import json
import time

def get_installation_token(redis_client, installation_id):
    """
    Retrieve cached installation token.
    """
    key = f"gh:inst_token:{installation_id}"
    raw = redis_client.get(key)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data["token"]
    except json.JSONDecodeError:
        return None

def set_installation_token(redis_client, installation_id, token: str, expires_at_epoch: int):
    """
    Cache installation token with TTL slightly less than expiration.
    """
    # buffer 5 minutes
    ttl = max(60, expires_at_epoch - int(time.time()) - 300)
    key = f"gh:inst_token:{installation_id}"
    redis_client.set(key, json.dumps({"token": token}), ex=ttl)


def invalidate_installation_token(redis_client, installation_id):
    """Force-evict the cached installation token (e.g. after a 403)."""
    if not redis_client:
        return
    try:
        redis_client.delete(f"gh:inst_token:{installation_id}")
    except Exception:
        pass
