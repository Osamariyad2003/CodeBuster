# Backend Reference

This document lists the Flask entry point, registered blueprints and routes, main services, models, tasks, and configuration.

---

## 1. Entry Point

- **File**: [main.py](../main.py)
- **App**: Flask app with CORS (frontend origins from settings), session config (cookie SameSite, HttpOnly, 7-day lifetime), structlog logging, and error handlers.
- **Blueprints registered**: auth, github, review, issue, feedback, metrics, repos, analyze. Additional rule: GET/OPTIONS `/api/github/install-url` for frontend install URL.
- **Health**: GET `/health` returns status and timestamp; GET `/ready` checks database and Redis and returns 200 or 503 with checks array.
- **Database**: `init_db(app)` called when running as main; SQLite by default.

---

## 2. Routes

### 2.1 Auth (`/auth`) – [routes/auth.py](../routes/auth.py)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/github` | Redirect to GitHub OAuth or return auth URL (e.g. for SPA) |
| GET | `/auth/callback` | OAuth callback: exchange code, fetch user, persist user, set session, return JSON or redirect |
| GET | `/auth/user` | Return current session user or unauthenticated |
| POST | `/auth/logout` | Clear session |

### 2.2 Repos (`/api/repos`) – [routes/repos.py](../routes/repos.py)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/repos` | List connected repositories for current user (from DB by login) |
| GET | `/api/repos/<repo_id>` | Repository detail |
| GET | `/api/repos/<repo_id>/settings` | Repository settings |
| PUT | `/api/repos/<repo_id>/settings` | Update repository settings |
| GET | `/api/repos/<repo_id>/reviews` | List reviews for repository |
| GET | `/api/repos/<repo_id>/latest-review` | Latest review with categories, top_issues, fix_first |
| GET | `/api/repos/<repo_id>/score-trend` | Score trend (query: days) for chart |
| GET | `/api/repos/<repo_id>/commits` | Commit list from GitHub API |
| POST | `/api/repos/<repo_id>/scan` | Trigger scan; body optional `{ "commit_sha" }`; returns job_id or inline or idempotent |
| GET | `/api/repos/<repo_id>/stats` | Repository statistics |

### 2.3 Review (`/api/reviews`) – [routes/review.py](../routes/review.py)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reviews` | List reviews (paginated) |
| POST | `/api/reviews` | Create review (async; idempotency key supported) |
| GET | `/api/reviews/<review_id>/canonical` | Canonical codebuster.commit_review JSON |
| GET | `/api/reviews/<review_id>` | Single review with issues (legacy shape) |
| GET | `/api/reviews/<review_id>/issues` | Paginated, filterable issues for review |
| GET | `/api/reviews/repository/<repository_id>` | Reviews for a repository |
| GET | `/api/reviews/pr/<owner>/<repo>/<pr_number>` | Review for a PR by number |

### 2.4 Issues (`/api/issues`) – [routes/issue.py](../routes/issue.py)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/issues` | List issues (query: review_id, severity, category, search, sort, limit, offset) |
| GET | `/api/issues/<issue_id>` | Single issue detail |

### 2.5 Feedback (`/api/feedback`) – [routes/feedback.py](../routes/feedback.py)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/feedback` | Submit feedback (issue_id, review_id, action, comment) |
| GET | `/api/feedback/issue/<issue_id>` | Feedback list for an issue |

### 2.6 Metrics (`/api`) – [routes/metrics.py](../routes/metrics.py)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/metrics/summary` | Dashboard summary (health, jobs, events, critical_issues, etc.) |
| GET | `/api/monitoring/summary` | Alias for metrics/summary |
| GET | `/api/metrics/health-trend` | Health trend data |
| GET | `/api/events` | List webhook events (from Redis); safe empty on error |
| GET | `/api/events/<delivery_id>` | Single event by delivery_id |
| GET | `/api/jobs` | List analysis jobs (from Redis); safe empty on error |
| GET | `/api/jobs/<job_id>` | Single job detail; 404 with error message if not found |

### 2.7 GitHub – [routes/github.py](../routes/github.py)

Prefix `/github`; plus explicit rule `/api/github/install-url`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/github/install-url` | URL for GitHub App installation (CORS preflight 204) |
| GET | `/github/repos` | User repos from GitHub API |
| POST | `/github/connect` | Connect repo (repo_full_name) |
| POST | `/github/disconnect` | Disconnect repo |
| POST | `/github/installations/sync` | Sync installations and repos (used after App install) |
| GET | `/github/connected-repos` | Connected repos for user |
| POST | `/github/webhook` | GitHub webhook handler (push, PR, etc.) |
| GET | `/github/install-url` | Same as /api/github/install-url (backend path) |

Other routes in github.py: fix/apply, and various webhook/action handlers.

### 2.8 Analyze (`/api/analyze`) – [routes/analyze.py](../routes/analyze.py)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analyze/dimension` | Run single dimension analyzer (body: analyzer_key, files) |
| GET | `/api/analyze/dimension/keys` | List supported analyzer keys |

---

## 3. Services

### 3.1 Review Orchestrator – [services/review_orchestrator.py](../services/review_orchestrator.py)

- **Role**: Runs the full analysis pipeline for a set of files and repository context.
- **Steps**: Parse repo config (e.g. `.codebuster.yaml`), run CodeQL (if context available), then security, TruffleHog, Semgrep, lint, performance, IaC, accessibility, maintainability (coverage), frontend, dimension analyzers, CodeReviewer; deduplicate findings; call AI Review Service; format result.
- **Config**: `DEFAULT_ANALYZERS` enables all tools by default; repo config can override. Result includes `overall_health_score`, `category_scores`, `summary`, `prioritized_issues`, `quick_wins`, `top_risks`, `analysis_metadata` (analyzers_run, by_tool, duration_seconds, etc.), `dimension_results`, `raw_findings`.

### 3.2 AI Review Service – [services/ai_review_service.py](../services/ai_review_service.py)

- **Role**: Turns raw findings into health score, category scores, prioritized issues, quick wins, and top risks. Uses **Gemini** when `GEMINI_API_KEY` is set, else **OpenAI**, else rule-based fallback.
- **Env**: `GEMINI_API_KEY`, `GEMINI_MODEL` (e.g. gemini-2.0-flash, gemini-3-flash-preview); or `OPENAI_API_KEY`, `OPENAI_MODEL`.
- **Output**: Same shape for both providers; `_parse_response` normalizes and validates (fallback to rule-based on parse error).

### 3.3 Commit Review Canonical Builder – [services/commit_review_canonical_builder.py](../services/commit_review_canonical_builder.py)

- **Role**: Builds the production-ready **codebuster.commit_review** JSON from DB (Review, Issues, Repository). Used by GET `/api/reviews/<id>/canonical`.
- **Schema**: See [schemas/commit_review_canonical.py](../schemas/commit_review_canonical.py). Populates trigger, repo, commit, status, scores, summary, analyzers (from extra_metadata), findings, artifacts, metadata.

### 3.4 Review Merge – [services/review_merge.py](../services/review_merge.py)

- **Role**: Merges orchestrator result into DB: creates or updates Review and Issue rows, stores category_scores, top_risks, quick_wins, extra_metadata.

### 3.5 Analyzers (one line each)

- **security_analyzer**: Security patterns and secrets.
- **semgrep_analyzer**: Semgrep rules.
- **lint_analyzer**: Pylint/ESLint.
- **code_quality_analyzer**: Legacy code quality.
- **codeql_analyzer**: CodeQL (GitHub); requires installation_id and repo.
- **trufflehog_scanner**: Secret scanning.
- **performance_analyzer**: Performance and query issues.
- **iac_analyzer**: IaC (e.g. Terraform, CloudFormation).
- **accessibility_analyzer**: A11y checks.
- **coverage_analyzer**: Cobertura/Clover/JaCoCo.
- **frontend_devtools_analyzer**, **lighthouse_service**: Frontend and Lighthouse.
- **dimension_analyzer_runner**: Dimension analyzers (security, code_quality, etc.) with strict JSON contract.
- **codereviewer_analyzer**: Microsoft CodeBERT-based suggestions (optional).

---

## 4. Models

- **Review** ([models/review.py](../models/review.py)): id, repository_id, pr_number, commit_sha, branch, trigger_type, status, overall_health_score, category_scores (JSON), findings_count, started_at, completed_at, error_message, top_risks, quick_wins, extra_metadata (JSON). Methods: get_category_scores, get_top_risks, get_quick_wins, get_extra_metadata, to_dict.
- **ReviewRun, CategoryScore, ScoredIssue, FixFirstItem**: Scoring entities; to_dict for API.
- **Issue** ([models/issue.py](../models/issue.py)): id, review_id, module, severity, category, title, description, file_path, line_number, confidence, evidence, tool, status, etc. to_dict.
- **Repository** ([models/repository.py](../models/repository.py)): id, owner, name, full_name, installation_id, status, connected_at, etc. to_dict.
- **User** ([models/user.py](../models/user.py)): id, github_id, username, email, avatar_url, token storage. to_dict.
- **Feedback** ([models/feedback.py](../models/feedback.py)): id, issue_id, review_id, user_id, action, comment. to_dict.

---

## 5. Tasks and Celery

- **Celery app**: [app/celery_app.py](../app/celery_app.py) – broker and backend from `REDIS_URL`.
- **Tasks** ([app/tasks.py](../app/tasks.py)):
  - **process_github_event**: Webhook-driven analysis; loads repo, fetches files, runs orchestrator, merges result, optional GitHub check run.
  - **run_review**: Main scan task; loads repo, fetches files, runs orchestrator, merges result; updates job status in Redis. Used when POST scan returns job_id.
- **Inline scan**: When Redis is unreachable or `RUN_SCAN_INLINE=1`, the scan route runs the same pipeline in a background thread via `_run_scan_inline` (no Celery).

---

## 6. Configuration (Env)

| Variable | Used in |
|----------|---------|
| FLASK_SECRET_KEY | main.py (session) |
| GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET | auth, GitHub OAuth |
| FRONTEND_URL | CORS, OAuth redirects |
| GEMINI_API_KEY, GEMINI_MODEL | ai_review_service |
| OPENAI_API_KEY, OPENAI_MODEL | ai_review_service |
| REDIS_URL | Celery, redis_client, limiter, metrics |
| RUN_SCAN_INLINE | repos scan route (inline vs Celery) |
| GITHUB_APP_*, WEBHOOK_SECRET | github routes, installation tokens |

See [config_template.env](../config_template.env) and [SETUP_ENV.md](../SETUP_ENV.md).
