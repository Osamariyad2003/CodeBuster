# Commit Review Canonical Format (Contract)

Production-ready payload for CodeBuster commit reviews. Backend and frontend should use this contract for consistency.

## Kind & Version

- **`kind`**: `"codebuster.commit_review"`
- **`version`**: `"1.0.0"` (semver)

## Top-Level Keys (minimal contract)

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `kind` | string | yes | Always `codebuster.commit_review` |
| `version` | string | yes | Schema version (e.g. `1.0.0`) |
| `review_id` | string | yes | Unique review identifier |
| `workspace_id` | string | no | Workspace/tenant id |
| `trigger` | object | no | `{ type, source, event, requested_by }` |
| `repo` | object | no | `{ provider, owner, name, full_name, repo_id, default_branch, visibility, url }` |
| `commit` | object | no | `{ sha, branch, message, author, committer, committed_at, compare }` |
| `status` | object | no | `{ state, started_at, completed_at, duration_ms, queue, errors }` |
| `policy` | object | no | `{ ruleset_id, ruleset_name, merge_gate }` |
| `scores` | object | no | `{ overall: { value, grade, trend }, by_dimension: {}, by_category: [] }` |
| `summary` | object | no | `{ severity_counts: {}, top_risks: [], next_actions: [] }` |
| `analyzers` | array | no | List of `{ id, name, status, started_at, completed_at, duration_ms, version, stats, error }` |
| `findings` | array | no | List of findings (see Finding below) |
| `artifacts` | object | no | `{ report_url, raw_analyzer_outputs, export }` |
| `metadata` | object | no | `{ generated_at, generator }` |

## Finding Object (minimal)

| Key | Type | Description |
|-----|------|-------------|
| `finding_id` | string | Unique id |
| `severity` | string | `critical` \| `major` \| `minor` \| `info` |
| `confidence` | number | 0–1 |
| `dimension` | string | e.g. security, code_quality |
| `category` | string | e.g. ssrf, auth |
| `title` | string | Short title |
| `description` | string | Full description |
| `impact` | string | Impact text |
| `evidence` | object | `{ snippets: [{ file_path, start_line, end_line, excerpt }] }` |
| `locations` | array | `[{ file_path, start_line, end_line, commit_sha }]` |
| `recommendation` | object | `{ summary, steps: [] }` |
| `suggested_patch` | object | optional |
| `references` | array | e.g. CWE/OWASP refs |
| `labels` | array | string tags |
| `lifecycle` | object | `{ status: open \| resolved \| ignored, first_seen_at, resolved_at, ignored }` |

## API

- **GET** `/api/reviews/<review_id>/canonical` — Returns the review in this canonical JSON format (requires auth).

## Backend

- **Schema (Pydantic)**: `backend/schemas/commit_review_canonical.py`
- **Builder**: `backend/services/commit_review_canonical_builder.py` — builds payload from DB `Review`, `Issue`, `Repository`.

## Example (minimal)

```json
{
  "kind": "codebuster.commit_review",
  "version": "1.0.0",
  "review_id": "rev_01HZXQ0Z9J5N4K2C1M9F6G7T8U",
  "repo": {
    "provider": "github",
    "owner": "acme",
    "name": "payments-service",
    "full_name": "acme/payments-service",
    "default_branch": "main"
  },
  "commit": { "sha": "9c0a3d2a...", "branch": "main" },
  "status": { "state": "completed", "duration_ms": 98000 },
  "scores": {
    "overall": { "value": 78, "grade": "B", "trend": "up" },
    "by_dimension": {},
    "by_category": []
  },
  "summary": {
    "severity_counts": { "critical": 1, "major": 3, "minor": 6, "info": 4 },
    "top_risks": [],
    "next_actions": []
  },
  "findings": [],
  "metadata": { "generated_at": "2026-02-10T09:14:48Z", "generator": { "name": "codebuster" } }
}
```
