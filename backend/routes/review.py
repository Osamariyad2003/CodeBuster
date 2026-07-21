"""Review routes."""
import logging
from flask import Blueprint, jsonify, request, session
from functools import wraps
from datetime import datetime
import uuid

from models import db, Review, Issue, Repository

logger = logging.getLogger(__name__)
from services.review_orchestrator import ReviewOrchestrator
from services.ai_review_service import AIReviewService

_STALE_EXPLANATION_MARKERS = (
    "AI reasoning is currently unavailable, so this finding is based on standard rules.",
    "AI reasoning provider is not configured",
    "Explanation generated from CodeBuster's rule library",
)
_ai_review_service = AIReviewService()


def _is_stale_explanation(text: str) -> bool:
    return not text or any(m in text for m in _STALE_EXPLANATION_MARKERS)


review_bp = Blueprint('review', __name__, url_prefix='/api/reviews')

def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@review_bp.route('', methods=['GET'])
@login_required
def get_reviews():
    """Get list of reviews."""
    try:
        user_session = session.get('user')
        if not user_session:
            return jsonify({"error": "Unauthorized"}), 401
            
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('page_size', request.args.get('limit', 20)))

        query = Review.query

        pagination = query.order_by(Review.created_at.desc()).paginate(page=page, per_page=limit, error_out=False)

        reviews = []
        for r in pagination.items:
            repo = Repository.query.get(r.repository_id)
            score = r.overall_health_score
            reviews.append({
                'id': r.id,
                'repo_id': r.repository_id,
                'repo_name': repo.full_name if repo else None,
                'overall_score': score,
                'overall_grade': _score_to_grade(score) if score is not None else None,
                'status': r.status,
                'created_at': r.created_at.isoformat() if r.created_at else None,
                'completed_at': r.completed_at.isoformat() if r.completed_at else None,
            })

        return jsonify({
            "reviews": reviews,
            "total": pagination.total,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@review_bp.route('', methods=['POST'])
@login_required
def review_code():
    """Review uploaded code files asynchronously with idempotency."""
    try:
        from tasks.analysis_tasks import run_code_analysis
        from models.schemas import ReviewRequestSchema
        from pydantic import ValidationError
        from utils.limiter import limiter

        # Idempotency check
        idempotency_key = request.headers.get('X-Idempotency-Key')
        if idempotency_key:
            # Check if this key was already processed in the last 10 minutes
            storage = limiter.storage
            storage_key = f"idempotency:{idempotency_key}"
            existing_job_id = storage.get(storage_key)
            if existing_job_id:
                return jsonify({
                    "job_id": existing_job_id.decode('utf-8') if isinstance(existing_job_id, bytes) else existing_job_id,
                    "status": "already_submitted",
                    "message": "This request was already submitted and is being processed."
                }), 200

        data = request.get_json()
        try:
            validated_data = ReviewRequestSchema(**data)
        except ValidationError as e:
            return jsonify({"error": e.errors()}), 400

        repository_id = validated_data.repository_id
        files = validated_data.files
        
        # Create initial review record as placeholder for the job
        review_id = str(uuid.uuid4())
        review = Review(
            id=review_id,
            repository_id=repository_id,
            trigger_type='manual',
            status='queued',
            started_at=datetime.utcnow()
        )
        db.session.add(review)
        db.session.commit()

        # Store idempotency key if provided (expires in 10 mins)
        if idempotency_key:
            storage.setex(storage_key, 600, review_id)

        # Dispatch background task with specific task_id matching review_id
        run_code_analysis.apply_async(
            args=[files, repository_id],
            task_id=review_id
        )
        
        return jsonify({
            "job_id": review_id,
            "status": "queued",
            "message": "Analysis started in background"
        }), 202
        
    except Exception as e:
        logger.error("review_code_error", error=str(e))
        return jsonify({"error": "Failed to start review"}), 500

@review_bp.route('/<review_id>/canonical', methods=['GET'])
@login_required
def get_review_canonical(review_id):
    """Get review in production-ready canonical format (codebuster.commit_review)."""
    try:
        review = Review.query.get_or_404(review_id)
        repository = Repository.query.get(review.repository_id) if review.repository_id else None
        issues = Issue.query.filter_by(review_id=review_id).all()
        from services.commit_review_canonical_builder import build_canonical_from_review
        import os
        frontend_url = os.environ.get("FRONTEND_URL", "").strip()
        payload = build_canonical_from_review(
            review,
            issues,
            repository,
            report_base_url=frontend_url or None,
        )
        return jsonify(payload)
    except Exception as e:
        logger.exception("get_review_canonical failed: %s", e)
        return jsonify({"error": str(e)}), 500


@review_bp.route('/<review_id>', methods=['GET'])
def get_review(review_id):
    """Get a specific review.

    Response is shaped to match the frontend ``ReviewDetail`` interface so that
    ReviewDetailPage.tsx can render findings, scores and grades without extra
    mapping on the client side.
    """
    try:
        review = Review.query.get(review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404

        # Optional severity / category filters (used by the frontend filter bar)
        severity_filter = request.args.get("severity")
        category_filter = request.args.get("category")

        query = Issue.query.filter_by(review_id=review_id)
        if severity_filter:
            query = query.filter(Issue.severity == severity_filter.lower())
        if category_filter:
            query = query.filter(
                (Issue.module == category_filter) | (Issue.category == category_filter)
            )
        issues = query.all()

        grade = _score_to_grade(review.overall_health_score or 0)

        # Map category_scores from JSON string/dict to the list format the
        # frontend expects: [{key, label, score}, …]
        raw_cats = review.category_scores
        if isinstance(raw_cats, str):
            import json as _json
            try:
                raw_cats = _json.loads(raw_cats)
            except Exception:
                raw_cats = {}
        cat_list = []
        if isinstance(raw_cats, dict):
            for k, v in raw_cats.items():
                cat_list.append({
                    "key": k,
                    "label": k.replace("_", " ").title(),
                    "score": v if isinstance(v, (int, float)) else 0,
                })
        elif isinstance(raw_cats, list):
            cat_list = raw_cats

        _BLOCKED_TITLES = {
            "magic number detected",
            "non-standard naming convention",
        }

        # Map Issue rows → frontend Finding[] shape.
        # Explanations use stored text only — no live AI calls in a synchronous GET
        # (live enrichment would block for seconds per finding and time out the request).
        findings = []
        for iss in issues:
            title = (iss.title or iss.description or "").strip()
            if title.lower() in _BLOCKED_TITLES:
                continue
            stored = iss.ai_explanation or ""
            explanation = stored if not _is_stale_explanation(stored) else \
                _ai_review_service._build_rule_based_explanation({
                    "category": iss.category or iss.module,
                    "tool": getattr(iss, "tool", None) or iss.module,
                    "module": iss.module,
                    "severity": iss.severity,
                    "description": iss.description,
                    "title": iss.title,
                    "suggested_fix": iss.get_suggested_fix() if hasattr(iss, "get_suggested_fix") else None,
                })
            findings.append({
                "id": iss.id,
                "severity": (iss.severity or "info").upper(),
                "category": iss.module or iss.category or None,
                "confidence": iss.confidence,
                "file": iss.file_path,
                "start_line": iss.line_number,
                "end_line": getattr(iss, "end_line", None),
                "message": iss.title or iss.description or "",
                "code_snippet": iss.code_snippet,
                "suggested_fix": iss.get_suggested_fix(),
                "ai_explanation": explanation,
            })

        return jsonify({
            "id": review.id,
            "repo_id": review.repository_id,
            "overall_score": review.overall_health_score,
            "overall_grade": grade,
            "category_scores": cat_list,
            "findings": findings,
            "created_at": review.created_at.isoformat() if review.created_at else None,
            "completed_at": review.completed_at.isoformat() if review.completed_at else None,
        })

    except Exception as e:
        logger.exception("get_review failed: %s", e)
        return jsonify({"error": str(e)}), 500


def _score_to_grade(score):
    if score >= 90: return 'A'
    if score >= 80: return 'B'
    if score >= 70: return 'C'
    if score >= 60: return 'D'
    return 'F'


@review_bp.route('/<review_id>/issues', methods=['GET'])
@login_required
def get_review_issues(review_id):
    """Get paginated, filterable issues for a review."""
    try:
        Review.query.get_or_404(review_id)
        severity = request.args.get('severity')
        category = request.args.get('category')  # module/category
        search = request.args.get('search', '').strip()
        sort = request.args.get('sort', 'severity')
        limit = min(request.args.get('limit', 50, type=int), 100)
        offset = request.args.get('offset', 0, type=int)

        query = Issue.query.filter_by(review_id=review_id)
        if severity:
            query = query.filter(Issue.severity == severity)
        if category:
            query = query.filter(Issue.module == category)
        if search:
            query = query.filter(
                Issue.title.ilike(f'%{search}%') | Issue.description.ilike(f'%{search}%')
            )
        if sort == 'severity':
            sev_order = {'critical': 1, 'major': 2, 'minor': 3, 'info': 4}
            query = query.order_by(Issue.severity.asc())
        elif sort == 'confidence':
            query = query.order_by(Issue.confidence.desc().nullslast())
        else:
            query = query.order_by(Issue.created_at.desc())

        total = query.count()
        issues = query.limit(limit).offset(offset).all()
        return jsonify({
            "success": True,
            "items": [i.to_dict() for i in issues],
            "total": total,
            "limit": limit,
            "offset": offset,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@review_bp.route('/repository/<repository_id>', methods=['GET'])
@login_required
def get_repository_reviews(repository_id):
    """Get all reviews for a repository."""
    try:
        reviews = Review.query.filter_by(repository_id=repository_id)\
            .order_by(Review.created_at.desc())\
            .limit(50)\
            .all()
        
        return jsonify({
            "success": True,
            "reviews": [review.to_dict() for review in reviews],
            "count": len(reviews)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@review_bp.route('/pr/<owner>/<repo>/<int:pr_number>', methods=['GET'])
@login_required
def get_pr_review(owner, repo, pr_number):
    """Get AI review for a specific PR."""
    try:
        # Find repository
        repo_full_name = f"{owner}/{repo}"
        repository = Repository.query.filter_by(full_name=repo_full_name).first()
        
        if not repository:
            return jsonify({"error": "Repository not found"}), 404
        
        # Find review for this PR
        review = Review.query.filter_by(
            repository_id=repository.id,
            pr_number=pr_number
        ).order_by(Review.created_at.desc()).first()
        
        if not review:
            return jsonify({
                "success": True,
                "pr": {"number": pr_number},
                "review": None,
                "message": "No review found for this PR"
            })
        
        # Get issues
        issues = Issue.query.filter_by(review_id=review.id).all()
        
        return jsonify({
            "success": True,
            "pr": {
                "number": pr_number,
                "title": None,  # Could fetch from GitHub API
            },
            "review": {
                **review.to_dict(),
                "issues": [issue.to_dict() for issue in issues]
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
