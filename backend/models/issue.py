"""Issue model."""
from .database import db
from datetime import datetime
import json
from .uuid_generator import generate_uuid

class Issue(db.Model):
    """Individual finding/issue from analyzers."""
    __tablename__ = 'issues'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    review_id = db.Column(db.String(36), db.ForeignKey('reviews.id'), nullable=False)
    module = db.Column(db.String(50), nullable=False)  # security, performance, etc.
    severity = db.Column(db.String(20), nullable=False)  # critical, major, minor, info
    category = db.Column(db.String(100))
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    file_path = db.Column(db.Text, nullable=False)
    line_number = db.Column(db.Integer)
    column_number = db.Column(db.Integer)
    code_snippet = db.Column(db.Text)
    tool = db.Column(db.String(100))
    confidence = db.Column(db.Float, default=0.5)  # 0.00-1.00
    evidence = db.Column(db.Text)  # JSON array
    suggested_fix = db.Column(db.Text)  # JSON object
    references = db.Column(db.Text)  # JSON array
    extra_metadata = db.Column(db.Text)  # JSON object
    ai_explanation = db.Column(db.Text)
    priority_score = db.Column(db.Integer)  # ML-predicted priority (0-100)
    status = db.Column(db.String(20), default='open')  # open, resolved, dismissed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    feedback = db.relationship('Feedback', backref='issue', lazy=True)
    
    def get_evidence(self):
        """Get evidence as list."""
        if self.evidence:
            return json.loads(self.evidence)
        return []
    
    def set_evidence(self, evidence_list):
        """Set evidence."""
        self.evidence = json.dumps(evidence_list)
    
    def get_suggested_fix(self):
        """Get suggested fix as dict."""
        if self.suggested_fix:
            return json.loads(self.suggested_fix)
        return {}
    
    def set_suggested_fix(self, fix_dict):
        """Set suggested fix."""
        self.suggested_fix = json.dumps(fix_dict)
    
    def get_references(self):
        """Get references as list."""
        if self.references:
            return json.loads(self.references)
        return []
    
    def set_references(self, refs_list):
        """Set references."""
        self.references = json.dumps(refs_list)
    
    def get_extra_metadata(self):
        """Get extra metadata dict (tags, effort, recommendation, etc.)."""
        if self.extra_metadata:
            try:
                return json.loads(self.extra_metadata)
            except (TypeError, ValueError):
                return {}
        return {}

    def to_dict(self):
        """Convert to dictionary."""
        meta = self.get_extra_metadata()
        return {
            'id': self.id,
            'review_id': self.review_id,
            'module': self.module,
            'severity': self.severity,
            'category': self.category,
            'title': self.title,
            'description': self.description,
            'file': self.file_path,
            'line': self.line_number,
            'column': self.column_number,
            'code_snippet': self.code_snippet,
            'tool': self.tool,
            'confidence': float(self.confidence) if self.confidence else 0.5,
            'evidence': self.get_evidence(),
            'suggested_fix': self.get_suggested_fix(),
            'references': self.get_references(),
            'ai_explanation': self.ai_explanation,
            'priority_score': self.priority_score,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            # AI agent findings carry these on extra_metadata. Always include
            # them in the response (empty dict is fine) so the frontend can
            # branch on their presence without doing JSON parsing client-side.
            'extra_metadata': meta,
            'tags': meta.get('tags') or [],
            'effort': meta.get('effort'),
            'recommendation': meta.get('recommendation'),
        }

