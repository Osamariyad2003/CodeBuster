"""
Gerrit commit review routes: list real commit reviews and trigger scans.
Frontend uses these for the Commits (Inbox) view.
"""
import logging
import os
import threading
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request, session

from models import db, Repository, Review, Issue
from utils.github_client import fetch_repo_commits
from utils.github_auth import get_installation_access_token

logger = logging.getLogger(__name__)

gerrit_bp = Blueprint("gerrit", __name__, url_prefix="/api/gerrit")


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def login_required(f):
    from functools import wraps

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated_function


# ---------------------------------------------------------------------------
# Category definitions
# ---------------------------------------------------------------------------

CATEGORY_DEFS = [
    ("needs_review", "Needs your review"),
    ("returned", "Returned to you"),
    ("approved", "Approved"),
    ("waiting_for_reviewers", "Waiting for reviewers"),
    ("drafts", "Drafts"),
    ("merging", "Merging and recently merged"),
    ("waiting_for_author", "Waiting for author"),
]


def _empty_categories():
    return [{"id": cid, "label": label, "count": 0} for cid, label in CATEGORY_DEFS]


def _build_categories(items):
    counts = {}
    for item in items:
        cat = item.get("category", "needs_review")
        counts[cat] = counts.get(cat, 0) + 1
    return [
        {"id": cid, "label": label, "count": counts.get(cid, 0)}
        for cid, label in CATEGORY_DEFS
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_access_token(repo, session_user):
    """Get GitHub access token: prefer installation token, fallback to OAuth."""
    access_token = None
    if repo.installation_id:
        access_token = get_installation_access_token(repo.installation_id)
    if not access_token and session_user:
        access_token = session_user.get("access_token")
    return access_token


def _relative_age(iso_date_str):
    """Convert ISO date string to human-readable relative age ('2h', '3d')."""
    if not iso_date_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = now - dt
        if delta.days > 365:
            return f"{delta.days // 365}y"
        if delta.days > 30:
            return f"{delta.days // 30}mo"
        if delta.days > 0:
            return f"{delta.days}d"
        hours = delta.seconds // 3600
        if hours > 0:
            return f"{hours}h"
        minutes = delta.seconds // 60
        return f"{max(1, minutes)}m"
    except Exception:
        return ""


def _categorize_review(review):
    """Determine Gerrit-style category from a Review record (or None)."""
    if not review:
        return "needs_review"

    status = review.status or ""
    if status in ("running", "pending"):
        return "waiting_for_reviewers"
    if status == "failed":
        return "returned"
    if status == "completed":
        score = review.overall_health_score or 0
        return "approved" if score >= 70 else "waiting_for_author"

    return "needs_review"


# ---------------------------------------------------------------------------
# GET /api/gerrit/commits?repo_id=...
# ---------------------------------------------------------------------------

@gerrit_bp.route("/commits", methods=["GET"])
@login_required
def get_commits():
    """
    Fetch real GitHub commits for a repo and cross-reference with Review
    records to categorize each commit for the Gerrit-style inbox.
    """
    repo_id = request.args.get("repo_id")
    per_page = request.args.get("per_page", 30, type=int)

    if not repo_id:
        return jsonify({"categories": _empty_categories(), "commits": []})

    repo = Repository.query.get(repo_id)
    if not repo:
        return jsonify({"error": "Repository not found"}), 404

    user_session = session.get("user")
    access_token = _get_access_token(repo, user_session)

    if not access_token:
        return jsonify({
            "categories": _empty_categories(),
            "commits": [],
            "error": "Failed to get GitHub access token",
        })

    # Fetch real commits from GitHub
    raw_commits = fetch_repo_commits(
        repo.full_name, access_token, per_page=per_page
    )
    if raw_commits is None:
        raw_commits = []

    # Bulk-fetch all reviews for this repo to avoid N+1 queries
    all_reviews = (
        Review.query
        .filter_by(repository_id=repo_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    review_by_sha = {}
    for rev in all_reviews:
        if rev.commit_sha and rev.commit_sha not in review_by_sha:
            review_by_sha[rev.commit_sha] = rev

    # Transform each commit
    items = []
    for gh in raw_commits:
        sha = gh.get("sha", "")
        commit_obj = gh.get("commit", {})
        author_obj = commit_obj.get("author", {})
        message = commit_obj.get("message", "")
        title = message.split("\n")[0][:120]
        owner = (
            (gh.get("author") or {}).get("login")
            or author_obj.get("name", "Unknown")
        )
        date_str = author_obj.get("date", "")

        review = review_by_sha.get(sha)
        category = _categorize_review(review)

        # Build CI / reviewer metadata from review
        reviewers_count = 0
        ci_passed = 0
        ci_failed = 0
        health_score = None

        if review and review.status == "completed":
            reviewers_count = 1  # CodeBuster is the reviewer
            health_score = review.overall_health_score
            critical = (
                Issue.query
                .filter_by(review_id=review.id, severity="critical")
                .count()
            )
            ci_passed = 1 if critical == 0 else 0
            ci_failed = 1 if critical > 0 else 0
        elif review and review.status in ("running", "pending"):
            reviewers_count = 1

        items.append({
            "id": sha,
            "title": title,
            "owner": owner,
            "repo_ref": f"{repo.full_name} #{sha[:7]}",
            "repo_id": repo_id,
            "status": review.status if review else None,
            "category": category,
            "reviewers_count": reviewers_count,
            "ci_passed": ci_passed,
            "ci_failed": ci_failed,
            "lines_added": None,
            "lines_removed": None,
            "age": _relative_age(date_str),
            "html_url": gh.get("html_url"),
            "review_id": review.id if review else None,
            "health_score": health_score,
        })

    categories = _build_categories(items)
    return jsonify({"categories": categories, "commits": items})


# ---------------------------------------------------------------------------
# POST /api/gerrit/run
# ---------------------------------------------------------------------------

@gerrit_bp.route("/run", methods=["POST"])
@login_required
def run_gerrit():
    """
    Trigger a real AI code review for a specific commit (or latest).
    Reuses the existing Celery scan pipeline.
    """
    body = request.get_json(silent=True) or {}
    repo_id = body.get("repo_id")
    commit_sha = body.get("commit_sha")

    if not repo_id:
        return jsonify({"error": "repo_id is required"}), 400

    repo = Repository.query.get(repo_id)
    if not repo:
        return jsonify({"error": "Repository not found"}), 404

    # Idempotency: return existing completed review for this commit
    if commit_sha:
        existing = Review.query.filter_by(
            repository_id=repo_id,
            commit_sha=commit_sha,
            status="completed",
        ).first()
        if existing:
            return jsonify({
                "success": True,
                "message": "Review already exists for this commit",
                "review_id": existing.id,
                "idempotent": True,
            })

    # Inline scan helper
    def _start_inline():
        from app.tasks import run_review_impl

        app_obj = current_app._get_current_object()

        def _run(app, rid, sha):
            with app.app_context():
                run_review_impl(rid, sha or "", "gerrit")

        thread = threading.Thread(
            target=_run, args=(app_obj, repo_id, commit_sha), daemon=True
        )
        thread.start()
        return jsonify({
            "success": True,
            "message": "Gerrit review running in background",
            "job_id": None,
            "inline": True,
        }), 202

    use_inline = os.getenv("RUN_SCAN_INLINE", "").strip().lower() in (
        "1", "true", "yes",
    )
    if use_inline:
        return _start_inline()

    # Prefer Celery; fallback to inline if Redis unreachable
    try:
        from app.redis_client import get_redis

        get_redis().ping()
    except Exception:
        logger.info("Redis unreachable, running gerrit review inline.")
        return _start_inline()

    try:
        from app.tasks import run_review

        task = run_review.delay(repo_id, commit_sha or "", "gerrit")
        logger.info(
            "Gerrit review queued: repo_id=%s sha=%s task=%s",
            repo_id, commit_sha, task.id,
        )
        return jsonify({
            "success": True,
            "message": "Gerrit review triggered",
            "job_id": task.id,
        }), 202
    except Exception:
        logger.info("Celery unavailable, running gerrit review inline.")
        return _start_inline()
