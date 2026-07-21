from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.database import get_db
from backend.api.models.review import Review
from backend.api.schemas.reviews import FindingOut, ReviewDetailOut, ReviewListOut, ReviewOut

router = APIRouter(prefix="/api", tags=["reviews"])


@router.get("/reviews", response_model=ReviewListOut)
def list_reviews(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ReviewListOut:
    q = db.query(Review).order_by(Review.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return ReviewListOut(
        reviews=[ReviewOut.model_validate(r) for r in items],
        total=total,
    )


@router.get("/reviews/{review_id}", response_model=ReviewDetailOut)
def get_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    severity: str | None = Query(None),
    category: str | None = Query(None),
) -> ReviewDetailOut:
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    findings: list[FindingOut] = []
    canonical = review.canonical_payload or {}
    raw_findings = canonical.get("findings") or []
    for f in raw_findings:
        if isinstance(f, dict):
            if severity and f.get("severity") != severity:
                continue
            if category and f.get("category") != category:
                continue
            findings.append(
                FindingOut(
                    id=str(f.get("id", "")),
                    severity=f.get("severity", ""),
                    category=f.get("category"),
                    confidence=f.get("confidence"),
                    file=f.get("file"),
                    start_line=f.get("start_line"),
                    end_line=f.get("end_line"),
                    message=f.get("explanation") or f.get("summary"),
                )
            )

    return ReviewDetailOut(
        id=review.id,
        repo_id=review.repo_id,
        overall_score=review.overall_score,
        overall_grade=review.overall_grade,
        category_scores=review.category_scores,
        findings=findings,
        canonical_payload=canonical,
        created_at=review.created_at,
        completed_at=review.completed_at,
    )
