"""Shared helpers for GitHub App JWT and installation tokens."""

from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt

from .config import settings


def build_jwt() -> str:
    """Create a short-lived JWT for GitHub App authentication."""
    if not settings.github_app_id or not settings.github_private_key_pem:
        raise RuntimeError("GitHub App id or private key not configured")

    now = datetime.now(timezone.utc)
    payload = {
        "iat": int(now.timestamp()) - 60,
        "exp": int((now + timedelta(minutes=10)).timestamp()),
        "iss": settings.github_app_id,
    }
    token = jwt.encode(
        payload,
        settings.github_private_key_pem,
        algorithm="RS256",
    )
    # PyJWT may return bytes in older versions
    return token.decode("utf-8") if isinstance(token, bytes) else token


async def get_installation_access_token(installation_id: int) -> str:
    """Exchange GitHub App JWT for an installation access token."""
    jwt_token = build_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["token"]

