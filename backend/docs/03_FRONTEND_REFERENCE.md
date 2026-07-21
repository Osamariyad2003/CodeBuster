# Frontend Reference

This document describes the React app structure, routes, auth, main pages, components, apiClient helpers, and scan flow behavior.

---

## 1. Stack and Entry

- **Stack**: React, React Router, Bootstrap (react-bootstrap), Vite. Axios for API calls; session cookies with `withCredentials: true`.
- **Entry**: [main.jsx](../../frontend/src/main.jsx) mounts App inside AuthProvider and root. [App.jsx](../../frontend/src/App.jsx) wraps routes with ToastProvider and MonitoringProvider; Router wraps Routes.
- **API base URL**: `import.meta.env.VITE_API_URL` (e.g. `http://localhost:5000`). Configured in frontend `.env`.

---

## 2. Routes

All routes except `/` and `/connect/callback` are protected (redirect to `/` when not authenticated). Protected content is wrapped in AppShell (sidebar + top bar + main area).

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home | Login / landing; redirect to `/dashboard` if authenticated |
| `/dashboard` | Dashboard | Overview: monitoring summary, repos, run history, local upload, GitHub connect |
| `/repos` | RepositoriesPage | List connected repos; connect via GitHub App |
| `/repos/:repoId` | RepositoryDashboard | Repo detail, latest-review, score trend, scan button, ScanProgressBanner, AnalyzerStatusList, tabs (Reviews, Commits, Events, Jobs) |
| `/repos/:repoId/settings` | RepositorySettings | Repo settings |
| `/repos/:repoId/reviews` | ReviewsHistoryPage | Review history for repo |
| `/connect/callback` | ConnectCallback | OAuth/install callback; sync installations |
| `/events` | EventsPage | Webhook events list |
| `/jobs` | JobsPage | Analysis jobs list and job detail modal |
| `/reviews` | ReviewsPage | Reviews list |
| `/reviews/:id` | ReviewDetail | Single review: canonical or legacy, header, scores, analyzers, findings, drawer |
| `/issues` | IssuesPage | Issues list |
| `/issues/:id` | IssueDetail | Single issue detail |
| `/system-status` | SystemStatus | System status view |
| `/components` | ComponentShowcase | Component showcase (dev) |
| `*` | Navigate to `/` | Catch-all |

---

## 3. Auth and Global Behavior

- **AuthContext** ([AuthContext.jsx](../../frontend/src/AuthContext.jsx)): Provides `user`, `isAuthenticated`, `loading`, `logout`. On init, checks session (e.g. GET `/auth/user`). OAuth flow may use callback with code exchange.
- **AppShell** ([components/layout/AppShell.jsx](../../frontend/src/components/layout/AppShell.jsx)): Renders SidebarNav and TopBar around children. Listens for `auth-required` (dispatched by apiClient on 401/403); on event calls `logout()`, `navigate('/', { replace: true })`, and shows toast (e.g. "You're signed out or your session expired").
- **apiClient** ([lib/apiClient.js](../../frontend/src/lib/apiClient.js)): Axios instance; response interceptor returns `response.data` on success. On 401/403 dispatches `auth-required`. On 429 dispatches `api-error`. Retries 502/503/504 with backoff.

---

## 4. Main Pages

### 4.1 Dashboard ([Dashboard.jsx](../../frontend/src/Dashboard.jsx))

- **Purpose**: Overview after login. Stats (health score, confidence, accepted/critical issues, events, jobs), health trend chart, local upload (ProjectDropzone), GitHub connect (GitHubConnect), run history (RunHistory). Can show a selected review (ReviewResult).
- **Data**: GET `/api/repos`, GET `/api/monitoring/summary`, GET `/api/metrics/health-trend`. Optional mock data when `VITE_USE_MOCK_DATA=true`.

### 4.2 RepositoriesPage ([pages/RepositoriesPage.jsx](../../frontend/src/pages/RepositoriesPage.jsx))

- **Purpose**: List repositories connected to the user; button to connect more (GET `/api/github/install-url` then redirect). Each repo links to `/repos/:repoId`.
- **Data**: GET `/api/repos` (response.repos).

### 4.3 RepositoryDashboard ([pages/RepositoryDashboard.jsx](../../frontend/src/pages/RepositoryDashboard.jsx))

- **Purpose**: Single-repo view: header (name, full_name, language), "Run scan" button, optional ScanProgressBanner when job_id is set, latest review card (score, grade, "View full report"), category radar and fix-first when latest review exists, AnalyzerStatusList from extra_metadata, issues table, score trend chart, tabs (Reviews, Commits, Events, Jobs).
- **Data**: GET `/api/repos/:repoId`, GET `/api/repos/:repoId/stats`, getLatestReview(repoId), getScoreTrend(repoId). Scan: triggerScan(repoId, body); on job_id shows ScanProgressBanner and polls getJob(job_id); on inline polls latest-review; on idempotent navigates to review.
- **Repo disconnected**: When repo.status is not active, shows Alert with "Reconnect repository" button to `/repos`.

### 4.4 ReviewDetail ([ReviewDetail.jsx](../../frontend/src/ReviewDetail.jsx))

- **Purpose**: Full review view from canonical or legacy API. Header (repo, commit, branch, status, duration), score overview (overall score, grade, trend, severity counts, category radar), analyzers list, findings table (click opens IssueDetailDrawer), next actions / top risks.
- **Data**: getReviewCanonical(id) first; on failure getReview(id). Categories from scores.by_category or legacy category_scores; findings from canonical.findings or legacy.issues.

### 4.5 JobsPage ([JobsPage.jsx](../../frontend/src/JobsPage.jsx))

- **Purpose**: List analysis jobs (from Redis), filters (repo, status), polling toggle, job detail modal. On job click: GET `/api/jobs/:job_id`; on 404 shows modal with "Job not found or no longer in cache."
- **Data**: GET `/api/jobs` (response.jobs or []).

---

## 5. Components (Grouped)

### 5.1 Layout

- **AppShell**: Sidebar + TopBar + main content; auth-required listener.
- **SidebarNav** ([layout/SidebarNav.jsx](../../frontend/src/components/layout/SidebarNav.jsx)): Navigation links (Dashboard, Repos, Events, Jobs, Reviews, Issues, System Status).
- **TopBar** ([layout/TopBar.jsx](../../frontend/src/components/layout/TopBar.jsx)): Top bar and sidebar toggle.

### 5.2 Scan

- **ScanProgressBanner** ([ScanProgressBanner.jsx](../../frontend/src/components/ScanProgressBanner.jsx)): Consumes job_id; polls GET `/api/jobs/:job_id`; shows Queued / Running / Completed / Failed / 404 (job not found). Calls onComplete(reviewId) or onDismiss().

### 5.3 Reviews and Findings

- **ScoreCard** ([reviews/ScoreCard.jsx](../../frontend/src/components/reviews/ScoreCard.jsx)): Single metric card (label, value, variant, icon).
- **CategoryRadarChart** ([reviews/CategoryRadarChart.jsx](../../frontend/src/components/reviews/CategoryRadarChart.jsx)): Radar chart from categories (key, label, score).
- **IssueTable** ([reviews/IssueTable.jsx](../../frontend/src/components/reviews/IssueTable.jsx)): Paginated, filterable issues table; GET `/api/reviews/:reviewId/issues`; onSelectIssue opens drawer.
- **FixFirstChecklist** ([reviews/FixFirstChecklist.jsx](../../frontend/src/components/reviews/FixFirstChecklist.jsx)): List of fix_first items (id, title).
- **AnalyzerStatusList** ([reviews/AnalyzerStatusList.jsx](../../frontend/src/components/reviews/AnalyzerStatusList.jsx)): List of analyzers from canonical.analyzers or legacy extra_metadata (analyzers_run, by_tool); status: pending/running/completed/failed/skipped.
- **IssueDetailDrawer** ([reviews/IssueDetailDrawer.jsx](../../frontend/src/components/reviews/IssueDetailDrawer.jsx)): Offcanvas with finding detail; supports canonical (evidence.snippets, recommendation.summary/steps) and legacy (evidence array, suggested_fix); severity, confidence, dimension.

### 5.4 Monitoring (Tabs on RepositoryDashboard)

- **CommitsView** ([monitoring/CommitsView.jsx](../../frontend/src/components/monitoring/CommitsView.jsx)): GET `/api/repos/:repoId/commits`; "Review" per commit calls onRunScanForCommit(sha) or POST scan with commit_sha.
- **ReviewsView** ([monitoring/ReviewsView.jsx](../../frontend/src/components/monitoring/ReviewsView.jsx)): GET `/api/repos/:repoId/reviews`; empty state with "Run scan"; onRunScan callback.
- **EventsView** ([monitoring/EventsView.jsx](../../frontend/src/components/monitoring/EventsView.jsx)): GET `/api/events` (or similar).
- **JobsView** ([monitoring/JobsView.jsx](../../frontend/src/components/monitoring/JobsView.jsx)): Jobs list for repo or global.

### 5.5 Shared

- **ToastProvider** ([ToastProvider.jsx](../../frontend/src/components/ToastProvider.jsx)): Global toast context (showToast).
- **Pagination** ([Pagination.jsx](../../frontend/src/components/Pagination.jsx)): Page navigation.
- **Skeleton** ([Skeleton.jsx](../../frontend/src/components/Skeleton.jsx)): Loading skeletons (e.g. SkeletonTable, SkeletonDetail).

---

## 6. apiClient Helpers

All return the response body (apiClient interceptor returns `response.data`).

| Helper | Calls | Purpose |
|--------|-------|---------|
| getRepoReviews(repoId, params) | GET /api/repos/:id/reviews | List reviews for repo |
| getLatestReview(repoId) | GET /api/repos/:id/latest-review | Latest review with categories, top_issues, fix_first |
| getReview(reviewId) | GET /api/reviews/:id | Single review with issues (legacy) |
| getReviewIssues(reviewId, params) | GET /api/reviews/:id/issues | Paginated issues |
| getScoreTrend(repoId, days) | GET /api/repos/:id/score-trend?days= | Score trend for chart |
| triggerScan(repoId, body) | POST /api/repos/:id/scan | Start scan; body optional { commit_sha } |
| getJob(jobId) | GET /api/jobs/:id | Job status |
| getReviewCanonical(reviewId) | GET /api/reviews/:id/canonical | codebuster.commit_review JSON |
| getJobs() | GET /api/jobs | Job list (returns { jobs: [] } on error) |

Other endpoints are called via `apiClient.get/post(...)` with explicit paths (e.g. `/api/repos`, `/api/repos/:id`, `/auth/user`, `/api/github/install-url`).

---

## 7. Scan Flow (UI)

1. User clicks "Run scan" or "Review" on a commit. Frontend calls `triggerScan(repoId, body)`.
2. If response has `job_id`: set scanJobId, show ScanProgressBanner; banner polls getJob(jobId) every 5s; on status completed call onComplete(reviewId) (navigate or refetch); on failed show error; on 404 show "Job no longer in queue."
3. If response has `inline: true`: show toast; optional polling of getLatestReview until new review appears.
4. If response has `idempotent` and `review_id`: show toast "Review already exists"; navigate to `/reviews/:reviewId` or refetch.
5. CommitsView can use `onRunScanForCommit` prop (same triggerScan with commit_sha) so one scan flow handles both full and commit-specific scans.

See [UI_DESIGN_JSON_TO_SCREENS.md](UI_DESIGN_JSON_TO_SCREENS.md) for state machine and copy.
