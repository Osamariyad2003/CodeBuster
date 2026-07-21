from typing import Dict, Any, Optional
import structlog
from utils.config_loader import settings
from core.github_auth import GitHubAuthService

logger = structlog.get_logger()

class ToolRegistry:
    """
    Lazy initialization of production tools and services.
    Ensures that services are only created when needed and reused.
    """
    _instances: Dict[str, Any] = {}

    @classmethod
    def get_redis(cls):
        """Return a Redis client using the shared app-level connection pool."""
        if "redis" not in cls._instances:
            from app.redis_client import get_redis
            logger.info("initializing_redis_client")
            cls._instances["redis"] = get_redis()
        return cls._instances["redis"]

    @classmethod
    def get_db(cls):
        """Lazy init DB session (SQLAlchemy)."""
        if "db" not in cls._instances:
            from models import db
            logger.info("retrieving_db_session")
            cls._instances["db"] = db.session
        return cls._instances["db"]

    @classmethod
    def get_github_client(cls, installation_id: str):
        """
        Returns a context-aware GitHub API client for a specific installation.
        Handles token caching automatically via Redis.
        """
        redis = cls.get_redis()
        cache_key = f"gh_iat:{installation_id}"
        
        token = redis.get(cache_key)
        if not token:
            logger.info("iat_cache_miss", installation_id=installation_id)
            token = GitHubAuthService.get_installation_token(installation_id)
            if token:
                # Cache for 55 minutes (GitHub tokens expire in 60m)
                redis.setex(cache_key, 3300, token)
        
        return GitHubAPIClient(token)

class GitHubAPIClient:
    """A minimal wrapper for GitHub API interactions."""
    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

    def fetch_codeql_alerts(self, owner: str, repo: str):
        """Specifically fetch CodeQL alerts to avoid duplication."""
        url = f"{self.base_url}/repos/{owner}/{repo}/code-scanning/alerts"
        params = {"tool_name": "CodeQL", "status": "open"}
        
        import requests
        response = requests.get(url, headers=self.headers, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
