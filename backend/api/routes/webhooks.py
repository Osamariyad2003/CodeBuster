"""GitHub webhook ingestion: verify signature, accept PR/push, store event, create review job."""
import hmac
import hashlib
import json
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from backend.api.config import settings
from backend.api.database import get_db
from backend.api.models.repo import Repository
from backend.api.models.review import ReviewJob
from backend.api.models.webhook import WebhookEvent
from backend.api.logging_middleware import get_request_id

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_signature(body: bytes, signature: str | None) -> None:
    secret = settings.github_webhook_secret
    if not secret:
        return  # allow in dev without secret
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=400, detail="Missing or invalid X-Hub-Signature-256")
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@router.post("/github")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_github_delivery: str = Header(..., alias="X-GitHub-Delivery"),
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
) -> Dict[str, Any]:
    body = await request.body()
    _verify_signature(body, x_hub_signature_256)

    try:
        payload: Dict[str, Any] = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if x_github_event not in ("pull_request", "push"):
        return {"status": "ignored", "reason": "event_not_supported"}

    repo_info = payload.get("repository") or {}
    full_name = repo_info.get("full_name")
    if not full_name:
        raise HTTPException(status_code=400, detail="Missing repository full_name")

    repo = db.query(Repository).filter(Repository.full_name == full_name).first()
    if not repo:
        # Auto-create repo for scaffold so webhook test works without pre-seeding
        repo = Repository(full_name=full_name, default_branch=repo_info.get("default_branch") or "main")
        db.add(repo)
        db.flush()

    # Resolve commit_sha and optional pr_number
    if x_github_event == "pull_request":
        pr = payload.get("pull_request") or {}
        commit_sha = (pr.get("head") or {}).get("sha")
        pr_number = pr.get("number")
        branch = (pr.get("head") or {}).get("ref", "").replace("refs/heads/", "")
    else:
        commit_sha = payload.get("after")
        pr_number = None
        branch = (payload.get("ref") or "").replace("refs/heads/", "")

    if not commit_sha:
        raise HTTPException(status_code=400, detail="Unable to determine commit SHA")

    # Store webhook event
    event = WebhookEvent(
        event_id=x_github_delivery,
        event_type=x_github_event,
        payload=payload,
        signature_valid="true",
    )
    db.add(event)
    db.flush()

    # Create review job and link event
    job = ReviewJob(
        repo_id=repo.id,
        trigger="webhook",
        event_type=x_github_event,
        commit_sha=commit_sha,
        pr_number=pr_number,
        branch=branch or None,
        status="queued",
        payload=payload,
    )
    db.add(job)
    db.flush()
    event.review_job_id = job.id
    db.commit()

    # Enqueue Celery task (id will be set when worker is wired)
    from workers.tasks import run_review_task
    run_review_task.delay(str(job.id))

    return {
        "status": "accepted",
        "job_id": str(job.id),
        "event_id": x_github_delivery,
        "repo_id": str(repo.id),
    }
