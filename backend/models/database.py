"""Database initialization and configuration."""
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
from sqlalchemy import text
import os

db = SQLAlchemy()

def init_db(app):
    """Initialize database with Flask app."""
    # Use DATABASE_URL from env or config, fallback to SQLite
    db_url = os.getenv('DATABASE_URL', app.config.get('DATABASE_URL'))
    
    if not db_url:
         db_path = Path(__file__).parent.parent / 'codebuster.db'
         db_url = f'sqlite:///{db_path}'

    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    
    # Import all models to register them
    from . import user, repository, review, issue, feedback
    
    with app.app_context():
        db.create_all()
        # Ensure new user profile columns exist in existing SQLite databases
        for col_name, col_type in [
            ('bio', 'TEXT'),
            ('role', 'VARCHAR(100)'),
            ('company', 'VARCHAR(255)'),
            ('preferences', 'TEXT')
        ]:
            try:
                db.session.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                db.session.commit()
            except Exception:
                db.session.rollback()
        print(f"[OK] Database initialized: {db_url}")
