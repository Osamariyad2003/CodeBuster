"""
Code quality dimension analyzer – implements the dimension contract for code_quality.
"""
from typing import Any, Dict, List, Optional

from .dimension_analyzer_base import BaseDimensionAnalyzer
from .dimension_analyzer_schema import (
    DimensionAnalyzerResult,
    AnalyzerInfo,
    CategoryResult,
    DimensionIssue,
    Signal,
    severity_legacy_to_enum,
)
from .code_quality_analyzer import CodeQualityAnalyzer
from .dead_code_analyzer import DeadCodeAnalyzer
from .duplicate_code_analyzer import DuplicateCodeAnalyzer


class CodeQualityDimensionAnalyzer(BaseDimensionAnalyzer):
    ANALYZER_KEY = "code_quality"
    ANALYZER_LABEL = "Code Quality"
    VERSION = "1.2"

    def __init__(self):
        self._quality = CodeQualityAnalyzer()
        self._dead_code = DeadCodeAnalyzer()
        self._duplicate_code = DuplicateCodeAnalyzer()

    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        target = self._target_from_metadata(repo_metadata)
        tool_logs = tool_logs or {}

        legacy_findings = self._quality.analyze(files)
        legacy_findings += self._dead_code.analyze(files)
        legacy_findings += self._duplicate_code.analyze(files)
        # Optional: merge pylint/eslint from tool_logs if present
        for raw in (tool_logs.get("pylint") or []) + (tool_logs.get("eslint") or []):
            if isinstance(raw, dict) and raw.get("file") or raw.get("filePath"):
                legacy_findings.append({
                    "severity": raw.get("severity", "minor"),
                    "category": raw.get("type") or raw.get("ruleId") or "style",
                    "title": raw.get("message") or raw.get("title", "Quality finding"),
                    "description": raw.get("message") or raw.get("description", ""),
                    "file": raw.get("file") or raw.get("filePath", "unknown"),
                    "line": raw.get("line"),
                    "confidence": 0.7,
                    "evidence": [raw.get("message", "")],
                    "tool": "pylint" if "line" in raw else "eslint",
                })

        issues = self._to_dimension_issues(legacy_findings)
        score, rationale = self._compute_score_and_rationale(issues, len(files))
        signals = [
            Signal(key="files_analyzed", label="Files analyzed", value=len(files), unit="count"),
            Signal(key="issues_found", label="Issues found", value=len(issues), unit="count"),
        ]
        return DimensionAnalyzerResult(
            analyzer=AnalyzerInfo(key=self.ANALYZER_KEY, label=self.ANALYZER_LABEL, version=self.VERSION),
            target=target,
            category_result=CategoryResult(score=score, not_applicable=False, rationale=rationale),
            issues=issues,
            signals=signals,
        )

    def _to_dimension_issues(self, legacy: List[Dict[str, Any]]) -> List[DimensionIssue]:
        issues = []
        for idx, f in enumerate(legacy, 1):
            issue_id = f"code_quality-{idx:03d}"
            severity = severity_legacy_to_enum(f.get("severity"))
            file_path = f.get("file") or f.get("file_path") or ""
            evidence = f.get("evidence") or []
            if isinstance(evidence, str):
                evidence = [evidence]
            evidence = [str(e) for e in evidence][:5]
            rec = f.get("recommendation") or ""
            if not rec and isinstance(f.get("suggested_fix"), dict):
                rec = (f["suggested_fix"].get("explanation") or "")[:500]
            if not rec:
                rec = "Refactor or address the finding and re-run checks."
            issues.append(DimensionIssue(
                id=issue_id,
                title=(f.get("title") or "Code quality finding")[:200],
                severity=severity,
                category_key=self.ANALYZER_KEY,
                confidence=float(min(1.0, max(0.0, f.get("confidence", 0.7)))),
                file_paths=[file_path] if file_path else [],
                evidence=evidence,
                impact=(f.get("description") or "")[:500],
                recommendation=rec[:500],
                effort="S" if severity == "LOW" else "M",
                tags=[f.get("category", "code_quality"), f.get("tool", "code_quality_analyzer")][:5],
            ))
        return issues

    def _compute_score_and_rationale(self, issues: List[DimensionIssue], files_analyzed: int) -> tuple[int, str]:
        penalty = sum(15 if i.severity == "CRITICAL" else 8 if i.severity == "HIGH" else 3 if i.severity == "MEDIUM" else 1 for i in issues)
        score = max(0, min(100, 100 - penalty))
        if not issues:
            rationale = "No code quality issues found in analyzed files."
        else:
            rationale = "Some quality findings; consider refactoring for maintainability."
        return score, rationale
