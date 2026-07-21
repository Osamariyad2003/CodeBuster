#!/usr/bin/env bash
# Run Alembic migrations (when added). For now, backend creates tables on startup.
set -e
cd "$(dirname "$0")/.."
export PYTHONPATH="${PYTHONPATH:-$PWD}"

if command -v alembic &>/dev/null; then
  alembic -c backend/alembic.ini upgrade head
  echo "Migrations complete."
else
  echo "Alembic not installed. Tables are created automatically on backend startup (create_all)."
fi
