import os
from pathlib import Path

# Load private key from file
def load_github_private_key():
    """Load GitHub App private key from file."""
    key_path = os.getenv('GITHUB_APP_PRIVATE_KEY_PATH')
    if key_path and os.path.exists(key_path):
        with open(key_path, 'r') as f:
            return f.read()
    return None

GITHUB_PRIVATE_KEY = load_github_private_key()