"""Feedback routes."""
from flask import Blueprint, jsonify, request, session
from functools import wraps
from datetime import datetime, timedelta
from collections import defaultdict
import uuid

from models import db, Feedback, Issue, Review, Repository

feedback_bp = Blueprint('feedback', __name__, url_prefix='/api/feedback')

def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@feedback_bp.route('', methods=['POST'])
@login_required
def submit_feedback():
    """Submit feedback on an issue."""
    try:
        data = request.get_json()
        issue_id = data.get('issue_id')
        review_id = data.get('review_id')
        action = data.get('action')  # accept, dismiss, resolve, ignore, reset
        comment = data.get('comment', '')

        if not issue_id or not review_id or not action:
            return jsonify({"error": "Missing required fields"}), 400

        if action not in ['accept', 'dismiss', 'resolve', 'ignore', 'reset']:
            return jsonify({"error": "Invalid action"}), 400

        # Verify issue and review exist
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404

        review = Review.query.get(review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404

        # Get user ID from session
        user_id = session.get('user', {}).get('id')

        # 'reset' undoes prior accept/dismiss feedback: clear the issue's status
        # without recording a feedback row (it isn't a quality signal itself).
        if action == 'reset':
            issue.status = 'open'
            db.session.commit()
            return jsonify({"success": True, "feedback": None})

        # Update issue status based on action
        if action == 'accept' or action == 'resolve':
            issue.status = 'resolved'
        elif action == 'dismiss' or action == 'ignore':
            issue.status = 'dismissed'
        else:
            issue.status = 'open'

        # Create feedback
        feedback = Feedback(
            id=str(uuid.uuid4()),
            issue_id=issue_id,
            review_id=review_id,
            user_id=user_id,
            action=action,
            comment=comment
        )

        db.session.add(feedback)
        db.session.commit()

        return jsonify({
            "success": True,
            "feedback": feedback.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

DISMISS_ACTIONS = {'dismiss', 'ignore'}
POSITIVE_ACTIONS = {'accept', 'resolve'}

# Below this many samples, a dismiss rate is too noisy to trust (e.g. 1/1 = "100%
# dismissed" off a single click). Stats with fewer samples than this are still
# returned but flagged `low_sample` so the UI can gray them out / caveat them.
MIN_TRUSTED_SAMPLES = 5


def _normalize_confidence(c):
    """Issue.confidence is documented as 0.00-1.00 but a handful of analyzers
    (e.g. performance_analyzer) write 0-100 scores into the same column. Mirror
    the normalization AIReviewService already does when scoring, so confidence
    buckets here aren't silently wrong for those rows."""
    if c is None:
        return None
    try:
        c = float(c)
    except (TypeError, ValueError):
        return None
    return c / 100.0 if c > 1.0 else c


@feedback_bp.route('/stats', methods=['GET'])
def get_feedback_stats():
    """Aggregate feedback stats: dismiss rate overall, by module/tool/confidence,
    and a daily trend. Optionally scoped to a repository and a lookback window."""
    try:
        repo_id = request.args.get('repo_id')
        days = request.args.get('days', 30, type=int)
        since = datetime.utcnow() - timedelta(days=days)

        # Outer-join Review/Repository (rather than requiring them) so a
        # feedback row with an orphaned review_id still counts toward the
        # stats -- it just won't have a project name attached.
        query = (
            db.session.query(Feedback, Issue, Repository)
            .join(Issue, Feedback.issue_id == Issue.id)
            .outerjoin(Review, Feedback.review_id == Review.id)
            .outerjoin(Repository, Review.repository_id == Repository.id)
        )
        query = query.filter(Feedback.created_at >= since)
        if repo_id:
            query = query.filter(Review.repository_id == repo_id)

        results = query.all()
        rows = [(f, issue) for f, issue, _repo in results]
        repo_by_review = {f.review_id: repo.full_name for f, _issue, repo in results if repo is not None}

        total = len(rows)
        dismissed = sum(1 for f, _ in rows if f.action in DISMISS_ACTIONS)

        by_module = defaultdict(lambda: {'total': 0, 'dismissed': 0})
        by_tool = defaultdict(lambda: {'total': 0, 'dismissed': 0})
        by_confidence = defaultdict(lambda: {'total': 0, 'dismissed': 0})
        by_day = defaultdict(lambda: {'total': 0, 'dismissed': 0})
        disputed_categories = defaultdict(lambda: {'total': 0, 'dismissed': 0, 'comments': [], 'locations': []})

        def bucket_confidence(c):
            c = _normalize_confidence(c)
            if c is None:
                return 'unknown'
            if c < 0.4:
                return 'low'
            if c < 0.7:
                return 'medium'
            return 'high'

        for f, issue in rows:
            is_dismissed = f.action in DISMISS_ACTIONS
            module = issue.module or 'unknown'
            tool = issue.tool or 'unknown'
            conf_bucket = bucket_confidence(issue.confidence)
            day = f.created_at.strftime('%Y-%m-%d') if f.created_at else 'unknown'
            category = issue.category or module

            for bucket, key in ((by_module, module), (by_tool, tool),
                                 (by_confidence, conf_bucket), (by_day, day)):
                bucket[key]['total'] += 1
                if is_dismissed:
                    bucket[key]['dismissed'] += 1

            disputed_categories[category]['total'] += 1
            if is_dismissed:
                disputed_categories[category]['dismissed'] += 1
                if f.comment:
                    disputed_categories[category]['comments'].append(f.comment)
                # Where the dismissed findings actually are, so "most disputed
                # category" points at real files instead of just a stat.
                if issue.file_path:
                    disputed_categories[category]['locations'].append({
                        'issue_id': issue.id,
                        'review_id': f.review_id,
                        'project': repo_by_review.get(f.review_id),
                        'file_path': issue.file_path,
                        'line_number': issue.line_number,
                        'title': issue.title,
                        'severity': issue.severity,
                    })

        def with_rate(d):
            out = []
            for key, v in d.items():
                rate = round(v['dismissed'] / v['total'], 3) if v['total'] else 0
                out.append({
                    **{'key': key}, **v, 'dismiss_rate': rate,
                    'low_sample': v['total'] < MIN_TRUSTED_SAMPLES,
                })
            return out

        module_stats = sorted(with_rate(by_module), key=lambda x: -x['total'])
        tool_stats = sorted(with_rate(by_tool), key=lambda x: -x['total'])
        confidence_stats = sorted(with_rate(by_confidence), key=lambda x: -x['total'])
        trend = sorted(with_rate(by_day), key=lambda x: x['key'])

        category_stats = []
        for key, v in disputed_categories.items():
            rate = round(v['dismissed'] / v['total'], 3) if v['total'] else 0
            # Dedup locations by (project, file) -- keep the first occurrence --
            # so a file with several dismissed findings doesn't repeat itself,
            # and same-named files in different projects don't collide.
            seen_files = set()
            unique_locations = []
            for loc in v['locations']:
                dedup_key = (loc['project'], loc['file_path'])
                if dedup_key in seen_files:
                    continue
                seen_files.add(dedup_key)
                unique_locations.append(loc)
            category_stats.append({
                'category': key,
                'total': v['total'],
                'dismissed': v['dismissed'],
                'dismiss_rate': rate,
                'low_sample': v['total'] < MIN_TRUSTED_SAMPLES,
                'sample_comments': v['comments'][:3],
                'affected_files': len(seen_files),
                'sample_locations': unique_locations[:5],
            })
        category_stats.sort(key=lambda x: (-x['dismiss_rate'], -x['total']))

        # Prefer a trusted (non-low-sample) category for the headline stat so a
        # single dismissed finding doesn't get crowned "most disputed category".
        trusted = [c for c in category_stats if not c['low_sample']]
        top_disputed = (trusted or category_stats)[0]['category'] if category_stats else None

        return jsonify({
            "success": True,
            "range_days": days,
            "total_feedback": total,
            "overall_dismiss_rate": round(dismissed / total, 3) if total else 0,
            "top_disputed_category": top_disputed,
            "by_module": module_stats,
            "by_tool": tool_stats,
            "by_confidence": confidence_stats,
            "trend": trend,
            "top_disputed_categories": category_stats[:10],
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@feedback_bp.route('/issue/<issue_id>', methods=['GET'])
def get_issue_feedback(issue_id):
    """Get all feedback for an issue."""
    try:
        feedbacks = Feedback.query.filter_by(issue_id=issue_id)\
            .order_by(Feedback.created_at.desc())\
            .all()
        
        return jsonify({
            "success": True,
            "feedback": [f.to_dict() for f in feedbacks],
            "count": len(feedbacks)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

