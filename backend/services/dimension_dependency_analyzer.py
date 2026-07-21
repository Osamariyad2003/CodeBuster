"""
Dependency dimension analyzer — wraps DependencyAnalyzer (OSV.dev lookups)
and produces a 0-100 score + strict DimensionAnalyzerResult.
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
from .dependency_analyzer import DependencyAnalyzer

_PENALTY = {"CRITICAL": 25, "HIGH": 12, "MEDIUM": 5, "LOW": 1}
_MAX_PENALTY = 90
_MANIFEST_NAMES = ('requirements.txt', 'package.json')


class DependencyDimensionAnalyzer(BaseDimensionAnalyzer):
    ANALYZER_KEY = "dependencies"
    ANALYZER_LABEL = "Dependencies"
    VERSION = "1.0"

    def __init__(self):
        self._dep = DependencyAnalyzer()

    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        target = self._target_from_metadata(repo_metadata)

        raw_findings = self._dep.analyze(files)
        issues = self._to_dimension_issues(raw_findings)
        score, rationale = self._score(issues)

        manifests_found = sum(
            1 for f in files
            if (f.get('path') or f.get('file') or '').replace('\\', '/').rsplit('/', 1)[-1] in _MANIFEST_NAMES
        )
        vulnerable = sum(1 for i in issues if 'scan_truncated' not in i.tags)
        critical = sum(1 for i in issues if i.severity == 'CRITICAL')
        signals = [
            Signal(key='manifests_found', label='Manifests scanned', value=manifests_found, unit='count'),
            Signal(key='vulnerable_dependencies', label='Vulnerable dependencies', value=vulnerable, unit='count'),
            Signal(key='critical_count', label='Critical vulnerabilities', value=critical, unit='count'),
        ]

        return DimensionAnalyzerResult(
            analyzer=AnalyzerInfo(key=self.ANALYZER_KEY, label=self.ANALYZER_LABEL, version=self.VERSION),
            target=target,
            category_result=CategoryResult(score=score, not_applicable=(manifests_found == 0), rationale=rationale),
            issues=issues,
            signals=signals,
        )

    # ── convert raw findings to DimensionIssue ────────────────────────────
    def _to_dimension_issues(self, findings: List[Dict[str, Any]]) -> List[DimensionIssue]:
        issues = []
        for idx, f in enumerate(findings, 1):
            severity = severity_legacy_to_enum(f.get('severity', 'minor'))
            file_path = f.get('file') or ''
            evidence = [str(e) for e in (f.get('evidence') or [])][:5]
            fix = f.get('suggested_fix') or {}
            rec = fix.get('explanation') or f.get('description') or 'Upgrade the affected dependency.'
            tags = list(dict.fromkeys([
                'dependencies', f.get('category', 'vulnerable_dependency'), f.get('tool', 'osv.dev'),
            ]))[:5]

            issues.append(DimensionIssue(
                id=f'dep-{idx:03d}',
                title=(f.get('title') or 'Vulnerable dependency')[:200],
                severity=severity,
                category_key=self.ANALYZER_KEY,
                confidence=float(min(1.0, max(0.0, f.get('confidence', 0.9)))),
                file_paths=[file_path] if file_path else [],
                evidence=evidence,
                impact=(f.get('description') or '')[:500],
                recommendation=rec[:500],
                effort='S' if severity in ('LOW', 'MEDIUM') else 'M',
                tags=tags,
            ))
        return issues

    # ── scoring ───────────────────────────────────────────────────────────
    def _score(self, issues: List[DimensionIssue]) -> Tuple[int, str]:
        real_issues = [i for i in issues if 'scan_truncated' not in i.tags]
        if not real_issues:
            return 100, 'No known-vulnerable dependencies detected in scanned manifests.'

        penalty = 0
        for issue in real_issues:
            penalty = min(_MAX_PENALTY, penalty + _PENALTY.get(issue.severity, 3))
        score = max(0, 100 - penalty)

        critical = sum(1 for i in real_issues if i.severity == 'CRITICAL')
        high = sum(1 for i in real_issues if i.severity == 'HIGH')
        if critical:
            noun = 'dependency has' if critical == 1 else 'dependencies have'
            rationale = f'{critical} {noun} a critical known vulnerability — upgrade immediately.'
        elif high:
            noun = 'dependency has' if high == 1 else 'dependencies have'
            rationale = f'{high} {noun} a high-severity known vulnerability.'
        else:
            rationale = f'{len(real_issues)} dependency finding(s), none critical or high severity.'
        return score, rationale
