from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class ReviewRequestSchema(BaseModel):
    repository_id: str
    branch: Optional[str] = "main"
    files: Optional[List[str]] = None

class JobResponseSchema(BaseModel):
    job_id: str
    status: str = "queued"

class IssueSchema(BaseModel):
    id: str
    severity: str
    title: str
    file: str
    line: Optional[int]
    description: Optional[str]
    suggested_fix: Optional[Dict[str, Any]] = None

class ReviewResponseSchema(BaseModel):
    id: str
    status: str
    overall_health_score: Optional[int] = None
    issues: List[IssueSchema] = []
    created_at: datetime
    completed_at: Optional[datetime] = None

class ErrorResponseSchema(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    request_id: str


class GithubOwnerSchema(BaseModel):
    """Minimal, safe subset of GitHub owner fields."""

    login: str
    avatar_url: Optional[str] = None


class GithubRepoItemSchema(BaseModel):
    """Safe projection of a GitHub repository for search results."""

    id: int
    full_name: str
    html_url: str
    description: Optional[str] = None
    stargazers_count: int = 0
    language: Optional[str] = None
    updated_at: Optional[datetime] = None
    owner: GithubOwnerSchema
    # CodeBuster-specific fields (safe to expose)
    is_connected: Optional[bool] = None
    connected_repo_id: Optional[str] = None
    installation_id: Optional[int] = None


class InstalledReposResponseSchema(BaseModel):
    """Response shape for 'My Installed Repos' search."""

    items: List[GithubRepoItemSchema]
    page: int
    per_page: int
    total_estimate: int
    source: str = "installed"


class PublicReposResponseSchema(BaseModel):
    """Response shape for 'Public GitHub' search."""

    items: List[GithubRepoItemSchema]
    page: int
    per_page: int
    total_count: int
    source: str = "public"
