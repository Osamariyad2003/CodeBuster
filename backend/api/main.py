"""FastAPI app: health, webhook, reviews, repos API."""
import structlog

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import settings
from backend.api.database import Base, engine
from backend.api.errors import global_exception_handler
from backend.api.logging_middleware import RequestIdLoggingMiddleware
from backend.api.routes import health_router, webhooks_router, reviews_router, repos_router

# Import models so tables exist
from backend.api.models import WebhookEvent, Repository, RepoSettings, Review, ReviewJob  # noqa: F401

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)

app = FastAPI(
    title="CodeBuster API",
    version="1.0.0",
    description="AI-powered GitHub code review & engineering health",
)

app.add_middleware(RequestIdLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(Exception, global_exception_handler)

app.include_router(health_router)
app.include_router(webhooks_router)
app.include_router(reviews_router)
app.include_router(repos_router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)
