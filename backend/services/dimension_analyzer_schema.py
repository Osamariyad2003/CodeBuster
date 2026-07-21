"""
Shared JSON schema for CodeBuster dimension analyzers.
Every dimension analyzer (security, code_quality, performance, etc.) must return this structure.
"""
from __future__ import annotations

from typing import List, Literal, Optional, Union
from pydantic import BaseModel, Field

# Allowed analyzer keys
ANALYZER_KEYS = Literal[
    "architecture", "code_quality", "security", "performance",
    "reliability", "devops", "observability", "data", "frontend", "ai",
    "dependencies", "secrets"
]
SEVERITY_ENUM = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
EFFORT_ENUM = Literal["S", "M", "L"]


class AnalyzerInfo(BaseModel):
    key: ANALYZER_KEYS
    label: str
    version: str = "1.0"


class TargetInfo(BaseModel):
    repo_id: Union[str, int, Literal["unknown"]] = "unknown"
    repo_full_name: str = "unknown"
    repo_url: str = "unknown"
    commit_sha: str = "unknown"


class CategoryResult(BaseModel):
    score: int = Field(..., ge=0, le=100)
    not_applicable: bool = False
    rationale: str = ""


class DimensionIssue(BaseModel):
    id: str  # e.g. "security-001"
    title: str
    severity: SEVERITY_ENUM
    category_key: ANALYZER_KEYS
    confidence: float = Field(..., ge=0.0, le=1.0)
    file_paths: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    impact: str = ""
    recommendation: str = ""
    effort: EFFORT_ENUM = "M"
    tags: List[str] = Field(default_factory=list)


class Signal(BaseModel):
    key: str
    label: str
    value: Union[int, float]
    unit: str = "none"


class DimensionAnalyzerResult(BaseModel):
    analyzer: AnalyzerInfo
    target: TargetInfo
    category_result: CategoryResult
    issues: List[DimensionIssue] = Field(default_factory=list)
    signals: List[Signal] = Field(default_factory=list)

    def to_json_dict(self) -> dict:
        """Return a dict suitable for JSON serialization (no Pydantic artifacts)."""
        return self.model_dump()


def severity_legacy_to_enum(legacy: str) -> str:
    """Map legacy severity (critical/major/minor/info) to CRITICAL|HIGH|MEDIUM|LOW."""
    s = (legacy or "").strip().lower()
    if s in ("critical", "crit"):
        return "CRITICAL"
    if s in ("major", "high"):
        return "HIGH"
    if s in ("minor", "medium"):
        return "MEDIUM"
    if s in ("info", "low"):
        return "LOW"
    return "MEDIUM"
