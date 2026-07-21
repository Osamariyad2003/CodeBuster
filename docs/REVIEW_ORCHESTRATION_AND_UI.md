# Review Orchestration & UI (Sections 4–7)

## 4) Backend: Orchestrator + Celery integration

### How a scan creates a review

1. **Trigger:** `POST /api/repos/<repo_id>/scan` (optional body: `{ "commit_sha": "..." }`).
2. **Idempotency:** If a completed review already exists for the same `repo_id` + `commit_sha`, the API returns **200** with `review_id` and `idempotent: true`; no new job is enqueued.
3. **Enqueue:** Otherwise the route enqueues the Celery task:  
   `run_review.delay(repo_id, commit_sha or "", "manual")`  
   and returns **202** with `job_id`.
4. **Job execution:** The task resolves `commit_sha` (default branch head if missing), runs `ReviewOrchestrator().analyze(files, ...)`, merges the result with `merge_to_canonical_review(...)`, then persists the `Review` and `Issue` rows (direct DB). No duplicate review is created for the same `(repo_id, commit_sha)`.

### Celery task (snippet)

```python
# backend/app/tasks.py
@celery_app.task(bind=True, max_retries=3)
def run_review(self, repo_id: str, commit_sha: str, trigger_source: str = "manual"):
    with flask_app.app_context():
        # 1. Resolve commit_sha from default branch if empty
        # 2. Idempotency check
        existing = Review.query.filter_by(
            repository_id=repo_id, commit_sha=commit_sha, status="completed"
        ).first()
        if existing:
            return {"status": "idempotent", "review_id": existing.id}
        # 3. Create pending Review, fetch files, run orchestrator.analyze(...)
        # 4. canonical = merge_to_canonical_review(repo_id, repo_full_name, commit_sha, trigger_source, result)
        # 5. Update review (scores, category_scores, top_risks, quick_wins), insert Issue rows, commit
        return {"status": "success", "review_id": review.id}
```

### Merge function contract

- **Function:** `merge_to_canonical_review(repo_id, repo_full_name, commit_sha, trigger_source, orchestrator_result)`  
- **Input `orchestrator_result`:** dict with `overall_health_score`, `category_scores`, `summary`, `prioritized_issues`, `quick_wins`, `top_risks`, optional `analysis_metadata`.  
- **Output (canonical):** dict with:
  - `project`: `{ name, repo_id, repo_full_name, version_or_commit }`
  - `scores`: `{ overall_score, overall_grade, production_readiness, categories }` (categories: list of `{ key, label, score, ... }`)
  - `issues`: list of `{ id, title, severity, category_key, confidence, file_paths, evidence, impact, recommendation, ... }`
  - `fix_first`: list of `{ title, why, owner_hint, effort, related_issue_ids }`

### Idempotency check (pseudocode)

```python
existing = Review.query.filter_by(
    repository_id=repo_id,
    commit_sha=commit_sha,
    status="completed",
).first()
if existing:
    return {"status": "idempotent", "review_id": existing.id}
# else: create new review and run analyzers
```

---

## 5) Frontend: UI pages, components, apiClient, routing

### Component tree per page

- **RepositoriesPage**
  - AppShell → Repo cards (each: latest overall_score badge, grade, critical/high issues count, “View Reviews” button).

- **RepositoryDashboard**
  - AppShell → RepoStatsCards (health, issues, etc.) → Row: CategoryRadarChart | FixFirstChecklist → Card: IssueTable (latest review) → IssueDetailDrawer → Score trend (HealthTrendChart) → Tabs: ReviewsView | CommitsView | EventsView | JobsView.

- **ReviewsHistoryPage**
  - AppShell → Table of review runs (date, score, grade, commit, trigger, status, “View”).

### Endpoint mapping (page → API calls)

| Page / component        | Endpoints |
|-------------------------|-----------|
| RepositoriesPage        | `GET /api/repos` (repos with health_score, overall_grade, issues_count, critical_issues, high_issues) |
| RepositoryDashboard     | `GET /api/repos/:id`, `GET /api/repos/:id/stats`, `GET /api/repos/:id/latest-review`, `GET /api/repos/:id/score-trend?days=30`, `GET /api/reviews/:reviewId/issues` (via IssueTable) |
| ReviewsHistoryPage      | `GET /api/repos/:id/reviews` |
| IssueTable              | `GET /api/reviews/:reviewId/issues?severity=&category=&search=&sort=&limit=&offset=` |
| Review detail           | `GET /api/reviews/:id` |

### apiClient methods

- `getRepoReviews(repoId, params)` → `GET /api/repos/:id/reviews`
- `getLatestReview(repoId)` → `GET /api/repos/:id/latest-review`
- `getReview(reviewId)` → `GET /api/reviews/:id`
- `getReviewIssues(reviewId, params)` → `GET /api/reviews/:id/issues`
- `getScoreTrend(repoId, days)` → `GET /api/repos/:id/score-trend?days=`

### Minimal skeletons (reference)

- **CategoryRadarChart.jsx:** Props: `categories` (array of `{ key, label, score }`), `height`. Uses Recharts `RadarChart` / `Radar` / `PolarGrid` / `PolarAngleAxis` / `PolarRadiusAxis`.
- **IssueTable.jsx:** Props: `reviewId`, `initialSeverity`, `initialCategory`, `onSelectIssue`. State: `items`, `total`, `limit`, `offset`, `loading`, `severity`, `category`, `search`, `sort`. Fetches via `getReviewIssues(reviewId, { limit, offset, severity, category, search, sort })`, renders table + Pagination.
- **RepositoryDashboard.jsx:** Fetches `getLatestReview(repoId)` and `getScoreTrend(repoId, 30)`; passes `latestReview.categories` to CategoryRadarChart, `latestReview.fix_first` to FixFirstChecklist, `latestReview.review.id` to IssueTable; opens IssueDetailDrawer on row click.

### UI states

- Loading: skeleton/spinner; empty: “No reviews yet” with CTA “Run scan”; errors: ToastProvider; optional: persist IssueTable filters in URL query params.

---

## 6) Example payloads

### Example canonical review JSON (after merge)

```json
{
  "project": {
    "name": "my-service",
    "repo_id": "550e8400-e29b-41d4-a716-446655440000",
    "repo_full_name": "org/my-service",
    "version_or_commit": "a1b2c3d4e5f6789"
  },
  "trigger_source": "manual",
  "scores": {
    "overall_score": 78,
    "overall_grade": "C",
    "production_readiness": "yes",
    "categories": [
      { "key": "security", "label": "Security", "score": 85, "weight": 0.1, "not_applicable": false, "rationale": "" },
      { "key": "performance", "label": "Performance", "score": 70, "weight": 0.1, "not_applicable": false, "rationale": "" },
      { "key": "maintainability", "label": "Maintainability", "score": 82, "weight": 0.1, "not_applicable": false, "rationale": "" }
    ]
  },
  "issues": [
    {
      "id": "issue-001",
      "title": "Hardcoded API key",
      "severity": "CRITICAL",
      "category_key": "security",
      "confidence": 0.95,
      "file_paths": ["src/config.py"],
      "evidence": [],
      "impact": "Exposure of secrets.",
      "recommendation": "Use environment variables.",
      "effort": "S",
      "tags": []
    }
  ],
  "fix_first": [
    { "title": "Address risk: issue-001", "why": "High-priority finding", "owner_hint": "security", "effort": "M", "related_issue_ids": ["issue-001"] }
  ],
  "summary": { "total_issues": 5, "critical": 1, "major": 2, "minor": 2, "info": 0 },
  "raw_metadata": null
}
```

### Example `GET /api/repos/<repo_id>/reviews` response

```json
{
  "success": true,
  "reviews": [
    {
      "id": "rev-uuid-1",
      "repository_id": "550e8400-e29b-41d4-a716-446655440000",
      "commit_sha": "a1b2c3d4e5f6789",
      "status": "completed",
      "overall_health_score": 78,
      "grade": "C",
      "trigger_type": "manual",
      "completed_at": "2025-01-27T12:00:00Z",
      "created_at": "2025-01-27T11:58:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 20
}
```

*(If the backend returns `trigger_source` per item, it may appear as `trigger_type` in the model; field name in the API may be either.)*

### Example `GET /api/reviews/<review_id>/issues` response (paginated)

```json
{
  "success": true,
  "issues": [
    {
      "id": "iss-uuid-1",
      "review_id": "rev-uuid-1",
      "title": "Hardcoded API key",
      "severity": "critical",
      "category": "security",
      "file_path": "src/config.py",
      "line_number": 42,
      "confidence": 0.95,
      "status": "open",
      "description": "API key found in source.",
      "evidence": [],
      "suggested_fix": {}
    }
  ],
  "total": 15,
  "limit": 10,
  "offset": 0
}
```

Query params supported: `severity`, `category`, `search`, `sort`, `limit`, `offset`.

---

## 7) Implementation checklist

### Backend

| Item | File / change |
|------|----------------|
| Models | `backend/models/review.py` (Review), `backend/models/issue.py` (Issue) — already present |
| Migrations / init | DB init or migrations for `reviews`, `issues` tables — as per existing setup |
| Routes | `backend/routes/repos.py`: POST scan (idempotency + enqueue), GET repos (enriched), GET latest-review, GET score-trend, GET repos/:id/reviews |
| Routes | `backend/routes/review.py` (or `reviews.py`): GET/POST reviews, GET review by id, GET review issues (paginated, filters) |
| Orchestrator | `backend/services/review_orchestrator.py` — used by Celery task |
| Merge | `backend/services/review_merge.py` — `merge_to_canonical_review` contract |
| Celery task | `backend/app/tasks.py` — `run_review(repo_id, commit_sha, trigger_source)` with idempotency and DB persist |
| Register blueprints | App factory registers `repos_bp`, review blueprint (e.g. `reviews_bp`) |

### Frontend

| Item | File / change |
|------|----------------|
| apiClient | `frontend/src/lib/apiClient.js`: getRepoReviews, getLatestReview, getReview, getReviewIssues, getScoreTrend |
| Pages | `RepositoriesPage.jsx`: repo cards with score badge, grade, issues count, “View Reviews” |
| Pages | `RepositoryDashboard.jsx`: ScoreCards (RepoStatsCards), CategoryRadarChart, IssueTable, FixFirstChecklist, trend chart, IssueDetailDrawer; no Header in loading/error |
| Pages | `ReviewsHistoryPage.jsx`: table of review runs; route `/repos/:repoId/reviews` |
| Router | `App.jsx`: route for ReviewsHistoryPage |
| Components | `frontend/src/components/reviews/`: ScoreCard, CategoryRadarChart, IssueTable, IssueDetailDrawer, FixFirstChecklist, ReviewRunSelector |

### Testing

| Item | Description |
|------|-------------|
| API | Minimal tests: POST scan returns 202 or 200 (idempotent); GET repos returns enriched repos; GET latest-review, GET score-trend, GET review issues with params |
| UI | Smoke: RepositoriesPage loads; RepositoryDashboard shows radar/issues/trend when data exists; ReviewsHistoryPage loads and shows table |

---

*Rationale for “unknown” or optional fields: exact field names for `trigger_source` vs `trigger_type` and pagination shape for `/repos/:id/reviews` depend on the current backend implementation; the examples above match the described behavior and can be adjusted to match the actual API.*
