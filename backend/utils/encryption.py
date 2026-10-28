from cryptography.fernet import Fernet, MultiFernet
import os
import base64
import hashlib

def _derive_key_sha256(secret: str) -> bytes:
    """Cryptographically derive a 32-byte urlsafe-base64 key using SHA-256."""
    h = hashlib.sha256(secret.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(h)

def _derive_key_legacy(secret: str) -> bytes:
    """Legacy padded/truncated key derivation for backward compatibility."""
    key_bytes = secret.encode('utf-8')
    if len(key_bytes) < 32:
        key_bytes = key_bytes.ljust(32, b'=')
    else:
        key_bytes = key_bytes[:32]
    return base64.urlsafe_b64encode(key_bytes)

def _get_fernet():
    """
    Returns a MultiFernet instance:
    - Primary key: Derived via SHA-256 from TOKEN_ENCRYPTION_KEY or FLASK_SECRET_KEY
    - Fallback key: Derived via legacy padding so existing database records can decrypt seamlessly
    """
    secret = os.getenv('TOKEN_ENCRYPTION_KEY') or os.getenv('FLASK_SECRET_KEY', 'codebuster-secret-key-change-in-production')
    primary = Fernet(_derive_key_sha256(secret))
    fallback = Fernet(_derive_key_legacy(secret))
    return MultiFernet([primary, fallback])

def encrypt_token(token: str) -> str:
    """Encrypt a token."""
    if not token:
        return None
    f = _get_fernet()
    return f.encrypt(token.encode('utf-8')).decode('utf-8')

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token."""
    if not encrypted_token:
        return None
    f = _get_fernet()
    try:
        return f.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')
    except Exception as e:
        print(f"Encryption error: {e}")
        return None
