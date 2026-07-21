# CodeBuster Architecture

## Overview

CodeBuster is an AI-powered GitHub code review and engineering health dashboard (SaaS). This document describes the scaffold architecture used for local development and production deployment.

## High-Level Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   GitHub    │     │   Backend    │     │   Frontend  │
│  (webhooks) │────▶│  (FastAPI)  │◀────│ React + TS  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Redis     │
                    │  (Celery)   │
                    └──────┬──────┘
                           │
┌─────────────┐     ┌──────┴──────┐     ┌─────────────┐
│  PostgreSQL │◀────│   Workers   │────▶│ MinIO / S3  │
│   (repos,   │     │  (Celery)   │     │ (artifacts) │
│  reviews)   │     │  analyzers  │     └─────────────┘
└─────────────┘     └─────────────┘
```

## Components

### Backend (`backend/`)

- **FastAPI** application in `backend/api/`:
  - **Health**: `GET /health`
  - **Webhook**: `POST /webhooks/github` — verifies `X-Hub-Signature-256`, accepts `pull_request` and `push`, stores event, creates a review job, enqueues Celery task
  - **API**: `GET /api/repos`, `GET /api/repos/{id}/health`, `GET /api/reviews`, `GET /api/reviews/{id}`, `PATCH /api/repos/{id}/settings`
- **Config**: Pydantic Settings from env (`.env`), central `backend/api/config.py`
- **Database**: SQLAlchemy (PostgreSQL), tables: `webhook_events`, `repos`, `repo_settings`, `review_jobs`, `reviews`
- **Logging**: Request ID middleware, structured logs (structlog)

### Workers (`workers/`)

- **Celery** app (`workers/celery_app.py`) with Redis broker/backend
- **Task** `run_review_task(job_id)`: loads job and repo, runs stub analyzers in parallel, merges results, persists review and optional artifact
- **Analyzers** (stubs): security, quality, performance, maintainability, devops, frontend — each returns a list of structured findings (severity, confidence, file/line)
- **Merger**: Builds canonical review payload (scores, grades, findings, category_scores)
- **Storage**: MinIO (S3-compatible) or filesystem stub for review JSON artifacts

### Frontend (`frontend/`)

- **React + TypeScript**, Vite
- **Typed API client** (`src/api/codebuster.ts`) for Backend API
- **Pages**: Repo list (with health), Reviews list, Review detail (with severity/category filters), Repo settings (policy toggles)

### Infra (`infra/`)

- **docker-compose.yml**: Postgres, Redis, MinIO, backend, worker, frontend
- **.env.example**: Template for `DATABASE_URL`, `REDIS_URL`, `GITHUB_WEBHOOK_SECRET`, S3/MinIO vars

### Scripts (`scripts/`)

- **run-dev.sh**: Run backend + worker locally (assumes db/redis up)
- **migrate.sh**: Alembic migrations (or rely on create_all)
- **test-webhook.sh**: Send a test push webhook to local backend

## Data Flow

1. **Webhook** → Backend verifies signature, creates `WebhookEvent` and `ReviewJob`, enqueues `run_review_task`.
2. **Worker** picks up task, runs analyzers, merges findings into canonical payload, writes `Review` and optional artifact to MinIO.
3. **Frontend** calls `GET /api/reviews` and `GET /api/reviews/{id}` to display list and detail with filters.

## Security

- Webhook: HMAC-SHA256 via `X-Hub-Signature-256` (optional in dev if secret not set).
- API: No auth in scaffold; add JWT/session and RBAC for production.
- Secrets: Use env / secret manager; never commit `GITHUB_WEBHOOK_SECRET` or DB credentials.
