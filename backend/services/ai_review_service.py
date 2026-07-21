"""AI review service using Vertex AI, Gemini, Anthropic, or OpenAI for issue prioritization and explanation."""
import os
import re
import json
import time
import random
import hashlib
import threading
import requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# Redis is the same broker Celery is already using; reusing it for the AI
# enhancement cache costs us nothing extra.
try:
    from app.redis_client import get_redis as _get_redis
except Exception:
    _get_redis = None  # tests / standalone usage

# Cache key prefix + TTL. 7 days is enough that a re-scan within a typical
# release cycle hits the cache, while still letting prompt or model changes
# percolate without a manual flush.
_AI_CACHE_PREFIX = 'codebuster:ai:enhance:v1:'
_AI_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

# Gemini (consumer) API (Google AI Studio)
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# In-process AI health tracker, keyed by provider name. Updated on every
# real dispatch (success or failure) so the frontend can show *why* an
# enhancement failed (rate-limited, bad key, provider down) instead of a
# generic "check the worker logs" message. Deliberately in-memory rather
# than Redis-backed — the enhance/preview endpoints run inline in the Flask
# process that also serves /ai/health, so there's no cross-process gap to
# bridge, and it avoids adding a Redis dependency to a purely diagnostic path.
_HEALTH_LOCK = threading.Lock()
_PROVIDER_HEALTH: Dict[str, Dict[str, Any]] = {}


def _classify_ai_error(err: Exception) -> str:
    """Bucket an exception from a provider call into a health status reason."""
    resp = getattr(err, "response", None)
    status_code = getattr(resp, "status_code", None)
    text = str(err)
    if status_code == 429 or "429" in text or "Too Many Requests" in text or "RESOURCE_EXHAUSTED" in text:
        return "rate_limited"
    if status_code in (401, 403) or "401" in text or "403" in text or "invalid api key" in text.lower():
        return "auth_error"
    if status_code is not None and status_code >= 500:
        return "provider_down"
    if isinstance(err, requests.exceptions.ConnectionError) or isinstance(err, requests.exceptions.Timeout):
        return "network_error"
    return "unknown_error"


def _record_ai_success(provider: str, model: str) -> None:
    with _HEALTH_LOCK:
        _PROVIDER_HEALTH[provider] = {
            "provider": provider,
            "model": model,
            "status": "ok",
            "last_success_at": datetime.now(timezone.utc).isoformat(),
            "last_error_at": _PROVIDER_HEALTH.get(provider, {}).get("last_error_at"),
            "last_error_type": None,
            "last_error_message": None,
            "consecutive_failures": 0,
        }


def _record_ai_failure(provider: str, model: str, err: Exception) -> None:
    reason = _classify_ai_error(err)
    with _HEALTH_LOCK:
        prev = _PROVIDER_HEALTH.get(provider, {})
        _PROVIDER_HEALTH[provider] = {
            "provider": provider,
            "model": model,
            "status": reason,
            "last_success_at": prev.get("last_success_at"),
            "last_error_at": datetime.now(timezone.utc).isoformat(),
            "last_error_type": reason,
            "last_error_message": str(err)[:400],
            "consecutive_failures": prev.get("consecutive_failures", 0) + 1,
        }


def get_ai_health() -> Dict[str, Any]:
    """
    Snapshot of AI provider configuration + the last dispatch outcome per
    provider. Used by the /github/ai/health endpoint so the UI can show a
    real status (e.g. "Gemini: rate-limited, retry in ~40s") instead of a
    generic failure after the fact.
    """
    svc = AIReviewService()
    active_model = {
        "vertex": svc.vertex_model,
        "gemini": svc.gemini_model,
        "anthropic": svc.anthropic_model,
        "openrouter": svc.openrouter_model,
        "groq": svc.groq_model,
        "openai": svc.openai_model,
    }.get(svc.provider)

    with _HEALTH_LOCK:
        active_entry = dict(_PROVIDER_HEALTH.get(svc.provider, {})) if svc.provider else {}

    return {
        "active_provider": svc.provider,
        "active_model": active_model,
        "configured": bool(svc.provider),
        "status": active_entry.get("status") or ("unconfigured" if not svc.provider else "unknown"),
        "last_success_at": active_entry.get("last_success_at"),
        "last_error_at": active_entry.get("last_error_at"),
        "last_error_type": active_entry.get("last_error_type"),
        "last_error_message": active_entry.get("last_error_message"),
        "consecutive_failures": active_entry.get("consecutive_failures", 0),
        "providers": _PROVIDER_HEALTH,
    }


def _strip_json_fences(raw: str) -> str:
    """Strip markdown code fences (```json ... ```) from an AI response."""
    raw = raw.strip()
    if raw.startswith('```'):
        raw = raw.split('\n', 1)[-1] if '\n' in raw else raw[3:]
        if raw.rstrip().endswith('```'):
            raw = raw.rstrip()[:-3].rstrip()
        if raw.startswith('json'):
            raw = raw[4:].lstrip()
    return raw


def _get_vertex_access_token() -> Optional[str]:
    """Get Bearer token for Vertex AI. Uses ADC when google-auth is installed, else VERTEX_ACCESS_TOKEN."""
    token = os.getenv("VERTEX_ACCESS_TOKEN", "").strip()
    if token:
        return token
    try:
        import google.auth
        import google.auth.transport.requests
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        credentials.refresh(google.auth.transport.requests.Request())
        return credentials.token if credentials else None
    except Exception:
        return None


class AIReviewService:
    """
    Service for AI-powered review reasoning.

    Default provider priority (highest first):
        OpenAI (GPT-5.6) > Vertex AI > Gemini > Anthropic > OpenRouter > Groq

    OpenAI/GPT-5.6 is the primary engine — set AI_PROVIDER=<name> in the env
    to force a specific provider regardless of which keys are configured.
    Valid values: openai, vertex, gemini, anthropic, openrouter, groq.
    """

    def __init__(self):
        # Vertex AI (Google Cloud) – preferred for enterprise / AI Reviews
        self.vertex_project_id = os.getenv("VERTEX_PROJECT_ID", "").strip()
        self.vertex_location = os.getenv("VERTEX_LOCATION", "us-central1").strip()
        self.vertex_model = os.getenv("VERTEX_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
        # Gemini (consumer API)
        self.gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        # Anthropic
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        # OpenRouter — meta-router with access to most major models via one
        # OpenAI-compatible endpoint. Models look like "anthropic/claude-3.5-sonnet",
        # "openai/gpt-4o", "meta-llama/llama-3.1-405b-instruct", etc.
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        self.openrouter_api_url = os.getenv(
            "OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions"
        ).strip()
        self.openrouter_model = os.getenv(
            "OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"
        ).strip()
        # Groq — fastest LPU-backed inference, OpenAI-compatible. Limited
        # model catalog (Llama family, Mixtral) but very low latency.
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_api_url = os.getenv(
            "GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"
        ).strip()
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        # OpenAI
        self.openai_api_key = os.getenv("OPEN_AI_KEY") or os.getenv("OPENAI_API_KEY")
        self.openai_api_url = "https://api.openai.com/v1/chat/completions"
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-5.6")

        # Per-provider availability (a key/credential is configured)
        available = {
            "vertex": bool(self.vertex_project_id),
            "gemini": bool(self.gemini_api_key),
            "anthropic": bool(self.anthropic_api_key),
            "openrouter": bool(self.openrouter_api_key),
            "groq": bool(self.groq_api_key),
            "openai": bool(self.openai_api_key),
        }

        # Optional explicit override — pick the named provider if its key is
        # actually configured. Otherwise fall through to auto-detection so a
        # mistyped AI_PROVIDER doesn't accidentally disable AI entirely.
        forced = (os.getenv("AI_PROVIDER") or "").strip().lower()
        if forced and available.get(forced):
            self.provider = forced
        else:
            # Auto-detect: walk the priority order and pick the first
            # provider with a credential present.
            priority = ("openai", "vertex", "gemini", "anthropic", "openrouter", "groq")
            self.provider = next((p for p in priority if available[p]), None)
        
    def enhance_issue(self, issue: Dict, file_content: str, language: str) -> Dict:
        """
        Enhance an existing issue with snippet context, impact explanation, and a suggested fix.
        Strictly follows the user-provided prompt and JSON schema.
        """
        if not self.provider:
            return issue

        # Evidence/references/tool carry the analyzer's own findings — e.g. a
        # CVE ID + advisory summary for a dependency finding, the other
        # file:line locations for a duplicate-code finding, or a detector
        # name for a secret leak. Without these the LLM only sees a generic
        # title/description and re-derives from scratch what the analyzer
        # already knew precisely; with them it can ground the fix in facts
        # it can't get from the file alone (e.g. which CVE to cite, or where
        # the other copy of a duplicated block lives).
        evidence = issue.get('evidence') or []
        references = issue.get('references') or []
        tool = issue.get('tool') or 'unknown'
        evidence_block = '\n'.join(f"  - {e}" for e in evidence[:8]) or '  (none)'
        references_block = '\n'.join(f"  - {r}" for r in references[:5]) or '  (none)'

        prompt = f"""You are CodeBuster, an AI senior engineering reviewer.

You receive an existing issue report — including the analyzer's raw evidence
and references — plus the full file content.

Your task is to enhance the issue by:

1. Verifying the issue at the given line.
2. Extracting at least 25 lines before and 25 lines after the issue line (if available).
   Always include the entire enclosing function, class, or block so the reviewer
   can see the full context — go beyond 25 lines on either side when needed to
   capture the full block. Do not truncate mid-function.
3. Including the exact code snippet with line numbers.
4. Clearly highlighting the problematic line with a marker: <-- ISSUE
5. Improving the description and impact explanation — use the Evidence and
   References below as ground truth (e.g. cite the specific CVE ID, detector
   name, or duplicate-code location rather than inventing generic wording).
6. Suggesting a concrete fix that FITS THIS PROJECT, not a generic textbook
   fix:
   - Match the file's existing style: indentation, quote style, naming
     conventions, and how errors/logging are handled elsewhere in this file.
   - Reuse whatever framework, library, or helper this file already imports
     for the task at hand (e.g. if the file already uses a specific ORM,
     HTTP client, or validation library, fix with that — don't introduce a
     new dependency the file doesn't already use).
   - Keep the fix minimal and localized. Don't restructure unrelated code,
     rename things, or "clean up" beyond what fixing this issue requires.
   - If the full file content doesn't give enough signal to know the
     project's convention for something (e.g. how it structures API
     responses), keep the fix as close as possible to the surrounding code's
     existing shape rather than guessing a new pattern.

Return ONLY valid JSON.
Do not include explanations outside JSON.

Existing Issue:
{{
  "title": "{issue.get('title', 'Unknown')}",
  "category": "{issue.get('category', 'unknown')}",
  "severity": "{issue.get('severity', 'minor')}",
  "confidence": {issue.get('confidence', 0.5)},
  "file": "{issue.get('file', issue.get('file_path', 'unknown'))}",
  "line": {issue.get('line', issue.get('line_number', 0))},
  "description": "{issue.get('description', '')}",
  "tool": "{tool}"
}}

Evidence (from the analyzer that found this issue):
{evidence_block}

References:
{references_block}

Language: {language}

Full File Content:
------------------------
{file_content}
------------------------

Enhance this issue and return the improved version in this format:

{{
  "title": "",
  "category": "",
  "severity": "low | medium | major | high | critical",
  "confidence": 0-100,
  "file": "",
  "line": number,
  "description": "",
  "impact": "",
  "snippet": {{
    "start_line": number,
    "end_line": number,
    "code": "line_number | code\\nline_number | code\\n..."
  }},
  "recommendation": "",
  "suggested_fix": "corrected code only"
}}

Important:
- The snippet must include line numbers.
- Mark the problematic line with: <-- ISSUE
- Do not change the line number unless incorrect.
- Return valid JSON only.
"""
        try:
            response = self._dispatch(prompt)

            content = response['choices'][0]['message']['content']
            enhanced = json.loads(_strip_json_fences(content))
            
            # Map snippet to what ReviewOrchestrator and tasks.py expect
            if "snippet" in enhanced and isinstance(enhanced["snippet"], dict):
                enhanced["code_snippet"] = enhanced["snippet"].get("code", "")
            
            # Normalize suggested_fix so both `.code` and `.content` are
            # populated. Different downstream consumers read different keys
            # (FixService reads `.code`, the drawer's "Suggested Fix" panel
            # reads `.content`). Keeping both in sync makes either path work.
            if "suggested_fix" in enhanced:
                fix_val = enhanced["suggested_fix"]
                if isinstance(fix_val, str):
                    enhanced["suggested_fix"] = {"content": fix_val, "code": fix_val}
                elif isinstance(fix_val, dict):
                    code_text = fix_val.get("code") or fix_val.get("content")
                    if code_text:
                        merged = dict(fix_val)
                        merged["code"] = code_text
                        merged["content"] = code_text
                        enhanced["suggested_fix"] = merged

            # Combine impact and recommendation into ai_explanation for better visibility
            impact = enhanced.get("impact", "")
            rec = enhanced.get("recommendation", "")
            if impact or rec:
                enhanced["ai_explanation"] = f"**Impact:** {impact}\n\n**Recommendation:** {rec}"

            # Ensure we don't lose the original ID or other tracking fields
            for key in issue:
                if key not in enhanced:
                    enhanced[key] = issue[key]
            
            return enhanced
        except Exception as e:
            print(f"[WARN]️ Error enhancing issue: {e}")
            return issue

    def generate_fix_patch(self, issue: Dict, file_content: str, language: str) -> Dict:
        """
        Ask the model for a complete corrected version of the file (not a
        line-splice) plus a commit message and PR summary, so FixService can
        open a real PR straight from the AI's own patch instead of relying
        on the deterministic analyzer's canned `suggested_fix.code`.

        Returns {"new_content": str, "commit_message": str, "summary": str}
        or {} if generation failed / no provider configured.
        """
        if not self.provider:
            return {}

        prompt = f"""You are CodeBuster, an AI senior engineer generating a real, mergeable fix.

You will receive a flagged issue and the FULL content of the file it's in.
Produce a corrected version of the ENTIRE file that fixes the issue.

Rules:
- Return the complete file content, not a diff or a snippet.
- Make the smallest change that correctly fixes the issue. Do not reformat,
  rename, or restructure unrelated code.
- Match the file's existing style (indentation, quotes, imports already in use).
- Do not introduce new dependencies the file doesn't already use.
- If you cannot confidently produce a correct fix, return "new_content" equal
  to the original file content unchanged.

Issue:
{{
  "title": "{issue.get('title', 'Unknown')}",
  "category": "{issue.get('category', 'unknown')}",
  "severity": "{issue.get('severity', 'minor')}",
  "file": "{issue.get('file', issue.get('file_path', 'unknown'))}",
  "line": {issue.get('line', issue.get('line_number', 0))},
  "description": "{issue.get('description', '')}"
}}

Language: {language}

Full File Content:
------------------------
{file_content}
------------------------

Return ONLY valid JSON in this exact shape:
{{
  "new_content": "the full corrected file, as a single string",
  "commit_message": "short imperative commit subject (<72 chars)",
  "summary": "1-3 sentence explanation of what changed and why, for the PR description"
}}
"""
        try:
            response = self._dispatch(prompt)
            content = response['choices'][0]['message']['content']
            parsed = json.loads(_strip_json_fences(content))
            new_content = parsed.get('new_content')
            if not new_content or not isinstance(new_content, str):
                return {}
            return {
                'new_content': new_content,
                'commit_message': parsed.get('commit_message') or f"Fix: {issue.get('title', 'issue')}",
                'summary': parsed.get('summary') or '',
            }
        except Exception as e:
            print(f"[WARN]️ Error generating AI fix patch: {e}")
            return {}

    @staticmethod
    def _enhancement_cache_key(issue: Dict, file_content: str, language: str) -> str:
        """
        Build a stable cache key for an issue + its surrounding code.

        We include the file path, line, category, and a content-derived hash
        so that:
          - Same finding on re-scan with no code changes → cache hit
          - Code edited (even if line stayed the same) → cache miss → fresh AI
          - Different category at same location → cache miss
        """
        # ~400 chars around the issue line is enough to detect "did the code change?"
        # without bloating cache keys with megabytes of file content.
        line_no = issue.get('line') or issue.get('line_number') or 0
        try:
            lines = file_content.split('\n')
            start = max(0, int(line_no) - 5)
            end = min(len(lines), int(line_no) + 5)
            window = '\n'.join(lines[start:end])
        except Exception:
            window = (file_content or '')[:400]
        digest_input = (
            f"{issue.get('file') or issue.get('file_path') or ''}|"
            f"{line_no}|"
            f"{(issue.get('category') or '').lower()}|"
            f"{(issue.get('severity') or '').lower()}|"
            f"{language}|"
            f"{window}"
        )
        digest = hashlib.sha256(digest_input.encode('utf-8', errors='ignore')).hexdigest()[:32]
        return _AI_CACHE_PREFIX + digest

    @staticmethod
    def _read_enhancement_cache(key: str) -> Optional[Dict]:
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

    @staticmethod
    def _write_enhancement_cache(key: str, payload: Dict) -> None:
        if _get_redis is None:
            return
        try:
            r = _get_redis()
            r.setex(key, _AI_CACHE_TTL_SECONDS, json.dumps(payload, default=str))
        except Exception:
            # Cache writes are best-effort — never break a review.
            pass

    def enhance_issue_with_retry(
        self,
        issue: Dict,
        file_content: str,
        language: str,
        max_attempts: int = 3,
    ) -> Dict:
        """
        Wrap enhance_issue with retry + exponential backoff for transient
        provider failures (rate limits, 5xx, connection resets), AND a
        Redis cache so a repeat review on unchanged code skips the AI call.

        Returns the original issue unchanged if all attempts fail — never raises.
        """
        if not self.provider:
            return issue

        # 1) Cache check — same finding + same surrounding code = reuse prior AI output.
        cache_key = self._enhancement_cache_key(issue, file_content, language)
        cached = self._read_enhancement_cache(cache_key)
        if cached:
            # Mark hit so the orchestrator can count it in ai_stats.
            cached['_ai_cache_hit'] = True
            # Carry over original tracking fields the caller may rely on.
            for key in issue:
                cached.setdefault(key, issue[key])
            return cached

        # 2) Cache miss — call the provider with retries.
        last_err = None
        for attempt in range(1, max_attempts + 1):
            try:
                enhanced = self.enhance_issue(issue, file_content, language)
                # enhance_issue silently returns the raw issue on failure;
                # detect that case so we actually retry rather than declare success.
                if enhanced is issue or not enhanced.get('ai_explanation'):
                    raise RuntimeError('enhancement produced no AI fields')
                # 3) Cache the successful enhancement (best-effort).
                self._write_enhancement_cache(cache_key, enhanced)
                return enhanced
            except Exception as e:
                last_err = e
                if attempt >= max_attempts:
                    break
                is_rate_limit = "429" in str(e) or "Too Many Requests" in str(e)
                if is_rate_limit:
                    # Groq rate limits reset within ~30s; wait longer before retrying
                    delay = 30 + random.uniform(0, 10)
                else:
                    # Exponential backoff: 0.6s, 1.5s, 3.5s with jitter
                    delay = (0.6 * (2 ** (attempt - 1))) + random.uniform(0, 0.5)
                time.sleep(delay)
        if last_err:
            print(f"[WARN]️ enhance_issue gave up after {max_attempts} attempts: {last_err}")
        return issue

    def generate_executive_summary(
        self,
        findings: List[Dict[str, Any]],
        category_scores: Dict[str, int],
        overall_score: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a narrative repo-level summary of the review.

        Returns a dict with:
          - executive_summary: 2-3 sentence overview of the codebase health
          - top_risks_narrative: list of {title, why_it_matters} for the worst items
          - fix_priority_order: ordered list of {issue_index, rationale} explaining why
                                this finding should be addressed before the next one
          - production_readiness: yes | with_caveats | no, with one-sentence rationale

        Returns None if AI is unavailable. The caller should treat None as
        "fall back to deterministic summary" and not block the review.
        """
        if not self.provider or not findings:
            return None

        # Cap context: send the top 20 issues + the score breakdown so the
        # prompt stays under 8k tokens even for large reviews.
        top_findings = findings[:20]
        compact_findings = [
            {
                'index': i,
                'severity': f.get('severity'),
                'category': f.get('category') or f.get('module'),
                'title': f.get('title') or f.get('message'),
                'file': f.get('file') or f.get('file_path'),
                'line': f.get('line') or f.get('line_number'),
                'description': (f.get('description') or '')[:400],
            }
            for i, f in enumerate(top_findings)
        ]

        prompt = f"""You are CodeBuster, an AI senior engineering reviewer.
You receive scoring + the top findings from an automated review.

Produce a narrative executive summary aimed at the repository owner. Be concrete
about what was found — never generic platitudes like "consider improving security".
Cite specific findings by their index when explaining priorities.

Scoring snapshot:
  overall_score: {overall_score}/100
  category_scores: {json.dumps(category_scores)}

Top findings (compact):
{json.dumps(compact_findings, indent=2)}

Return ONLY valid JSON in this shape — no markdown fences, no commentary:

{{
  "executive_summary": "2-3 sentences. Mention the overall posture and the single biggest concern.",
  "top_risks_narrative": [
    {{ "title": "<short label>", "why_it_matters": "<1-2 sentences, concrete>" }}
  ],
  "fix_priority_order": [
    {{ "issue_index": <int from the list above>,
       "rationale": "<why this one before the rest>" }}
  ],
  "production_readiness": "yes" | "with_caveats" | "no",
  "production_readiness_rationale": "<1 sentence>"
}}

Constraints:
- top_risks_narrative: at most 3 items
- fix_priority_order: at most 5 items, ordered by what to fix first
- Use the same severity/category vocabulary as the input
"""
        try:
            response = self._dispatch(prompt)

            content = response['choices'][0]['message']['content']
            return json.loads(_strip_json_fences(content))
        except Exception as e:
            print(f"[WARN]️ generate_executive_summary failed: {e}")
            return None

    def summarize_fix_sprint(
        self,
        applied: List[Dict[str, Any]],
        skipped: List[Dict[str, Any]],
        repo_full_name: str,
    ) -> Optional[str]:
        """
        Write the PR body for a "Fix Sprint" — a single PR batching fixes for
        several issues at once. Returns markdown text, or None if AI is
        unavailable (caller falls back to a template).
        """
        if not self.provider or not applied:
            return None

        compact_applied = [
            {'title': a.get('title'), 'file': a.get('file_path'), 'severity': a.get('severity')}
            for a in applied[:20]
        ]
        compact_skipped = [
            {'title': s.get('title'), 'file': s.get('file_path'), 'reason': s.get('reason')}
            for s in skipped[:10]
        ]

        prompt = f"""You are CodeBuster, an AI senior engineering reviewer, writing a pull
request description for a batch of automated fixes ("Fix Sprint") against {repo_full_name}.

Fixes applied in this PR:
{json.dumps(compact_applied, indent=2)}

Issues considered but NOT fixed automatically (be honest about these — don't
hide or minimize them):
{json.dumps(compact_skipped, indent=2)}

Write a concise, professional PR description in Markdown:
- Open with 1-2 sentences summarizing what this sprint fixed and why it matters.
- A bullet list of what changed, grouped sensibly (e.g. by severity or file)
  — don't just restate the JSON, synthesize it into readable prose per bullet.
- If there are skipped issues, a short "Not included" section explaining why
  (e.g. no safe automatic fix was available) so the reviewer knows what's
  still open.
- End with a one-line reminder to review the diff before merging.
Return ONLY the markdown body text — no JSON, no code fences around the whole thing.
"""
        try:
            response = self._dispatch(prompt)
            content = response['choices'][0]['message']['content']
            return content.strip()
        except Exception as e:
            print(f"[WARN]️ summarize_fix_sprint failed: {e}")
            return None

    def generate_review(self, findings: List[Dict[str, Any]], repository_context: Dict = None, diff_context: str = "") -> Dict[str, Any]:
        """
        Generate CodeBuster AI review from findings and PR context.
        Uses Gemini 3 when GEMINI_API_KEY is set, otherwise OpenAI, else rule-based fallback.
        """
        if not self.provider:
            return self._rule_based_review(findings, strategy="rule-based (no API key)")
        
        try:
            # 1. Enrich context (RAG)
            enriched_context = self._get_enriched_context(repository_context, findings)
            
            # 2. Prepare prompt with all PR metadata
            prompt = self._build_prompt(findings, repository_context, enriched_context, diff_context)
            
            # 3. Call AI (one of: vertex, gemini, anthropic, openrouter, groq, openai)
            model_label = {
                "vertex": f"Vertex AI ({self.vertex_model})",
                "gemini": f"Gemini ({self.gemini_model})",
                "anthropic": f"Anthropic Claude ({self.anthropic_model})",
                "openrouter": f"OpenRouter ({self.openrouter_model})",
                "groq": f"Groq ({self.groq_model})",
                "openai": f"OpenAI ({self.openai_model})",
            }.get(self.provider, self.provider or "unknown")
            print(f"[AI] CodeBuster: Using {model_label} for review reasoning.")
            response = self._dispatch(prompt)

            # 4. Parse (same shape: choices[0].message.content)
            return self._parse_response(response, findings)
            
        except Exception as e:
            print(f"[Error] CodeBuster Reasoning Failed: {e}")
            return self._rule_based_review(findings, strategy="rule-based (fallback)")
    
    def _build_prompt(self, findings: List[Dict], repository_context: Dict = None, enriched_context: str = "", diff_context: str = "") -> str:
        """Build prompt for CodeBuster PR Review."""
        findings_text = self._format_findings(findings)
        repo_ctx = repository_context or {}
        
        prompt = f"""You are **CodeBuster**, an AI code review reasoner that sits on top of static analyzers.
Your job is to turn analyzer findings + retrieved repository context into high-signal, actionable pull request feedback.

# Core Rules
1. **Be evidence-grounded**: Every claim MUST be supported by (a) analyzer output or (b) retrieved context.
2. **Handle missing evidence**: If evidence is missing for a serious claim, say “Insufficient evidence” and ask for the minimal missing artifact.
3. **Handle Retrieved Context (RAG)**: 
   - Treat retrieved snippets as **authoritative** for repo-specific conventions.
   - Cite the exact **Snippet IDs** in your `evidence_refs` field.
4. **Reduce noise**: Suppress duplicates, low-impact style nits, and findings contradicted by repo conventions.
5. **High-Signal Titles**: NEVER use generic titles like "Magic Number", "Too Complex", or "Lint Error".
   - **Bad**: "Magic Number Detected"
   - **Good**: "Hardcoded API Timeout (5000ms) in auth.py"
   - **Bad**: "Function too complex"
   - **Good**: "Auth flow has 25+ branches; risk of bypass"
6. **Prioritize by impact**: Security > Correctness > Reliability > Performance > Maintainability > Style.
7. **Be repo-aware**: Follow team conventions found in retrieved context.
8. **Hallucination Guard**: NEVER invent files, functions, line numbers, or configs.

# PR Metadata
- Repo: {repo_ctx.get('full_name', 'unknown')}
- PR Title: {repo_ctx.get('pr_title', 'unknown')}
- PR Description: {repo_ctx.get('pr_description', 'unknown')}
- Branch: {repo_ctx.get('branch', 'unknown')}
- Languages: {repo_ctx.get('languages', 'unknown')}
- Changed Files: {repo_ctx.get('changed_files', [])}

# Diff Context
{diff_context[:2000] if diff_context else "No diff provided."}

# Analyzer Findings (Normalized)
{findings_text}

# Retrieved Repository Context (RAG)
{enriched_context}

# Tasks
1) Deduplicate and merge related findings across tools into single issues.
2) For each issue:
   - Explain why it matters in THIS repo context.
   - Propose a safe fix/mitigation aligned with repo conventions: reuse the
     libraries/frameworks/helpers this repo already uses for the task (per
     the retrieved context and changed files) rather than introducing a new
     dependency, match existing naming/error-handling patterns, and keep the
     fix minimal — don't restructure unrelated code.
   - Assign severity (critical|major|minor|info) and confidence (0-1).
   - Include evidence refs: [Finding IDs, RAG snippet IDs].
3) Produce summary sections: overall_health_score, category_scores, quick_wins, top_risks.

# Output Schema (JSON)
{{
  "overall_health_score": 0-100,
  "category_scores": {{
    "security": 0-100,
    "code_quality": 0-100,
    "performance": 0-100,
    "maintainability": 0-100,
    "devops": 0-100,
    "frontend": 0-100
  }},
  "prioritized_issues": [
    {{
      "id": "cb-001",
      "severity": "critical|major|minor|info",
      "title": "Title",
      "description": "Expl",
      "file": "path/file.py",
      "line": 42,
      "confidence": 0.95,
      "evidence": {{
        "analyzer_finding_ids": ["Tool:ID"],
        "rag_snippet_ids": ["Context:SnippetID"]
      }},
      "suggested_fix": {{
        "type": "patch|steps|config",
        "content": "string or code"
      }},
      "inline_comment": "Concise PR comment text or null"
    }}
  ],
  "quick_wins": ["cb-001"],
  "top_risks": ["cb-001"]
}}
"""
        return prompt
    
    def _format_findings(self, findings: List[Dict]) -> str:
        """Format findings for prompt, prioritizing CodeQL findings."""
        # Separate CodeQL findings from others
        codeql_findings = [f for f in findings if f.get('tool', '').lower() == 'codeql']
        other_findings = [f for f in findings if f.get('tool', '').lower() != 'codeql']
        
        formatted = []
        
        # Format CodeQL findings first (with priority marker)
        if codeql_findings:
            formatted.append("\n=== CODEQL FINDINGS (HIGH PRIORITY - Deep Security Analysis) ===")
            for i, finding in enumerate(codeql_findings, 1):
                formatted.append(f"""
CodeQL Finding {i} [HIGH PRIORITY]:
- Module: {finding.get('module', 'security')}
- Severity: {finding.get('severity', 'unknown')}
- Category: {finding.get('category', 'codeql_vulnerability')}
- Title: {finding.get('title', 'Unknown')}
- File: {finding.get('file', finding.get('file_path', 'unknown'))}
- Line: {finding.get('line', finding.get('line_number', 'unknown'))}
- Code: {finding.get('code_snippet', 'N/A')}
- Tool: CodeQL (GitHub Advanced Security)
- Evidence: {', '.join(finding.get('evidence', []))}
- Description: {finding.get('description', 'N/A')}
""")
        
        # Format other findings
        if other_findings:
            formatted.append("\n=== OTHER STATIC ANALYSIS FINDINGS ===")
            for i, finding in enumerate(other_findings, 1):
                formatted.append(f"""
Finding {i}:
- Module: {finding.get('module', 'unknown')}
- Severity: {finding.get('severity', 'unknown')}
- Category: {finding.get('category', 'unknown')}
- Title: {finding.get('title', 'Unknown')}
- File: {finding.get('file', finding.get('file_path', 'unknown'))}
- Line: {finding.get('line', finding.get('line_number', 'unknown'))}
- Code: {finding.get('code_snippet', 'N/A')}
- Tool: {finding.get('tool', 'unknown')}
- Evidence: {', '.join(finding.get('evidence', []))}
""")
        
        return '\n'.join(formatted)
    
    def _call_gemini(self, prompt: str) -> Dict:
        """Call Google Gemini API (Gemini 2.0 / 3.x). Returns same shape as OpenAI for _parse_response."""
        # Model from env: e.g. gemini-2.0-flash, gemini-3-flash-preview, gemini-1.5-pro
        model = (self.gemini_model or "gemini-2.0-flash").strip()
        url = f"{GEMINI_BASE_URL}/{model}:generateContent"
        headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': self.gemini_api_key,
        }
        # API expects camelCase: systemInstruction (not system_instruction)
        payload = {
            'systemInstruction': {
                'parts': [{'text': 'You are an expert code reviewer. Always respond with valid JSON only, no markdown.'}]
            },
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            }
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=90)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            err_body = ""
            if hasattr(e, 'response') and e.response is not None and e.response.text:
                err_body = e.response.text[:500]
            print(f"Gemini API request failed: {e} {err_body}")
            raise
        text = ""
        try:
            cands = data.get('candidates') or []
            if cands:
                c0 = cands[0]
                if c0.get('content', {}).get('parts'):
                    text = c0['content']['parts'][0].get('text', '') or ''
                if c0.get('finishReason') and c0['finishReason'] != 'STOP' and not text:
                    print(f"Gemini finishReason: {c0.get('finishReason')}")
        except (IndexError, KeyError, TypeError):
            pass
        if not text and data.get('promptFeedback'):
            print(f"Gemini promptFeedback: {data.get('promptFeedback')}")
        # Normalize to same shape as OpenAI so _parse_response works
        return {"choices": [{"message": {"content": text or "{}"}}]}

    def _call_vertex(self, prompt: str) -> Dict:
        """Call Google Cloud Vertex AI (Gemini). Uses ADC or VERTEX_ACCESS_TOKEN. Same response shape as Gemini."""
        token = _get_vertex_access_token()
        if not token:
            raise RuntimeError("Vertex AI: no access token (set GOOGLE_APPLICATION_CREDENTIALS or VERTEX_ACCESS_TOKEN)")
        model = (self.vertex_model or "gemini-2.0-flash").strip()
        url = (
            f"https://{self.vertex_location}-aiplatform.googleapis.com/v1/projects/"
            f"{self.vertex_project_id}/locations/{self.vertex_location}/publishers/google/models/"
            f"{model}:generateContent"
        )
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }
        payload = {
            "systemInstruction": {
                "parts": [{"text": "You are an expert code reviewer. Always respond with valid JSON only, no markdown."}]
            },
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=90)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            err_body = getattr(getattr(e, "response", None), "text", "") or ""
            if err_body:
                err_body = err_body[:500]
            print(f"Vertex AI request failed: {e} {err_body}")
            raise
        text = ""
        try:
            cands = data.get("candidates") or []
            if cands:
                c0 = cands[0]
                if c0.get("content", {}).get("parts"):
                    text = c0["content"]["parts"][0].get("text", "") or ""
                if c0.get("finishReason") and c0["finishReason"] != "STOP" and not text:
                    print(f"Vertex finishReason: {c0.get('finishReason')}")
        except (IndexError, KeyError, TypeError):
            pass
        if not text and data.get("promptFeedback"):
            print(f"Vertex promptFeedback: {data.get('promptFeedback')}")
        return {"choices": [{"message": {"content": text or "{}"}}]}

    def _call_anthropic(self, prompt: str) -> Dict:
        """Call Anthropic Claude API. Returns normalized shape for _parse_response."""
        from anthropic import Anthropic
        client = Anthropic(api_key=self.anthropic_api_key)
        response = client.messages.create(
            model=self.anthropic_model,
            max_tokens=4096,
            system="You are an expert code reviewer. Always respond with valid JSON only, no markdown.",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        text = response.content[0].text if response.content else "{}"
        # Normalize to same shape as OpenAI/Gemini
        return {'choices': [{'message': {'content': text}}]}

    def _call_openai(self, prompt: str) -> Dict:
        """Call OpenAI API."""
        headers = {
            'Authorization': f'Bearer {self.openai_api_key}',
            'Content-Type': 'application/json'
        }
        data = {
            'model': self.openai_model,
            'messages': [
                {'role': 'system', 'content': 'You are an expert code reviewer. Always respond with valid JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'response_format': {'type': 'json_object'}
        }
        # Reasoning-tier models (o1/o3/gpt-5.x) reject any non-default
        # temperature ("Only the default (1) value is supported") — only
        # send it for models that actually accept sampling controls. They
        # also spend time on hidden reasoning tokens before the visible
        # response, so the default 30s timeout isn't enough headroom.
        model_name = (self.openai_model or '').lower()
        is_reasoning_model = bool(re.match(r'^(o1|o3|o4|gpt-5)', model_name))
        if not is_reasoning_model:
            data['temperature'] = 0.2
        response = requests.post(
            self.openai_api_url,
            headers=headers,
            json=data,
            timeout=90 if is_reasoning_model else 30
        )
        response.raise_for_status()
        return response.json()

    def _call_openrouter(self, prompt: str) -> Dict:
        """
        Call OpenRouter — OpenAI-compatible meta-router that proxies to most
        major LLM providers under a single endpoint. Set OPENROUTER_MODEL to
        e.g. "anthropic/claude-3.5-sonnet", "openai/gpt-4o",
        "google/gemini-2.0-flash-exp", "meta-llama/llama-3.1-405b-instruct".

        Optional headers (HTTP-Referer, X-Title) help OpenRouter attribute
        usage to your project on their dashboard but are not required.
        """
        headers = {
            'Authorization': f'Bearer {self.openrouter_api_key}',
            'Content-Type': 'application/json',
            # Best-effort attribution; harmless if not set on the dashboard.
            'HTTP-Referer': os.getenv('OPENROUTER_REFERRER', 'http://localhost:5174'),
            'X-Title': os.getenv('OPENROUTER_APP_NAME', 'CodeBuster'),
        }
        data = {
            'model': self.openrouter_model,
            'messages': [
                {'role': 'system', 'content': 'You are an expert code reviewer. Always respond with valid JSON only, no markdown fences.'},
                {'role': 'user', 'content': prompt},
            ],
            'temperature': 0.2,
            # OpenRouter passes response_format through to providers that
            # support JSON mode (OpenAI, some others). Providers that don't
            # honor it just ignore it — strip_json_fences handles the rest.
            'response_format': {'type': 'json_object'},
        }
        response = requests.post(
            self.openrouter_api_url,
            headers=headers,
            json=data,
            timeout=60,  # OpenRouter sometimes routes to slower providers
        )
        response.raise_for_status()
        return response.json()

    def _dispatch(self, prompt: str) -> Dict:
        """
        Single dispatch point that routes a prompt to whichever provider was
        auto-selected (or forced via AI_PROVIDER). Keeps enhance_issue /
        generate_executive_summary / generate_review from drifting when a
        new provider is added — only this method needs to know about it.

        Also records the outcome (success/failure + reason) into the
        module-level health tracker so /github/ai/health can report it.
        """
        model = {
            "vertex": self.vertex_model,
            "gemini": self.gemini_model,
            "anthropic": self.anthropic_model,
            "openrouter": self.openrouter_model,
            "groq": self.groq_model,
            "openai": self.openai_model,
        }.get(self.provider)
        try:
            if self.provider == "vertex":
                result = self._call_vertex(prompt)
            elif self.provider == "gemini":
                result = self._call_gemini(prompt)
            elif self.provider == "anthropic":
                result = self._call_anthropic(prompt)
            elif self.provider == "openrouter":
                result = self._call_openrouter(prompt)
            elif self.provider == "groq":
                result = self._call_groq(prompt)
            else:
                # Default fallback — GPT-5.6 via OpenAI, works as long as a key is present.
                result = self._call_openai(prompt)
            _record_ai_success(self.provider, model)
            return result
        except Exception as e:
            _record_ai_failure(self.provider, model, e)
            raise

    def _call_groq(self, prompt: str) -> Dict:
        """
        Call Groq — OpenAI-compatible API on dedicated LPU hardware. Latency
        is typically <1s for 70B-class models. Set GROQ_MODEL to one of
        the supported models (llama-3.3-70b-versatile, llama-3.1-70b-versatile,
        mixtral-8x7b-32768, etc.).
        """
        headers = {
            'Authorization': f'Bearer {self.groq_api_key}',
            'Content-Type': 'application/json',
        }
        data = {
            'model': self.groq_model,
            'messages': [
                {'role': 'system', 'content': 'You are an expert code reviewer. Always respond with valid JSON only, no markdown fences.'},
                {'role': 'user', 'content': prompt},
            ],
            'temperature': 0.2,
            # Groq supports OpenAI-style JSON mode on most chat models.
            'response_format': {'type': 'json_object'},
        }
        response = requests.post(
            self.groq_api_url,
            headers=headers,
            json=data,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    
    def _parse_response(self, response: Dict, original_findings: List[Dict]) -> Dict:
        """Parse and validate AI response (Gemini or OpenAI)."""
        try:
            content = response['choices'][0]['message']['content']
            result = json.loads(_strip_json_fences(content))
            
            # Validate structure
            if 'overall_health_score' not in result:
                result['overall_health_score'] = self._calculate_health_score(original_findings)
            
            if 'category_scores' not in result:
                result['category_scores'] = self._calculate_category_scores(original_findings)
            
            if 'prioritized_issues' not in result:
                result['prioritized_issues'] = self._prioritize_findings(original_findings)
            
            # Ensure all required fields
            for issue in result.get('prioritized_issues', []):
                if 'id' not in issue:
                    issue['id'] = f"issue-{hash(str(issue))}"
                if 'confidence' not in issue:
                    issue['confidence'] = 0.8
                if 'priority_score' not in issue:
                    issue['priority_score'] = self._calculate_priority_score(issue)
            
            return result
            
        except (KeyError, json.JSONDecodeError) as e:
            print(f"Error parsing AI response: {e}")
            return self._rule_based_review(original_findings)
    
    def _rule_based_review(self, findings: List[Dict], strategy: str = "rule-based") -> Dict[str, Any]:
        """Fallback rule-based review when AI is unavailable."""
        # Calculate health score
        health_score = self._calculate_health_score(findings)
        
        # Calculate category scores
        category_scores = self._calculate_category_scores(findings)
        
        # Prioritize findings
        prioritized = self._prioritize_findings(findings)
        
        # Count issues
        counts = {'critical': 0, 'major': 0, 'minor': 0, 'info': 0}
        for finding in findings:
            severity = finding.get('severity', 'minor')
            counts[severity] = counts.get(severity, 0) + 1
            
            # Add fallback explanation if missing
            if not finding.get('ai_explanation'):
                finding['ai_explanation'] = self._build_rule_based_explanation(finding)
        
        return {
            'overall_health_score': health_score,
            'category_scores': category_scores,
            'summary': {
                'total_issues': len(findings),
                'critical': counts['critical'],
                'major': counts['major'],
                'minor': counts['minor'],
                'info': counts.get('info', 0),
                'status': 'fallback_active'
            },
            'prioritized_issues': prioritized,
            'quick_wins': [f['id'] for f in prioritized if f.get('severity') in ['minor', 'info']][:3],
            'top_risks': [f['id'] for f in prioritized if f.get('severity') == 'critical'][:5],
            'analysis_strategy': strategy,
            'message': "Review generated using static rules (AI offline)."
        }

    # Category-specific guidance used when the AI provider is offline.
    _CATEGORY_GUIDANCE = {
        'secret_leak': (
            "A credential appears to be hardcoded in source. Anyone with repo access "
            "(or anyone who clones a leaked copy) can use it to impersonate the service. "
            "Rotate the credential immediately, remove it from git history, and load it "
            "from an environment variable or a secrets manager (Vault, AWS Secrets Manager, "
            "GCP Secret Manager) at runtime."
        ),
        'high_entropy_secret': (
            "A high-entropy string was detected that matches the shape of a real secret. "
            "Even if it turns out to be a test value, treat it as leaked: rotate it, purge "
            "it from git history with `git filter-repo`, and move the real value behind an "
            "environment variable or secrets manager."
        ),
        'sql_injection': (
            "User-controlled input is being concatenated into a SQL statement, which lets "
            "an attacker change the query's meaning (data exfiltration, auth bypass, even "
            "RCE via stacked queries on some DBs). Use parameterized queries / prepared "
            "statements — never string-format values into SQL."
        ),
        'xss': (
            "Untrusted input is rendered into HTML without escaping, enabling cross-site "
            "scripting. Escape on output (framework-specific helpers or a library like "
            "DOMPurify), set a strict Content-Security-Policy, and prefer text bindings "
            "over `innerHTML` / `dangerouslySetInnerHTML`."
        ),
        'command_injection': (
            "User input reaches a shell/exec call. An attacker can chain their own "
            "commands. Pass arguments as a list (no `shell=True`), validate against an "
            "allow-list, and avoid building command strings by concatenation."
        ),
        'path_traversal': (
            "A filesystem path is built from user input without normalization, so `../` "
            "sequences can escape the intended directory. Resolve the path, then verify "
            "it stays inside an allow-listed base directory before opening it."
        ),
        'insecure_deserialization': (
            "Untrusted data is being deserialized (pickle, yaml.load, Java ObjectInputStream, "
            "etc.), which can execute arbitrary code. Use a safe parser (`yaml.safe_load`, "
            "JSON) or a schema-validated format."
        ),
        'weak_crypto': (
            "A weak or broken cryptographic primitive is in use (MD5/SHA1 for security, "
            "DES, ECB mode, or a non-CSPRNG). Switch to SHA-256+, AES-GCM, and "
            "`secrets` / `crypto.randomBytes` for randomness."
        ),
    }

    def _build_rule_based_explanation(self, finding: Dict) -> str:
        """Produce a category-aware explanation when AI reasoning is offline."""
        category = (finding.get('category') or '').lower()
        tool = finding.get('tool') or finding.get('module') or 'a static analyzer'
        severity = finding.get('severity', 'minor')

        guidance = self._CATEGORY_GUIDANCE.get(category)
        if not guidance:
            # Fall back to the finding's own description / suggested fix if we have one,
            # so the user still gets something more useful than "AI is offline".
            parts = []
            desc = (finding.get('description') or '').strip()
            if desc:
                parts.append(desc)
            fix = finding.get('suggested_fix') or {}
            fix_explanation = (fix.get('explanation') or '').strip() if isinstance(fix, dict) else ''
            if fix_explanation:
                parts.append(f"Recommended fix: {fix_explanation}")
            if parts:
                guidance = ' '.join(parts)
            else:
                guidance = (
                    f"This {severity} issue was flagged by {tool} based on a "
                    "deterministic rule. Review the code context and evidence above "
                    "to confirm the finding before acting on it."
                )

        return (
            f"{guidance}\n\n"
            f"(Explanation generated from CodeBuster's rule library because the AI "
            f"reasoning provider is not configured. Detected by {tool}.)"
        )

    # Severity weights for the scoring functions.
    # info > 0 so info findings still register (the old system's 0 weight
    # silently swallowed huge classes of findings).
    # Confidence-aware: a low-confidence finding contributes less penalty.
    _SEVERITY_WEIGHTS = {
        'critical': 8.0,
        'major':    3.5,
        'minor':    1.0,
        'info':     0.4,
    }

    @staticmethod
    def _weighted_penalty(findings: List[Dict]) -> float:
        """
        Sum of severity-weighted finding penalties, optionally damped by the
        finding's confidence (0-1). High-confidence criticals weigh full,
        low-confidence ones weigh less so a noisy analyzer can't tank the
        score on its own.
        """
        total = 0.0
        for f in findings:
            sev = (f.get('severity') or 'minor').lower()
            weight = AIReviewService._SEVERITY_WEIGHTS.get(sev, 1.0)

            # Confidence: clamp to [0.5, 1.0] so even unconfident findings
            # still penalize 50% (we don't want to silently zero them out).
            conf_raw = f.get('confidence')
            try:
                conf = float(conf_raw) if conf_raw is not None else 0.85
            except (TypeError, ValueError):
                conf = 0.85
            # Backend stores confidence in two formats: 0-1 floats and 0-100 ints.
            if conf > 1.0:
                conf = conf / 100.0
            conf = max(0.5, min(1.0, conf))

            total += weight * conf
        return total

    @staticmethod
    def _saturating_score(weighted_penalty: float, scale: float) -> int:
        """
        Map a weighted-penalty number to a 0-100 score with a smooth,
        saturating curve:

            score = round(100 * scale / (scale + W))

        The curve asymptotically approaches 0 but never hits it for finite W,
        so even very rough codebases land somewhere in the single digits
        instead of showing a flat zero. We then floor at 5 and ceiling at 100.

        Calibration with scale=60 (overall):
          W=0   → 100   (clean)
          W=10  →  86   (a few minor issues or one major)
          W=25  →  71   (B-grade)
          W=50  →  55   (C-grade)
          W=100 →  38   (D)
          W=250 →  19   (F, but visible)
          W=∞   →   5+  (floored)
        """
        if weighted_penalty <= 0:
            return 100
        raw = 100.0 * scale / (scale + weighted_penalty)
        return max(5, min(100, int(round(raw))))

    def _calculate_health_score(self, findings: List[Dict]) -> int:
        """Overall health score (0-100). Saturating, confidence-aware."""
        if not findings:
            return 100
        return self._saturating_score(self._weighted_penalty(findings), scale=60.0)

    def _calculate_category_scores(self, findings: List[Dict]) -> Dict[str, int]:
        """
        Scores per dimension/category (0-100). Uses a smaller scale than the
        overall score because per-category finding counts are smaller — without
        this, a single critical in one category would crash that category to 0.

        Calibration with scale=40:
          W=0  → 100
          W=4  →  91
          W=10 →  80
          W=25 →  62
          W=50 →  44
          W=100 → 29
        """
        # Group findings by their canonical category bucket. Prefer 'module'
        # (code_quality, security, performance, ...) and fall back to
        # 'category' (e.g. sql_injection) so a security finding without a
        # module still lands somewhere reasonable.
        SECURITY_CATEGORIES = {
            'secret_leak', 'high_entropy_secret', 'sql_injection', 'xss',
            'command_injection', 'path_traversal',
            'insecure_deserialization', 'weak_crypto',
        }

        buckets: Dict[str, List[Dict]] = {}
        for f in findings:
            module = (f.get('module') or '').lower().strip()
            category = (f.get('category') or '').lower().strip()
            if module:
                bucket = module
            elif category in SECURITY_CATEGORIES:
                bucket = 'security'
            elif category:
                bucket = category
            else:
                bucket = 'code_quality'
            buckets.setdefault(bucket, []).append(f)

        scores: Dict[str, int] = {}
        for bucket, bucket_findings in buckets.items():
            scores[bucket] = self._saturating_score(
                self._weighted_penalty(bucket_findings),
                scale=40.0,
            )
        return scores
    
    def _prioritize_findings(self, findings: List[Dict]) -> List[Dict]:
        """Prioritize findings by severity and confidence."""
        severity_order = {'critical': 0, 'major': 1, 'minor': 2, 'info': 3}
        
        # Add IDs if missing
        for i, finding in enumerate(findings):
            if 'id' not in finding:
                finding['id'] = f"issue-{i+1:03d}"
            if 'priority_score' not in finding:
                finding['priority_score'] = self._calculate_priority_score(finding)
        
        # Sort by severity, then confidence
        sorted_findings = sorted(
            findings,
            key=lambda f: (
                severity_order.get(f.get('severity', 'minor'), 3),
                -f.get('confidence', 0.5),
                -f.get('priority_score', 0)
            )
        )
        
        return sorted_findings
    
    def _calculate_priority_score(self, finding: Dict) -> int:
        """Calculate priority score (0-100)."""
        severity_scores = {'critical': 100, 'major': 70, 'minor': 40, 'info': 10}
        base_score = severity_scores.get(finding.get('severity', 'minor'), 40)
        
        # Adjust by confidence
        confidence = finding.get('confidence', 0.5)
        adjusted_score = int(base_score * confidence)
        
        return min(100, max(0, adjusted_score))

    def _get_enriched_context(self, repo_context: Optional[Dict], findings: List[Dict]) -> str:
        """Query external sources for better context (Diagram Steps 11-12)."""
        context_parts = []
        
        # 1. Query Vector Database for similar issues (Step 11)
        vector_context = self._query_vector_db(findings)
        if vector_context:
            context_parts.append(f"Knowledge Base: {vector_context}")
            
        # 2. Query Internal Documentation (Step 12)
        docs_context = self._query_internal_docs(repo_context)
        if docs_context:
            context_parts.append(f"Security Policy: {docs_context}")
            
        return "\n".join(context_parts)

    def _query_vector_db(self, findings: List[Dict]) -> Optional[str]:
        """Hook for Vector Database queries."""
        # TODO: Implement RAG with Pinecone/Milvus
        return "Based on historical findings, favor security-first fixes for this tech stack."

    def _query_internal_docs(self, repo_context: Optional[Dict]) -> Optional[str]:
        """Hook for Internal Documentation queries."""
        # TODO: Implement query over internal dev/security docs
        return "Standard: All secrets must be moved to environment variables or Secret Manager."

