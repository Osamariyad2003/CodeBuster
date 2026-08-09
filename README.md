# CodeBuster

[![CodeQL](https://github.com/Osamariyad2003/CodeBuster/actions/workflows/codeql.yml/badge.svg)](https://github.com/Osamariyad2003/CodeBuster/actions/workflows/codeql.yml)
![Python](https://img.shields.io/badge/backend-Flask%20%2F%20Python-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/frontend-React%2018%20%2F%20Vite-61DAFB?logo=react&logoColor=black)
![Celery](https://img.shields.io/badge/queue-Celery%20%2F%20Redis-37814A?logo=redis&logoColor=white)

**CodeBuster** is an AI-powered code review and engineering-health dashboard for GitHub repositories. It combines deterministic analyzers with an AI senior-engineer reasoning pass to find security risks, performance regressions, dependency issues, dead code, and maintainability problems — then turns them into a single, prioritized, fixable review instead of scattered linter/CI noise.

Prepared for the OpenAI Build Week Devpost challenge, **Developer Tools** track.

## Demo

[![CodeBuster demo](https://img.youtube.com/vi/C1yJe_QViqE/0.jpg)](https://www.youtube.com/watch?v=C1yJe_QViqE)

## Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Useful Commands](#useful-commands)
- [Project Structure](#project-structure)
- [Build Week Fit](#build-week-fit)
- [Codex and GPT-5.6 Usage](#codex-and-gpt-56-usage)
- [Repository Notes](#repository-notes)

## What It Does

- **Connect** GitHub repositories through OAuth or a GitHub App.
- **Analyze** across security, dependencies, code quality, performance, IaC, accessibility, dead code, duplicate code, SonarQube, CodeQL, Semgrep, TruffleHog, and LLM-based reasoning.
- **Score** each repository with a health score, category breakdowns, prioritized findings, AI explanations, and suggested fixes.
- **Review** findings in a React dashboard — history, filters, evidence drawers, fix-first checklists, feedback insights, and agent views.
- **Fix** by generating fix previews and running fix sprints that open GitHub branches and pull requests.
- **Learn** from reviewer feedback — accept/dismiss decisions on findings feed back into per-analyzer trust scoring, so chronically-dismissed analyzers get down-weighted in future reviews (see the *Finding Quality* dashboard).

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite, React Router, React Bootstrap, Recharts, Three.js |
| Backend | Flask, SQLAlchemy, Celery, Redis, PostgreSQL or SQLite |
| Analysis | CodeQL, SonarQube, Semgrep, TruffleHog, Ruff/linting, plus custom dependency / dead-code / duplicate-code / performance analyzers |
| AI layer | Provider abstraction for Vertex/Gemini, Anthropic, OpenRouter, Groq, OpenAI — with a deterministic rule-based fallback when no provider is configured |

## Quick Start

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item config_template.env .env
```

Edit `backend/.env` and fill in your own values for `FLASK_SECRET_KEY`, `DATABASE_URL`, and `REDIS_URL` — full list and defaults are in `backend/config_template.env`.

For GitHub login and repository access, set the GitHub OAuth/App values documented in `backend/GITHUB_APP_SETUP.md`.

Start the backend:

```powershell
python main.py
```

Backend health check:

```powershell
Invoke-RestMethod http://localhost:5000/health
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5174`.

### 3. Optional Worker

Use this when running queued scans instead of inline/local flows:

```powershell
cd backend
celery -A celery_init worker --loglevel=info
```

## Useful Commands

Frontend production build:

```powershell
cd frontend
npm run build
```

Backend tests:

```powershell
cd backend
$env:PYTHONPATH = (Resolve-Path ..).Path
python -m pytest tests -q
```

## Project Structure

```
CodeBuster/
├── backend/               # Flask app (entry: main.py) — routes/, services/, models/, tasks/
├── frontend/               # React 18 + Vite SPA — src/pages, src/components
├── workers/                 Async job workers used alongside Celery
├── webhook_ingestor/         GitHub webhook intake service
├── webhook_orchestrator/     Webhook-to-review orchestration
├── codeql-packs/              Bundled CodeQL query packs (used by .github/workflows/codeql.yml)
├── docs/                       Architecture, API, and setup references
├── docker-compose.yml, Dockerfile
└── README-SCAFFOLD.md, infra/, services/, src/  # Older scaffold/microservice references
```

> The active product path is `backend/main.py` + `frontend/`. See [Repository Notes](#repository-notes) for what the other top-level directories are.

## Build Week Fit

**Track:** Developer Tools

**Problem:** Teams receive scattered signals from linters, scanners, CI jobs, and pull request comments. It's hard to know which findings matter, what changed over time, and what should be fixed first.

**Solution:** CodeBuster turns those signals into one actionable review workflow: run the analyzers, ask the AI reviewer to reason over the evidence, rank the work, explain impact, and help generate fixes.

## Codex and GPT-5.6 Usage

This submission was developed with Codex during OpenAI Build Week. Codex was used to inspect the existing codebase, modernize the review workflow, build frontend screens, improve analyzer orchestration, debug tests, and prepare the submission materials.

GPT-5.6/Codex usage is also part of the product story — CodeBuster is designed around AI-assisted engineering review. The backend AI layer can use a configured provider to:

- reason over analyzer output,
- produce an executive summary,
- enhance findings with code context,
- generate concrete fix recommendations,
- identify deeper logic bugs through the AI Senior Engineer analyzer.

For OpenAI-backed runs, configure:

```env
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5.6
```

The service gracefully falls back to deterministic explanations when no AI provider is configured, so judges can still run the product locally.

## Repository Notes

The current product path is the Flask backend in `backend/main.py` plus the Vite frontend in `frontend/`. Older scaffold and microservice documents remain in `README-SCAFFOLD.md`, `docs/`, `infra/`, and `services/` as architecture references — not part of the running app.

For judging, prefer the Quick Start above.
