"""Celery tasks implementing the new review pipeline.

This is a minimal but end-to-end implementation:

* `enqueue_review_job` is intended to be called by HTTP services when a scan
  should be triggered (e.g. from GitHub webhooks or the dashboard).
* `run_review_job` orchestrates dummy analyzers, calls a lightweight AI
  reasoning stub, and persists a canonical review JSON into `review_runs`.
"""

from datetime import datetime
from typing import Any, Dict, List
from uuid import UUID, uuid4

from celery import shared_task

from services.shared.config import settings
from services.shared.db import session_scope
from services.shared import models


def _dummy_analyzers(repo_full_name: str, commit_sha: str) -> List[Dict[str, Any]]:
    """Very small set of analyzers that produce structured findings.

    In production these would call Bandit, ESLint, Semgrep, IaC scanners, etc.
    """
    base_file = f"{repo_full_name.split('/')[-1]}/main.py"
    return [
        {
            "id": str(uuid4()),
            "severity": "CRITICAL",
            "category": "security",
            "module": "security",
            "rule_id": "SEC001",
            "file": base_file,
            "start_line": 42,
            "end_line": 42,
            "explanation": "Use of hard-coded secret detected.",
            "suggested_fix": {
                "summary": "Move secrets to environment variables or a secret manager.",
                "steps": [
                    "Remove the hard-coded secret from the source file.",
                    "Inject the value via environment variable or secret manager.",
                ],
            },
            "confidence": 0.9,
        },
        {
            "id": str(uuid4()),
            "severity": "MINOR",
            "category": "quality",
            "module": "quality",
            "rule_id": "STYLE001",
            "file": base_file,
            "start_line": 10,
            "end_line": 15,
            "explanation": "Function exceeds recommended length; consider refactoring.",
            "suggested_fix": {
                "summary": "Extract helper functions to improve readability.",
            },
            "confidence": 0.7,
        },
    ]


def _ai_reason_over_findings(
    findings: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Very lightweight AI-like reasoning step.

    We approximate scores based on finding severities rather than calling a
    real LLM, but keep the shape identical so swapping an LLM later is easy.
    """
    severity_weight = {"CRITICAL": 40, "MAJOR": 20, "MINOR": 10, "INFO": 0}
    total_penalty = sum(severity_weight.get(f["severity"], 0) for f in findings)
    overall_score = max(0, 100 - total_penalty)
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

    severity_counts = {"CRITICAL": 0, "MAJOR": 0, "MINOR": 0, "INFO": 0}
    for f in findings:
        sev = f["severity"]
        if sev in severity_counts:
            severity_counts[sev] += 1

    return {
        "overall_score": overall_score,
        "overall_grade": grade,
        "severity_counts": severity_counts,
    }


def _build_canonical_payload(
    repo: models.Repository,
    review_run: models.ReviewRun,
    findings: List[Dict[str, Any]],
    scores: Dict[str, Any],
) -> Dict[str, Any]:
    """Create a minimal `codebuster.review.v1` payload."""
    canonical_findings: List[Dict[str, Any]] = []
    for f in findings:
        canonical_findings.append(
            {
                "id": f["id"],
                "severity": f["severity"],
                "category": f["category"],
                "module": f["module"],
                "rule_id": f["rule_id"],
                "confidence": f["confidence"],
                "file": f["file"],
                "start_line": f["start_line"],
                "end_line": f["end_line"],
                "explanation": f["explanation"],
                "suggested_fix": f["suggested_fix"],
                "evidence": [],
                "references": [],
            }
        )

    fix_first = [
        {
            "id": str(uuid4()),
            "title": "Address hard-coded secrets",
            "why": "Critical security risk identified by static analysis.",
            "owner_hint": "security",
            "effort": "M",
            "related_finding_ids": [canonical_findings[0]["id"]]
            if canonical_findings
            else [],
            "status": "pending",
        }
    ]

    return {
        "project": {
            "name": repo.full_name.split("/")[-1],
            "repo_id": str(repo.id),
            "repo_full_name": repo.full_name,
            "default_branch": repo.default_branch,
            "installation_id": repo.installation_id,
        },
        "trigger": {
            "source": review_run.trigger_source,
            "type": review_run.trigger_type,
            "commit_sha": review_run.commit_sha,
            "branch": review_run.branch,
            "pr_number": review_run.pr_number,
        },
        "scores": {
            "overall_score": scores["overall_score"],
            "overall_grade": scores["overall_grade"],
            "production_readiness": "yes" if scores["overall_score"] >= 70 else "no",
            "categories": [
                {
                    "key": "security",
                    "label": "Security",
                    "score": max(0, scores["overall_score"] - 10),
                    "weight": 0.3,
                }
            ],
        },
        "findings": canonical_findings,
        "fix_first": fix_first,
        "summary": {
            "severity_counts": scores["severity_counts"],
            "top_risks": ["Hard-coded secrets"],
            "next_actions": ["Rotate any exposed credentials and add checks to CI."],
            "key_insights": [],
        },
        "analyzers": {
            "run": [
                {
                    "key": "security",
                    "version": "0.1.0",
                    "status": "completed",
                    "duration_ms": 500,
                    "findings_count": len(findings),
                }
            ],
            "by_tool": {},
        },
        "metadata": {
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "orchestrator_version": "0.1.0",
            "llm_model": settings.llm_model,
            "config_hash": "initial",
        },
    }


@shared_task(name="enqueue_review_job")
def enqueue_review_job(
    org_id: str,
    repo_id: str,
    trigger_source: str,
    trigger_type: str,
    commit_sha: str,
    pr_number: int | None = None,
) -> str:
    """Create a ReviewJob row and schedule execution."""
    with session_scope() as db:
        job = models.ReviewJob(
            org_id=UUID(org_id),
            repo_id=UUID(repo_id),
            trigger_source=trigger_source,
            payload={
                "trigger_type": trigger_type,
                "commit_sha": commit_sha,
                "pr_number": pr_number,
            },
            status="queued",
            created_at=datetime.utcnow(),
        )
        db.add(job)
        db.flush()
        job_id = str(job.id)

    run_review_job.delay(job_id)
    return job_id


@shared_task(name="run_review_job")
def run_review_job(job_id: str) -> None:
    """End-to-end orchestration for a single review job."""
    with session_scope() as db:
        job: models.ReviewJob | None = db.get(models.ReviewJob, UUID(job_id))
        if not job:
            return

        repo: models.Repository | None = db.get(models.Repository, job.repo_id)
        if not repo:
            job.status = "failed"
            job.error_message = "Repository not found"
            return

        job.status = "running"
        job.started_at = datetime.utcnow()

        # 1. Run analyzers (dummy for now)
        commit_sha = job.payload.get("commit_sha") if job.payload else ""
        findings = _dummy_analyzers(repo.full_name, commit_sha)

        # 2. AI reasoning stub
        scores = _ai_reason_over_findings(findings)

        # 3. Persist ReviewRun + related entities
        review_run = models.ReviewRun(
            org_id=job.org_id,
            repo_id=job.repo_id,
            trigger_source=job.trigger_source,
            trigger_type=job.payload.get("trigger_type") if job.payload else "commit",
            commit_sha=commit_sha,
            pr_number=job.payload.get("pr_number") if job.payload else None,
            branch=None,
            status="completed",
            overall_score=scores["overall_score"],
            overall_grade=scores["overall_grade"],
            production_readiness="yes" if scores["overall_score"] >= 70 else "no",
            created_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        db.add(review_run)
        db.flush()

        canonical = _build_canonical_payload(repo, review_run, findings, scores)
        review_run.canonical_payload = canonical

        # Link job → review
        job.review_run_id = review_run.id
        job.status = "completed"
        job.finished_at = datetime.utcnow()

