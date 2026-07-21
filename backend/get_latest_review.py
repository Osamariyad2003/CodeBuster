from main import app
from models import Review, Repository
import json

with app.app_context():
    review = Review.query.order_by(Review.completed_at.desc()).first()
    if review:
        print(json.dumps(review.to_dict(), indent=2))
    else:
        print("No reviews found.")
