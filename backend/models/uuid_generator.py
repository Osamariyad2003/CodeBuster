"""UUID generator for SQLAlchemy defaults."""
import uuid

def generate_uuid():
    """Generate a UUID string for use as SQLAlchemy default."""
    return str(uuid.uuid4())

