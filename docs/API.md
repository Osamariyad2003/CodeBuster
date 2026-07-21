# CodeBuster API Reference

Base URL: `http://localhost:8000` (local) or your deployment host.

## Health

### GET /health

Returns service health.

**Response:** `200`

```json
{
  "status": "healthy",
  "timestamp": "2025-02-10T12:00:00.000000",
  "version": "1.0.0"
}
```

---

## Webhooks

### POST /webhooks/github

Ingests GitHub webhook events. Verifies `X-Hub-Signature-256` when `GITHUB_WEBHOOK_SECRET` is set.

**Headers:**

- `Content-Type: application/json`
- `X-GitHub-Event`: `pull_request` | `push`
- `X-GitHub-Delivery`: unique delivery ID
- `X-Hub-Signature-256`: `sha256=<hmac_hex>` (required if secret is set)

**Response:** `200`

- Accepted: `{"status": "accepted", "job_id": "<uuid>", "event_id": "...", "repo_id": "..."}`
- Ignored: `{"status": "ignored", "reason": "event_not_supported"}` or `"repository-not-registered"`

**Errors:** `400` invalid JSON or missing repo/commit, `401` invalid signature.

---

## Repositories

### GET /api/repos

List all repositories.

**Response:** `200`

```json
[
  { "id": "uuid", "full_name": "org/repo", "default_branch": "main" }
]
```

### GET /api/repos/{repo_id}/health

Latest health for a repository.

**Response:** `200`

```json
{
  "repo_id": "uuid",
  "full_name": "org/repo",
  "latest_score": 85,
  "latest_grade": "B",
  "latest_review_id": "uuid"
}
```

### GET /api/repos/{repo_id}/settings

Get repository policy settings.

**Response:** `200`

```json
{
  "repo_id": "uuid",
  "enabled_analyzers": ["security", "quality", "performance"],
  "min_severity": "MINOR",
  "fail_pr_on_grade_below": "D"
}
```

### PATCH /api/repos/{repo_id}/settings

Update repository settings (policy toggles).

**Body:**

```json
{
  "enabled_analyzers": ["security", "quality"],
  "min_severity": "MAJOR",
  "fail_pr_on_grade_below": "C"
}
```

**Response:** `200` — same shape as GET settings.

---

## Reviews

### GET /api/reviews

List reviews with pagination.

**Query:** `page` (default 1), `page_size` (default 20, max 100)

**Response:** `200`

```json
{
  "reviews": [
    {
      "id": "uuid",
      "repo_id": "uuid",
      "overall_score": 80,
      "overall_grade": "B",
      "created_at": "2025-02-10T12:00:00",
      "completed_at": "2025-02-10T12:01:00"
    }
  ],
  "total": 42
}
```

### GET /api/reviews/{review_id}

Get review detail with optional filters.

**Query:** `severity` (CRITICAL|MAJOR|MINOR|INFO), `category` (e.g. security)

**Response:** `200`

```json
{
  "id": "uuid",
  "repo_id": "uuid",
  "overall_score": 80,
  "overall_grade": "B",
  "category_scores": [{ "key": "security", "label": "Security", "score": 85 }],
  "findings": [
    {
      "id": "security-001",
      "severity": "MAJOR",
      "category": "security",
      "file": "app/main.py",
      "start_line": 10,
      "message": "..."
    }
  ],
  "canonical_payload": { ... },
  "created_at": "...",
  "completed_at": "..."
}
```

**Errors:** `404` if review not found.

---

## Error format

All errors use a consistent schema:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Human-readable message",
    "field": null,
    "details": null
  },
  "request_id": "uuid"
}
```

`X-Request-ID` is set on every response for tracing.
