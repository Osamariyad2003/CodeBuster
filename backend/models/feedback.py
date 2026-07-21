"""Feedback model."""
from .database import db
from datetime import datetime
from .uuid_generator import generate_uuid

class Feedback(db.Model):
    """User feedback on issues (accept/dismiss/resolve)."""
    __tablename__ = 'feedback'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    issue_id = db.Column(db.String(36), db.ForeignKey('issues.id'), nullable=False)
    review_id = db.Column(db.String(36), db.ForeignKey('reviews.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    action = db.Column(db.String(20), nullable=False)  # accept, dismiss, resolve, ignore
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'issue_id': self.issue_id,
            'review_id': self.review_id,
            'user_id': self.user_id,
            'action': self.action,
            'comment': self.comment,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

