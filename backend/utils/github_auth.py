import os
import requests
import jwt
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

from utils.config_loader import settings

def generate_app_jwt():
    """Generate GitHub App JWT."""
    github_app_id = settings.GITHUB_APP_ID
    if not github_app_id:
        return None
        
    try:
        private_key = settings.get_private_key()
    except ValueError as e:
        print(f"[ERR] {e}")
        return None
        
    now = datetime.utcnow()
    payload = {
        'iat': now - timedelta(seconds=60), # Clock skew
        'exp': now + timedelta(minutes=5),
        'iss': int(github_app_id)
    }
    return jwt.encode(payload, private_key, algorithm='RS256')

def get_installation_access_token(installation_id, force_refresh: bool = False):
    """Get access token for a specific installation.

    When ``force_refresh`` is True we skip the Redis cache and mint a brand-new
    token, then overwrite the cache. Use this after a 403 from GitHub to recover
    from stale tokens that predate a permission upgrade.
    """
    from app.redis_client import get_redis
    from app.token_cache import (
        get_installation_token,
        set_installation_token,
        invalidate_installation_token,
    )

    redis_client = None
    try:
        redis_client = get_redis()
        if force_refresh:
            invalidate_installation_token(redis_client, installation_id)
        else:
            cached_token = get_installation_token(redis_client, installation_id)
            if cached_token:
                return cached_token
    except Exception as e:
        print(f"[WARN]️ Redis error in auth: {e}")
        # Continue without cache if redis fails

    app_jwt = generate_app_jwt()
    if not app_jwt:
        return None
        
    response = requests.post(
        f'https://api.github.com/app/installations/{installation_id}/access_tokens',
        headers={
            'Authorization': f'Bearer {app_jwt}',
            'Accept': 'application/vnd.github.v3+json'
        }
    )
    
    if response.status_code == 201:
        data = response.json()
        token = data.get('token')
        expires_at_str = data.get('expires_at') # e.g. 2016-07-11T22:14:10Z
        
        # Cache if possible
        try:
            if redis_client and token and expires_at_str:
                # Parse ISO format "2016-07-11T22:14:10Z"
                dt = datetime.strptime(expires_at_str, "%Y-%m-%dT%H:%M:%SZ")
                expires_at_epoch = int(dt.timestamp())
                set_installation_token(redis_client, installation_id, token, expires_at_epoch)
        except Exception as e:
            print(f"[WARN]️ Failed to cache token: {e}")
            
        return token
    print(f"[ERR] Failed to get access token: {response.text}")
    return None
