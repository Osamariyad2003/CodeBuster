import sys
import os
sys.path.append(os.getcwd())

from main import app
from models import Review, Issue, Repository
import json

with app.app_context():
    review = Review.query.order_by(Review.completed_at.desc()).first()
    if review:
        repo = Repository.query.get(review.repository_id)
        issues = Issue.query.filter_by(review_id=review.id).all()
        
        result = {
            "review": review.to_dict(),
            "repository": repo.name if repo else "Unknown",
            "findings_count": len(issues),
            "findings_severities": {
                "critical": len([i for i in issues if i.severity == 'critical']),
                "high": len([i for i in issues if i.severity == 'high']),
                "medium": len([i for i in issues if i.severity == 'medium']),
                "low": len([i for i in issues if i.severity == 'low'])
            },
            "sample_issues": [i.to_dict() for i in issues[:3]]
        }
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"error": "No reviews found in database."}, indent=2))
