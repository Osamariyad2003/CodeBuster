# Run Scan – Backend Output Contract

When the user clicks **Run scan** on a repository, the backend participates in two parts: the **immediate response** when the scan is triggered, and the **scan result** that the UI shows after the scan completes.

---

## 1. Immediate response (POST /api/repos/:repoId/scan)

**Request**

- `POST /api/repos/<repo_id>/scan`
- Body: `{}` or `{ "commit_sha": "<sha>" }` (optional)

**Response** (HTTP 200 or 202)

| Field        | Type    | Description |
|-------------|---------|-------------|
| `success`   | boolean | Always `true` on success |
| `message`   | string  | User-facing message, e.g. "Scan queued...", "Manual scan triggered successfully", "Scan running in background. Refresh in a minute to see results." |
| `job_id`    | string \| null | Celery task id when the scan is queued; `null` when the scan runs inline (no queue) |
| `review_id` | string \| null | Set when **idempotent**: a review already exists for this commit; frontend can navigate to that review |
| `inline`    | boolean | Present and `true` when the scan runs in a background thread (no Celery) |
| `idempotent`| boolean | Present and `true` when `review_id` is returned for an existing review |

**Example (queued)**

```json
{
  "success": true,
  "message": "Manual scan triggered successfully",
  "job_id": "abc-123",
  "review_id": null
}
```

**Example (inline, no queue)**

```json
{
  "success": true,
  "message": "Scan running in background. Refresh the page in a minute to see results.",
  "job_id": null,
  "review_id": null,
  "inline": true
}
```

---

## 2. Scan result (what the UI shows as “Scan result”)

The dashboard shows **health score, issues, and fix-first suggestions** by calling:

**GET /api/repos/:repoId/latest-review**

**Response**

| Field        | Type   | Description |
|-------------|--------|-------------|
| `success`   | boolean | `true` |
| `review`    | object \| null | Latest completed review: `id`, `grade`, `overall_health_score`, etc. `null` if no completed review yet |
| `categories`| array  | Category scores, e.g. `[{ "key": "security", "label": "Security", "score": 85 }, ...]` |
| `top_issues`| array  | Top critical/major issues (e.g. up to 5) |
| `fix_first` | array  | Fix-first suggestions: `[{ "id", "title", "why", "effort", "status", "related_issue_ids" }, ...]` |

So the **backend output** that “run scan” ultimately provides is:

1. **Immediate**: the POST /scan response above (so the UI can show “Scan queued” or “Scan running in background” and optionally poll by `job_id`).
2. **After completion**: the scan job (e.g. `run_review_impl`) must create or update a **Review** and **Issue** rows so that **GET /api/repos/:repoId/latest-review** returns:
   - **Health score** (and grade) from the review
   - **Issues** via `top_issues` (and full list via GET /api/reviews/:reviewId/issues)
   - **Fix-first suggestions** via `fix_first`

The implementation that produces this lives in `app.tasks.run_review_impl` (and the Celery task `run_review`), which should persist the review and issues so that `get_latest_review` in `routes/repos.py` can return the above shape.
