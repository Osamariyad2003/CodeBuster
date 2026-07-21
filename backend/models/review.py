"""Review model."""
from .database import db
from datetime import datetime
import json
from .uuid_generator import generate_uuid

class Review(db.Model):
    """Analysis review (one per PR or manual analysis)."""
    __tablename__ = 'reviews'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    repository_id = db.Column(db.String(36), db.ForeignKey('repositories.id'), nullable=False)
    pr_number = db.Column(db.Integer)
    commit_sha = db.Column(db.String(40))
    branch = db.Column(db.String(255))
    trigger_type = db.Column(db.String(50), nullable=False)  # webhook, manual, scheduled
    status = db.Column(db.String(50), default='pending')  # pending, running, completed, failed
    overall_health_score = db.Column(db.Integer)  # 0-100
    category_scores = db.Column(db.Text)  # JSON string
    findings_count = db.Column(db.Text)  # JSON string
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    top_risks = db.Column(db.Text)  # JSON string
    quick_wins = db.Column(db.Text)  # JSON string
    extra_metadata = db.Column(db.Text)  # JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    issues = db.relationship('Issue', backref='review', lazy=True, cascade='all, delete-orphan')
    feedback = db.relationship('Feedback', backref='review', lazy=True)
    
    def get_category_scores(self):
        """Get category scores as dict."""
        if self.category_scores:
            return json.loads(self.category_scores)
        return {}
    
    def set_category_scores(self, scores_dict):
        """Set category scores."""
        self.category_scores = json.dumps(scores_dict)
    
    def get_findings_count(self):
        """Get findings count as dict."""
        if self.findings_count:
            return json.loads(self.findings_count)
        return {}
    
    def set_findings_count(self, count_dict):
        """Set findings count."""
        self.findings_count = json.dumps(count_dict)
    
    def get_top_risks(self):
        if self.top_risks: return json.loads(self.top_risks)
        return []

    def get_quick_wins(self):
        if self.quick_wins: return json.loads(self.quick_wins)
        return []

    def get_extra_metadata(self):
        if self.extra_metadata: return json.loads(self.extra_metadata)
        return {}
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'repository_id': self.repository_id,
            'pr_number': self.pr_number,
            'commit_sha': self.commit_sha,
            'branch': self.branch,
            'trigger_type': self.trigger_type,
            'status': self.status,
            'overall_health_score': self.overall_health_score,
            'category_scores': self.get_category_scores(),
            'findings_count': self.get_findings_count(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message,
            'top_risks': self.get_top_risks(),
            'quick_wins': self.get_quick_wins(),
            'extra_metadata': self.get_extra_metadata(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ==========================================
# NEW: Comprehensive Review Scoring Models
# ==========================================

# Category weights for scoring
CATEGORY_WEIGHTS = {
    'security': 0.20,
    'reliability': 0.15,
    'architecture': 0.15,
    'code_quality': 0.10,
    'devops': 0.10,
    'performance': 0.10,
    'observability': 0.08,
    'data': 0.07,
    'frontend': 0.03,
    'ai': 0.02
}


def calculate_grade(score):
    """
    Calculate letter grade from score.

    Thresholds are calibrated for the saturating-curve scoring used by
    AIReviewService._calculate_health_score (see that method for details).
    The old cliff at 60→F was too steep — a "moderately rough" codebase
    landed at ~55 which is genuinely C/D territory, not failure.

      A: 85+   pristine to lightly-flagged code
      B: 70+   handful of minor/moderate issues
      C: 55+   visible quality drag, but still serviceable
      D: 40+   significant tech debt; needs attention
      F: <40   widespread problems
    """
    if score is None:
        return 'F'
    if score >= 85:
        return 'A'
    elif score >= 70:
        return 'B'
    elif score >= 55:
        return 'C'
    elif score >= 40:
        return 'D'
    else:
        return 'F'


class ReviewRun(db.Model):
    """Complete code review run for a repository with full scoring."""
    __tablename__ = 'review_runs'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    repository_id = db.Column(db.String(255), nullable=False, index=True)
    repo_full_name = db.Column(db.String(500))
    commit_sha = db.Column(db.String(100))
    trigger_source = db.Column(db.String(50))  # 'webhook', 'manual', 'scheduled'
    overall_score = db.Column(db.Integer, nullable=False)
    overall_grade = db.Column(db.String(1))  # A, B, C, D, F
    production_readiness = db.Column(db.String(20))  # 'yes', 'no', 'conditional'
    review_data = db.Column(db.JSON)  # Full canonical JSON payload
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    scored_categories = db.relationship('CategoryScore', back_populates='review_run', 
                                        cascade='all, delete-orphan', lazy='dynamic')
    scored_issues = db.relationship('ScoredIssue', back_populates='review_run', 
                                    cascade='all, delete-orphan', lazy='dynamic')
    fix_first_items = db.relationship('FixFirstItem', back_populates='review_run', 
                                      cascade='all, delete-orphan', lazy='dynamic')
    
    def to_dict(self):
        return {
            'review_id': self.id,
            'repository_id': self.repository_id,
            'repo_full_name': self.repo_full_name,
            'commit_sha': self.commit_sha,
            'trigger_source': self.trigger_source,
            'overall_score': self.overall_score,
            'overall_grade': self.overall_grade,
            'production_readiness': self.production_readiness,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def to_summary(self):
        """Return summary for list views."""
        return {
            'review_id': self.id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'overall_score': self.overall_score,
            'overall_grade': self.overall_grade,
            'production_readiness': self.production_readiness,
            'commit': self.commit_sha,
            'trigger_source': self.trigger_source
        }


class CategoryScore(db.Model):
    """Individual category scores for a review run."""
    __tablename__ = 'category_scores'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    review_run_id = db.Column(db.String(36), db.ForeignKey('review_runs.id', ondelete='CASCADE'), 
                              nullable=False, index=True)
    category_key = db.Column(db.String(50), nullable=False)
    label = db.Column(db.String(100))
    score = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Float)
    not_applicable = db.Column(db.Boolean, default=False)
    rationale = db.Column(db.Text)
    
    review_run = db.relationship('ReviewRun', back_populates='scored_categories')
    
    def to_dict(self):
        return {
            'key': self.category_key,
            'label': self.label,
            'score': self.score,
            'weight': self.weight,
            'not_applicable': self.not_applicable,
            'rationale': self.rationale
        }


class ScoredIssue(db.Model):
    """Issues found during a scored review run."""
    __tablename__ = 'scored_issues'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    review_run_id = db.Column(db.String(36), db.ForeignKey('review_runs.id', ondelete='CASCADE'), 
                              nullable=False, index=True)
    issue_id_stable = db.Column(db.String(50), nullable=False)  # ISSUE-001
    title = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    category_key = db.Column(db.String(50), index=True)
    confidence = db.Column(db.Float)
    file_paths = db.Column(db.JSON)  # Array of file paths
    evidence = db.Column(db.JSON)  # Array of evidence strings
    impact = db.Column(db.Text)
    recommendation = db.Column(db.Text)
    effort = db.Column(db.String(1))  # S, M, L
    tags = db.Column(db.JSON)  # Array of tags
    status = db.Column(db.String(20), default='open', index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    review_run = db.relationship('ReviewRun', back_populates='scored_issues')
    
    def to_dict(self):
        return {
            'id': self.id,
            'issue_id': self.issue_id_stable,
            'title': self.title,
            'severity': self.severity,
            'category_key': self.category_key,
            'confidence': self.confidence,
            'file_paths': self.file_paths or [],
            'evidence': self.evidence or [],
            'impact': self.impact,
            'recommendation': self.recommendation,
            'effort': self.effort,
            'tags': self.tags or [],
            'status': self.status
        }


class FixFirstItem(db.Model):
    """Prioritized fix-first action items."""
    __tablename__ = 'fix_first_items'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    review_run_id = db.Column(db.String(36), db.ForeignKey('review_runs.id', ondelete='CASCADE'), 
                              nullable=False, index=True)
    title = db.Column(db.Text, nullable=False)
    why = db.Column(db.Text)
    owner_hint = db.Column(db.String(50))  # backend, frontend, devops, security, data, ai
    effort = db.Column(db.String(1))  # S, M, L
    related_issue_ids = db.Column(db.JSON)  # Array of issue IDs like ISSUE-001
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    review_run = db.relationship('ReviewRun', back_populates='fix_first_items')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'why': self.why,
            'owner_hint': self.owner_hint,
            'effort': self.effort,
            'related_issue_ids': self.related_issue_ids or [],
            'status': self.status
        }

