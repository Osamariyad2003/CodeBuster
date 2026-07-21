"""
Schema for the SonarQube + Awesome-Linters + Claude enriched review response.

This defines the standardized "review response formula" JSON contract that
combines SonarQube scan data, cross-referenced Awesome-Linters rules, and
AI-generated descriptions and fixes from Claude.
"""
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class LinterReference(BaseModel):
    """Reference to a linter rule that corresponds to a SonarQube finding."""
    linter_name: str = ""
    linter_rule_id: str = ""
    linter_rule_desc: str = ""


class SonarQubeEnrichedIssue(BaseModel):
    """Single enriched issue in the review."""
    issue_id: str = ""
    rule: str = ""
    severity: str = ""
    file: str = ""
    line: int = 0
    description: str = ""
    recommended_fix: str = ""
    effort_minutes: int = 0
    linters_reference: List[LinterReference] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class SonarQubeReviewResponse(BaseModel):
    """
    Root schema for the SonarQube + AwesomeLinters + Claude enrichment output.

    This is the standardized JSON output that combines SonarQube scan data,
    cross-referenced linter rules, and AI-generated descriptions and fixes.
    """
    project: str = "codebuster"
    scan_source: str = "SonarQube + AwesomeLinters"
    issue_list: List[SonarQubeEnrichedIssue] = Field(default_factory=list)

    class Config:
        extra = "allow"

    def to_json_dict(self) -> Dict[str, Any]:
        return self.model_dump(exclude_none=False)
