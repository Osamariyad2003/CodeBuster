# CodeBuster UI Design: JSON-to-Screen Mapping

**Senior Product Designer + Frontend Architect**  
Production-ready UI mapped strictly to the CodeBuster JSON API contract. No invented backend behavior.

---

## 1. Screen Mapping (JSON Kinds → Screens & Components)

### 1.1 `codebuster.scan` (Scan trigger & job lifecycle)

**API:** `POST /api/repos/{repo_id}/scan`  
**Request body:** `{}` or `{ "commit_sha": "optional" }`  
**Response (202):** `{ "success": true, "message": "...", "job_id": "string | null", "review_id": "string | null", "inline": true | undefined, "idempotent": true | undefined }`  
**Response (200, idempotent):** `{ "success": true, "review_id": "uuid", "idempotent": true, "job_id": null }`

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **RepositoryDashboard** (repo detail) | `ScanTriggerButton`, `ScanProgressBanner` | `job_id` → poll `GET /api/jobs/{job_id}`; `review_id` → navigate to review; `inline` → show “Scan running in background” |
| **CommitsView** (per-commit “Review” button) | `ScanTriggerButton` | Same; `commit_sha` in request body |
| **JobsPage** (optional) | — | Job list from `GET /api/jobs`; individual job from `GET /api/jobs/{job_id}` |

- **Primary:** `job_id`, `review_id`, `success`, `message`  
- **Secondary:** `inline` (determines copy: “Check back in a minute” vs “Track in Jobs”)  
- **Advanced:** `idempotent` (show “Review already existed” toast)

---

### 1.2 `codebuster.commit_review` (Canonical review)

**API:** `GET /api/reviews/{review_id}/canonical`

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **ReviewDetailScreen** (primary) | See §3 (Canonical Commit Review UI) | Full payload |
| **RepositoryDashboard** (summary only) | `ScoreCard`, `CategoryRadarChart` | `scores`, `summary`; legacy `GET /api/repos/{id}/latest-review` can be used instead for list/summary |

- **Primary:** `repo`, `commit`, `status`, `scores`, `summary`, `findings`, `analyzers`  
- **Secondary:** `trigger`, `policy`, `artifacts`, `metadata`  
- **Advanced:** `artifacts.raw_analyzer_outputs`, `metadata.generator`, `policy.merge_gate`

---

### 1.3 Repository list + stats

**APIs:**  
- `GET /api/repos` → `{ "success": true, "repos": [ Repository.to_dict() + issues_count, critical_issues, high_issues, last_review_at, health_score, overall_grade ] }`  
- `GET /api/metrics/summary` or `GET /api/monitoring/summary` → `{ "events", "jobs", "health", "accepted_issues", "critical_issues", "avg_confidence", "event_details", "job_details" }`

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **RepositoriesPage** (list) | `RepoCard`, `RepoList` | `repos[].id`, `full_name`, `issues_count`, `critical_issues`, `high_issues`, `last_review_at`, `health_score`, `overall_grade` |
| **Dashboard** (overview) | `StatsStrip`, `HealthOverview` | `health`, `critical_issues`, `accepted_issues`, `events`, `jobs`, `job_details.running`, etc. |

- **Primary:** `repos[].id`, `full_name`, `health_score`, `overall_grade`, `issues_count`, `critical_issues`, `last_review_at`  
- **Secondary:** `high_issues`, `description`, `language`, `connected_at`  
- **Advanced:** `job_details` (running/completed/failed counts)

---

### 1.4 Review (legacy) + Issues

**APIs:**  
- `GET /api/repos/{repo_id}/latest-review` → `{ "success", "review", "categories", "top_issues", "fix_first" }`  
- `GET /api/repos/{repo_id}/reviews` → `{ "success", "reviews": [ Review.to_dict() ] }`  
- `GET /api/reviews/{review_id}` → `{ **Review.to_dict(), "issues": [ Issue.to_dict() ] }`  
- `GET /api/issues?review_id=...` → `{ "success", "items": [ Issue.to_dict() ], "total" }`

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **RepositoryDashboard** | `LatestReviewCard`, `ReviewsView`, `ScoreCard`, `CategoryRadarChart`, `IssueTable`, `FixFirstChecklist` | `review`, `categories`, `top_issues`, `fix_first` |
| **ReviewDetailScreen** (legacy path) | Same as canonical but from Review + Issues | `review.*`, `issues[]` |
| **ReviewsHistoryPage** | `ReviewRunSelector`, `ReviewCard` | `reviews[]` (id, commit_sha, status, overall_health_score, completed_at, grade) |

- **Primary:** `review.id`, `review.status`, `review.overall_health_score`, `review.commit_sha`, `review.completed_at`, `categories`, `top_issues`, `fix_first`, `issues`  
- **Secondary:** `review.trigger_type`, `review.findings_count`, `review.top_risks`, `review.quick_wins`, `review.extra_metadata`  
- **Advanced:** `review.extra_metadata.analyzers_run`, `by_tool`, `duration_seconds`

---

### 1.5 Analyzer results

**API:** `GET /api/reviews/{review_id}/canonical` → `commit_review.analyzers[]`  
**Alternative:** Legacy `review.extra_metadata.analyzers_run` + `review.extra_metadata.by_tool`  
**Single-analyzer:** `POST /api/analyze` → DimensionAnalyzerResult (see JSON_FORMATS §5)

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **ReviewDetailScreen** | `AnalyzerStatusList` | `commit_review.analyzers[]` (id, name, status, duration_ms, stats.findings, error) |
| **AnalyzePlayground** (if present) | `DimensionResultCard` | `DimensionAnalyzerResult` (analyzer, category_result, issues, signals) |

- **Primary:** `analyzers[].id`, `analyzers[].name`, `analyzers[].status`, `analyzers[].stats.findings`  
- **Secondary:** `analyzers[].duration_ms`, `analyzers[].started_at`, `analyzers[].completed_at`  
- **Advanced:** `analyzers[].version`, `analyzers[].error`, `analyzers[].stats.files_scanned`

---

### 1.6 Jobs / events

**APIs:**  
- `GET /api/jobs` → `{ "jobs": [ { job_id, delivery_id, repo, status, started_at, completed_at, duration_ms, error, result } ] }` (or safe empty)  
- `GET /api/jobs/{job_id}` → single job or `{ "error": "Job not found or no longer in cache" }`  
- `GET /api/events` → `{ "events": [ ... ] }` (or safe empty)

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **JobsPage** | `JobList`, `JobCard`, `JobDetailModal` | `jobs[]`: job_id, repo, status, started_at, completed_at, duration_ms, error |
| **Dashboard** (optional) | `ActiveJobsBadge` | Count of `jobs[].status === 'running'` |
| **EventsPage** (optional) | `EventList` | `events[]` |

- **Primary:** `job_id`, `repo`, `status`, `started_at`, `completed_at`, `error`  
- **Secondary:** `duration_ms`, `delivery_id`, `result`  
- **Advanced:** `retries`

---

### 1.7 Error responses

**Standard shapes:**  
- `401`: `{ "error": "Unauthorized" }`  
- `403`: (treat same as 401 for UI)  
- `404`: `{ "error": "Repository not found" }` / `"Review not found"` / etc.  
- `400`: `{ "error": "description" }` or `{ "error", "troubleshooting" }`  
- `500`: `{ "error": "string" }`  
- `503`: `{ "error": "Scan failed and fallback unavailable.", "detail": "string" }`

| Consumed by screen(s) | UI components | Field usage |
|------------------------|---------------|-------------|
| **Global** | `AuthGuard`, `ErrorBoundary`, `Toast` | `error` → user message; `troubleshooting` → expandable hint |
| **RepositoryDashboard** | `DisconnectedRepoBanner`, `ScanErrorCard` | 400/404/503 for repo/scan |
| **JobsPage** | `JobDetailModal` | `GET /api/jobs/{id}` → `{ "error": "Job not found or no longer in cache" }` |

---

## 2. Scan Flow UI (Command → Progress → Result)

**API:** `POST /api/repos/{repo_id}/scan` (body optional `{ "commit_sha": "sha" }`).  
**Note:** Backend uses `POST /api/repos/<repo_id>/scan` (singular). No separate “scans” resource.

### 2.1 State machine: Scan → Review

```
[Create Scan] 
    → POST /scan 
    → 202 + job_id (or 202 + inline, or 200 + review_id idempotent)
         │
         ├─ job_id present ──→ [Queued] ──→ poll GET /api/jobs/{job_id}
         │                           │
         │                           ├─ status: pending   → [Queued]
         │                           ├─ status: running   → [Running]
         │                           ├─ status: completed → [Completed] → GET review (by result.review_id or latest)
         │                           └─ status: failed   → [Failed]
         │
         ├─ inline: true ───────────→ [Running (inline)] ──→ poll GET /api/repos/{id}/latest-review until new review or timeout
         │
         └─ review_id (idempotent) ─→ [Completed] → navigate to review
```

### 2.2 Per-state definition

| State | User-visible label | JSON that drives it | Actions enabled / disabled |
|-------|--------------------|---------------------|----------------------------|
| **Idle** | — | No job, or job not for this repo | **Run scan** (enabled); **Run scan** for specific commit (enabled from Commits tab). |
| **Queued** | “Scan queued” / “Waiting in queue” | `GET /api/jobs/{job_id}` → `status: "pending"` | **Run scan** disabled (or show “Another scan in progress”). **Cancel** only if API supports it (currently not in contract → hide or disable). |
| **Running** | “Scanning…” / “Analysis in progress” | `status: "running"` or `inline: true` with no new review yet | Same as Queued. Optional: show “This usually takes 1–3 minutes.” |
| **Completed** | “Review ready” | `status: "completed"` and `result.review_id` or new review in `GET /api/repos/{id}/reviews` / `latest-review` | **View review** (primary CTA). **Run scan** enabled again. |
| **Failed** | “Scan failed” | `status: "failed"` or `GET /api/jobs/{id}` → `error`; or 503 from POST | **Retry scan** (enabled). **View job** (if job_id) to show `error`. **Run scan** enabled. |
| **Idempotent** | “Review already exists for this commit” | 200 + `review_id` + `idempotent: true` | **View review** (primary). **Run scan** enabled. |

### 2.3 Exact UX copy (critical states)

- **After POST 202 (with job_id):** “Scan started. You can track progress below or refresh in a minute to see results.”
- **After POST 202 (inline: true):** “Scan is running in the background. Refresh the page in about a minute to see the new review.”
- **After POST 200 idempotent:** “A review already exists for this commit.” [View review]
- **Queued:** “Scan queued. It will start shortly.”
- **Running:** “Scanning your code… This usually takes 1–3 minutes.”
- **Completed:** “Review ready.” [View review]
- **Failed (from job):** “Scan failed: { job.error }.” [Retry scan]
- **Failed (503):** “Scan couldn’t be started. Please try again in a moment.” [Retry scan]
- **Job not found (404 on GET job):** “This job is no longer in the queue. Check the latest review for results or run a new scan.”

---

## 3. Canonical Commit Review UI (field-by-field)

Data source: `GET /api/reviews/{review_id}/canonical` → single `codebuster.commit_review` object.

### 3.1 Header (repo, commit, branch, status)

| UI element | JSON path | Null / missing behavior |
|------------|-----------|-------------------------|
| Repo name + link | `repo.full_name`, `repo.url` | If `full_name` empty → “Unknown repo”. If `url` null → no link. |
| Commit SHA (short) | `commit.sha` | Empty → show “—”. Optional copy to clipboard. |
| Branch | `commit.branch` | Null → “main” or “—”. |
| Status pill | `status.state` | pending → “Pending”, running → “Running”, completed → “Completed”, failed → “Failed”. Color: pending=gray, running=blue, completed=green, failed=red. |
| Duration | `status.duration_ms` | Null → hide or “—”. Else “X.X s”. |
| Trigger | `trigger.type` / `trigger.source` | Null → “Manual”. Else “Commit” / “Pull request” / “Manual”. |
| Errors | `status.errors[]` | If length > 0 → small alert “N error(s)” with tooltip/list. |

### 3.2 Score overview

| UI element | JSON path | Null / missing behavior |
|------------|-----------|-------------------------|
| Overall score + grade | `scores.overall.value`, `scores.overall.grade` | Default value 0, grade “—”. Show large grade (A–F) and numeric score. |
| Trend | `scores.overall.trend` | Null → hide. up → ↑ green, down → ↓ red, stable → → gray. |
| Dimension scores | `scores.by_dimension` | Iterate keys; each `DimensionScore.value` + `.grade`. Null key → skip. Empty → “No dimension scores”. |
| Category list | `scores.by_category` | List of `{ key, score }`. Null/empty → hide section. |

### 3.3 Analyzer status panel

| UI element | JSON path | Null / missing behavior |
|------------|-----------|-------------------------|
| List of analyzers | `analyzers[]` | Empty → “No analyzer data.” |
| Per row: name | `analyzers[].name` or `analyzers[].id` | Fallback: id. |
| Per row: status | `analyzers[].status` | pending → gray spinner; running → progress bar; completed → green check; failed → red icon + tooltip; skipped → gray “Skipped”. |
| Per row: findings count | `analyzers[].stats.findings` | Null → “—”. |
| Per row: duration | `analyzers[].duration_ms` | Null → “—”. Else “X.X s”. |
| Per row: error | `analyzers[].error` | Non-null → tooltip or inline small text. |

### 3.4 Findings list + detail drawer

| UI element | JSON path | Null / missing behavior |
|------------|-----------|-------------------------|
| Table columns (primary) | `findings[].finding_id`, `title`, `severity`, `dimension` or `category`, `confidence`, `lifecycle.status` | See §3.5 for severity/confidence/dimension. |
| Row click / “View” | — | Open drawer with full finding. |
| Drawer: title | `findings[].title` | Empty → “Finding”. |
| Drawer: description | `findings[].description` | Null → hide or “No description.” |
| Drawer: impact | `findings[].impact` | Null → hide. |
| Drawer: evidence | `findings[].evidence.snippets[]` | Empty → “No code snippets.” |
| Drawer: locations | `findings[].locations[]` | file_path, start_line, end_line, commit_sha. Null → “—”. |
| Drawer: recommendation | `findings[].recommendation.summary`, `.steps` | Null summary → hide; empty steps → hide. |
| Drawer: references | `findings[].references[]` | Empty → hide. **Advanced:** type, id, title. |
| Drawer: suggested_patch | `findings[].suggested_patch` | Null → hide. **Advanced:** diff viewer. |
| Drawer: lifecycle | `findings[].lifecycle.status`, `first_seen_at`, `resolved_at`, `ignored` | open → “Open”; resolved → “Resolved”; ignored → “Ignored” + optional reason. |

### 3.5 Severity, confidence, dimension (visual)

- **Severity:** critical = red badge; major = orange; minor = yellow/amber; info = blue/gray. Label: “Critical” / “Major” / “Minor” / “Info”. If unknown → treat as “Minor”.  
- **Confidence:** 0–1 numeric. Show as “High” (≥0.8), “Medium” (0.5–&lt;0.8), “Low” (&lt;0.5), or bar. Null → “—”.  
- **Dimension/category:** Pill or tag with `finding.dimension` or `finding.category`. Null → “General” or hide.  
- **Advanced:** `labels[]`, `references[]`, `suggested_patch` (collapsed “Show suggested patch”).

### 3.6 Evidence and code snippets

- **Component:** `EvidenceSnippets` (in finding drawer).  
- **Data:** `finding.evidence.snippets[]` → `file_path`, `start_line`, `end_line`, `excerpt`.  
- Null/empty → “No code snippets.”  
- Render: file path as link (if app supports file view), line range, code block for `excerpt` (syntax highlight by extension).

### 3.7 Recommendations & next actions

- **From summary:** `summary.next_actions[]` (strings) → “Next actions” list on review overview.  
- **From summary:** `summary.top_risks[]` → “Top risks” list.  
- **Per finding:** `finding.recommendation.summary` + `finding.recommendation.steps` in drawer.  
- Null/empty → hide section or “No recommendations.”

### 3.8 What is “Advanced”

- **Hide behind “Advanced” or “Show more”:**  
  - `policy.merge_gate`, `artifacts.raw_analyzer_outputs`, `artifacts.export`, `metadata.generator`, `finding.references`, `finding.suggested_patch`, `finding.lifecycle.ignored` (detail).  
- **Primary always visible:** repo, commit, status, scores, summary counts, analyzers list, findings list, severity/confidence/dimension, evidence snippets, recommendation summary/steps, next_actions, top_risks.

---

## 4. Component-Level Mapping

### 4.1 ScanTriggerButton

- **JSON path(s):**  
  - Input: `repo_id`, optional `commit_sha`.  
  - Output: `POST /api/repos/{repo_id}/scan` → `success`, `job_id`, `review_id`, `inline`, `idempotent`, `message`.  
- **States:**  
  - Default: “Run scan” / “Review this commit”.  
  - Loading: disable button, spinner after click until 202/200.  
  - Success 202: show toast with message; pass `job_id` to parent for progress.  
  - Success 200 idempotent: toast “Review already exists”; navigate to `review_id` if desired.  
  - Error (4xx/5xx): toast with `response.error` (+ `response.detail` for 503).  
- **Interaction:** Click → POST; optional “Scan latest” vs “Scan this commit” (body with/without `commit_sha`).

### 4.2 ScanProgressBanner

- **JSON path(s):**  
  - `job_id` from parent (from POST response).  
  - `GET /api/jobs/{job_id}` → `status`, `started_at`, `completed_at`, `duration_ms`, `error`, `result`.  
- **States:**  
  - No job_id: hidden.  
  - pending: “Scan queued” + spinner.  
  - running: “Scanning…” + progress indicator (indeterminate).  
  - completed: “Review ready” + link to review (from `result.review_id` or latest-review).  
  - failed: “Scan failed” + `error` text + [Retry].  
  - 404 on GET job: “Job no longer in queue.” [Run new scan].  
- **Interaction:** Poll every 5–10 s while status is pending/running; stop on completed/failed or 404.

### 4.3 AnalyzerStatusList

- **JSON path(s):** `commit_review.analyzers[]` (or legacy `review.extra_metadata.analyzers_run` + `by_tool`).  
- **States:**  
  - pending → gray spinner + “Pending”.  
  - running → progress bar (indeterminate) + “Running”.  
  - completed → green check + name + optional duration + findings count.  
  - failed → red error icon + tooltip with `analyzers[].error`.  
  - skipped → gray “Skipped”.  
- **Empty:** “No analyzer data.”  
- **Interaction:** Optional expand per row for duration_ms, version, error.

### 4.4 ScoreCard (overall)

- **JSON path(s):** `scores.overall.value`, `scores.overall.grade`, `scores.overall.trend` (or legacy `review.overall_health_score` + computed grade).  
- **States:** Loaded → big grade (A–F) + number; trend arrow if present. Null → “—”.  
- **Interaction:** None (display only).

### 4.5 CategoryRadarChart / CategoryScores

- **JSON path(s):** `scores.by_dimension` or `scores.by_category` or legacy `categories[]` (key, label, score).  
- **States:** Has data → radar or bar list. Empty → “No category scores.”  
- **Interaction:** Optional tooltip per dimension.

### 4.6 IssueTable (findings list)

- **JSON path(s):** `findings[]` or legacy `issues[]` (Issue.to_dict()). Columns: finding_id/id, title, severity, dimension/category, confidence, file (from locations[0].file_path or issue.file), lifecycle.status.  
- **States:** Loading → skeleton. Empty → “No findings. This scan is clean.” With data → sortable/filterable table.  
- **Interaction:** Row click or “View” → open FindingDetailDrawer with that finding.

### 4.7 FindingDetailDrawer

- **JSON path(s):** Single `finding` object: title, description, impact, severity, confidence, dimension, category, evidence.snippets, locations, recommendation, references, suggested_patch, lifecycle.  
- **States:** Null → don’t open. Empty optional fields → hide or “No …”.  
- **Interaction:** Close; optional “Resolve” / “Ignore” (calls feedback/issue APIs if in contract); copy link.

### 4.8 FixFirstChecklist

- **JSON path(s):** Legacy `fix_first[]` (ids/titles) or map from `summary.top_risks` + `summary.next_actions`.  
- **States:** Empty → “No fix-first items.” Else list with link to finding/review.  
- **Interaction:** Click item → scroll to finding or open drawer.

### 4.9 RepoCard (list item)

- **JSON path(s):** `repos[].id`, `full_name`, `health_score`, `overall_grade`, `issues_count`, `critical_issues`, `high_issues`, `last_review_at`.  
- **States:** Loaded → show; missing optional → “—”.  
- **Interaction:** Click → navigate to repo dashboard.

### 4.10 JobCard / JobDetailModal

- **JSON path(s):** `jobs[].job_id`, `repo`, `status`, `started_at`, `completed_at`, `duration_ms`, `error`. Single job: `GET /api/jobs/{job_id}`.  
- **States:** pending/running/completed/failed as above. 404 → “Job not found or no longer in cache.”  
- **Interaction:** Click job → open JobDetailModal; Retry → POST scan for that repo if applicable.

---

## 5. Error & Edge-State UX

### 5.1 401 / 403 auth errors

- **Trigger:** Any API returns 401 or 403; body `{ "error": "Unauthorized" }` (or similar).  
- **Copy:** “You’re signed out or your session expired. Please sign in again.”  
- **Action:** Redirect to login / auth flow; after re-auth return to intended URL.  
- **Where:** Global axios/fetch interceptor or AuthGuard; show one toast + redirect.

### 5.2 Repo disconnected

- **Trigger:** 404 on repo-scoped endpoints or `repo.status` / backend logic indicating disconnected.  
- **Copy:** “This repository is no longer connected. Reconnect it to run scans and see reviews.”  
- **Action:** [Reconnect repository] → GitHub App install or sync flow (`GET /api/github/install-url`, then sync).  
- **Where:** RepositoryDashboard; hide scan button or show banner until reconnected.

### 5.3 Scan stuck in “running” &gt; X minutes

- **Trigger:** Same `job_id` with `status: "running"` for e.g. &gt; 10 minutes (client timer).  
- **Copy:** “This scan is taking longer than usual. You can keep this page open or run a new scan later.”  
- **Action:** [Run new scan] (optional; may create a second job). Keep polling or offer “Stop waiting” that hides the progress banner.  
- **Where:** ScanProgressBanner.

### 5.4 Partial analyzer failures

- **Trigger:** `commit_review.analyzers[]` has one or more `status: "failed"` and/or `error` set.  
- **Copy (summary):** “Some analyzers didn’t run: N failed.” In list: per-row “Failed” with tooltip showing `analyzers[].error`.  
- **Action:** No automatic retry; user can “Run scan again” for full re-run. Optionally “Why did this happen?” linking to docs.  
- **Where:** AnalyzerStatusList; optional small summary badge “N analyzers failed” in header.

### 5.5 Empty findings (“clean scan”)

- **Trigger:** `findings.length === 0` (or legacy `issues.length === 0`).  
- **Copy:** “No findings. This scan is clean.” Optional: “We ran N analyzers and found no issues.”  
- **Action:** None required. Optional [View score breakdown] to focus on scores/analyzers.  
- **Where:** IssueTable empty state; keep ScoreCard and AnalyzerStatusList visible so the run still feels valuable.

---

## 6. Actionability & Developer Trust

### 6.1 “What do I do next?”

- **Review header:** Primary CTA = “View findings” or “Fix first” (from fix_first / top_risks / next_actions).  
- **Finding drawer:** Always show **Recommendation** (summary + steps); then optional “Mark resolved” / “Dismiss” with short reason.  
- **Dashboard:** After scan completes, single clear line: “Review ready — fix X critical and Y high issues” with link to review.  
- **Empty findings:** “No issues found. Consider running another scan after your next commit.”

### 6.2 “Why did the system say this?”

- **Evidence → recommendation → action:** In FindingDetailDrawer: (1) **Evidence** (code snippets + locations), (2) **Impact** (why it matters), (3) **Recommendation** (summary + steps), (4) **Action** (resolve/ignore with optional comment).  
- **Confidence:** Show “Confidence: High/Medium/Low” with short tooltip: “How sure the analyzer is about this finding.”  
- **Tool/source:** Show which analyzer(s) reported the finding (`finding.labels`, or legacy `issue.tool` / `issue.module`) so engineers can judge by tool reputation.  
- **Ignore/resolve:** If policy or feedback API exists: “Ignore” requires optional justification when `policy.merge_gate.require_justification_for_ignore` is true; “Resolve” can add a comment. Show lifecycle status (open/resolved/ignored) in list and drawer.

### 6.3 Trust paragraph

This UI is built to feel trustworthy to engineers by **binding every label and number to the API contract**: no synthetic statuses or invented fields. Screens answer “what do I do next?” with a clear primary action (view review, fix first, reconnect repo, retry scan) and surface “why?” by exposing evidence (code snippets and locations), impact, and recommendation in a single loop. Confidence and analyzer source are visible so engineers can weigh findings; severity and lifecycle are explicit; and error states (auth, disconnected repo, failed scan, job not found, partial analyzer failure) use consistent copy and recovery actions. By mapping scan flow to real job/review states and keeping “Advanced” details collapsible, the UI stays focused on actionable outcomes without hiding how the system reached them—which is what developers need to trust and act on the results.
