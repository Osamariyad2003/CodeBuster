# CodeBuster – Production-grade scaffold

AI-powered GitHub code review and engineering health dashboard. This scaffold provides a monorepo that runs end-to-end locally with Docker.

## Folder structure

- **backend/** – FastAPI app (webhook ingestion, reviews, repos API), SQLAlchemy models, Pydantic schemas
- **workers/** – Celery workers, stub analyzers (security, quality, performance, maintainability, devops, frontend), merger, artifact storage
- **frontend/** – React + TypeScript dashboard (repo list with health, reviews list, review detail with filters, settings)
- **infra/** – docker-compose for local dev, env template, Dockerfiles
- **docs/** – ARCHITECTURE.md, API.md
- **scripts/** – run-dev.sh, migrate.sh, test-webhook.sh

## Prerequisites

- Docker and Docker Compose
- Node 20+ and Python 3.11+ (for local runs without Docker)
- (Optional) `jq` for pretty-printed curl output

## Local setup with Docker

From the **repository root**:

```bash
# 1. Copy env template (optional; defaults work for local)
cp infra/.env.example infra/.env
# Edit infra/.env if you need a custom GITHUB_WEBHOOK_SECRET

# 2. Start all services
docker compose -f infra/docker-compose.yml up --build

# Backend: http://localhost:8000
# Frontend: http://localhost:5173
# MinIO console: http://localhost:9001 (codebuster / codebuster_pass)
```

Wait until backend and worker logs show “Application startup complete” and “celery@... ready”. Then open:

- **Dashboard:** http://localhost:5173/repos (repo list with health)
- **Reviews:** http://localhost:5173/reviews (list and open a review)
- **API health:** http://localhost:8000/health

## Test webhook locally

After `docker compose up` is running:

### 1. Using the script (Bash, Git Bash, or WSL)

```bash
# From repo root; uses GITHUB_WEBHOOK_SECRET from infra/.env or default "dev-webhook-secret"
./scripts/test-webhook.sh http://localhost:8000
```

You should see something like:

```json
{
  "status": "accepted",
  "job_id": "...",
  "event_id": "test-delivery-...",
  "repo_id": "..."
}
```

### 2. Using curl manually

```bash
# Set secret (must match backend env GITHUB_WEBHOOK_SECRET)
SECRET="dev-webhook-secret"
PAYLOAD='{"repository":{"full_name":"my-org/my-repo","default_branch":"main"},"ref":"refs/heads/main","after":"abc123"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -X POST http://localhost:8000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-$(date +%s)" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD"
```

### 3. After sending the webhook

- The worker will process the job (watch worker logs).
- Open http://localhost:5173/reviews – you should see the new review after a few seconds.
- Click **View** to open the review detail with findings and severity/category filters.
- Repo list at http://localhost:5173/repos will show the created repo and its health once the review is completed.

## Local run without Docker (backend + worker only)

Start Postgres, Redis (and optionally MinIO) first, e.g.:

```bash
docker compose -f infra/docker-compose.yml up -d db redis minio
```

Then from repo root:

```bash
export PYTHONPATH=$PWD
cp infra/.env.example .env   # and set DATABASE_URL, REDIS_URL if needed

# Terminal 1 – backend
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 – worker
celery -A workers.celery_app:celery_app worker -l info
```

Frontend (with proxy to backend):

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Open http://localhost:5173 and use the same test webhook commands against http://localhost:8000.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| POST | /webhooks/github | GitHub webhook (PR/push) |
| GET | /api/repos | List repos |
| GET | /api/repos/{id}/health | Repo health (latest score/grade) |
| GET | /api/repos/{id}/settings | Get repo policy settings |
| PATCH | /api/repos/{id}/settings | Update policy toggles |
| GET | /api/reviews | List reviews (paginated) |
| GET | /api/reviews/{id} | Review detail (optional severity/category filters) |

See **docs/API.md** for request/response shapes and **docs/ARCHITECTURE.md** for the design.

## Mandatory features in this scaffold

1. **GitHub webhook** – Verifies `X-Hub-Signature-256`, accepts PR and push, stores event and creates a review job.
2. **Review pipeline** – Celery job runs stub analyzers in parallel, merger builds canonical payload (severity, confidence, file/line, scores), persists to Postgres and stores artifacts in MinIO or a filesystem stub.
3. **Backend API** – Health, webhook, GET reviews/repos, GET repo health, PATCH repo settings.
4. **Frontend** – Repo list with health, reviews list, review detail with filters, settings page (policy toggles).

Engineering: Pydantic request/response, SQLAlchemy + create_all (Alembic optional), typed API client, central config, request ID logging, consistent error schema.
