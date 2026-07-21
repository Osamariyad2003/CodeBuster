import os
import redis
import logging
import threading

logger = logging.getLogger(__name__)

# Shared pool — one per process, max 5 connections so we stay inside
# the Redis Cloud free-tier client limit (30) even with Flask + Celery.
_pool: redis.ConnectionPool | None = None
_pool_lock = threading.Lock()


def mask_url(url):
    """Mask password in Redis URL for safe logging."""
    if not url:
        return "None"
    try:
        if "@" in url:
            parts = url.split("@")
            prefix = parts[0].split("://")
            scheme = prefix[0]
            if ":" in prefix[1]:
                user_info = prefix[1].split(":")
                return f"{scheme}://{user_info[0]}:****@{parts[1]}"
        return url
    except Exception:
        return "****"


def _get_pool() -> redis.ConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is not None:
            return _pool
        url = os.getenv("REDIS_URL")
        if not url:
            raise RuntimeError("CRITICAL: REDIS_URL is not set.")
        _pool = redis.ConnectionPool.from_url(
            url,
            decode_responses=True,
            max_connections=5,
            socket_connect_timeout=10,
            socket_timeout=10,
            health_check_interval=30,
        )
        logger.info(f"Redis pool created: {mask_url(url)} (max_connections=5)")
    return _pool


def get_redis() -> redis.Redis:
    """Return a Redis client backed by the shared process-level connection pool."""
    return redis.Redis(connection_pool=_get_pool())

