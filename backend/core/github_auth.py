import hmac
import hashlib
import time
import jwt
import requests
from typing import Optional
from utils.config_loader import settings
import structlog

logger = structlog.get_logger()

class GitHubAuthService:
    """
    Handles production-grade GitHub App authentication.
    - JWT Generation for App-level auth
    - IAT (Installation Access Token) fetching and caching
    - Signature verification
    """

    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str) -> bool:
        """Verify the HMAC SHA256 signature from GitHub."""
        if not signature:
            return False
        
        secret = settings.GITHUB_WEBHOOK_SECRET.encode()
        expected = "sha256=" + hmac.new(secret, payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def generate_app_jwt() -> str:
        """Generate a JWT representing the GitHub App."""
        # Use an offset to account for clock drift between servers
        iat = int(time.time()) - 60
        exp = iat + (10 * 60)  # Maximum allowed is 10 minutes

        payload = {
            "iat": iat,
            "exp": exp,
            "iss": settings.GITHUB_APP_ID,
        }

        private_key = settings.get_private_key()
        return jwt.encode(payload, private_key, algorithm="RS256")

    @classmethod
    def get_installation_token(cls, installation_id: str) -> Optional[str]:
        """
        Request an Installation Access Token (IAT) from GitHub.
        Note: Caching logic should be handled by the caller or a decorator.
        """
        app_jwt = cls.generate_app_jwt()
        
        url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github.v3+json",
        }

        try:
            response = requests.post(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json().get("token")
        except Exception as e:
            logger.error("github_iat_request_failed", installation_id=installation_id, error=str(e))
            return None
