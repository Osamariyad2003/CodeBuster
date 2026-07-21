# APIs and Flows

This document summarizes the API surface, scan and review flows, and points to the detailed JSON and UI design docs.

---

## 1. API Base and Auth

- **Base URL**: Configured in the frontend via `VITE_API_URL` (e.g. `http://localhost:5000`). All API calls use this base.
- **Authentication**: Session cookie (SameSite, HttpOnly). Requests are sent with `withCredentials: true`. No Bearer token in headers for normal API calls.
- **401/403**: Backend returns 401 or 403 when unauthenticated or forbidden. Frontend apiClient intercepts and dispatches a global `auth-required` event; the app shell then logs out, redirects to `/`, and shows a toast.

---

## 2. Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/github` | Redirect to GitHub OAuth or return auth URL for SPA |
| GET | `/auth/callback` | OAuth callback: exchange code, create/update user, set session |
| GET | `/auth/user` | Current session user or unauthenticated |
| POST | `/auth/logout` | Clear session |

Request/response shapes: see [JSON_FORMATS.md](JSON_FORMATS.md).

---

## 3. Repos Endpoints

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/repos` | List connected repos for current user |
| GET | `/api/repos/<id>` | Repository detail |
| GET | `/api/repos/<id>/reviews` | List reviews (paginated) |
| GET | `/api/repos/<id>/latest-review` | Latest review with categories, top_issues, fix_first |
| GET | `/api/repos/<id>/score-trend` | Score trend (query: days) |
| GET | `/api/repos/<id>/commits` | Commit list from GitHub |
| POST | `/api/repos/<id>/scan` | Trigger scan; body optional `{ "commit_sha" }` |
| GET | `/api/repos/<id>/stats` | Repository statistics |

Full request/response shapes: see [JSON_FORMATS.md](JSON_FORMATS.md).

---

## 4. Review Endpoints

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/reviews` | List reviews (paginated) |
| POST | `/api/reviews` | Create review (async; idempotency key) |
| GET | `/api/reviews/<id>/canonical` | Canonical codebuster.commit_review JSON (scores, findings, analyzers, evidence, recommendation) |
| GET | `/api/reviews/<id>` | Single review with issues (legacy shape) |
| GET | `/api/reviews/<id>/issues` | Paginated, filterable issues for review |

The **canonical** response is the preferred shape for the review detail UI: it includes `scores`, `findings` (with evidence and recommendation), `analyzers`, and metadata. Legacy GET `/api/reviews/<id>` returns the same data in a different structure; the frontend uses canonical first and falls back to legacy.

---

## 5. Jobs and Events

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/jobs` | List analysis jobs (from Redis). Returns `{ jobs: [] }`; on error backend may return safe empty. |
| GET | `/api/jobs/<job_id>` | Single job; 404 with error message if not in cache |
| GET | `/api/events` | List webhook events; safe empty on error |
| GET | `/api/events/<delivery_id>` | Single event by delivery_id |

Job object includes at least: `id`, `status` (queued, running, completed, failed), `repo_id`, `review_id` (when completed), `created_at`, etc. See [JSON_FORMATS.md](JSON_FORMATS.md).

---

## 6. Scan Flow (Backend)

1. **Request**: POST `/api/repos/:repoId/scan` with optional body `{ "commit_sha": "..." }`.
2. **Idempotency**: If a review already exists for the same repo and commit (and branch/ref if applicable), backend returns **200** with `review_id` and `idempotent: true`. No new job is created.
3. **Async with job**: If Redis (and optionally Celery) is available and inline scan is not forced, backend enqueues a `run_review` task and returns **202** with `job_id`. Client polls GET `/api/jobs/:job_id` for status; when `status === "completed"`, `review_id` is present.
4. **Inline**: If `RUN_SCAN_INLINE=1` or Celery is unavailable, backend may start the scan in a background thread and return **202** with `inline: true` (no job_id). Client may poll GET `/api/repos/:id/latest-review` until a new review appears.
5. **Execution**: Worker or inline thread loads repo and file context, runs the **Review Orchestrator** (all analyzers), then **AI Review Service** (Gemini/OpenAI). Result is merged into the DB (Review + Issues) via the review merge service. Job status in Redis is updated to completed or failed.

---

## 7. Review Flow

1. **Production of review data**: The orchestrator runs analyzers and collects raw findings; the AI service produces overall health score, category scores, prioritized issues, quick wins, and top risks. The **review merge** service writes this into the `Review` model and related tables (CategoryScore, ScoredIssue, FixFirstItem, Issue rows).
2. **Serving**: The **commit review canonical builder** reads from the DB and produces the codebuster.commit_review JSON. GET `/api/reviews/:id/canonical` returns this. GET `/api/repos/:id/latest-review` returns the latest review for the repo in a similar shape (categories, top_issues, fix_first).
3. **UI**: The frontend uses GET canonical or GET legacy review to render ReviewDetail: header, scores, category radar, analyzers list, findings table, and IssueDetailDrawer with evidence and recommendation. See [UI_DESIGN_JSON_TO_SCREENS.md](UI_DESIGN_JSON_TO_SCREENS.md) for screen/component mapping and state machine.

---

## 8. References

- **[backend/docs/JSON_FORMATS.md](JSON_FORMATS.md)**: All request/response shapes, canonical commit_review schema, scan response (job_id, inline, idempotent), job object, and error formats.
- **[backend/docs/UI_DESIGN_JSON_TO_SCREENS.md](UI_DESIGN_JSON_TO_SCREENS.md)**: Screen-to-JSON mapping, component state, scan progress states, and copy for toasts and errors.
