"""Model registry to ensure all models are imported before relationships are resolved."""
# This file ensures all models are imported in the correct order

def register_models():
    """Import all models to register them with SQLAlchemy."""
    from . import user
    from . import repository
    from . import review
    from . import issue
    from . import feedback

