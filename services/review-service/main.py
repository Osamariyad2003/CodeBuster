from datetime import datetime
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from services.shared.config import settings
from services.shared.db import get_db
from services.shared import models
from services.shared.schemas.review import (
    CanonicalReview,
    ReviewSummary,
    ReviewScores,
    CategoryScore,
)
from services.shared.logging import setup_observability
from services.shared.security import require_org_role, Principal
from services.worker_service.celery_app import celery_app


app = FastAPI(title="CodeBuster Review Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_observability(app, service_name="review-service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "review-service", "env": settings.environment}


class ScanRequest(BaseModel):
    trigger: str = "manual"
    commit_sha: str | None = None


class ScanResponse(BaseModel):
    job_id: str | None = None
    review_run_id: UUID | None = None
    idempotent: bool = False
    inline: bool = False


class ReviewListItem(BaseModel):
    id: UUID
    repo_id: UUID
    commit_sha: str
    trigger_source: str
    trigger_type: str
    status: str
    overall_score: int | None = None
    overall_grade: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None


class ReviewListResponse(BaseModel):
    reviews: list[ReviewListItem]
    total: int


class RepoWithHealth(BaseModel):
    id: UUID
    org_id: UUID
    full_name: str
    default_branch: str | None = None
    latest_overall_score: int | None = None
    latest_overall_grade: str | None = None
    latest_review_id: UUID | None = None


@app.get("/api/v1/orgs/{org_id}/repos", response_model=list[RepoWithHealth])
def list_repositories_for_org(
    org_id: UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_org_role("owner", "admin", "member", "read_only")
    ),
) -> list[RepoWithHealth]:
    """List repositories for an organization with latest health scores."""
    if principal.org.id != org_id:
        raise HTTPException(status_code=403, detail="Organization mismatch")

    repos = (
        db.query(models.Repository)
        .filter(models.Repository.org_id == org_id)
        .order_by(models.Repository.full_name.asc())
        .all()
    )

    results: list[RepoWithHealth] = []
    for repo in repos:
        latest_review = (
            db.query(models.ReviewRun)
            .filter(models.ReviewRun.repo_id == repo.id)
            .order_by(models.ReviewRun.created_at.desc())
            .first()
        )
        results.append(
            RepoWithHealth(
                id=repo.id,
                org_id=repo.org_id,
                full_name=repo.full_name,
                default_branch=repo.default_branch,
                latest_overall_score=getattr(latest_review, "overall_score", None),
                latest_overall_grade=getattr(latest_review, "overall_grade", None),
                latest_review_id=getattr(latest_review, "id", None),
            )
        )

    return results


@app.get("/api/v1/repos/{repo_id}/reviews/latest")
def get_latest_review(
    repo_id: UUID,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_org_role("owner", "admin", "member", "read_only")),
) -> dict:
    """Return latest review summary for a repository.

    This is a thin wrapper that exposes the canonical review shape while we
    build out the full pipeline. For now it returns at most one review if it
    exists, or an empty payload.
    """
    review = (
        db.query(models.ReviewRun)
        .filter(models.ReviewRun.repo_id == repo_id)
        .order_by(models.ReviewRun.created_at.desc())
        .first()
    )
    if not review:
        return {
            "review": None,
            "categories": [],
            "top_issues": [],
            "fix_first": [],
        }

    # Minimal mapping; in a complete implementation we'd also hydrate findings.
    scores = ReviewScores(
        overall_score=review.overall_score or 0,
        overall_grade=review.overall_grade or "F",
        production_readiness=review.production_readiness or "no",
        categories=[
            CategoryScore(
                key=cs.category_key,
                label=cs.category_key.replace("_", " ").title(),
                score=cs.score,
                weight=cs.weight,
            )
            for cs in review.category_scores
        ],
    )

    summary = ReviewSummary(
        review_id=review.id,
        repository_id=review.repo_id,
        repo_full_name=review.repository.full_name if review.repository else "",
        commit_sha=review.commit_sha,
        trigger_source=review.trigger_source,
        created_at=review.created_at,
        overall_score=scores.overall_score,
        overall_grade=scores.overall_grade,
        production_readiness=scores.production_readiness,
    )

    return {
        "review": summary.dict(),
        "categories": [c.dict() for c in scores.categories],
        "top_issues": [],  # Filled once findings table is integrated
        "fix_first": [],  # Filled from FixFirstItem
    }


@app.get("/api/v1/repos/{repo_id}/reviews", response_model=ReviewListResponse)
def list_reviews(
    repo_id: UUID,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_org_role("owner", "admin", "member", "read_only")),
) -> ReviewListResponse:
    """Paginated list of reviews for a repository."""
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20

    query = (
        db.query(models.ReviewRun)
        .filter(models.ReviewRun.repo_id == repo_id)
        .order_by(models.ReviewRun.created_at.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    reviews = [
        ReviewListItem(
            id=r.id,
            repo_id=r.repo_id,
            commit_sha=r.commit_sha,
            trigger_source=r.trigger_source,
            trigger_type=r.trigger_type,
            status=r.status,
            overall_score=r.overall_score,
            overall_grade=r.overall_grade,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        for r in items
    ]

    return ReviewListResponse(reviews=reviews, total=total)


@app.post(
    "/api/v1/repos/{repo_id}/scans",
    response_model=ScanResponse,
    status_code=202,
)
def trigger_scan(
    repo_id: UUID,
    payload: ScanRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_org_role("owner", "admin", "member")
    ),
) -> ScanResponse:
    """Trigger a new review job for a repository.

    - Ensures the repository exists and belongs to the caller's org.
    - Performs a simple idempotency check on (repo_id, commit_sha).
    - Enqueues a Celery job that runs the minimal orchestrator pipeline.
    """
    repo = db.get(models.Repository, repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repo.org_id != principal.org.id:
        raise HTTPException(status_code=403, detail="Repository not in active organization")

    commit_sha = payload.commit_sha or ""
    if commit_sha:
        existing = (
            db.query(models.ReviewRun)
            .filter(
                models.ReviewRun.repo_id == repo_id,
                models.ReviewRun.commit_sha == commit_sha,
                models.ReviewRun.status == "completed",
            )
            .order_by(models.ReviewRun.created_at.desc())
            .first()
        )
        if existing:
            return ScanResponse(
                job_id=None,
                review_run_id=existing.id,
                idempotent=True,
                inline=False,
            )

    result = celery_app.send_task(
        "enqueue_review_job",
        args=[
            str(principal.org.id),
            str(repo.id),
            payload.trigger or "manual",
            "commit",
            commit_sha,
            None,
        ],
    )

    return ScanResponse(
        job_id=result.id,
        review_run_id=None,
        idempotent=False,
        inline=False,
    )


@app.get("/api/v1/reviews/{review_id}", response_model=CanonicalReview)
def get_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_org_role("owner", "admin", "member", "read_only")),
) -> CanonicalReview:
    review = db.query(models.ReviewRun).get(review_id)
    if not review or not review.canonical_payload:
        raise HTTPException(status_code=404, detail="Review not found")
    # Rely on CanonicalReview model for validation.
    return CanonicalReview.parse_obj(review.canonical_payload)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8082)

