from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ReviewOut(BaseModel):
    id: UUID
    repo_id: UUID
    overall_score: Optional[int] = None
    overall_grade: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewListOut(BaseModel):
    reviews: List[ReviewOut]
    total: int


class FindingOut(BaseModel):
    id: str
    severity: str
    category: Optional[str] = None
    confidence: Optional[float] = None
    file: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    message: Optional[str] = None


class ReviewDetailOut(BaseModel):
    id: UUID
    repo_id: UUID
    overall_score: Optional[int] = None
    overall_grade: Optional[str] = None
    category_scores: Optional[List[Dict[str, Any]]] = None
    findings: List[FindingOut] = Field(default_factory=list)
    canonical_payload: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
