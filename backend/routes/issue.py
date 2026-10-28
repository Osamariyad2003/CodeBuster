"""Issue routes."""
from flask import Blueprint, jsonify, request, session
from functools import wraps
from models import db, Issue, Review, Repository, User

issue_bp = Blueprint('issue', __name__, url_prefix='/api/issues')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function


def _get_current_user_db():
    user_session = session.get('user') or {}
    user_id = user_session.get('id')
    login = user_session.get('login') or user_session.get('username')
    user_db = None
    if user_id:
        user_db = User.query.get(user_id)
    if not user_db and login:
        user_db = User.query.filter_by(username=login).first()
    return user_db

@issue_bp.route('', methods=['GET'])
@login_required
def get_issues():
    """Get list of issues with filtering scoped to current user."""
    try:
        user_db = _get_current_user_db()
        if not user_db:
            return jsonify({"error": "Unauthorized"}), 401

        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        severity = request.args.get('severity')
        category = request.args.get('category')
        status = request.args.get('status')
        repo_id = request.args.get('repo_id')
        patch_status = request.args.get('patch_status')
        search_query = request.args.get('q') or request.args.get('search')
        
        user_repo_ids = [r.id for r in Repository.query.with_entities(Repository.id).filter_by(connected_by=user_db.id).all()]
        if not user_repo_ids:
            return jsonify({"success": True, "data": [], "total_pages": 0, "current_page": 1, "total_count": 0})

        if repo_id:
            matched_repo = Repository.query.filter(
                Repository.connected_by == user_db.id,
                db.or_(Repository.id == repo_id, Repository.full_name == repo_id, Repository.name == repo_id)
            ).first()
            if matched_repo:
                user_review_ids = [r.id for r in Review.query.with_entities(Review.id).filter_by(repository_id=matched_repo.id).all()]
            else:
                return jsonify({'success': True, 'data': [], 'total_pages': 0, 'current_page': 1, 'total_count': 0})
        else:
            user_review_ids = [r.id for r in Review.query.with_entities(Review.id).filter(Review.repository_id.in_(user_repo_ids)).all()]
        if not user_review_ids:
            return jsonify({"success": True, "data": [], "total_pages": 0, "current_page": 1, "total_count": 0})

        query = db.session.query(Issue).filter(Issue.review_id.in_(user_review_ids))
        
        if severity:
            query = query.filter(Issue.severity == severity)
        if category:
            query = query.filter(Issue.category == category)
        if status:
            query = query.filter(Issue.status == status)
        if patch_status == 'ready':
            query = query.filter(Issue.suggested_fix.isnot(None), Issue.suggested_fix != '', Issue.suggested_fix != '{}', Issue.status != 'resolved')
        elif patch_status == 'applied':
            query = query.filter(Issue.status == 'resolved')
        elif patch_status == 'pending':
            query = query.filter(db.or_(Issue.suggested_fix.is_(None), Issue.suggested_fix == '', Issue.suggested_fix == '{}'))
        if search_query:
            term = f'%{search_query.strip()}%'
            query = query.filter(db.or_(Issue.title.ilike(term), Issue.file_path.ilike(term), Issue.description.ilike(term)))
            
        # Default sort by created_at desc (newest first)
        query = query.order_by(Issue.created_at.desc())
        
        # Safe pagination
        pagination = query.paginate(page=page, per_page=limit, error_out=False)
        
        issues = []
        for i in pagination.items:
            i_dict = i.to_dict()
            
            # Enrich with repo name using the existing relationships/backrefs
            # This is now much faster because of how the database objects are handled
            try:
                review = i.review
                if review:
                    repo = review.repository
                    i_dict['repo_name'] = repo.full_name if repo else 'Unknown'
                    i_dict['pr_number'] = review.pr_number
            except Exception as inner_e:
                print(f"DEBUG: Relationship enrichment failed for issue {i.id}: {str(inner_e)}")
                i_dict['repo_name'] = 'Unknown'
                
            issues.append(i_dict)
            
        return jsonify({
            "success": True,
            "data": issues,
            "total_pages": pagination.pages,
            "current_page": page,
            "total_count": pagination.total
        })
    except Exception as e:
        import traceback
        print(f"[ERR] Error in get_issues: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "Failed to fetch issues",
            "message": str(e)
        }), 500

@issue_bp.route('/<issue_id>', methods=['GET'])
@login_required
def get_issue(issue_id):
    """Get issue detail."""
    try:
        user_db = _get_current_user_db()
        if not user_db:
            return jsonify({"success": False, "error": "Unauthorized"}), 401

        issue = db.session.get(Issue, issue_id)
        if not issue:
            return jsonify({
                "success": False,
                "error": "Issue not found"
            }), 404

        review = issue.review
        repo = review.repository if review else None
        if repo and repo.connected_by and repo.connected_by != user_db.id:
            return jsonify({"success": False, "error": "Forbidden: Access denied"}), 403
            
        result = issue.to_dict()
        
        # Enrich with context using relationships
        try:
            review = issue.review
            if review:
                repo = review.repository
                result['repo_name'] = repo.full_name if repo else 'Unknown'
                result['pr_number'] = review.pr_number
        except Exception as rel_e:
            print(f"DEBUG: Detail relationship enrichment failed: {str(rel_e)}")
            result['repo_name'] = 'Unknown'
            
        return jsonify({
            "success": True,
            "data": result
        })
    except Exception as e:
        import traceback
        print(f"[ERR] Error in get_issue: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "Failed to fetch issue detail",
            "message": str(e)
        }), 500
