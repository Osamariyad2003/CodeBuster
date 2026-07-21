from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.database import get_db
from backend.api.models.repo import Repository, RepoSettings
from backend.api.models.review import Review
from backend.api.schemas.repos import RepoHealthOut, RepoOut, RepoSettingsIn, RepoSettingsOut

router = APIRouter(prefix="/api", tags=["repos"])


@router.get("/repos", response_model=list[RepoOut])
def list_repos(db: Session = Depends(get_db)) -> list[RepoOut]:
    repos = db.query(Repository).order_by(Repository.full_name).all()
    return [RepoOut.model_validate(r) for r in repos]


@router.get("/repos/{repo_id}/health", response_model=RepoHealthOut)
def get_repo_health(repo_id: UUID, db: Session = Depends(get_db)) -> RepoHealthOut:
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    latest = db.query(Review).filter(Review.repo_id == repo_id).order_by(Review.created_at.desc()).first()
    return RepoHealthOut(
        repo_id=repo.id,
        full_name=repo.full_name,
        latest_score=latest.overall_score if latest else None,
        latest_grade=latest.overall_grade if latest else None,
        latest_review_id=latest.id if latest else None,
    )


@router.get("/repos/{repo_id}/settings", response_model=RepoSettingsOut)
def get_repo_settings(repo_id: UUID, db: Session = Depends(get_db)) -> RepoSettingsOut:
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    settings = db.query(RepoSettings).filter(RepoSettings.repo_id == repo_id).first()
    if not settings:
        settings = RepoSettings(repo_id=repo_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return RepoSettingsOut(
        repo_id=settings.repo_id,
        enabled_analyzers=settings.enabled_analyzers or [],
        min_severity=settings.min_severity or "MINOR",
        fail_pr_on_grade_below=settings.fail_pr_on_grade_below or "D",
    )


@router.patch("/repos/{repo_id}/settings", response_model=RepoSettingsOut)
def update_repo_settings(
    repo_id: UUID,
    body: RepoSettingsIn,
    db: Session = Depends(get_db),
) -> RepoSettingsOut:
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    settings = db.query(RepoSettings).filter(RepoSettings.repo_id == repo_id).first()
    if not settings:
        settings = RepoSettings(repo_id=repo_id)
        db.add(settings)
        db.flush()
    if body.enabled_analyzers is not None:
        settings.enabled_analyzers = body.enabled_analyzers
    if body.min_severity is not None:
        settings.min_severity = body.min_severity
    if body.fail_pr_on_grade_below is not None:
        settings.fail_pr_on_grade_below = body.fail_pr_on_grade_below
    db.commit()
    db.refresh(settings)
    return RepoSettingsOut(
        repo_id=settings.repo_id,
        enabled_analyzers=settings.enabled_analyzers or [],
        min_severity=settings.min_severity or "MINOR",
        fail_pr_on_grade_below=settings.fail_pr_on_grade_below or "D",
    )
