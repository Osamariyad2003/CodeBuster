"""
Security dimension analyzer – implements the dimension contract for the security category.
Uses repo metadata + file contents + optional tool logs (bandit, semgrep, eslint) and returns strict JSON.
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
from .security_analyzer import SecurityAnalyzer
from .semgrep_analyzer import SemgrepAnalyzer


class SecurityDimensionAnalyzer(BaseDimensionAnalyzer):
    ANALYZER_KEY = "security"
    ANALYZER_LABEL = "Security"
    VERSION = "1.0"

    def __init__(self):
        self._security = SecurityAnalyzer()
        self._semgrep = SemgrepAnalyzer()

    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        target = self._target_from_metadata(repo_metadata)
        tool_logs = tool_logs or {}

        # 1) Run built-in analyzers
        security_findings = self._security.analyze(files)
        semgrep_findings = self._semgrep.analyze(files)

        # 2) Ingest optional tool logs (bandit, semgrep, eslint) into a common finding shape
        extra_findings = self._parse_tool_logs(tool_logs)

        # 3) Merge and convert to DimensionIssue list
        all_legacy = security_findings + semgrep_findings + extra_findings
        issues = self._to_dimension_issues(all_legacy)

        # 4) Compute category score 0–100 from issues
        score, rationale = self._compute_score_and_rationale(issues, len(files), tool_logs)

        # 5) Signals
        critical = sum(1 for i in issues if i.severity == "CRITICAL")
        high = sum(1 for i in issues if i.severity == "HIGH")
        signals = [
            Signal(key="files_analyzed", label="Files analyzed", value=len(files), unit="count"),
            Signal(key="issues_found", label="Issues found", value=len(issues), unit="count"),
            Signal(key="critical_count", label="Critical issues", value=critical, unit="count"),
            Signal(key="high_count", label="High issues", value=high, unit="count"),
        ]

        return DimensionAnalyzerResult(
            analyzer=AnalyzerInfo(key=self.ANALYZER_KEY, label=self.ANALYZER_LABEL, version=self.VERSION),
            target=target,
            category_result=CategoryResult(score=score, not_applicable=False, rationale=rationale),
            issues=issues,
            signals=signals,
        )

    def _parse_tool_logs(self, tool_logs: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert bandit/semgrep/eslint outputs into legacy finding dicts."""
        out = []
        # Bandit: list of { filename, issue_severity, issue_confidence, issue_text, ... }
        for raw in tool_logs.get("bandit") or []:
            if isinstance(raw, dict):
                out.append({
                    "severity": (raw.get("issue_severity") or "MEDIUM").lower().replace("high", "major").replace("low", "minor"),
                    "category": "bandit",
                    "title": raw.get("issue_text") or "Bandit finding",
                    "description": raw.get("issue_text") or "",
                    "file": raw.get("filename") or "unknown",
                    "line": raw.get("line_number"),
                    "confidence": {"HIGH": 0.9, "MEDIUM": 0.7, "LOW": 0.5}.get((raw.get("issue_confidence") or "MEDIUM").upper(), 0.7),
                    "evidence": [f"Bandit: {raw.get('issue_text', '')}"],
                    "tool": "bandit",
                })
        # Semgrep: list of { check_id, path, start.line, metadata.severity, extra.message }
        for raw in tool_logs.get("semgrep") or []:
            if isinstance(raw, dict):
                sev = (raw.get("metadata") or {}).get("severity") or "WARNING"
                out.append({
                    "severity": "critical" if sev == "ERROR" else "major" if sev == "WARNING" else "minor",
                    "category": raw.get("check_id") or "semgrep",
                    "title": (raw.get("extra") or {}).get("message") or raw.get("check_id") or "Semgrep finding",
                    "description": (raw.get("extra") or {}).get("message") or "",
                    "file": raw.get("path") or "unknown",
                    "line": (raw.get("start") or {}).get("line"),
                    "confidence": 0.85,
                    "evidence": [(raw.get("extra") or {}).get("message", "")],
                    "tool": "semgrep",
                })
        # ESLint: list of { filePath, line, message, severity, ruleId }
        for raw in tool_logs.get("eslint") or []:
            if isinstance(raw, dict):
                sev = raw.get("severity", 1)
                out.append({
                    "severity": "major" if sev == 2 else "minor",
                    "category": raw.get("ruleId") or "eslint",
                    "title": raw.get("message") or "ESLint finding",
                    "description": raw.get("message") or "",
                    "file": raw.get("filePath") or "unknown",
                    "line": raw.get("line"),
                    "confidence": 0.75,
                    "evidence": [raw.get("message", "")],
                    "tool": "eslint",
                })
        return out

    def _to_dimension_issues(self, legacy_findings: List[Dict[str, Any]]) -> List[DimensionIssue]:
        issues = []
        for idx, f in enumerate(legacy_findings, 1):
            issue_id = f"security-{idx:03d}"
            severity = severity_legacy_to_enum(f.get("severity"))
            file_path = f.get("file") or f.get("file_path") or ""
            file_paths = [file_path] if file_path else []
            evidence = f.get("evidence") or []
            if isinstance(evidence, str):
                evidence = [evidence]
            evidence = [str(e) for e in evidence][:5]
            rec = f.get("recommendation") or ""
            if not rec and isinstance(f.get("suggested_fix"), dict):
                rec = (f["suggested_fix"].get("explanation") or str(f["suggested_fix"]))[:500]
            if not rec:
                rec = "Address the finding and re-run security checks."
            issues.append(DimensionIssue(
                id=issue_id,
                title=(f.get("title") or "Security finding")[:200],
                severity=severity,
                category_key=self.ANALYZER_KEY,
                confidence=float(min(1.0, max(0.0, f.get("confidence", 0.7)))),
                file_paths=file_paths,
                evidence=evidence,
                impact=(f.get("description") or f.get("impact") or "")[:500],
                recommendation=rec[:500],
                effort="S" if severity == "LOW" else "L" if severity == "CRITICAL" else "M",
                tags=list(set([f.get("category", "security"), f.get("tool", "security")]))[:5],
            ))
        return issues

    def _compute_score_and_rationale(
        self,
        issues: List[DimensionIssue],
        files_analyzed: int,
        tool_logs: Dict[str, Any],
    ) -> tuple[int, str]:
        # 0–100: start at 100, deduct by severity
        penalty = 0
        for i in issues:
            if i.severity == "CRITICAL":
                penalty += 15
            elif i.severity == "HIGH":
                penalty += 8
            elif i.severity == "MEDIUM":
                penalty += 3
            else:
                penalty += 1
        score = max(0, min(100, 100 - penalty))
        if not issues:
            rationale = "No security issues found in analyzed files. Run bandit/semgrep for deeper coverage."
        elif any(i.severity == "CRITICAL" for i in issues):
            rationale = "Critical or high-severity issues detected. Address these before production."
        else:
            rationale = "Some security findings; recommend addressing high-severity items and re-scanning."
        return score, rationale
