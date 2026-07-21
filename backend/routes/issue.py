"""Issue routes."""
from flask import Blueprint, jsonify, request, session
from functools import wraps
from models import db, Issue, Review, Repository

issue_bp = Blueprint('issue', __name__, url_prefix='/api/issues')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@issue_bp.route('', methods=['GET'])
@login_required
def get_issues():
    """Get list of issues with filtering."""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        severity = request.args.get('severity')
        category = request.args.get('category')
        
        # Use a base query with joined loading to optimize DB performance
        # This prevents the N+1 query problem by loading review and repo info in one go
        query = db.session.query(Issue)
        
        if severity:
            query = query.filter(Issue.severity == severity)
        if category:
            query = query.filter(Issue.category == category)
            
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
        # Use modern SQLAlchemy 2.0 fetching style
        issue = db.session.get(Issue, issue_id)
        if not issue:
            return jsonify({
                "success": False,
                "error": "Issue not found"
            }), 404
            
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
