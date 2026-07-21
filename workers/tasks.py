"""Celery task: run analyzers, merge, persist review."""
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from backend.api.database import SessionLocal
from backend.api.models.repo import Repository
from backend.api.models.review import Review, ReviewJob
from workers.celery_app import celery_app
from workers.analyzers import ANALYZERS
from workers.merger import merge
from workers.storage import put_artifact
import json


@celery_app.task(name="run_review_task", bind=True)
def run_review_task(self, job_id: str) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(ReviewJob).filter(ReviewJob.id == UUID(job_id)).first()
        if not job:
            return
        job.status = "running"
        job.started_at = datetime.utcnow()
        db.commit()

        repo = db.query(Repository).filter(Repository.id == job.repo_id).first()
        if not repo:
            job.status = "failed"
            job.error_message = "Repository not found"
            db.commit()
            return

        repo_full_name = repo.full_name
        commit_sha = job.commit_sha or "HEAD"
        enabled = ["security", "quality", "performance", "maintainability", "devops", "frontend"]

        analyzer_results: dict = {}
        for key in enabled:
            if key not in ANALYZERS:
                continue
            try:
                findings = ANALYZERS[key](repo_full_name, commit_sha)
                analyzer_results[key] = findings
            except Exception as e:
                analyzer_results[key] = [{"id": f"{key}-error", "severity": "INFO", "explanation": str(e), "category": key, "module": key, "file": "", "start_line": 0, "confidence": 0}]

        canonical = merge(
            repo_full_name=repo_full_name,
            commit_sha=commit_sha,
            branch=job.branch,
            pr_number=job.pr_number,
            trigger=job.trigger,
            analyzer_results=analyzer_results,
        )

        artifact_key = f"reviews/{job_id}.json"
        put_artifact(artifact_key, json.dumps(canonical).encode("utf-8"))

        review = Review(
            job_id=job.id,
            repo_id=job.repo_id,
            overall_score=canonical["scores"]["overall_score"],
            overall_grade=canonical["scores"]["overall_grade"],
            category_scores=canonical["scores"].get("categories"),
            canonical_payload=canonical,
            artifact_path=artifact_key,
            completed_at=datetime.utcnow(),
        )
        db.add(review)
        job.status = "completed"
        job.finished_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()
