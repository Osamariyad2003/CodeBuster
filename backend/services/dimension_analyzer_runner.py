"""
Run a dimension analyzer by key with repo metadata + files + optional tool logs.
Returns the strict JSON schema (DimensionAnalyzerResult).
"""
from typing import Any, Dict, List, Optional

from .dimension_analyzer_schema import DimensionAnalyzerResult, ANALYZER_KEYS
from .dimension_security_analyzer import SecurityDimensionAnalyzer
from .dimension_code_quality_analyzer import CodeQualityDimensionAnalyzer
from .dimension_performance_analyzer import PerformanceDimensionAnalyzer
from .dimension_dependency_analyzer import DependencyDimensionAnalyzer
from .dimension_secrets_analyzer import SecretsDimensionAnalyzer
from .ai_agent_analyzer import AIAgentDimensionAnalyzer

# Registry: analyzer_key -> analyzer instance
_DIMENSION_ANALYZERS: Dict[str, Any] = {
    "security":     SecurityDimensionAnalyzer(),
    "code_quality": CodeQualityDimensionAnalyzer(),
    "performance":  PerformanceDimensionAnalyzer(),
    # Checks pinned dependencies (requirements.txt, package.json) against the
    # OSV.dev vulnerability database for known CVEs/GHSAs.
    "dependencies": DependencyDimensionAnalyzer(),
    # Hardcoded credentials via TruffleHog — split out from `security` so
    # leaked secrets get their own visible score instead of being buried.
    "secrets": SecretsDimensionAnalyzer(),
    # Senior-engineer LLM pass: reads source code and reports the class of
    # bugs static tools can't see (race conditions, business logic, edge
    # cases, architectural flaws). No-ops gracefully when no AI provider
    # is configured.
    "ai": AIAgentDimensionAnalyzer(),
}

# Supported keys for API validation
SUPPORTED_ANALYZER_KEYS = list(_DIMENSION_ANALYZERS.keys())


def run_dimension_analyzer(
    analyzer_key: str,
    repo_metadata: Dict[str, Any],
    files: List[Dict[str, Any]],
    tool_logs: Optional[Dict[str, Any]] = None,
) -> DimensionAnalyzerResult:
    """
    Run the dimension analyzer for the given key.

    Args:
        analyzer_key: One of security, code_quality, (future: performance, reliability, etc.)
        repo_metadata: repo_id, repo_full_name, repo_url?, commit_sha?
        files: List of { path, content }
        tool_logs: Optional { bandit: [...], semgrep: [...], eslint: [...], pylint: [...] }

    Returns:
        DimensionAnalyzerResult (strict schema).

    Raises:
        ValueError: If analyzer_key is not supported.
    """
    key = (analyzer_key or "").strip().lower()
    if key not in _DIMENSION_ANALYZERS:
        raise ValueError(
            f"Unsupported analyzer_key: {analyzer_key}. Supported: {SUPPORTED_ANALYZER_KEYS}"
        )
    analyzer = _DIMENSION_ANALYZERS[key]
    return analyzer.run(repo_metadata, files, tool_logs)
