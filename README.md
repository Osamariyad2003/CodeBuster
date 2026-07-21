# CodeBuster

CodeBuster is an AI-powered code review and engineering health dashboard for GitHub repositories. It combines deterministic analyzers with an AI senior-engineer pass to find security risks, performance regressions, dependency issues, dead code, maintainability problems, and fixable review findings in one product workflow.

This project is prepared for the OpenAI Build Week Devpost challenge in the **Developer Tools** track.

## Contents

- [What It Does](#what-it-does)
- [Build Week Fit](#build-week-fit)
- [Codex and GPT-5.6 Usage](#codex-and-gpt-56-usage)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Useful Commands](#useful-commands)
- [Project Structure](#project-structure)
- [Demo Path](#demo-path)
- [Repository Notes](#repository-notes)

## What It Does

- Connect GitHub repositories through OAuth or a GitHub App.
- Run multi-dimensional reviews across security, dependencies, code quality, performance, IaC, accessibility, dead code, duplicate code, SonarQube, CodeQL, Semgrep, TruffleHog, and LLM-based reasoning.
- Produce a repository health score, category scores, prioritized findings, AI explanations, and suggested fixes.
- Show findings in a React dashboard with review history, filters, evidence drawers, fix-first checklists, feedback insights, and agent views.
- Generate fix previews and run fix sprints that can open GitHub branches and pull requests.

## Build Week Fit

**Track:** Developer Tools

**Problem:** Teams receive scattered signals from linters, scanners, CI jobs, and pull request comments. It is hard to know which findings matter, what changed over time, and what should be fixed first.

**Solution:** CodeBuster turns those signals into one actionable review workflow: run the analyzers, ask the AI reviewer to reason over the evidence, rank the work, explain impact, and help generate fixes.

## Codex and GPT-5.6 Usage

This submission was developed with Codex during OpenAI Build Week. Codex was used to inspect the existing codebase, modernize the review workflow, build frontend screens, improve analyzer orchestration, debug tests, and prepare the submission materials.

GPT-5.6/Codex usage is also part of the product story: CodeBuster is designed around AI-assisted engineering review. The backend AI layer can use a configured provider to:

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

## Tech Stack

- **Frontend:** React 18, Vite, React Router, React Bootstrap, Recharts, Three.js
- **Backend:** Flask, SQLAlchemy, Celery, Redis, PostgreSQL or SQLite
- **Analysis:** CodeQL, SonarQube, Semgrep, TruffleHog, Ruff/linting, dependency/dead-code/duplicate-code/performance analyzers
- **AI layer:** Provider abstraction for Vertex/Gemini/Anthropic/OpenRouter/Groq/OpenAI, plus rule-based fallback

## Project Structure

```
CodeBuster/
├── backend/               # Flask app (entry: main.py), routes/, services/, models/, tasks/
├── frontend/              # React 18 + Vite SPA (src/pages, src/components)
├── workers/               # Async job workers used alongside Celery
├── webhook_ingestor/      # GitHub webhook intake service
├── webhook_orchestrator/  # Webhook-to-review orchestration
├── codeql-packs/          # Bundled CodeQL query packs
├── docs/                  # Architecture, API, and setup references
├── docker-compose.yml, Dockerfile
└── README-SCAFFOLD.md, infra/, services/, src/  # Older scaffold/microservice references
```

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

## Demo Path

Use the short recording script in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

The recommended demo flow is:

1. Show the landing page and GitHub connection.
2. Open a repository dashboard.
3. Run or open a completed review.
4. Show the health score, category breakdown, AI executive summary, and findings.
5. Open one finding to show evidence, snippet context, AI explanation, and suggested fix.
6. Show the Fix Sprint or Agents page to demonstrate how CodeBuster turns review results into action.

## Repository Notes

The current product path is the Flask backend in `backend/main.py` plus the Vite frontend in `frontend/`. Older scaffold and microservice documents remain in `README-SCAFFOLD.md`, `docs/`, `infra/`, and `services/` as architecture references.

For judging, prefer the Quick Start above.
