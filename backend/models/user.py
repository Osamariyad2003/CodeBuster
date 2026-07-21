"""User model."""
from .database import db
from datetime import datetime
from .uuid_generator import generate_uuid

class User(db.Model):
    """User account (GitHub OAuth)."""
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    github_id = db.Column(db.Integer, unique=True, nullable=False)
    username = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    avatar_url = db.Column(db.Text)
    access_token_encrypted = db.Column(db.Text)  # In production, encrypt this
    refresh_token_encrypted = db.Column(db.Text)
    token_expires_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    repositories = db.relationship('Repository', backref='user', lazy=True)
    feedback = db.relationship('Feedback', backref='user', lazy=True)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'github_id': self.github_id,
            'username': self.username,
            'email': self.email,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
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
