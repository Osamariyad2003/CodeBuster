"""Analytics aggregate endpoints for dashboard visualizations."""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, session
from functools import wraps
from sqlalchemy import func

from models import db, Review, Issue

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/repos')


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


def _score_to_grade(score):
    if score is None:
        return None
    if score >= 90:
        return 'A'
    if score >= 80:
        return 'B'
    if score >= 70:
        return 'C'
    if score >= 60:
        return 'D'
    return 'F'


SEVERITY_WEIGHT = {'critical': 4, 'major': 3, 'minor': 2, 'info': 1,
                   'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}


# --------------------------------------------------------------------------
# GET /api/repos/<repo_id>/analytics/issues-by-category
# --------------------------------------------------------------------------
@analytics_bp.route('/<repo_id>/analytics/issues-by-category', methods=['GET'])
@login_required
def issues_by_category(repo_id):
    """Issue counts grouped by category/module for the donut chart."""
    # Try ScoredIssue (new model) first
    try:
        from models.review import ReviewRun, ScoredIssue
        latest_run = (ReviewRun.query
                      .filter_by(repository_id=repo_id)
                      .order_by(ReviewRun.created_at.desc()).first())
        if latest_run:
            rows = (db.session.query(ScoredIssue.category_key, func.count(ScoredIssue.id))
                    .filter_by(review_run_id=latest_run.id)
                    .group_by(ScoredIssue.category_key).all())
            total = sum(r[1] for r in rows)
            return jsonify([{
                'category': r[0] or 'other',
                'count': r[1],
                'percentage': round(r[1] / total * 100, 1) if total else 0
            } for r in rows])
    except Exception:
        pass

    # Fallback: legacy Issue model
    latest_review = (Review.query.filter_by(repository_id=repo_id, status='completed')
                     .order_by(Review.completed_at.desc()).first())
    if not latest_review:
        return jsonify([])

    rows = (db.session.query(Issue.module, func.count(Issue.id))
            .filter_by(review_id=latest_review.id)
            .group_by(Issue.module).all())
    total = sum(r[1] for r in rows)
    return jsonify([{
        'category': r[0] or 'other',
        'count': r[1],
        'percentage': round(r[1] / total * 100, 1) if total else 0
    } for r in rows])


# --------------------------------------------------------------------------
# GET /api/repos/<repo_id>/analytics/risk-heatmap
# --------------------------------------------------------------------------
@analytics_bp.route('/<repo_id>/analytics/risk-heatmap', methods=['GET'])
@login_required
def risk_heatmap(repo_id):
    """Directory × category heatmap data for the risk grid."""
    grid = {}

    # Try ScoredIssue first
    try:
        from models.review import ReviewRun, ScoredIssue
        latest_run = (ReviewRun.query
                      .filter_by(repository_id=repo_id)
                      .order_by(ReviewRun.created_at.desc()).first())
        if latest_run:
            issues = ScoredIssue.query.filter_by(review_run_id=latest_run.id).all()
            for issue in issues:
                cat = issue.category_key or 'other'
                sev_w = SEVERITY_WEIGHT.get(issue.severity, 1)
                paths = issue.file_paths or []
                for p in (paths if paths else ['(root)']):
                    d = p.split('/')[0] if '/' in str(p) else '(root)'
                    key = (d, cat)
                    if key not in grid:
                        grid[key] = {'count': 0, 'severity_score': 0}
                    grid[key]['count'] += 1
                    grid[key]['severity_score'] += sev_w
            return _heatmap_response(grid)
    except Exception:
        pass

    # Fallback: legacy Issue model
    latest_review = (Review.query.filter_by(repository_id=repo_id, status='completed')
                     .order_by(Review.completed_at.desc()).first())
    if not latest_review:
        return jsonify([])

    issues = Issue.query.filter_by(review_id=latest_review.id).all()
    for issue in issues:
        cat = issue.module or issue.category or 'other'
        sev_w = SEVERITY_WEIGHT.get(issue.severity, 1)
        p = issue.file_path or '(root)'
        d = p.split('/')[0] if '/' in p else '(root)'
        key = (d, cat)
        if key not in grid:
            grid[key] = {'count': 0, 'severity_score': 0}
        grid[key]['count'] += 1
        grid[key]['severity_score'] += sev_w

    return _heatmap_response(grid)


def _heatmap_response(grid):
    """Convert grid dict to JSON, limiting to top 10 directories."""
    if not grid:
        return jsonify([])
    dir_totals = {}
    for (d, _), v in grid.items():
        dir_totals[d] = dir_totals.get(d, 0) + v['count']
    top_dirs = sorted(dir_totals, key=dir_totals.get, reverse=True)[:10]
    return jsonify([{
        'directory': k[0],
        'category': k[1],
        'issue_count': v['count'],
        'severity_score': v['severity_score']
    } for k, v in grid.items() if k[0] in top_dirs])


# --------------------------------------------------------------------------
# GET /api/repos/<repo_id>/analytics/review-activity?days=30
# --------------------------------------------------------------------------
@analytics_bp.route('/<repo_id>/analytics/review-activity', methods=['GET'])
@login_required
def review_activity(repo_id):
    """Reviews grouped by date for the PR activity bar chart."""
    days = request.args.get('days', 30, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    reviews = (Review.query
               .filter_by(repository_id=repo_id)
               .filter(Review.created_at >= since)
               .order_by(Review.created_at.asc()).all())

    by_date = {}
    for r in reviews:
        d = r.created_at.strftime('%Y-%m-%d') if r.created_at else 'unknown'
        if d not in by_date:
            by_date[d] = {'date': d, 'total': 0, 'flagged': 0, 'approved': 0}
        by_date[d]['total'] += 1
        grade = _score_to_grade(r.overall_health_score)
        if grade in ('D', 'F'):
            by_date[d]['flagged'] += 1
        elif grade in ('A', 'B'):
            by_date[d]['approved'] += 1

    return jsonify(list(by_date.values()))


# --------------------------------------------------------------------------
# GET /api/repos/<repo_id>/analytics/severity-trend?days=30
# --------------------------------------------------------------------------
@analytics_bp.route('/<repo_id>/analytics/severity-trend', methods=['GET'])
@login_required
def severity_trend(repo_id):
    """Issue severity counts per review date for the vulnerability trend chart."""
    days = request.args.get('days', 30, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    reviews = (Review.query
               .filter_by(repository_id=repo_id, status='completed')
               .filter(Review.completed_at >= since)
               .order_by(Review.completed_at.asc()).all())

    result = {}
    for rev in reviews:
        d = rev.completed_at.strftime('%Y-%m-%d') if rev.completed_at else 'unknown'
        if d not in result:
            result[d] = {'date': d, 'critical': 0, 'major': 0, 'minor': 0, 'info': 0}
        counts = Issue.query.filter_by(review_id=rev.id).with_entities(
            Issue.severity, func.count(Issue.id)
        ).group_by(Issue.severity).all()
        for sev, cnt in counts:
            key = (sev or '').lower()
            if key in result[d]:
                result[d][key] += cnt

    return jsonify(list(result.values()))
