import hmac
import json
from hashlib import sha256
from typing import Any, Dict

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.shared.config import settings
from services.shared.db import get_db
from services.shared import models
from services.shared.github_app import get_installation_access_token
from services.shared.logging import setup_observability
from services.shared.audit import write_audit_log
from services.worker_service.celery_app import celery_app
from sqlalchemy.orm import Session


class InstallUrlResponse(BaseModel):
    url: str


app = FastAPI(title="CodeBuster GitHub Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_observability(app, service_name="github-service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "github-service", "env": settings.environment}


@app.get("/api/v1/github/install-url", response_model=InstallUrlResponse)
def get_install_url() -> InstallUrlResponse:
    """Return the GitHub App installation URL for the dashboard."""
    app_id = settings.github_app_id
    if not app_id:
        raise HTTPException(status_code=500, detail="GitHub App not configured")

    # We use app slug-style URL; app slug is typically derived from app name.
    # For scaffolding we let operators configure it via GITHUB_APP_SLUG if needed.
    app_slug = settings.service_name.replace("_", "-")
    url = f"https://github.com/apps/{app_slug}/installations/new"
    return InstallUrlResponse(url=url)


def _verify_signature(body: bytes, signature: str | None) -> None:
    secret = settings.github_webhook_secret
    if not secret:
        # In early environments we may choose to run without verification, but
        # keep the check explicit so it can be hardened later.
        return
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=400, detail="Missing or invalid signature")
    sig_hex = signature.split("=", 1)[1]
    mac = hmac.new(secret.encode("utf-8"), msg=body, digestmod=sha256)
    if not hmac.compare_digest(mac.hexdigest(), sig_hex):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@app.post("/api/v1/github/webhook")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
) -> dict:
    """Ingest GitHub webhook events and enqueue review jobs."""
    body = await request.body()
    _verify_signature(body, x_hub_signature_256)

    try:
        payload: Dict[str, Any] = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if x_github_event not in {"pull_request", "push"}:
        return {"status": "ignored", "reason": "event-not-supported"}

    repo_info = payload.get("repository") or {}
    full_name = repo_info.get("full_name")
    if not full_name:
        raise HTTPException(status_code=400, detail="Missing repository information")

    # Resolve repository and organisation from DB (dashboard onboarding is
    # responsible for ensuring they exist).
    repo: models.Repository | None = (
        db.query(models.Repository)
        .filter(models.Repository.full_name == full_name)
        .first()
    )
    if not repo:
        return {
            "status": "ignored",
            "reason": "repository-not-registered",
        }

    org_id = str(repo.org_id)
    repo_id = str(repo.id)

    if x_github_event == "pull_request":
        action = payload.get("action")
        if action not in {"opened", "synchronize", "reopened"}:
            return {"status": "ignored", "reason": f"pr-action-{action}-ignored"}
        pr = payload.get("pull_request") or {}
        commit_sha = pr.get("head", {}).get("sha")
        pr_number = pr.get("number")
        trigger_type = "pr"
    else:  # push
        commit_sha = payload.get("after")
        pr_number = None
        trigger_type = "branch"

    if not commit_sha:
        raise HTTPException(status_code=400, detail="Unable to determine commit SHA")

    # Optionally ensure we can get an installation token; failures here should
    # not block job creation but are logged by workers when fetching code.
    installation = payload.get("installation") or {}
    installation_id = installation.get("id")
    if installation_id:
        # Fire and forget – we only validate configuration.
        try:
            await get_installation_access_token(int(installation_id))
        except Exception:
            # In early environments we don't fail the webhook on GitHub API
            # issues; the orchestrator will surface errors later.
            pass

    # Enqueue Celery job
    result = celery_app.send_task(
        "enqueue_review_job",
        args=[org_id, repo_id, "webhook", trigger_type, commit_sha, pr_number],
    )

    # Best-effort audit log
    if repo.org_id:
        write_audit_log(
            db,
            org_id=repo.org_id,
            user_id=None,
            action="github_webhook_review_enqueued",
            resource_type="repository",
            resource_id=str(repo.id),
            metadata={"event": x_github_event, "celery_task_id": result.id},
        )

    return {"status": "accepted", "job_id": result.id}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8083)

