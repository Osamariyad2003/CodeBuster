"""Merge analyzer outputs into canonical review payload (severity, confidence, file/line, scores)."""
from datetime import datetime
from typing import Any, Dict, List
import uuid


def merge(
    repo_full_name: str,
    commit_sha: str,
    branch: str | None,
    pr_number: int | None,
    trigger: str,
    analyzer_results: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    all_findings: List[Dict[str, Any]] = []
    for _analyzer_key, findings in analyzer_results.items():
        for f in findings:
            f = dict(f)
            if "id" not in f or not f["id"]:
                f["id"] = str(uuid.uuid4())
            all_findings.append(f)

    severity_order = {"CRITICAL": 0, "MAJOR": 1, "MINOR": 2, "INFO": 3}
    all_findings.sort(key=lambda x: (severity_order.get(x.get("severity", "INFO"), 4), -(x.get("confidence") or 0)))

    severity_counts: Dict[str, int] = {"CRITICAL": 0, "MAJOR": 0, "MINOR": 0, "INFO": 0}
    for f in all_findings:
        s = f.get("severity", "INFO")
        if s in severity_counts:
            severity_counts[s] += 1

    penalty = (
        severity_counts["CRITICAL"] * 25
        + severity_counts["MAJOR"] * 10
        + severity_counts["MINOR"] * 3
        + severity_counts["INFO"] * 1
    )
    overall_score = max(0, min(100, 100 - penalty))
    if overall_score >= 90:
        grade = "A"
    elif overall_score >= 80:
        grade = "B"
    elif overall_score >= 70:
        grade = "C"
    elif overall_score >= 60:
        grade = "D"
    else:
        grade = "F"

    category_keys = list(analyzer_results.keys())
    category_scores = [
        {"key": k, "label": k.replace("_", " ").title(), "score": max(0, overall_score - 5), "weight": 1.0 / max(1, len(category_keys))}
        for k in category_keys
    ]

    return {
        "project": {"name": repo_full_name.split("/")[-1], "repo_full_name": repo_full_name, "default_branch": branch or "main"},
        "trigger": {"source": trigger, "commit_sha": commit_sha, "branch": branch, "pr_number": pr_number},
        "scores": {
            "overall_score": overall_score,
            "overall_grade": grade,
            "production_readiness": "yes" if overall_score >= 70 else "no",
            "categories": category_scores,
        },
        "findings": all_findings,
        "summary": {
            "severity_counts": severity_counts,
            "top_risks": [f.get("explanation", "")[:80] for f in all_findings[:5]],
            "next_actions": ["Address findings above before merge."] if all_findings else [],
        },
        "analyzers": {
            "run": [{"key": k, "status": "completed", "findings_count": len(v)} for k, v in analyzer_results.items()],
        },
        "metadata": {"created_at": datetime.utcnow().isoformat(), "completed_at": datetime.utcnow().isoformat()},
    }
