#!/usr/bin/env bash
# Run backend (FastAPI) and worker (Celery) locally. Start Postgres/Redis/MinIO via docker first.
set -e
cd "$(dirname "$0")/.."
export PYTHONPATH="${PYTHONPATH:-$PWD}"

echo "Ensure db/redis are up (e.g. docker compose -f infra/docker-compose.yml up -d db redis minio)"
echo "Starting backend on :8000 and Celery worker in background..."
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
celery -A workers.celery_app:celery_app worker -l info &
WORKER_PID=$!
echo "Backend PID $BACKEND_PID, Worker PID $WORKER_PID. Ctrl+C to stop both."
trap "kill $BACKEND_PID $WORKER_PID 2>/dev/null" EXIT
wait
