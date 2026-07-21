def is_duplicate_delivery(redis_client, delivery_id: str, ttl_seconds: int = 86400) -> bool:
    """
    Returns True if delivery_id already seen.
    Uses SET NX with TTL.
    """
    if not delivery_id:
        return False
        
    key = f"gh:delivery:{delivery_id}"
    # set returns True if set happened (key didn't exist), None if key existed
    # We want to return True if it IS a duplicate (i.e. set failed)
    
    # "nx=True": Only set the key if it does not already exist. 
    # Returns True if key was set, None if key was not set.
    ok = redis_client.set(key, "1", nx=True, ex=ttl_seconds)
    
    # If ok is True, it means it's NEW (not duplicate).
    # If ok is None, it means it EXISTS (is duplicate).
    return ok is None
