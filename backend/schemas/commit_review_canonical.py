"""
Canonical Commit Review JSON schema (production-ready contract).
Kind: codebuster.commit_review, version: 1.0.0.

All fields that may be absent in current CodeBuster data are Optional.
Use this for API responses and frontend/backend consistency.
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# --- Trigger ---
class RequestedBy(BaseModel):
    type: Literal["user", "bot", "system"] = "user"
    id: Optional[int] = None
    login: Optional[str] = None


class Trigger(BaseModel):
    type: Literal["commit", "pull_request", "manual"] = "commit"
    source: Optional[str] = None  # github_webhook, api, ui
    event: Optional[str] = None   # push, pull_request
    requested_by: Optional[RequestedBy] = None


# --- Repo ---
class Repo(BaseModel):
    provider: Literal["github"] = "github"
    owner: str = ""
    name: str = ""
    full_name: str = ""
    repo_id: Optional[int] = None
    default_branch: str = "main"
    visibility: Optional[Literal["public", "private"]] = None
    url: Optional[str] = None


# --- Commit ---
class AuthorOrCommitter(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class Compare(BaseModel):
    base_sha: Optional[str] = None
    head_sha: Optional[str] = None
    url: Optional[str] = None


class Commit(BaseModel):
    sha: str = ""
    branch: Optional[str] = None
    message: Optional[str] = None
    author: Optional[AuthorOrCommitter] = None
    committer: Optional[AuthorOrCommitter] = None
    committed_at: Optional[str] = None
    compare: Optional[Compare] = None


# --- Status ---
class Queue(BaseModel):
    job_id: Optional[str] = None
    priority: Literal["low", "normal", "high"] = "normal"


class Status(BaseModel):
    state: Literal["pending", "running", "completed", "failed"] = "completed"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    queue: Optional[Queue] = None
    errors: List[str] = Field(default_factory=list)


# --- Policy ---
class MergeGate(BaseModel):
    enabled: bool = False
    block_on: List[str] = Field(default_factory=list)  # e.g. ["critical"]
    require_justification_for_ignore: bool = False


class Policy(BaseModel):
    ruleset_id: Optional[str] = None
    ruleset_name: Optional[str] = None
    merge_gate: Optional[MergeGate] = None


# --- Scores ---
class OverallScore(BaseModel):
    value: int = 0
    grade: str = "F"
    trend: Optional[Literal["up", "down", "stable"]] = None


class DimensionScore(BaseModel):
    value: int = 0
    grade: str = "F"


class CategoryScore(BaseModel):
    key: str = ""
    score: int = 0


class Scores(BaseModel):
    overall: Optional[OverallScore] = None
    by_dimension: Dict[str, DimensionScore] = Field(default_factory=dict)
    by_category: List[CategoryScore] = Field(default_factory=list)


# --- Summary ---
class Summary(BaseModel):
    severity_counts: Dict[str, int] = Field(default_factory=dict)
    top_risks: List[str] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)


# --- Analyzers ---
class AnalyzerStats(BaseModel):
    files_scanned: Optional[int] = None
    findings: Optional[int] = None


class AnalyzerRun(BaseModel):
    id: str = ""
    name: str = ""
    status: Literal["pending", "running", "completed", "failed", "skipped"] = "completed"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    version: Optional[str] = None
    stats: Optional[AnalyzerStats] = None
    error: Optional[str] = None


# --- Findings ---
class EvidenceSnippet(BaseModel):
    file_path: str = ""
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    excerpt: Optional[str] = None


class Evidence(BaseModel):
    snippets: List[EvidenceSnippet] = Field(default_factory=list)


class Location(BaseModel):
    file_path: str = ""
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    commit_sha: Optional[str] = None


class Recommendation(BaseModel):
    summary: Optional[str] = None
    steps: List[str] = Field(default_factory=list)


class SuggestedPatch(BaseModel):
    format: Optional[str] = None  # e.g. unified_diff
    diff: Optional[str] = None


class Reference(BaseModel):
    type: Optional[str] = None  # cwe, owasp, etc.
    id: Optional[str] = None
    title: Optional[str] = None


class Lifecycle(BaseModel):
    status: Literal["open", "resolved", "ignored"] = "open"
    first_seen_at: Optional[str] = None
    resolved_at: Optional[str] = None
    ignored: Optional[Dict[str, Any]] = None


class Finding(BaseModel):
    finding_id: str = ""
    severity: Literal["critical", "major", "minor", "info"] = "minor"
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    dimension: Optional[str] = None
    category: Optional[str] = None
    title: str = ""
    description: Optional[str] = None
    impact: Optional[str] = None
    evidence: Optional[Evidence] = None
    locations: List[Location] = Field(default_factory=list)
    recommendation: Optional[Recommendation] = None
    suggested_patch: Optional[SuggestedPatch] = None
    references: List[Reference] = Field(default_factory=list)
    labels: List[str] = Field(default_factory=list)
    lifecycle: Optional[Lifecycle] = None


# --- Artifacts ---
class RawAnalyzerOutput(BaseModel):
    analyzer_id: str = ""
    uri: Optional[str] = None


class Export(BaseModel):
    json_uri: Optional[str] = None
    pdf_uri: Optional[str] = None


class Artifacts(BaseModel):
    report_url: Optional[str] = None
    raw_analyzer_outputs: List[RawAnalyzerOutput] = Field(default_factory=list)
    export: Optional[Export] = None


# --- Metadata ---
class Generator(BaseModel):
    name: str = "codebuster"
    build: Optional[str] = None


class Metadata(BaseModel):
    generated_at: Optional[str] = None
    generator: Optional[Generator] = None


# --- Root ---
class CommitReviewCanonical(BaseModel):
    """Production-ready canonical Commit Review payload."""
    kind: Literal["codebuster.commit_review"] = "codebuster.commit_review"
    version: str = "1.0.0"

    review_id: str = ""
    workspace_id: Optional[str] = None

    trigger: Optional[Trigger] = None
    repo: Optional[Repo] = None
    commit: Optional[Commit] = None
    status: Optional[Status] = None
    policy: Optional[Policy] = None

    scores: Optional[Scores] = None
    summary: Optional[Summary] = None
    analyzers: List[AnalyzerRun] = Field(default_factory=list)
    findings: List[Finding] = Field(default_factory=list)

    artifacts: Optional[Artifacts] = None
    metadata: Optional[Metadata] = None

    class Config:
        extra = "allow"  # allow additional fields for forward compatibility

    def to_json_dict(self) -> Dict[str, Any]:
        return self.model_dump(exclude_none=False)
