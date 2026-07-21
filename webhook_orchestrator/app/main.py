import hmac
import hashlib
import json
import uuid
import time
import redis
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Header, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import Config
from .worker import process_github_event

# Configure Structured Logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# Initialize Redis for Idempotency
redis_client = redis.from_url(Config.REDIS_URL)

# Initialize Rate Limiter
limiter = Limiter(key_func=get_remote_address, storage_uri=Config.REDIS_URL)
app = FastAPI(title="GitHub Webhook Orchestrator")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Payload Size Check
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > Config.MAX_PAYLOAD_SIZE:
             return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"error": "Payload too large"}
            )

    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(duration)
    return response

async def verify_signature(request: Request, x_hub_signature_256: str = Header(None)):
    if not Config.GITHUB_WEBHOOK_SECRET:
        logger.error("missing_webhook_secret_env")
        raise HTTPException(status_code=500, detail="Server configuration error")
        
    if not x_hub_signature_256:
        logger.warning("missing_signature_header")
        raise HTTPException(status_code=401, detail="Signature missing")

    body = await request.body()
    
    signature = hmac.new(
        Config.GITHUB_WEBHOOK_SECRET.encode(),
        msg=body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    expected_header = f"sha256={signature}"
    
    if not hmac.compare_digest(expected_header, x_hub_signature_256):
        logger.warning("invalid_signature", provided=x_hub_signature_256)
        raise HTTPException(status_code=401, detail="Invalid signature")

@app.post("/webhooks/github")
@limiter.limit("60/minute")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(...),
    x_github_delivery: str = Header(...),
    _verify: None = Depends(verify_signature)
):
    # 1. Idempotency Check (Deduplication)
    idempotency_key = f"webhook_delivery:{x_github_delivery}"
    is_new = redis_client.set(idempotency_key, "processed", ex=Config.IDEMPOTENCY_TTL, nx=True)
    
    if not is_new:
        logger.info("duplicate_delivery_skipped", delivery_id=x_github_delivery)
        return JSONResponse(status_code=200, content={"status": "ignored", "reason": "duplicate delivery"})

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON payload"})

    repo_full_name = payload.get("repository", {}).get("full_name", "unknown")
    
    log_context = {
        "delivery_id": x_github_delivery,
        "event": x_github_event,
        "repository": repo_full_name,
        "request_id": request.state.request_id
    }

    # 2. Event Validation & Queueing
    if x_github_event == "pull_request":
        action = payload.get("action")
        log_context["action"] = action
        
        if action in ["opened", "synchronize", "reopened"]:
            process_github_event.delay(payload, x_github_event)
            logger.info("event_enqueued", **log_context)
            return JSONResponse(status_code=202, content={"status": "accepted", "event": "pull_request", "action": action})
        
    elif x_github_event == "push":
        process_github_event.delay(payload, x_github_event)
        logger.info("event_enqueued", **log_context)
        return JSONResponse(status_code=202, content={"status": "accepted", "event": "push"})

    # Default: Ignore unsupported events/actions
    logger.info("event_ignored", **log_context)
    return JSONResponse(status_code=200, content={"status": "ignored", "reason": "unsupported event or action"})
