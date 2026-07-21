from cryptography.fernet import Fernet
import os
import base64

def _get_fernet_key():
    """Derive a Fernet-compatible key from the Flask Secret Key."""
    # In production, use a dedicated key. For MVP, we derive from secret key.
    key = os.getenv('FLASK_SECRET_KEY', 'codebuster-secret-key-change-in-production')
    # Pad or truncate to 32 bytes for url-safe base64 encoding
    key_bytes = key.encode('utf-8')
    if len(key_bytes) < 32:
        key_bytes = key_bytes.ljust(32, b'=')
    else:
        key_bytes = key_bytes[:32]
    return base64.urlsafe_b64encode(key_bytes)

def encrypt_token(token: str) -> str:
    """Encrypt a token."""
    if not token:
        return None
    f = Fernet(_get_fernet_key())
    return f.encrypt(token.encode('utf-8')).decode('utf-8')

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token."""
    if not encrypted_token:
        return None
    f = Fernet(_get_fernet_key())
    try:
        return f.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')
    except Exception as e:
        print(f"Encryption error: {e}")
        return None
