"""Structured JSON finding from any analyzer."""
from typing import Any, Dict, List, Optional


def finding(
    id: str,
    severity: str,
    category: str,
    module: str,
    message: str,
    file: str,
    start_line: int,
    end_line: Optional[int] = None,
    confidence: float = 0.8,
    rule_id: Optional[str] = None,
    suggested_fix: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "id": id,
        "severity": severity,
        "category": category,
        "module": module,
        "explanation": message,
        "file": file,
        "start_line": start_line,
        "end_line": end_line or start_line,
        "confidence": confidence,
        "rule_id": rule_id or "",
        "suggested_fix": suggested_fix or {"summary": ""},
    }


def run_stub(
    name: str,
    repo_full_name: str,
    commit_sha: str,
    severity: str = "MINOR",
    message: str = "Stub finding",
) -> List[Dict[str, Any]]:
    file = repo_full_name.split("/")[-1] + "/main.py"
    return [
        finding(
            id=f"{name}-001",
            severity=severity,
            category=name,
            module=name,
            message=message,
            file=file,
            start_line=1,
            confidence=0.7,
            rule_id=f"{name.upper()}_STUB_001",
        )
    ]
