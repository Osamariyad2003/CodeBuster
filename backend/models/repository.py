"""Repository model."""
from .database import db
from datetime import datetime
import json
from .uuid_generator import generate_uuid

class Repository(db.Model):
    """GitHub repository."""
    __tablename__ = 'repositories'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    owner = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(512), unique=True, nullable=False)
    github_repo_id = db.Column(db.Integer, unique=True)
    description = db.Column(db.Text)
    language = db.Column(db.String(100))
    is_private = db.Column(db.Boolean, default=False)
    default_branch = db.Column(db.String(255))
    webhook_secret_encrypted = db.Column(db.Text)
    installation_id = db.Column(db.Integer)
    config = db.Column(db.Text)  # JSON string for MVP
    status = db.Column(db.String(50), default='active')
    connected_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    connected_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    reviews = db.relationship('Review', backref='repository', lazy=True, cascade='all, delete-orphan')
    
    def get_config(self):
        """Get repository configuration with defaults."""
        default_config = {
            'active': True,
            'enabled_modules': ['security', 'quality', 'performance'],
            'severity_threshold': 'all',
            'confidence_threshold': 0.6,
            'ai_mode': 'balanced',
            'protected_branches': ['main']
        }
        
        if self.config:
            try:
                # Parse JSON if string
                parsed_config = json.loads(self.config) if isinstance(self.config, str) else self.config
                # Merge with defaults
                config = default_config.copy()
                config.update(parsed_config)
                return config
            except (json.JSONDecodeError, TypeError):
                return default_config
        return default_config
    
    def set_config(self, config):
        """Set repository configuration."""
        # Store as JSON string
        self.config = json.dumps(config) if not isinstance(config, str) else config

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'owner': self.owner,
            'name': self.name,
            'full_name': self.full_name,
            'description': self.description,
            'language': self.language,
            'is_private': self.is_private,
            'status': self.status,
            'connected_at': self.connected_at.isoformat() if self.connected_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

