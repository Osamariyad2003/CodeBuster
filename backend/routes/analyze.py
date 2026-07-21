"""
Dimension analyzer API – run a single-dimension analyzer with repo metadata + files + optional tool logs.
Returns strict JSON schema (DimensionAnalyzerResult).
"""
import logging
from functools import wraps
from flask import Blueprint, request, jsonify, session

from services.dimension_analyzer_runner import run_dimension_analyzer, SUPPORTED_ANALYZER_KEYS

logger = logging.getLogger(__name__)

analyze_bp = Blueprint("analyze", __name__, url_prefix="/api/analyze")


def login_required(f):
    """Decorator to require authentication and preserve endpoint name."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


@analyze_bp.route("/dimension", methods=["POST"])
@login_required
def run_dimension():
    """
    Run a dimension analyzer (security, code_quality, etc.) with real data.

    Body (JSON):
      - analyzer_key: string (required), one of: security, code_quality
      - repo_id: string (optional)
      - repo_full_name: string (optional)
      - repo_url: string (optional)
      - commit_sha: string (optional)
      - files: array (required), each { path: string, content: string }
      - tool_logs: object (optional), e.g. { bandit: [...], semgrep: [...], eslint: [...] }

    Returns:
      - 200: DimensionAnalyzerResult as JSON (analyzer, target, category_result, issues, signals)
      - 400: Missing analyzer_key or files, or invalid analyzer_key
      - 500: Analyzer error
    """
    try:
        body = request.get_json() or {}
        analyzer_key = body.get("analyzer_key")
        if not analyzer_key:
            return jsonify({"error": "analyzer_key is required"}), 400
        files = body.get("files")
        if not isinstance(files, list):
            return jsonify({"error": "files must be an array of { path, content }"}), 400

        repo_metadata = {
            "repo_id": body.get("repo_id") or "unknown",
            "repo_full_name": body.get("repo_full_name") or body.get("full_name") or "unknown",
            "repo_url": body.get("repo_url") or "unknown",
            "commit_sha": body.get("commit_sha") or "unknown",
        }
        tool_logs = body.get("tool_logs")
        if not isinstance(tool_logs, dict):
            tool_logs = None

        result = run_dimension_analyzer(analyzer_key, repo_metadata, files, tool_logs)
        return jsonify(result.to_json_dict()), 200
    except ValueError as e:
        return jsonify({"error": str(e), "supported_analyzer_keys": SUPPORTED_ANALYZER_KEYS}), 400
    except Exception as e:
        logger.exception("Dimension analyzer failed: %s", e)
        return jsonify({"error": str(e)}), 500


@analyze_bp.route("/dimension/keys", methods=["GET"])
@login_required
def list_dimension_keys():
    """Return supported analyzer_key values for the dimension contract."""
    return jsonify({"analyzer_keys": SUPPORTED_ANALYZER_KEYS}), 200
