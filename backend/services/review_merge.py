"""
Merge function contract: convert orchestrator result into canonical review JSON.
Used for storage (POST /api/reviews) or direct DB insert consistency.
"""
from typing import Dict, Any, List


def merge_to_canonical_review(
    repo_id: str,
    repo_full_name: str,
    commit_sha: str,
    trigger_source: str,
    orchestrator_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Merge orchestrator output into canonical review JSON.

    Contract:
        orchestrator_result: dict with keys
            - overall_health_score (int 0-100)
            - category_scores (dict str -> int)
            - summary (dict with total_issues, critical, major, minor, info)
            - prioritized_issues (list of issue dicts)
            - quick_wins (list of issue ids)
            - top_risks (list of issue ids)
            - analysis_metadata (optional)

        Returns canonical shape:
            - project: { name, repo_id, repo_full_name, version_or_commit }
            - scores: { overall_score, overall_grade, production_readiness, categories }
            - issues: list of { id, title, severity, category_key, ... }
            - fix_first: list of { title, why, owner_hint, effort, related_issue_ids }
    """
    score = orchestrator_result.get("overall_health_score", 100)
    grade = _score_to_grade(score)
    categories = orchestrator_result.get("category_scores", {})
    summary = orchestrator_result.get("summary", {})
    prioritized = orchestrator_result.get("prioritized_issues", [])
    quick_wins = orchestrator_result.get("quick_wins", [])
    top_risks = orchestrator_result.get("top_risks", [])

    # Build categories list for canonical format
    categories_list = [
        {
            "key": k,
            "label": k.replace("_", " ").title(),
            "score": v,
            "weight": 0.1,
            "not_applicable": False,
            "rationale": "",
        }
        for k, v in categories.items()
    ]

    # Build issues list (map to canonical issue shape)
    issues_list = []
    for i, issue in enumerate(prioritized):
        issue_id = issue.get("id") or f"issue-{i+1:03d}"
        issues_list.append({
            "id": issue_id,
            "title": issue.get("title", "Unknown"),
            "severity": (issue.get("severity") or "minor").upper(),
            "category_key": issue.get("category") or issue.get("module") or "general",
            "confidence": float(issue.get("confidence", 0.5)),
            "file_paths": [issue.get("file") or issue.get("file_path") or ""],
            "evidence": issue.get("evidence_refs") or issue.get("evidence") or [],
            "impact": issue.get("why_it_matters") or issue.get("description") or "",
            "recommendation": _get_recommendation(issue),
            "effort": "M",
            "tags": [],
        })

    # Fix-first: top_risks and quick_wins as actionable items
    fix_first_list = []
    for rid in top_risks[:5]:
        fix_first_list.append({
            "title": f"Address risk: {rid}",
            "why": "High-priority finding from analysis",
            "owner_hint": "security",
            "effort": "M",
            "related_issue_ids": [rid],
        })
    for qid in quick_wins[:3]:
        if qid not in top_risks:
            fix_first_list.append({
                "title": f"Quick win: {qid}",
                "why": "Low-effort improvement",
                "owner_hint": "backend",
                "effort": "S",
                "related_issue_ids": [qid],
            })

    return {
        "project": {
            "name": repo_full_name.split("/")[-1],
            "repo_id": repo_id,
            "repo_full_name": repo_full_name,
            "version_or_commit": commit_sha,
        },
        "trigger_source": trigger_source,
        "scores": {
            "overall_score": score,
            "overall_grade": grade,
            "production_readiness": "yes" if score >= 70 else ("conditional" if score >= 50 else "no"),
            "categories": categories_list,
        },
        "issues": issues_list,
        "fix_first": fix_first_list,
        "summary": summary,
        "raw_metadata": orchestrator_result.get("analysis_metadata"),
    }


def _score_to_grade(score: int) -> str:
    """Grade thresholds match models.review.calculate_grade — see that
    docstring for calibration rationale."""
    if score is None:
        return "F"
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def _get_recommendation(issue: Dict[str, Any]) -> str:
    fix = issue.get("suggested_fix")
    if isinstance(fix, dict) and fix.get("explanation"):
        return fix["explanation"]
    return issue.get("description") or "See evidence and apply fix."
