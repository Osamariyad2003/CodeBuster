"""
Performance dimension analyzer — wraps PerformanceAnalyzer and produces a
0-100 score + strict DimensionAnalyzerResult following the dimension contract.
"""
from typing import Any, Dict, List, Optional

from .dimension_analyzer_base import BaseDimensionAnalyzer
from .dimension_analyzer_schema import (
    DimensionAnalyzerResult,
    AnalyzerInfo,
    CategoryResult,
    DimensionIssue,
    Signal,
    TargetInfo,
    severity_legacy_to_enum,
)
from .performance_analyzer import PerformanceAnalyzer


# Penalty per issue severity (same philosophy as SecurityDimensionAnalyzer)
_PENALTY = {
    "CRITICAL": 20,
    "HIGH":      8,
    "MEDIUM":    3,
    "LOW":       1,
}

# Cap how much a single category of issue can penalize
_CAP = {
    "n_plus_one_query":     60,
    "sql_efficiency":       40,
    "js_perf_antipattern":  30,
    "algo_efficiency":      25,
}


class PerformanceDimensionAnalyzer(BaseDimensionAnalyzer):
    ANALYZER_KEY   = "performance"
    ANALYZER_LABEL = "Performance"
    VERSION        = "2.0"

    def __init__(self):
        self._perf = PerformanceAnalyzer()

    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        target    = self._target_from_metadata(repo_metadata)
        tool_logs = tool_logs or {}

        # Run the analyzer
        raw_findings = self._perf.analyze(files)

        # Optionally ingest lighthouse / webpack-bundle-analyzer logs
        raw_findings += self._parse_tool_logs(tool_logs)

        # Convert to DimensionIssue list
        issues = self._to_dimension_issues(raw_findings)

        # Score
        score, rationale = self._score(issues, len(files))

        # Signals
        n1_count   = sum(1 for i in issues if "n_plus_one" in i.tags)
        crit_count = sum(1 for i in issues if i.severity == "CRITICAL")
        signals = [
            Signal(key="files_analyzed",  label="Files analyzed",   value=len(files),   unit="count"),
            Signal(key="issues_found",    label="Issues found",     value=len(issues),  unit="count"),
            Signal(key="critical_count",  label="Critical issues",  value=crit_count,   unit="count"),
            Signal(key="n1_query_count",  label="N+1 queries",      value=n1_count,     unit="count"),
        ]

        return DimensionAnalyzerResult(
            analyzer=AnalyzerInfo(key=self.ANALYZER_KEY, label=self.ANALYZER_LABEL, version=self.VERSION),
            target=target,
            category_result=CategoryResult(score=score, not_applicable=False, rationale=rationale),
            issues=issues,
            signals=signals,
        )

    # ── tool log ingestion ────────────────────────────────────────────────
    def _parse_tool_logs(self, tool_logs: Dict[str, Any]) -> List[Dict]:
        """Accept optional lighthouse / bundle-analyzer JSON and normalise."""
        out = []
        # Lighthouse: { audits: { "speed-index": { score, title, description }, ... } }
        lh = tool_logs.get("lighthouse") or {}
        audits = lh.get("audits") or {}
        for key, audit in audits.items():
            if not isinstance(audit, dict):
                continue
            score = audit.get("score")
            if score is None or score >= 0.5:   # only flag failing audits
                continue
            severity = "critical" if score < 0.25 else "major"
            out.append({
                "module":       "performance",
                "severity":     severity,
                "category":     "lighthouse",
                "title":        audit.get("title") or key,
                "description":  audit.get("description") or "",
                "file":         "lighthouse-report",
                "line":         None,
                "code_snippet": "",
                "confidence":   0.90,
                "tool":         "lighthouse",
            })
        return out

    # ── convert raw findings to DimensionIssue ────────────────────────────
    def _to_dimension_issues(self, findings: List[Dict]) -> List[DimensionIssue]:
        issues = []
        for idx, f in enumerate(findings, 1):
            issue_id = f"perf-{idx:03d}"
            severity = severity_legacy_to_enum(f.get("severity", "minor"))
            file_path = f.get("file") or f.get("file_path") or ""
            evidence = f.get("evidence") or []
            if isinstance(evidence, str):
                evidence = [evidence]
            evidence = [str(e) for e in evidence][:5]

            rec = ""
            fix = f.get("suggested_fix")
            if isinstance(fix, dict):
                rec = fix.get("explanation") or ""
            if not rec:
                rec = f.get("description") or "Address the performance finding and re-scan."

            category = f.get("category", "performance")
            tool     = f.get("tool", "performance_analyzer")
            tags     = list({category, tool, "performance"})[:5]

            issues.append(DimensionIssue(
                id=issue_id,
                title=(f.get("title") or "Performance finding")[:200],
                severity=severity,
                category_key=self.ANALYZER_KEY,
                confidence=float(min(1.0, max(0.0, f.get("confidence", 0.75)))),
                file_paths=[file_path] if file_path else [],
                evidence=evidence,
                impact=(f.get("description") or "")[:500],
                recommendation=rec[:500],
                effort="S" if severity == "LOW" else "L" if severity == "CRITICAL" else "M",
                tags=tags,
            ))
        return issues

    # ── scoring ───────────────────────────────────────────────────────────
    def _score(self, issues: List[DimensionIssue], files_analyzed: int) -> tuple[int, str]:
        # Accumulate penalty per category, with per-category caps
        penalty_by_cat: Dict[str, int] = {}
        for issue in issues:
            cat     = next((t for t in issue.tags if t in _CAP), "other")
            pen     = _PENALTY.get(issue.severity, 1)
            current = penalty_by_cat.get(cat, 0)
            cap     = _CAP.get(cat, 20)
            penalty_by_cat[cat] = min(current + pen, cap)

        total_penalty = min(100, sum(penalty_by_cat.values()))
        score = max(0, 100 - total_penalty)

        # Rationale
        critical = sum(1 for i in issues if i.severity == "CRITICAL")
        high     = sum(1 for i in issues if i.severity == "HIGH")
        n1       = sum(1 for i in issues if "n_plus_one_query" in i.tags)

        if not issues:
            rationale = (
                f"No performance issues found across {files_analyzed} file(s). "
                "Consider profiling in staging to catch runtime hotspots."
            )
        elif n1 > 0:
            rationale = (
                f"{n1} N+1 query pattern(s) detected — these are often the #1 "
                "performance killer in production. Fix them before shipping."
            )
        elif critical > 0:
            rationale = (
                f"{critical} critical performance issue(s) found. "
                "Address these to avoid production degradation under load."
            )
        elif high > 0:
            rationale = (
                f"{high} high-severity performance finding(s). "
                "These will likely surface under moderate traffic."
            )
        else:
            rationale = (
                f"{len(issues)} low-to-medium performance hint(s). "
                "No showstoppers, but worth addressing before a major release."
            )

        return score, rationale
