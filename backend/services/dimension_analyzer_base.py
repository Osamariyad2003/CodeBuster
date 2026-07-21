"""
Base class for CodeBuster dimension analyzers.
Each dimension (security, code_quality, performance, etc.) implements this contract.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from .dimension_analyzer_schema import (
    DimensionAnalyzerResult,
    TargetInfo,
    ANALYZER_KEYS,
)


class BaseDimensionAnalyzer(ABC):
    """Contract for a single-dimension analyzer. Output must match DimensionAnalyzerResult schema."""

    ANALYZER_KEY: ANALYZER_KEYS
    ANALYZER_LABEL: str
    VERSION: str = "1.0"

    @abstractmethod
    def run(
        self,
        repo_metadata: Dict[str, Any],
        files: List[Dict[str, Any]],
        tool_logs: Optional[Dict[str, Any]] = None,
    ) -> DimensionAnalyzerResult:
        """
        Run analysis for this dimension.

        Args:
            repo_metadata: repo_id, repo_full_name, repo_url (optional), commit_sha (optional)
            files: List of { path, content } (path may be filename)
            tool_logs: Optional dict, e.g. { "bandit": [...], "semgrep": [...], "eslint": [...] }
                      Each value can be list of findings or raw string output to parse.

        Returns:
            DimensionAnalyzerResult matching the strict JSON schema.
        """
        pass

    def _target_from_metadata(self, repo_metadata: Dict[str, Any]) -> TargetInfo:
        """Build TargetInfo from repo_metadata."""
        return TargetInfo(
            repo_id=repo_metadata.get("repo_id") or "unknown",
            repo_full_name=repo_metadata.get("repo_full_name") or repo_metadata.get("full_name") or "unknown",
            repo_url=repo_metadata.get("repo_url") or "unknown",
            commit_sha=repo_metadata.get("commit_sha") or "unknown",
        )
