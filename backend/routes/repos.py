"""Repository management routes."""
from flask import Blueprint, jsonify, request, session, current_app
from functools import wraps
from models import db, Repository, Review, Issue, User
import uuid
from utils.github_client import fetch_repo_commits
from utils.github_auth import get_installation_access_token
from app.tasks import process_github_event

repos_bp = Blueprint('repos', __name__, url_prefix='/api/repos')


def _score_to_grade(score):
    if score >= 90: return 'A'
    if score >= 80: return 'B'
    if score >= 70: return 'C'
    if score >= 60: return 'D'
    return 'F'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@repos_bp.route('', methods=['GET'])
@login_required
def get_repos():
    """List connected repositories for current user (resolve user by login so sync and list use same id)."""
    user_session = session.get('user')
    login = user_session.get('login') or user_session.get('username')
    user_db = User.query.filter_by(username=login).first() if login else None
    if not user_db:
        return jsonify({"success": True, "repos": []})
    repos = Repository.query.filter_by(connected_by=user_db.id).all()
    
    # Enrich with latest review data and issue counts
    result = []
    for repo in repos:
        repo_dict = repo.to_dict()
        latest_review = Review.query.filter_by(repository_id=repo.id)\
            .order_by(Review.completed_at.desc()).first()
        review_ids = [r.id for r in Review.query.with_entities(Review.id).filter_by(repository_id=repo.id).all()]
        if review_ids:
            repo_dict['issues_count'] = Issue.query.filter(Issue.review_id.in_(review_ids), Issue.status == 'open').count()
            repo_dict['critical_issues'] = Issue.query.filter(Issue.review_id.in_(review_ids), Issue.status == 'open', Issue.severity == 'critical').count()
            high_count = Issue.query.filter(Issue.review_id.in_(review_ids), Issue.status == 'open', Issue.severity == 'major').count()
            repo_dict['high_issues'] = high_count
        else:
            repo_dict['issues_count'] = 0
            repo_dict['critical_issues'] = 0
            repo_dict['high_issues'] = 0
        if latest_review:
            repo_dict['last_review_at'] = latest_review.completed_at.isoformat() if latest_review.completed_at else None
            repo_dict['health_score'] = latest_review.overall_health_score
            repo_dict['overall_grade'] = _score_to_grade(latest_review.overall_health_score or 0)
        else:
            repo_dict['last_review_at'] = None
            repo_dict['health_score'] = None
            repo_dict['overall_grade'] = None
        result.append(repo_dict)
        
    return jsonify({
        "success": True,
        "repos": result
    })

@repos_bp.route('/<repo_id>', methods=['GET'])
@login_required
def get_repo_detail(repo_id):
    """Fetch repository details."""
    repo = Repository.query.get_or_404(repo_id)
    return jsonify({
        "success": True,
        "repo": repo.to_dict()
    })


@repos_bp.route('/<repo_id>/health', methods=['GET'])
@login_required
def get_repo_health(repo_id):
    """Fetch repo health (latest score, grade, review id). Used by RepoListPage."""
    repo = Repository.query.get_or_404(repo_id)
    latest = Review.query.filter_by(repository_id=repo_id, status='completed').order_by(
        Review.completed_at.desc()
    ).first()
    return jsonify({
        "repo_id": repo.id,
        "full_name": repo.full_name,
        "latest_score": latest.overall_health_score if latest else None,
        "latest_grade": _score_to_grade(latest.overall_health_score or 0) if latest else None,
        "latest_review_id": latest.id if latest else None,
    })

@repos_bp.route('/<repo_id>/settings', methods=['GET'])
@login_required
def get_repo_settings(repo_id):
    """Fetch repository settings."""
    repo = Repository.query.get_or_404(repo_id)
    return jsonify({
        "success": True,
        "settings": repo.get_config()
    })

@repos_bp.route('/<repo_id>/settings', methods=['PUT'])
@login_required
def update_repo_settings(repo_id):
    """Update repository settings."""
    try:
        repo = Repository.query.get_or_404(repo_id)
        data = request.get_json(force=True)
        if not data or not isinstance(data, dict):
            return jsonify({"error": "Invalid JSON body"}), 400

        # Update settings
        repo.set_config(data)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Settings updated successfully",
            "settings": repo.get_config()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@repos_bp.route('/<repo_id>/reviews', methods=['GET'])
@login_required
def get_repo_reviews(repo_id):
    """List reviews for a specific repository."""
    try:
        page = max(1, request.args.get('page', 1, type=int))
        per_page = max(1, min(100, request.args.get('pageSize', 10, type=int)))
        limit = max(1, min(100, request.args.get('limit', per_page, type=int)))
        offset = (page - 1) * per_page

        query = Review.query.filter_by(repository_id=repo_id).order_by(Review.created_at.desc())
        total = query.count()
        reviews = query.limit(limit).offset(offset).all()
        review_list = []
        for r in reviews:
            d = r.to_dict()
            d['grade'] = _score_to_grade(r.overall_health_score or 0)
            d['trigger_source'] = r.trigger_type
            review_list.append(d)
        return jsonify({
            "success": True,
            "reviews": review_list,
            "total": total,
            "page": page,
            "limit": limit,
        })
    except Exception:
        return jsonify({
            "success": True,
            "reviews": [],
            "total": 0,
            "page": 1,
            "limit": 10,
        }), 200

@repos_bp.route('/<repo_id>/reviews/<review_id>/issues', methods=['GET'])
@login_required
def get_review_issues_for_repo(repo_id, review_id):
    """Get issues for a specific review, scoped to the repo."""
    try:
        limit = min(200, request.args.get('limit', 100, type=int))
        file_filter = request.args.get('file')
        query = Issue.query.filter_by(review_id=review_id)
        if file_filter:
            query = query.filter(Issue.file_path == file_filter)
        sev_order = db.case(
            (Issue.severity == 'critical', 1),
            (Issue.severity == 'major', 2),
            (Issue.severity == 'minor', 3),
            else_=4
        )
        issues = query.order_by(sev_order).limit(limit).all()
        return jsonify({"success": True, "issues": [i.to_dict() for i in issues], "total": query.count()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@repos_bp.route('/<repo_id>/latest-review', methods=['GET'])
@login_required
def get_latest_review(repo_id):
    """Get latest review summary + category scores + top issues."""
    repo = Repository.query.get_or_404(repo_id)
    latest = Review.query.filter_by(repository_id=repo_id, status='completed')\
        .order_by(Review.completed_at.desc()).first()
    if not latest:
        return jsonify({"success": True, "review": None, "categories": [], "top_issues": [], "fix_first": []}), 200
    categories = latest.get_category_scores()
    top_issues = Issue.query.filter_by(review_id=latest.id)\
        .filter(Issue.severity.in_(['critical', 'major']))\
        .order_by(Issue.severity.asc()).limit(5).all()
    top_risks = latest.get_top_risks() or []
    quick_wins = latest.get_quick_wins() or []
    seen = set()
    fix_first_ids = []
    for rid in (top_risks[:5] + quick_wins[:3]):
        if rid not in seen:
            seen.add(rid)
            fix_first_ids.append(rid)
    fix_first = []
    for i, fid in enumerate(fix_first_ids[:5]):
        fix_first.append({
            "id": fid if isinstance(fid, str) else str(fid),
            "title": f"Fix: {fid}" if isinstance(fid, str) else f"Fix item {i + 1}",
            "why": "Prioritized finding from analysis",
            "owner_hint": "",
            "effort": "M",
            "related_issue_ids": [fid] if isinstance(fid, str) else [],
            "status": "pending",
        })
    return jsonify({
        "success": True,
        "review": {**latest.to_dict(), "grade": _score_to_grade(latest.overall_health_score or 0)},
        "categories": [{"key": k, "label": k.replace("_", " ").title(), "score": v} for k, v in categories.items()],
        "top_issues": [i.to_dict() for i in top_issues],
        "fix_first": fix_first,
    })

@repos_bp.route('/<repo_id>/score-trend', methods=['GET'])
@login_required
def get_score_trend(repo_id):
    """Get score trend for chart (e.g. last 7 or 30 days)."""
    days = request.args.get('days', 30, type=int)
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=days)
    reviews = Review.query.filter_by(repository_id=repo_id, status='completed')\
        .filter(Review.completed_at >= since)\
        .order_by(Review.completed_at.asc()).all()
    return jsonify([{
        "date": r.completed_at.isoformat() if r.completed_at else None,
        "overall_score": r.overall_health_score,
        "grade": _score_to_grade(r.overall_health_score or 0),
    } for r in reviews])

@repos_bp.route('/<repo_id>/commits', methods=['GET'])
@login_required
def get_repo_commits(repo_id):
    """Fetch commit history for a repository."""
    repo = Repository.query.get_or_404(repo_id)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    
    access_token = None
    
    # Try installation token first (for GitHub App)
    if repo.installation_id:
        access_token = get_installation_access_token(repo.installation_id)
        if access_token:
            print(f"[OK] Using installation token for {repo.full_name}")
    
    # Fallback to user's OAuth token if installation token failed
    if not access_token:
        user_session = session.get('user')
        if user_session and user_session.get('access_token'):
            access_token = user_session.get('access_token')
            print(f"[OK] Using OAuth token for {repo.full_name}")
        else:
            print(f"[WARN]️ No OAuth token in session for {repo.full_name}")
    
    if not access_token:
        return jsonify({
            "success": False,
            "error": "Failed to get GitHub access token. Please reconnect the repository or sign in again.",
            "commits": [],
            "count": 0
        }), 200
        
    commits = fetch_repo_commits(repo.full_name, access_token, per_page=per_page, page=page)
    
    if commits is None:
        commits = []
    
    return jsonify({
        "success": True,
        "commits": commits,
        "count": len(commits) if commits else 0
    })

def _run_scan_inline(app, repo_id, commit_sha):
    """Run review in background thread (no Celery). Used when Redis is unavailable."""
    from app.tasks import run_review_impl
    with app.app_context():
        run_review_impl(repo_id, commit_sha or "", "manual")


# ---------------------------------------------------------------------------
# Run Scan API contract (for "Run scan" on repository dashboard)
# ---------------------------------------------------------------------------
# POST /api/repos/<repo_id>/scan
#   Body: {} or { "commit_sha": "<optional>" }
#   Returns (202 or 200):
#     success: true
#     message: string (e.g. "Scan queued...", "Manual scan triggered successfully")
#     job_id: string | null  (Celery task id when queued; null when inline)
#     review_id: string | null (set when idempotent: review already exists for commit)
#     inline: true | omitted (true when scan runs in background thread, no Celery)
#     idempotent: true | omitted (true when review_id returned for existing commit)
#
# After the scan completes, the UI fetches "Scan result" via:
#   GET /api/repos/<repo_id>/latest-review
#   Returns: success, review (health score, grade), categories, top_issues, fix_first
# The scan job (run_review_impl) must create/update Review + Issue rows so this
# endpoint returns health score, issues, and fix-first suggestions.
# ---------------------------------------------------------------------------

@repos_bp.route('/<repo_id>/scan', methods=['POST'])
@login_required
def trigger_repo_scan(repo_id):
    """
    Trigger a manual full-repository scan.
    Returns: success, message, job_id (if queued), review_id (if idempotent), inline (if no queue).
    Uses Celery if available; otherwise runs inline when RUN_SCAN_INLINE=1 or Redis down.
    """
    import os
    import threading
    repo = Repository.query.get_or_404(repo_id)
    data = (request.get_json(silent=True)) or {}
    commit_sha = data.get('commit_sha')
    use_inline = os.getenv("RUN_SCAN_INLINE", "").strip().lower() in ("1", "true", "yes")

    if commit_sha:
        existing = Review.query.filter_by(
            repository_id=repo_id,
            commit_sha=commit_sha,
            status='completed'
        ).first()
        if existing:
            return jsonify({
                "success": True,
                "message": "Review already exists for this commit",
                "review_id": existing.id,
                "idempotent": True,
                "job_id": None
            }), 200

    def _start_inline_scan():
        app_obj = current_app._get_current_object()
        thread = threading.Thread(
            target=_run_scan_inline,
            args=(app_obj, repo_id, commit_sha),
            daemon=True,
        )
        thread.start()
        return jsonify({
            "success": True,
            "message": "Scan running in background. Refresh the page in a minute to see results.",
            "job_id": None,
            "review_id": None,
            "inline": True,
        }), 202

    if use_inline:
        return _start_inline_scan()

    # Prefer inline when Redis is unreachable to avoid Celery backend "Connection to Redis lost" errors
    try:
        r = get_redis()
        r.ping()
    except Exception:
        import logging
        logging.getLogger(__name__).info("Redis unreachable, running scan inline.")
        return _start_inline_scan()

    try:
        from app.tasks import run_review
        from routes.metrics import record_job

        task = run_review.delay(repo_id, commit_sha or "", "manual")
        delivery_id = f"manual-scan-{task.id}"
        try:
            record_job(task.id, delivery_id, repo.full_name, "pending")
        except Exception:
            pass
        return jsonify({
            "success": True,
            "message": "Manual scan triggered successfully",
            "job_id": task.id,
            "review_id": None,
        }), 202
    except Exception as e:
        import logging
        logging.getLogger(__name__).info(
            "Celery/Redis unavailable (%s), running scan inline.", type(e).__name__
        )
        try:
            return _start_inline_scan()
        except Exception as fallback_err:
            import traceback
            traceback.print_exc()
            return jsonify({
                "error": "Scan failed and fallback unavailable.",
                "detail": str(fallback_err),
            }), 503

from app.redis_client import get_redis
import json

@repos_bp.route('/<repo_id>/stats', methods=['GET'])
@login_required
def get_repo_stats(repo_id):
    """Get summary statistics for a specific repository."""
    repo = Repository.query.get_or_404(repo_id)
    
    try:
        # 1. Health Score (Latest review health score)
        latest_review = (
            Review.query.filter_by(repository_id=repo_id, status='completed')
            .order_by(Review.completed_at.desc())
            .first()
        )
        health_score = latest_review.overall_health_score if latest_review else 100
        
        # 2. Issues Count (via reviews → issues, since Issue has no direct repository_id)
        review_ids = [
            r.id for r in Review.query.with_entities(Review.id).filter_by(repository_id=repo_id).all()
        ]
        if review_ids:
            total_issues = Issue.query.filter(
                Issue.review_id.in_(review_ids),
                Issue.status == 'open'
            ).count()
            critical_issues = Issue.query.filter(
                Issue.review_id.in_(review_ids),
                Issue.status == 'open',
                Issue.severity == 'critical'
            ).count()
        else:
            total_issues = 0
            critical_issues = 0
        
        # 3. Activity (Jobs and Events from Redis) – safe if Redis down or bad data
        repo_events = []
        repo_jobs = []
        try:
            from routes.metrics import REDIS_KEY_EVENTS, REDIS_KEY_JOBS
            r = get_redis()
            events_raw = r.lrange(REDIS_KEY_EVENTS, 0, -1) or []
            jobs_raw = r.lrange(REDIS_KEY_JOBS, 0, -1) or []
            for e in events_raw:
                try:
                    obj = json.loads(e)
                    if obj.get('repo') == repo.full_name:
                        repo_events.append(obj)
                except (TypeError, ValueError):
                    pass
            for j in jobs_raw:
                try:
                    obj = json.loads(j)
                    if obj.get('repo') == repo.full_name:
                        repo_jobs.append(obj)
                except (TypeError, ValueError):
                    pass
        except Exception:
            pass
        
        # 4. Trend (Last 7 reviews)
        recent_reviews = Review.query.filter_by(repository_id=repo_id, status='completed')\
            .order_by(Review.completed_at.asc()).limit(7).all()
        
        trend = []
        for rev in recent_reviews:
            trend.append({
                'date': rev.completed_at.strftime('%a'),
                'score': rev.overall_health_score
            })
            
        # Fallback trend if empty
        if not trend:
            trend = [{'date': 'N/A', 'score': health_score}]
            
        return jsonify({
            "success": True,
            "stats": {
                "health": health_score,
                "total_issues": total_issues,
                "critical_issues": critical_issues,
                "events_count": len(repo_events),
                "active_jobs": len([j for j in repo_jobs if j.get('status') == 'running']),
                "trend": trend
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
