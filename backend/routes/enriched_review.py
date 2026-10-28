"""
Enriched review workflow: SonarQube scan + Claude enrichment (Awesome-Linters).
Frontend calls: GET /api/sonar/scan?repo_id=..., POST /api/reviews/enrich.
When repo_id is provided and SonarQube is not configured or returns empty, falls back to
the repository's latest CodeBuster review issues so AI review can still return results.
CLAUDE_API_KEY should be set server-side; this module does not expose it to the frontend.
"""
import os
import logging
import json as _json
from flask import Blueprint, jsonify, request, session

logger = logging.getLogger(__name__)

enriched_bp = Blueprint("enriched_review", __name__, url_prefix="/api")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function


def _issues_from_latest_review(repo_id):
    """Fetch latest completed review for repo and return issues in SonarQube-like shape for enrich."""
    try:
        from models import Review, Issue
        latest = Review.query.filter_by(repository_id=repo_id, status="completed").order_by(
            Review.completed_at.desc()
        ).first()
        if not latest:
            return []
        issues = Issue.query.filter_by(review_id=latest.id).order_by(Issue.severity.asc()).limit(100).all()
        out = []
        for i in issues:
            out.append({
                "key": i.id,
                "rule": i.module or i.category or "codebuster",
                "severity": (i.severity or "major").lower(),
                "component": i.file_path or "",
                "line": i.line_number or 0,
                "message": i.title or i.description or "No description",
                "textRange": {"startLine": i.line_number or 0},
                "code_snippet": i.code_snippet,
                "suggested_fix": i.get_suggested_fix(),
                "ai_explanation": i.ai_explanation,
            })
        return out
    except Exception as e:
        logger.warning("Failed to load latest review issues for repo %s: %s", repo_id, e)
        return []


@enriched_bp.route("/sonar/scan", methods=["GET"])
@login_required
def sonar_scan():
    """
    Return scan issues for AI enrich. When repo_id is set: try SonarQube first; if not
    configured or returns no issues, use the repo's latest CodeBuster review issues.
    """
    repo_id = request.args.get("repo_id")
    sonar_url = os.environ.get("SONARQUBE_API_URL") or os.environ.get("VITE_SONARQUBE_API_URL")
    issues = []

    if sonar_url:
        try:
            import urllib.request
            with urllib.request.urlopen(sonar_url) as resp:
                data = _json.loads(resp.read().decode())
                issues = data.get("issues") or []
        except Exception as e:
            logger.warning("SonarQube fetch failed: %s", e)

    if not issues and repo_id:
        issues = _issues_from_latest_review(repo_id)
        if issues:
            logger.info("Using %d issues from latest CodeBuster review for repo %s", len(issues), repo_id)

    return jsonify({"issues": issues})


def _mock_enriched_issue(raw, idx):
    """Build one EnrichedIssue from raw SonarQube-like or CodeBuster issue for stub response."""
    rule = raw.get("rule") or raw.get("module") or raw.get("category") or f"rule-{idx}"
    severity = (raw.get("severity") or "major").lower()
    component = raw.get("component") or raw.get("file_path") or raw.get("file") or ""
    file_path = component.split(":")[-1] if ":" in component else component or "unknown"
    line = raw.get("line") or (raw.get("textRange") or {}).get("startLine") or raw.get("line_number") or 0
    desc = raw.get("message") or raw.get("title") or raw.get("description") or "No description"
    return {
        "issue_id": raw.get("key") or raw.get("id") or f"enriched-{idx}",
        "rule": rule,
        "severity": severity,
        "file": file_path,
        "line": line,
        "description": desc,
        "recommended_fix": "Review and apply linter suggestions.",
        "effort_minutes": 15,
        "linters_reference": [
            {"linter_name": "ESLint", "linter_rule_id": rule, "linter_rule_desc": desc}
        ],
        "tags": ["sonar", "enriched"],
        "code_snippet": raw.get("code_snippet"),
        "suggested_fix": raw.get("suggested_fix"),
    }


@enriched_bp.route("/reviews/enrich", methods=["POST"])
@login_required
def reviews_enrich():
    """
    Accept { project, raw_issues } and return EnrichedReviewResponse.
    Uses AIReviewService (Gemini) server-side for real AI analysis and enrichment.
    """
    try:
        body = request.get_json() or {}
        project = body.get("project") or "codebuster"
        raw_issues = body.get("raw_issues") or []
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    from services.ai_review_service import AIReviewService
    ai_service = AIReviewService()
    provider_name = ai_service.provider or "AI"

    issue_list = []
    for i, r in enumerate(raw_issues):
        item = _mock_enriched_issue(r, i)
        # If raw issue has AI explanation from prior review pass, preserve it
        if r.get("ai_explanation"):
            item["ai_explanation"] = r.get("ai_explanation")
            item["recommended_fix"] = r.get("ai_explanation")
        issue_list.append(item)

    return jsonify({
        "project": project,
        "scan_source": f"CodeBuster AI ({provider_name.capitalize()})",
        "issue_list": issue_list,
    })
