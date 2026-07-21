"""Review scoring API routes."""
from flask import Blueprint, jsonify, request, session
from functools import wraps
from models.database import db
from models.review import ReviewRun, CategoryScore, ScoredIssue, FixFirstItem, CATEGORY_WEIGHTS, calculate_grade
from datetime import datetime, timedelta

reviews_bp = Blueprint('reviews', __name__, url_prefix='/api')


def login_required(f):
    """Decorator to require login for API endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function


def validate_review_payload(data):
    """Validate canonical review JSON payload."""
    required_keys = ['project', 'scores', 'issues']
    if not all(k in data for k in required_keys):
        return False, f"Missing required keys: {required_keys}"
    
    # Validate project
    if not all(k in data.get('project', {}) for k in ['name', 'repo_id', 'repo_full_name']):
        return False, "Invalid project structure"
    
    # Validate scores
    if not all(k in data.get('scores', {}) for k in ['overall_score', 'overall_grade', 'categories']):
        return False, "Invalid scores structure"
    
    return True, None


@reviews_bp.route('/reviews', methods=['POST'])
@login_required
def create_review():
    """Store a review run payload."""
    try:
        data = request.get_json()
        
        # Validate payload
        is_valid, error = validate_review_payload(data)
        if not is_valid:
            return jsonify({"error": error}), 400
        
        # Extract core fields
        project = data['project']
        scores = data['scores']
        
        # Check idempotency: same repo + commit
        if project.get('version_or_commit'):
            existing = ReviewRun.query.filter_by(
                repository_id=str(project['repo_id']),
                commit_sha=project['version_or_commit']
            ).first()
            
            if existing:
                return jsonify({
                    "review_id": existing.id,
                    "stored": False,
                    "message": "Review already exists for this commit"
                }), 200
        
        # Create ReviewRun
        review_run = ReviewRun(
            repository_id=str(project['repo_id']),
            repo_full_name=project['repo_full_name'],
            commit_sha=project.get('version_or_commit'),
            trigger_source=data.get('trigger_source', 'manual'),
            overall_score=scores['overall_score'],
            overall_grade=scores['overall_grade'],
            production_readiness=scores.get('production_readiness', 'no'),
            review_data=data  # Store full JSON
        )
        db.session.add(review_run)
        db.session.flush()  # Get review_run.id
        
        # Create CategoryScores
        for cat in scores.get('categories', []):
            cat_score = CategoryScore(
                review_run_id=review_run.id,
                category_key=cat['key'],
                label=cat.get('label', cat['key']),
                score=cat['score'],
                weight=cat.get('weight', 0),
                not_applicable=cat.get('not_applicable', False),
                rationale=cat.get('rationale', '')
            )
            db.session.add(cat_score)
        
        # Create ScoredIssues
        for issue_data in data.get('issues', []):
            issue = ScoredIssue(
                review_run_id=review_run.id,
                issue_id_stable=issue_data['id'],
                title=issue_data['title'],
                severity=issue_data['severity'],
                category_key=issue_data['category_key'],
                confidence=issue_data.get('confidence', 0.5),
                file_paths=issue_data.get('file_paths', []),
                evidence=issue_data.get('evidence', []),
                impact=issue_data.get('impact', ''),
                recommendation=issue_data.get('recommendation', ''),
                effort=issue_data.get('effort', 'M'),
                tags=issue_data.get('tags', [])
            )
            db.session.add(issue)
        
        # Create FixFirstItems
        for fix in data.get('fix_first', []):
            fix_item = FixFirstItem(
                review_run_id=review_run.id,
                title=fix['title'],
                why=fix.get('why', ''),
                owner_hint=fix.get('owner_hint', ''),
                effort=fix.get('effort', 'M'),
                related_issue_ids=fix.get('related_issue_ids', [])
            )
            db.session.add(fix_item)
        
        db.session.commit()
        
        return jsonify({
            "review_id": review_run.id,
            "stored": True
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/repos/<repo_id>/reviews', methods=['GET'])
@login_required
def get_repo_reviews(repo_id):
    """List review runs for a repo."""
    try:
        # Query params
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = ReviewRun.query.filter_by(repository_id=repo_id)
        
        # Date filters
        if date_from:
            query = query.filter(ReviewRun.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.filter(ReviewRun.created_at <= datetime.fromisoformat(date_to))
        
        # Order and paginate
        query = query.order_by(ReviewRun.created_at.desc())
        total = query.count()
        reviews = query.limit(limit).offset(offset).all()
        
        return jsonify({
            "reviews": [r.to_summary() for r in reviews],
            "total": total,
            "limit": limit,
            "offset": offset
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/reviews/<review_id>', methods=['GET'])
@login_required
def get_review(review_id):
    """Get full review payload."""
    try:
        review = ReviewRun.query.get(review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
        return jsonify(review.review_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/reviews/<review_id>/issues', methods=['GET'])
@login_required
def get_review_issues(review_id):
    """Get paginated, filterable issues."""
    try:
        # Query params
        severity = request.args.get('severity')
        category_key = request.args.get('category_key')
        search = request.args.get('search', '')
        sort = request.args.get('sort', 'severity_desc')
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        query = ScoredIssue.query.filter_by(review_run_id=review_id)
        
        # Filters
        if severity:
            query = query.filter(ScoredIssue.severity == severity)
        if category_key:
            query = query.filter(ScoredIssue.category_key == category_key)
        if search:
            query = query.filter(ScoredIssue.title.ilike(f'%{search}%'))
        
        # Sorting
        if sort == 'severity_desc':
            severity_order = db.case(
                (ScoredIssue.severity == 'CRITICAL', 1),
                (ScoredIssue.severity == 'HIGH', 2),
                (ScoredIssue.severity == 'MEDIUM', 3),
                (ScoredIssue.severity == 'LOW', 4),
                else_=5
            )
            query = query.order_by(severity_order)
        elif sort == 'confidence_desc':
            query = query.order_by(ScoredIssue.confidence.desc().nullslast())
        elif sort == 'newest':
            query = query.order_by(ScoredIssue.created_at.desc())
        
        total = query.count()
        issues = query.limit(limit).offset(offset).all()
        
        return jsonify({
            "items": [i.to_dict() for i in issues],
            "total": total,
            "limit": limit,
            "offset": offset
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/repos/<repo_id>/latest-review', methods=['GET'])
@login_required
def get_latest_review(repo_id):
    """Get latest review summary + top 5 issues."""
    try:
        review = ReviewRun.query.filter_by(repository_id=repo_id)\
            .order_by(ReviewRun.created_at.desc()).first()
        
        if not review:
            return jsonify({"error": "No reviews found", "review": None}), 404
        
        # Top 5 critical/high issues
        top_issues = ScoredIssue.query.filter_by(review_run_id=review.id)\
            .filter(ScoredIssue.severity.in_(['CRITICAL', 'HIGH']))\
            .order_by(
                db.case(
                    (ScoredIssue.severity == 'CRITICAL', 1),
                    (ScoredIssue.severity == 'HIGH', 2),
                    else_=3
                )
            )\
            .limit(5).all()
        
        # Get category scores
        categories = CategoryScore.query.filter_by(review_run_id=review.id).all()
        
        # Get fix first items
        fix_first = FixFirstItem.query.filter_by(review_run_id=review.id).all()
        
        return jsonify({
            "review": review.to_summary(),
            "categories": [c.to_dict() for c in categories],
            "top_issues": [i.to_dict() for i in top_issues],
            "fix_first": [f.to_dict() for f in fix_first]
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/repos/<repo_id>/score-trend', methods=['GET'])
@login_required
def get_score_trend(repo_id):
    """Get time series for chart."""
    try:
        days = request.args.get('days', 30, type=int)
        date_from = datetime.utcnow() - timedelta(days=days)
        
        reviews = ReviewRun.query.filter_by(repository_id=repo_id)\
            .filter(ReviewRun.created_at >= date_from)\
            .order_by(ReviewRun.created_at.asc()).all()
        
        return jsonify([{
            "date": r.created_at.isoformat() if r.created_at else None,
            "overall_score": r.overall_score,
            "grade": r.overall_grade
        } for r in reviews])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/reviews/<review_id>/fix-first', methods=['GET'])
@login_required
def get_fix_first_items(review_id):
    """Get fix-first checklist items."""
    try:
        items = FixFirstItem.query.filter_by(review_run_id=review_id).all()
        return jsonify({
            "items": [i.to_dict() for i in items]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/reviews/<review_id>/fix-first/<item_id>', methods=['PATCH'])
@login_required
def update_fix_first_item(review_id, item_id):
    """Update fix-first item status."""
    try:
        item = FixFirstItem.query.filter_by(id=item_id, review_run_id=review_id).first()
        if not item:
            return jsonify({"error": "Item not found"}), 404
        
        data = request.get_json()
        if 'status' in data:
            item.status = data['status']
        
        db.session.commit()
        return jsonify(item.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@reviews_bp.route('/reviews/<review_id>/issues/<issue_id>', methods=['PATCH'])
@login_required
def update_issue_status(review_id, issue_id):
    """Update issue status."""
    try:
        issue = ScoredIssue.query.filter_by(id=issue_id, review_run_id=review_id).first()
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        data = request.get_json()
        if 'status' in data:
            issue.status = data['status']
        
        db.session.commit()
        return jsonify(issue.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
