from flask import Blueprint, jsonify, session
from functools import wraps

stats_bp = Blueprint('stats', __name__, url_prefix='/stats')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

mock_stats = {
    "code_quality_trend": [
        {"name": "Week 1", "quality_score": 75},
        {"name": "Week 2", "quality_score": 78},
        {"name": "Week 3", "quality_score": 82},
        {"name": "Week 4", "quality_score": 85}
    ],
    "error_patterns": [
        {"pattern": "Missing Error Handling", "count": 12},
        {"pattern": "Complex Function", "count": 8},
        {"pattern": "Poor Naming", "count": 5},
        {"pattern": "Hardcoded Values", "count": 3}
    ]
}

@stats_bp.route('', methods=['GET'])
def get_stats():
    """Get code quality statistics."""
    return jsonify(mock_stats)

@stats_bp.route('/user', methods=['GET'])
@login_required
def get_user_stats():
    """Get user-specific statistics."""
    return jsonify({
        "total_reviews": 0,
        "total_issues_found": 0,
        "average_quality_score": 0,
        "connected_repos": 0,
        **mock_stats
    })