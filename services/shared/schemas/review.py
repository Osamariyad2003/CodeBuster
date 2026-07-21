from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryScore(BaseModel):
    key: str
    label: str
    score: int = Field(..., ge=0, le=100)
    weight: Optional[float] = None


class FindingSuggestion(BaseModel):
    summary: str
    diff: Optional[str] = None
    steps: Optional[List[str]] = None


class FindingEvidence(BaseModel):
    snippet: str
    file: str
    line: int


class FindingReference(BaseModel):
    title: str
    url: str


class Finding(BaseModel):
    id: UUID
    severity: str
    category: Optional[str] = None
    module: Optional[str] = None
    rule_id: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    file: str
    start_line: int
    end_line: Optional[int] = None
    start_column: Optional[int] = None
    end_column: Optional[int] = None
    explanation: str
    suggested_fix: FindingSuggestion
    evidence: Optional[List[FindingEvidence]] = None
    references: Optional[List[FindingReference]] = None


class FixFirstItem(BaseModel):
    id: UUID
    title: str
    why: str
    owner_hint: Optional[str] = None
    effort: str = Field(..., regex="^(S|M|L)$")
    related_finding_ids: List[UUID] = Field(default_factory=list)
    status: str = Field(..., regex="^(pending|in_progress|done)$")


class ReviewScores(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    overall_grade: str = Field(..., regex="^[A-F]$")
    production_readiness: str
    categories: List[CategoryScore]


class ReviewSummary(BaseModel):
    review_id: UUID
    repository_id: UUID
    repo_full_name: str
    commit_sha: str
    trigger_source: str
    created_at: Optional[datetime] = None
    overall_score: int
    overall_grade: str
    production_readiness: Optional[str] = None


class CanonicalReview(BaseModel):
    """Top-level canonical review schema (codebuster.review.v1)."""

    project: dict
    trigger: dict
    scores: ReviewScores
    findings: List[Finding]
    fix_first: List[FixFirstItem]
    summary: dict
    analyzers: dict
    metadata: dict

    class Config:
        orm_mode = True

