from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RepoOut(BaseModel):
    id: UUID
    full_name: str
    default_branch: Optional[str] = None

    class Config:
        from_attributes = True


class RepoHealthOut(BaseModel):
    repo_id: UUID
    full_name: str
    latest_score: Optional[int] = None
    latest_grade: Optional[str] = None
    latest_review_id: Optional[UUID] = None


class RepoSettingsIn(BaseModel):
    enabled_analyzers: Optional[List[str]] = Field(None, description="e.g. security, quality, performance")
    min_severity: Optional[str] = Field(None, pattern="^(CRITICAL|MAJOR|MINOR|INFO)$")
    fail_pr_on_grade_below: Optional[str] = Field(None, pattern="^[A-F]$")


class RepoSettingsOut(BaseModel):
    repo_id: UUID
    enabled_analyzers: List[str] = Field(default_factory=list)
    min_severity: str = "MINOR"
    fail_pr_on_grade_below: str = "D"

    class Config:
        from_attributes = True
