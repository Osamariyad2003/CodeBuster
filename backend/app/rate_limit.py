import time

def rate_limit(redis_client, ip: str, limit_per_minute: int = 60) -> bool:
    """
    Returns True if allowed, False if rate limited.
    Fixed window per-minute bucket.
    """
    bucket = int(time.time() // 60)
    key = f"rl:{ip}:{bucket}"

    # Use a pipeline to ensure atomicity of incr + expire on first write
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.ttl(key)
    results = pipe.execute()
    
    count = results[0]
    ttl = results[1]
    
    if count == 1 or ttl == -1:
        redis_client.expire(key, 60)

    return count <= limit_per_minute
