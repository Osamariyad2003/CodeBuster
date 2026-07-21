from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.shared.config import settings
from services.shared.logging import setup_observability


class UserOut(BaseModel):
    id: str
    github_login: str
    name: str | None = None
    avatar_url: str | None = None


class MeResponse(BaseModel):
    user: UserOut | None
    organizations: list[dict] = []
    active_org_id: str | None = None


class AuthUrlResponse(BaseModel):
    auth_url: str


app = FastAPI(title="CodeBuster Auth Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_observability(app, service_name="auth-service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.service_name, "env": settings.environment}


@app.get("/api/v1/auth/github/login", response_model=AuthUrlResponse)
def github_login() -> AuthUrlResponse:
    """Return the GitHub OAuth authorize URL for SPA-based flows.

    The full OAuth dance (callback, user creation, session/JWT issuance) is
    intentionally not implemented here yet; this endpoint gives the frontend
    a stable contract while we evolve the auth stack.
    """
    client_id = settings.github_app_id or ""
    if not client_id:
        # In a real deployment this would be a 500; for scaffolding we keep it explicit.
        raise HTTPException(
            status_code=500,
            detail="GitHub client/app id is not configured",
        )

    # The redirect URL is assumed to be configured at the GitHub App level.
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&scope=repo,user"
    return AuthUrlResponse(auth_url=url)


@app.get("/api/v1/auth/me", response_model=MeResponse)
def auth_me() -> MeResponse:
    """Return the authenticated user.

    For now this is a stub that always returns `null` user, but the shape is
    aligned with the production contract so it can be wired into the React
    dashboard without churn.
    """
    return MeResponse(user=None, organizations=[], active_org_id=None)


if __name__ == "__main__":  # pragma: no cover - manual dev entrypoint
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8081)

