from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os


def get_key_func():
    return get_remote_address()

limiter = Limiter(
    key_func=get_key_func,
    default_limits=["2000 per day", "1000 per hour"],
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    strategy="fixed-window",
    swallow_errors=True,
)

# Exempt localhost from limits
# This is crucial for local dev where multiple frontend calls happen quickly
@limiter.request_filter
def ip_whitelist():
    return get_remote_address() == "127.0.0.1" or get_remote_address() == "::1"

def init_limiter(app):
    limiter.init_app(app)
