"""
Build canonical codebuster.commit_review JSON from DB models (Review, Issue, Repository).
Keeps backend and frontend consistent with the production-ready contract.
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from schemas.commit_review_canonical import (
    CommitReviewCanonical,
    Trigger,
    RequestedBy,
    Repo,
    Commit,
    AuthorOrCommitter,
    Status,
    Queue,
    Scores,
    OverallScore,
    DimensionScore,
    CategoryScore,
    Summary,
    Finding,
    Evidence,
    EvidenceSnippet,
    Location,
    Recommendation,
    Lifecycle,
    Metadata,
    Generator,
    Artifacts,
    AnalyzerRun,
    AnalyzerStats,
)


def _score_to_grade(score: int) -> str:
    """Grade thresholds match models.review.calculate_grade — see that
    docstring for calibration rationale."""
    if score is None:
        return "F"
    if score >= 85: return "A"
    if score >= 70: return "B"
    if score >= 55: return "C"
    if score >= 40: return "D"
    return "F"


def build_canonical_from_review(
    review: Any,
    issues: List[Any],
    repository: Any,
    *,
    report_base_url: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build canonical codebuster.commit_review payload from DB Review, Issues, and Repository.

    Returns a dict suitable for JSON response (not Pydantic model) so it can include
    extra keys and stay consistent with the schema contract.
    """
    # Repo
    owner = (repository.owner or "") if repository else ""
    name = (repository.name or "") if repository else ""
    full_name = (repository.full_name or f"{owner}/{name}") if repository else ""
    repo_obj = Repo(
        provider="github",
        owner=owner,
        name=name,
        full_name=full_name,
        repo_id=getattr(repository, "github_repo_id", None),
        default_branch=getattr(repository, "default_branch", None) or "main",
        visibility="private" if getattr(repository, "is_private", False) else "public",
        url=f"https://github.com/{full_name}" if full_name else None,
    )

    # Commit
    commit_sha = getattr(review, "commit_sha", None) or ""
    branch = getattr(review, "branch", None) or "main"
    commit_obj = Commit(
        sha=commit_sha,
        branch=branch,
        message=None,
        author=None,
        committer=None,
        committed_at=None,
        compare=None,
    )

    # Trigger
    trigger_type = getattr(review, "trigger_type", None) or "manual"
    trigger_obj = Trigger(
        type="commit" if trigger_type in ("webhook", "push") else ("pull_request" if "pr" in (trigger_type or "") else "manual"),
        source=trigger_type,
        event="push" if trigger_type == "webhook" else None,
        requested_by=None,
    )

    # Status
    started_at = getattr(review, "started_at", None)
    completed_at = getattr(review, "completed_at", None)
    duration_ms = None
    if started_at and completed_at:
        try:
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
        except Exception:
            pass
    status_obj = Status(
        state=(getattr(review, "status", None) or "completed").lower(),
        started_at=started_at.isoformat() + "Z" if started_at else None,
        completed_at=completed_at.isoformat() + "Z" if completed_at else None,
        duration_ms=duration_ms,
        queue=Queue(job_id=None, priority="normal"),
        errors=[],
    )

    # Scores
    overall_score = getattr(review, "overall_health_score", None) or 0
    categories = review.get_category_scores() if hasattr(review, "get_category_scores") else {}
    if not isinstance(categories, dict):
        categories = {}
    overall_obj = OverallScore(value=overall_score, grade=_score_to_grade(overall_score), trend=None)
    by_dimension = {k: DimensionScore(value=v, grade=_score_to_grade(v)) for k, v in categories.items()}
    by_category = [CategoryScore(key=k, score=v) for k, v in categories.items()]
    scores_obj = Scores(overall=overall_obj, by_dimension=by_dimension, by_category=by_category)

    # Summary
    severity_counts: Dict[str, int] = {"critical": 0, "major": 0, "minor": 0, "info": 0}
    issues_by_id = {getattr(i, "id", None): i for i in issues if getattr(i, "id", None)}
    for i in issues:
        sev = (getattr(i, "severity", None) or "minor").lower()
        if sev not in severity_counts:
            severity_counts[sev] = 0
        severity_counts[sev] += 1
    raw_top_risks = review.get_top_risks() if hasattr(review, "get_top_risks") else []
    top_risks: List[str] = []
    for r in (raw_top_risks or [])[:10]:
        if isinstance(r, str):
            if r in issues_by_id:
                top_risks.append(getattr(issues_by_id[r], "title", None) or r)
            else:
                top_risks.append(r)
    raw_next = review.get_quick_wins() if hasattr(review, "get_quick_wins") else []
    next_actions = []
    for q in (raw_next or [])[:5]:
        if isinstance(q, str):
            if q in issues_by_id:
                next_actions.append(getattr(issues_by_id[q], "title", None) or q)
            else:
                next_actions.append(q)
    summary_obj = Summary(severity_counts=severity_counts, top_risks=top_risks, next_actions=next_actions)

    # Findings
    findings_list: List[Finding] = []
    for i in issues:
        ev_list = i.get_evidence() if hasattr(i, "get_evidence") else []
        if not isinstance(ev_list, list):
            ev_list = []
        snippets = []
        for ev in ev_list[:5]:
            if isinstance(ev, dict):
                snippets.append(EvidenceSnippet(
                    file_path=ev.get("file_path") or i.file_path or "",
                    start_line=ev.get("start_line"),
                    end_line=ev.get("end_line"),
                    excerpt=ev.get("excerpt") or ev.get("text"),
                ))
            elif isinstance(ev, str):
                snippets.append(EvidenceSnippet(file_path=i.file_path or "", excerpt=ev))
        if not snippets and (i.file_path or i.code_snippet):
            snippets.append(EvidenceSnippet(
                file_path=i.file_path or "",
                start_line=i.line_number,
                end_line=i.line_number,
                excerpt=i.code_snippet,
            ))
        evidence_obj = Evidence(snippets=snippets) if snippets else None
        loc = Location(
            file_path=i.file_path or "",
            start_line=i.line_number,
            end_line=i.line_number,
            commit_sha=commit_sha or None,
        )
        rec = Recommendation(
            summary=i.description or None,
            steps=[],
        )
        lifecycle = Lifecycle(
            status=(i.status or "open").lower() if (i.status or "open").lower() in ("open", "resolved", "ignored") else "open",
            first_seen_at=i.created_at.isoformat() + "Z" if getattr(i, "created_at", None) else None,
            resolved_at=None,
            ignored=None,
        )
        severity = (i.severity or "minor").lower()
        if severity not in ("critical", "major", "minor", "info"):
            severity = "minor"
        findings_list.append(Finding(
            finding_id=i.id,
            severity=severity,
            confidence=float(i.confidence or 0.5),
            dimension=i.module,
            category=i.category,
            title=i.title or "Finding",
            description=i.description,
            impact=i.description,
            evidence=evidence_obj,
            locations=[loc],
            recommendation=rec,
            suggested_patch=None,
            references=[],
            labels=[i.module] if i.module else [],
            lifecycle=lifecycle,
        ))

    # Analyzers: from stored analysis_metadata (all tools that ran + by_tool counts)
    analyzers_list: List[Any] = []
    try:
        raw = getattr(review, "extra_metadata", None)
        if isinstance(raw, str):
            meta = json.loads(raw)
        else:
            meta = raw if isinstance(raw, dict) else {}
        runs = meta.get("analyzers_run") or []
        by_tool = meta.get("by_tool") or {}
        for aid in runs:
            count = by_tool.get(aid, 0)
            analyzers_list.append(
                AnalyzerRun(
                    id=aid,
                    name=aid.replace("_", " ").title(),
                    status="completed",
                    stats=AnalyzerStats(findings=count) if count is not None else None,
                )
            )
        # Also add any tools that reported findings but weren't in analyzers_run
        for tool_id, count in by_tool.items():
            if count and not any(a.id == tool_id for a in analyzers_list):
                analyzers_list.append(
                    AnalyzerRun(
                        id=tool_id,
                        name=tool_id.replace("_", " ").title(),
                        status="completed",
                        stats=AnalyzerStats(findings=count),
                    )
                )
    except Exception:
        pass

    # Artifacts
    review_id = getattr(review, "id", "")
    report_url = None
    if report_base_url:
        report_url = f"{report_base_url.rstrip('/')}/reviews/{review_id}"
    artifacts_obj = Artifacts(report_url=report_url, raw_analyzer_outputs=[], export=None)

    # Metadata
    now = datetime.utcnow().isoformat() + "Z"
    metadata_obj = Metadata(generated_at=now, generator=Generator(name="codebuster", build=None))

    payload = CommitReviewCanonical(
        kind="codebuster.commit_review",
        version="1.0.0",
        review_id=review_id,
        workspace_id=workspace_id,
        trigger=trigger_obj,
        repo=repo_obj,
        commit=commit_obj,
        status=status_obj,
        policy=None,
        scores=scores_obj,
        summary=summary_obj,
        analyzers=analyzers_list,
        findings=findings_list,
        artifacts=artifacts_obj,
        metadata=metadata_obj,
    )
    return payload.model_dump()
