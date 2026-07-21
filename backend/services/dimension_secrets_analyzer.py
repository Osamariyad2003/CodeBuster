"""
Secrets dimension analyzer — wraps TruffleHogScanner and produces a 0-100
score + strict DimensionAnalyzerResult. Split out from the generic
`security` dimension so leaked credentials get their own visible signal
instead of being buried among broader security findings.
"""
from typing import Any, Dict, List, Optional, Tuple

from .dimension_analyzer_base import BaseDimensionAnalyzer
from .dimension_analyzer_schema import (
    DimensionAnalyzerResult,
    AnalyzerInfo,
    CategoryResult,
    DimensionIssue,
    Signal,
    severity_legacy_to_enum,
)
from .trufflehog_scanner import TruffleHogScanner

_PENALTY = {"CRITICAL": 40, "HIGH": 20, "MEDIUM": 8, "LOW": 2}


class SecretsDimensionAnalyzer(BaseDimensionAnalyzer):
    ANALYZER_KEY = "secrets"
    ANALYZER_LABEL = "Secrets"
    VERSION = "1.0"

    def __init__(self):
        self._scanner = TruffleHogScanner()

    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        target = self._target_from_metadata(repo_metadata)

        try:
            raw_findings = self._scanner.analyze(files)
        except Exception:
            raw_findings = []  # trufflehog binary unavailable — degrade gracefully

        issues = self._to_dimension_issues(raw_findings)
        score, rationale = self._score(issues)

        verified = sum(1 for i in issues if 'verified' in i.tags)
        signals = [
            Signal(key='files_analyzed', label='Files analyzed', value=len(files), unit='count'),
            Signal(key='secrets_found', label='Secrets found', value=len(issues), unit='count'),
            Signal(key='verified_secrets', label='Verified (active) secrets', value=verified, unit='count'),
        ]

        return DimensionAnalyzerResult(
            analyzer=AnalyzerInfo(key=self.ANALYZER_KEY, label=self.ANALYZER_LABEL, version=self.VERSION),
            target=target,
            category_result=CategoryResult(score=score, not_applicable=False, rationale=rationale),
            issues=issues,
            signals=signals,
        )

    def _to_dimension_issues(self, findings: List[Dict[str, Any]]) -> List[DimensionIssue]:
        issues = []
        for idx, f in enumerate(findings, 1):
            severity = severity_legacy_to_enum(f.get('severity', 'major'))
            file_path = f.get('file') or ''
            evidence = [str(e) for e in (f.get('evidence') or [])][:5]
            fix = f.get('suggested_fix') or {}
            rec = fix.get('explanation') or 'Revoke and rotate this secret immediately, then remove it from history.'
            verified = bool((f.get('metadata') or {}).get('verified'))
            tags = list(dict.fromkeys(['secrets', f.get('category', 'secret_leak'), f.get('tool', 'trufflehog')]))
            if verified:
                tags.append('verified')

            issues.append(DimensionIssue(
                id=f'secret-{idx:03d}',
                title=(f.get('title') or 'Secret detected')[:200],
                severity=severity,
                category_key=self.ANALYZER_KEY,
                confidence=float(min(1.0, max(0.0, f.get('confidence', 0.8)))),
                file_paths=[file_path] if file_path else [],
                evidence=evidence,
                impact=(f.get('description') or '')[:500],
                recommendation=rec[:500],
                effort='S',
                tags=tags[:5],
            ))
        return issues

    def _score(self, issues: List[DimensionIssue]) -> Tuple[int, str]:
        if not issues:
            return 100, 'No hardcoded secrets detected in scanned files.'

        penalty = 0
        for issue in issues:
            penalty = min(100, penalty + _PENALTY.get(issue.severity, 5))
        score = max(0, 100 - penalty)

        verified = sum(1 for i in issues if 'verified' in i.tags)
        if verified:
            rationale = f'{verified} verified (active) secret(s) found — rotate immediately, these are confirmed live credentials.'
        else:
            rationale = f'{len(issues)} potential secret(s) found. Verification was skipped or inconclusive; treat as leaked until confirmed otherwise.'
        return score, rationale
