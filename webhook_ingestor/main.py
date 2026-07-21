import hmac
import hashlib
import json
import os
import time
import uuid
from typing import List, Optional

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Header, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Load environment variables
load_dotenv()

GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MAX_PAYLOAD_SIZE = 2 * 1024 * 1024  # 2MB

# Configure Structured Logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# Initialize Rate Limiter
limiter = Limiter(key_func=get_remote_address, storage_uri=REDIS_URL)
app = FastAPI(title="GitHub Webhook Ingestor")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Middleware for Request ID and Logging
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    
    # Check payload size
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_PAYLOAD_SIZE:
             return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"error": "Payload too large"}
            )

    response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    
    return response

async def verify_signature(request: Request, x_hub_signature_256: str = Header(None)):
    if not GITHUB_WEBHOOK_SECRET:
        logger.error("missing_webhook_secret_env")
        raise HTTPException(status_code=500, detail="Server configuration error")
        
    if not x_hub_signature_256:
        logger.warning("missing_signature_header")
        raise HTTPException(status_code=401, detail="Signature missing")

    body = await request.body()
    
    # Verify signature using HMAC SHA-256
    signature = hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(),
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
    response: Response,
    x_github_event: str = Header(...),
    x_github_delivery: str = Header(...),
    _verify: None = Depends(verify_signature)
):
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

    if x_github_event == "pull_request":
        action = payload.get("action")
        log_context["action"] = action
        
        if action in ["opened", "synchronize", "reopened"]:
            logger.info("accepted_event", **log_context)
            return JSONResponse(status_code=202, content={"status": "accepted", "event": "pull_request", "action": action})
        else:
            logger.info("ignored_event", **log_context)
            return JSONResponse(status_code=200, content={"status": "ignored", "reason": f"unsupported action: {action}"})

    elif x_github_event == "push":
        logger.info("accepted_event", **log_context)
        return JSONResponse(status_code=202, content={"status": "accepted", "event": "push"})

    else:
        logger.info("ignored_event", **log_context)
        return JSONResponse(status_code=200, content={"status": "ignored", "reason": f"unsupported event: {x_github_event}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
