"""User model."""
from .database import db
from datetime import datetime
import json
from .uuid_generator import generate_uuid

class User(db.Model):
    """User account (GitHub OAuth)."""
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    github_id = db.Column(db.Integer, unique=True, nullable=False)
    username = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    avatar_url = db.Column(db.Text)
    bio = db.Column(db.Text)
    role = db.Column(db.String(100), default='Senior Reviewer')
    company = db.Column(db.String(255), default='CodeBuster Labs')
    preferences = db.Column(db.Text)  # JSON serialized dictionary
    access_token_encrypted = db.Column(db.Text)  # Encrypted with Fernet
    refresh_token_encrypted = db.Column(db.Text)
    token_expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    repositories = db.relationship('Repository', backref='user', lazy=True)
    feedback = db.relationship('Feedback', backref='user', lazy=True)
    
    def get_preferences(self):
        """Retrieve user preferences with secure, production-grade defaults."""
        defaults = {
            'ai_model': 'gemini-2.5-flash',
            'ai_persona': 'senior_staff',  # 'senior_staff', 'security_lead', 'concise'
            'thoroughness': 'strict',      # 'strict', 'balanced', 'standard'
            'auto_suggest_fixes': True,
            'filter_style_nitpicks': True,
            'sound_effects': True,
            'email_notifications': True,
            'pr_digest': True,
            'theme': 'dark'
        }
        if self.preferences:
            try:
                saved = json.loads(self.preferences) if isinstance(self.preferences, str) else self.preferences
                if isinstance(saved, dict):
                    defaults.update(saved)
            except Exception:
                pass
        return defaults

    def set_preferences(self, new_prefs):
        """Update and serialize user preferences."""
        current = self.get_preferences()
        if isinstance(new_prefs, dict):
            current.update(new_prefs)
        self.preferences = json.dumps(current)

    def to_dict(self):
        """Convert to dictionary."""
        prefs = self.get_preferences()
        return {
            'id': self.id,
            'github_id': self.github_id,
            'username': self.username,
            'login': self.username,
            'email': self.email or '',
            'avatar_url': self.avatar_url or '',
            'bio': getattr(self, 'bio', '') or 'Autonomous code reviewer and software engineer.',
            'role': getattr(self, 'role', '') or 'Senior Reviewer',
            'company': getattr(self, 'company', '') or 'CodeBuster Labs',
            'preferences': prefs,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'connected_repos_count': len(self.repositories) if self.repositories else 0,
        }

    def set_access_token(self, token):
        """Encrypt and set access token."""
        from utils.encryption import encrypt_token
        self.access_token_encrypted = encrypt_token(token)

    def get_access_token(self):
        """Decrypt and get access token."""
        from utils.encryption import decrypt_token
        return decrypt_token(self.access_token_encrypted)

    def set_refresh_token(self, token):
        """Encrypt and set refresh token."""
        from utils.encryption import encrypt_token
        self.refresh_token_encrypted = encrypt_token(token)

    def get_refresh_token(self):
        """Decrypt and get refresh token."""
        from utils.encryption import decrypt_token
        return decrypt_token(self.refresh_token_encrypted)
