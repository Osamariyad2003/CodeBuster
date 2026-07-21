"""
AI Agent dimension analyzer.

This is the "Senior Engineer" pass — it reads source code directly and asks an
LLM to think dynamically about logical errors, edge cases, race conditions,
and architectural flaws. It complements the deterministic analyzers (which
look for known patterns via regex/AST) by catching the class of bugs that
static tools cannot see.

Key design points:

  * Inherits from BaseDimensionAnalyzer so it slots into the existing review
    pipeline alongside SecurityDimensionAnalyzer / CodeQualityDimensionAnalyzer.
  * Reuses AIReviewService for provider auth + transport (Vertex / Gemini /
    Anthropic / OpenAI) — no duplicate API client code.
  * Anti-redundancy: the prompt explicitly tells the model NOT to flag
    syntax issues, missing docstrings, or things a linter already catches.
  * File budget: caps the prompt at ~12 files and ~50k chars total to keep
    token usage predictable. Vendored / generated files are filtered out.
  * Graceful degradation: if AI is unavailable or returns malformed JSON,
    the analyzer returns a clean "skipped" result with no false findings.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from .ai_review_service import AIReviewService
from .dimension_analyzer_base import BaseDimensionAnalyzer
from .dimension_analyzer_schema import (
    AnalyzerInfo,
    CategoryResult,
    DimensionAnalyzerResult,
    DimensionIssue,
    Signal,
)

# Reuse the same Redis client Celery already uses; cache the AI agent's
# verdict per slice-of-source-code so re-scans on unchanged files don't
# re-spend LLM tokens. 7-day TTL — long enough to hit on typical re-scan
# cadences, short enough that prompt changes percolate without manual flush.
try:
    from app.redis_client import get_redis as _get_redis
except Exception:
    _get_redis = None

_CACHE_PREFIX = 'codebuster:ai:agent:v1:'
_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60


# ── File selection -----------------------------------------------------------

# Source-code extensions worth reasoning about. Extend as needed.
_SOURCE_EXTS = {
    '.py', '.pyw',
    '.js', '.jsx', '.mjs', '.cjs',
    '.ts', '.tsx',
    '.go', '.rs', '.java', '.kt', '.scala',
    '.rb', '.php', '.cs', '.swift',
    '.c', '.cc', '.cpp', '.h', '.hpp',
}

# Path fragments that almost always indicate generated / vendored code we
# don't want the LLM to read. Anchored as substrings of the *normalized*
# (forward-slash) path so we don't have to worry about Windows separators.
_BLOCKED_DIR_NAMES = {
    'node_modules', 'dist', 'build', 'out', 'vendor',
    '__pycache__', 'venv', '.venv', 'site-packages',
    'windows', 'ephemeral', 'coverage', 'target', 'netlify',
}

_BLOCKED_FILE_SUFFIXES = ('.min.js', '.bundle.js', '.map', '.lock', '.snap')

def _is_hidden_dir(path: str) -> bool:
    """Return True if any directory segment in the path is blocklisted or starts with a dot."""
    parts = path.replace('\\', '/').split('/')
    for d in parts[:-1]:
        if d in _BLOCKED_DIR_NAMES or d.startswith('.'):
            return True
    return False


# ── Prompt construction -------------------------------------------------------

_SYSTEM_INSTRUCTION = """You are a Staff Software Engineer doing a deep code review.

Your job is to find LOGIC BUGS that automated linters and static analyzers cannot
see. Specifically focus on:

  - Race conditions, TOCTOU issues, missing locks, async/await mistakes
  - Business-logic errors (calculation order, off-by-one, wrong assumptions about
    domain rules, state machine transitions that drop or double-process events)
  - Missing edge cases: nulls, empty collections, zero / negative numbers,
    timezone boundaries, character encoding, very large / very small inputs
  - Resource leaks: unclosed handles, unbounded queues, retry storms, n+1 queries
  - Architectural flaws visible in this slice: tight coupling, broken abstraction
    boundaries, dependencies pointing the wrong way, missing transactional scope
  - Security issues that depend on application semantics (authz checks at the
    wrong layer, data leak via logging, time-based info disclosure, etc.)

DO NOT report:
  - Missing docstrings, comments, or formatting
  - Style issues (linter territory)
  - Pure refactoring suggestions ("you could rename this")
  - Generic best-practice nags ("consider adding tests"). If you flag a bug,
    explain *why it is a bug* concretely, with the specific input that breaks it.

Confidence: only return findings you are at least ~70% sure are real bugs.
A handful of high-confidence, concrete findings is far more valuable than a long
list of guesses.
"""

_RESPONSE_FORMAT = """Return ONLY valid JSON in this exact shape — no markdown
fences, no commentary, no extra fields:

{
  "category_score": <integer 0-100, your overall verdict on the slice>,
  "rationale": "<1 sentence summarizing the slice's health>",
  "findings": [
    {
      "title": "<short imperative — e.g. 'Race condition on reservation upsert'>",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "confidence": <float 0.0-1.0>,
      "file_path": "<the path you read this from>",
      "evidence": [
        "<short literal code excerpt or line reference that demonstrates the bug>"
      ],
      "impact": "<concrete consequence: what breaks, who it affects, when>",
      "recommendation": "<concrete actionable fix — code patterns or refactor steps>",
      "effort": "S" | "M" | "L",
      "tags": ["<freeform tags like 'race-condition', 'edge-case', 'business-logic'>"]
    }
  ]
}

If you find no real bugs, return an empty findings array and a category_score
≥ 85 with a brief rationale.
"""


def _is_source_file(path: str) -> bool:
    """Source-code file we want the LLM to read?"""
    if not path:
        return False
    norm = path.replace('\\', '/').lower()
    if any(norm.endswith(s) for s in _BLOCKED_FILE_SUFFIXES):
        return False
    if _is_hidden_dir(path):
        return False
    _, ext = os.path.splitext(norm)
    return ext in _SOURCE_EXTS


def _select_files_for_review(
    files: List[Dict[str, Any]],
    max_files: int = 12,
    max_chars_total: int = 50_000,
    max_chars_per_file: int = 8_000,
) -> List[Dict[str, Any]]:
    """
    Pick a representative slice of files for the LLM. Sorted by size desc
    (bigger files tend to carry more logic) but capped per-file so a single
    huge file can't crowd everyone else out.
    """
    candidates = []
    for f in files:
        path = (f.get('path') or '').strip()
        content = f.get('content') or ''
        if not _is_source_file(path) or not content:
            continue
        candidates.append((path, content))

    # Largest-first; the LLM tends to find more in dense files.
    candidates.sort(key=lambda x: len(x[1]), reverse=True)

    selected: List[Dict[str, Any]] = []
    used_chars = 0
    for path, content in candidates:
        if len(selected) >= max_files:
            break
        truncated = content[:max_chars_per_file]
        if used_chars + len(truncated) > max_chars_total:
            # Only take partial budget if we still have room
            remaining = max_chars_total - used_chars
            if remaining < 1_000:
                break
            truncated = truncated[:remaining]
        selected.append({'path': path, 'content': truncated})
        used_chars += len(truncated)
    return selected


def _build_prompt(files: List[Dict[str, Any]], repo_full_name: str) -> str:
    """Assemble the user message for the LLM."""
    header = (
        f"Repository: {repo_full_name}\n"
        f"Files in this slice: {len(files)}\n\n"
    )
    body_parts = [header]
    for f in files:
        body_parts.append(f"\n----- FILE: {f['path']} -----\n")
        body_parts.append(f['content'])
        body_parts.append("\n----- END FILE -----\n")
    body_parts.append(
        "\n\nNow analyze the slice above and report only deep, dynamic bugs.\n"
    )
    body_parts.append(_RESPONSE_FORMAT)
    return _SYSTEM_INSTRUCTION + "\n\n" + "".join(body_parts)


# ── Output parsing ------------------------------------------------------------

def _strip_json_fences(text: str) -> str:
    """Some providers wrap JSON in ```json ... ``` despite instructions."""
    raw = (text or '').strip()
    if not raw.startswith('```'):
        return raw
    # Drop opening fence (and optional language tag)
    raw = raw.split('\n', 1)[-1] if '\n' in raw else raw[3:]
    if raw.rstrip().endswith('```'):
        raw = raw.rstrip()[:-3].rstrip()
    if raw.lower().startswith('json'):
        raw = raw[4:].lstrip()
    return raw


_VALID_SEVERITIES = {'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'}
_VALID_EFFORTS = {'S', 'M', 'L'}


def _normalize_finding(raw: Dict[str, Any], idx: int) -> Optional[DimensionIssue]:
    """Convert a single LLM-reported finding into a DimensionIssue. None if invalid."""
    try:
        title = (raw.get('title') or '').strip()
        if not title:
            return None
        severity = (raw.get('severity') or 'MEDIUM').upper().strip()
        if severity not in _VALID_SEVERITIES:
            severity = 'MEDIUM'

        # Confidence floor at 0.5 — anything lower we suspect is a guess and
        # we don't want it to dilute the signal of real findings.
        try:
            confidence = float(raw.get('confidence', 0.7))
        except (TypeError, ValueError):
            confidence = 0.7
        confidence = max(0.5, min(1.0, confidence))

        file_path = (raw.get('file_path') or '').strip()
        evidence_in = raw.get('evidence') or []
        evidence = [str(e) for e in evidence_in if str(e).strip()][:5]

        effort = (raw.get('effort') or 'M').upper().strip()
        if effort not in _VALID_EFFORTS:
            effort = 'M'

        tags_in = raw.get('tags') or []
        tags = [str(t).strip() for t in tags_in if str(t).strip()][:6]

        return DimensionIssue(
            id=f"ai-agent-{idx + 1:03d}-{uuid.uuid4().hex[:6]}",
            title=title[:200],
            severity=severity,  # type: ignore[arg-type]
            category_key='ai',
            confidence=confidence,
            file_paths=[file_path] if file_path else [],
            evidence=evidence,
            impact=(raw.get('impact') or '').strip()[:1000],
            recommendation=(raw.get('recommendation') or '').strip()[:1000],
            effort=effort,  # type: ignore[arg-type]
            tags=tags,
        )
    except Exception:
        return None


def _score_from_findings(findings: List[DimensionIssue], default: int) -> int:
    """
    If the model returns a category_score we trust, use it. Otherwise derive
    a saturating-curve score from finding severities — same pattern as the
    rest of the scoring system so the AI dimension reads consistently with
    the deterministic dimensions.
    """
    weights = {'CRITICAL': 8.0, 'HIGH': 3.5, 'MEDIUM': 1.0, 'LOW': 0.4}
    weighted = sum(weights.get(f.severity, 1.0) * max(0.5, min(1.0, f.confidence)) for f in findings)
    if weighted <= 0:
        return max(default, 95)
    raw = 100.0 * 40.0 / (40.0 + weighted)
    derived = max(5, min(100, int(round(raw))))
    # Trust the model's score only if it's plausible (within 15 pts of derived)
    if 0 <= default <= 100 and abs(default - derived) <= 15:
        return default
    return derived


# ── Cross-review cache --------------------------------------------------------


def _slice_cache_key(
    repo_full_name: str,
    slice_files: List[Dict[str, Any]],
    provider: str,
) -> str:
    """
    Build a stable cache key for a (repo, code-slice, provider) tuple.

    We hash the file paths AND content so that:
      - Same code on re-scan → cache hit, zero tokens spent
      - One file edited → cache miss → fresh LLM run
      - Provider switched (e.g. gemini → anthropic) → cache miss (different
        models surface different bugs, mixing their cached output would lie)
    """
    h = hashlib.sha256()
    h.update(repo_full_name.encode('utf-8', errors='ignore'))
    h.update(b'|')
    h.update(provider.encode('utf-8', errors='ignore'))
    h.update(b'|')
    # Sort to ensure stable order regardless of how the orchestrator handed us
    # the file list.
    for f in sorted(slice_files, key=lambda x: x.get('path') or ''):
        path = (f.get('path') or '').encode('utf-8', errors='ignore')
        content = (f.get('content') or '').encode('utf-8', errors='ignore')
        h.update(path)
        h.update(b':')
        h.update(hashlib.sha256(content).digest())
        h.update(b'|')
    return _CACHE_PREFIX + h.hexdigest()[:32]


def _read_cache(key: str) -> Optional[Dict[str, Any]]:
    if _get_redis is None:
        return None
    try:
        r = _get_redis()
        raw = r.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


def _write_cache(key: str, payload: Dict[str, Any]) -> None:
    if _get_redis is None:
        return
    try:
        r = _get_redis()
        r.setex(key, _CACHE_TTL_SECONDS, json.dumps(payload, default=str))
    except Exception:
        # Cache writes are best-effort — never break a review.
        pass


# ── The analyzer --------------------------------------------------------------


class AIAgentDimensionAnalyzer(BaseDimensionAnalyzer):
    """
    The dynamic-thinking pass. Reads source files and asks the LLM for the
    class of bugs static tools cannot detect.
    """

    ANALYZER_KEY = 'ai'
    ANALYZER_LABEL = 'AI Agent (Senior Engineer)'
    VERSION = '1.0'

    def __init__(self, ai_service: Optional[AIReviewService] = None):
        # Reuse AIReviewService so we get provider abstraction + retry/cache
        # for free. If no provider is configured the analyzer no-ops.
        self._ai = ai_service or AIReviewService()

    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        target = self._target_from_metadata(repo_metadata)
        analyzer_info = AnalyzerInfo(
            key=self.ANALYZER_KEY, label=self.ANALYZER_LABEL, version=self.VERSION
        )

        # Provider unavailable → return a clean "not applicable" result. We
        # don't want to invent fake findings, and we don't want a missing key
        # to crash a review.
        if not self._ai.provider:
            return DimensionAnalyzerResult(
                analyzer=analyzer_info,
                target=target,
                category_result=CategoryResult(
                    score=0,
                    not_applicable=True,
                    rationale='AI provider not configured — set GEMINI_API_KEY (or VERTEX/ANTHROPIC/OPENAI) to enable.',
                ),
                issues=[],
                signals=[
                    Signal(key='files_in_repo', label='Files in repo', value=len(files), unit='count'),
                    Signal(key='ai_skipped', label='AI skipped', value=1, unit='bool'),
                ],
            )

        # Pick a tractable slice of source code for the LLM.
        slice_files = _select_files_for_review(files)
        if not slice_files:
            return DimensionAnalyzerResult(
                analyzer=analyzer_info,
                target=target,
                category_result=CategoryResult(
                    score=100,
                    not_applicable=True,
                    rationale='No source files found to review (only docs / generated content).',
                ),
                issues=[],
                signals=[
                    Signal(key='files_in_repo', label='Files in repo', value=len(files), unit='count'),
                    Signal(key='files_reviewed', label='Files sent to AI', value=0, unit='count'),
                ],
            )

        # Cross-review cache: identical (repo, slice, provider) → reuse prior
        # verdict, no LLM call. Big win on re-scans of unchanged code.
        cache_key = _slice_cache_key(target.repo_full_name, slice_files, self._ai.provider)
        cached_payload = _read_cache(cache_key)
        cache_hit = False
        parsed: Dict[str, Any] = {}
        error: Optional[str] = None

        if cached_payload:
            parsed = cached_payload
            cache_hit = True
        else:
            # Send to LLM
            prompt = _build_prompt(slice_files, target.repo_full_name)
            try:
                response = self._call_provider(prompt)
                content = response['choices'][0]['message']['content']
                parsed = json.loads(_strip_json_fences(content))
                # Cache the parsed payload (not raw text) so cache hits skip
                # the JSON parse step too.
                if isinstance(parsed, dict):
                    _write_cache(cache_key, parsed)
            except Exception as e:
                error = str(e)
                parsed = {}

        if error or not isinstance(parsed, dict):
            # Fail soft. Score 0 with `not_applicable=True` is the schema's
            # way of saying "we couldn't run this dimension" — it doesn't
            # punish the overall health score.
            return DimensionAnalyzerResult(
                analyzer=analyzer_info,
                target=target,
                category_result=CategoryResult(
                    score=0,
                    not_applicable=True,
                    rationale=f'AI agent run failed: {error or "invalid response"}',
                ),
                issues=[],
                signals=[
                    Signal(key='files_reviewed', label='Files sent to AI', value=len(slice_files), unit='count'),
                    Signal(key='ai_error', label='AI error', value=1, unit='bool'),
                ],
            )

        # Convert findings → DimensionIssue list
        raw_findings = parsed.get('findings') or []
        issues: List[DimensionIssue] = []
        for idx, raw in enumerate(raw_findings):
            if not isinstance(raw, dict):
                continue
            issue = _normalize_finding(raw, idx)
            if issue:
                issues.append(issue)

        # Score: blend model verdict with severity-based derivation
        try:
            model_score = int(parsed.get('category_score', 0))
        except (TypeError, ValueError):
            model_score = 0
        score = _score_from_findings(issues, model_score)
        rationale = (parsed.get('rationale') or '').strip() or (
            f'AI agent reviewed {len(slice_files)} file(s) and reported '
            f'{len(issues)} finding(s).'
        )
        if cache_hit:
            rationale = f'{rationale} (cached — code unchanged since prior review)'

        # Signals
        critical = sum(1 for i in issues if i.severity == 'CRITICAL')
        high = sum(1 for i in issues if i.severity == 'HIGH')
        signals = [
            Signal(key='files_in_repo', label='Files in repo', value=len(files), unit='count'),
            Signal(key='files_reviewed', label='Files sent to AI', value=len(slice_files), unit='count'),
            Signal(key='ai_findings', label='Issues from AI', value=len(issues), unit='count'),
            Signal(key='ai_critical', label='Critical (AI)', value=critical, unit='count'),
            Signal(key='ai_high', label='High (AI)', value=high, unit='count'),
            # Boolean signal so the orchestrator / UI can tell whether the
            # agent actually called the LLM this run or reused a prior verdict.
            Signal(key='ai_cache_hit', label='From cache', value=1 if cache_hit else 0, unit='bool'),
        ]

        return DimensionAnalyzerResult(
            analyzer=analyzer_info,
            target=target,
            category_result=CategoryResult(
                score=int(score),
                not_applicable=False,
                rationale=rationale[:500],
            ),
            issues=issues,
            signals=signals,
        )

    # ── Provider plumbing ---------------------------------------------------

    def _call_provider(self, prompt: str) -> Dict[str, Any]:
        """
        Dispatch the prompt through AIReviewService._dispatch so the agent
        automatically picks up any new provider added there (vertex, gemini,
        anthropic, openrouter, groq, openai) without local changes.
        """
        return self._ai._dispatch(prompt)
