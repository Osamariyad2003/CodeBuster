# CodeBuster – All JSON Formats

Reference for every JSON structure used in the app: API responses, request bodies, canonical schema, and internal shapes.

---

## 1. Canonical Commit Review (`codebuster.commit_review`)

**Kind:** `codebuster.commit_review`  
**Version:** `1.0.0`  
**Used by:** `GET /api/reviews/<review_id>/canonical`

```json
{
  "kind": "codebuster.commit_review",
  "version": "1.0.0",
  "review_id": "string",
  "workspace_id": "string | null",

  "trigger": {
    "type": "commit | pull_request | manual",
    "source": "string | null",
    "event": "string | null",
    "requested_by": {
      "type": "user | bot | system",
      "id": "number | null",
      "login": "string | null"
    }
  },

  "repo": {
    "provider": "github",
    "owner": "string",
    "name": "string",
    "full_name": "string",
    "repo_id": "number | null",
    "default_branch": "main",
    "visibility": "public | private | null",
    "url": "string | null"
  },

  "commit": {
    "sha": "string",
    "branch": "string | null",
    "message": "string | null",
    "author": { "name": "string | null", "email": "string | null" },
    "committer": { "name": "string | null", "email": "string | null" },
    "committed_at": "string | null",
    "compare": { "base_sha": "string | null", "head_sha": "string | null", "url": "string | null" }
  },

  "status": {
    "state": "pending | running | completed | failed",
    "started_at": "ISO8601 | null",
    "completed_at": "ISO8601 | null",
    "duration_ms": "number | null",
    "queue": { "job_id": "string | null", "priority": "low | normal | high" },
    "errors": []
  },

  "policy": {
    "ruleset_id": "string | null",
    "ruleset_name": "string | null",
    "merge_gate": {
      "enabled": false,
      "block_on": [],
      "require_justification_for_ignore": false
    }
  },

  "scores": {
    "overall": { "value": 0, "grade": "A|B|C|D|F", "trend": "up|down|stable|null" },
    "by_dimension": { "security": { "value": 0, "grade": "string" }, "..." },
    "by_category": [ { "key": "string", "score": 0 } ]
  },

  "summary": {
    "severity_counts": { "critical": 0, "major": 0, "minor": 0, "info": 0 },
    "top_risks": [],
    "next_actions": []
  },

  "analyzers": [
    {
      "id": "string",
      "name": "string",
      "status": "pending|running|completed|failed|skipped",
      "started_at": "string | null",
      "completed_at": "string | null",
      "duration_ms": "number | null",
      "version": "string | null",
      "stats": { "files_scanned": "number | null", "findings": "number | null" },
      "error": "string | null"
    }
  ],

  "findings": [
    {
      "finding_id": "string",
      "severity": "critical|major|minor|info",
      "confidence": 0.5,
      "dimension": "string | null",
      "category": "string | null",
      "title": "string",
      "description": "string | null",
      "impact": "string | null",
      "evidence": { "snippets": [ { "file_path": "", "start_line": null, "end_line": null, "excerpt": null } ] },
      "locations": [ { "file_path": "", "start_line": null, "end_line": null, "commit_sha": null } ],
      "recommendation": { "summary": null, "steps": [] },
      "suggested_patch": null,
      "references": [],
      "labels": [],
      "lifecycle": { "status": "open|resolved|ignored", "first_seen_at": null, "resolved_at": null, "ignored": null }
    }
  ],

  "artifacts": {
    "report_url": "string | null",
    "raw_analyzer_outputs": [ { "analyzer_id": "", "uri": null } ],
    "export": { "json_uri": null, "pdf_uri": null }
  },

  "metadata": {
    "generated_at": "ISO8601",
    "generator": { "name": "codebuster", "build": null }
  }
}
```

---

## 2. API Responses by Endpoint

### Auth

- **GET `/auth/github`**  
  `{ "auth_url": "https://github.com/login/oauth/authorize?..." }`

- **GET `/auth/callback`** (success)  
  `{ "success": true, "user": { "id", "login", "avatar_url" }, "message": "Authentication successful" }`

- **GET `/auth/user`**  
  `{ "authenticated": true|false, "user": { "id", "login", "avatar_url" } | null }`

- **POST `/auth/logout`**  
  `{ "success": true }`

### Repos

- **GET `/api/repos`**  
  `{ "success": true, "repos": [ Repository.to_dict() + issues_count, critical_issues, high_issues, last_review_at, health_score, overall_grade ] }`

- **GET `/api/repos/<repo_id>`**  
  `{ "success": true, "repo": Repository.to_dict() }`

- **GET `/api/repos/<repo_id>/reviews`**  
  `{ "success": true, "reviews": [ Review.to_dict() ] }`

- **GET `/api/repos/<repo_id>/latest-review`**  
  `{ "success": true, "review": Review.to_dict() + grade, "categories": [ { key, label, score } ], "top_issues": [ Issue.to_dict() ], "fix_first": [ { id, title } ] }`  
  If no review: `{ "success": true, "review": null, "categories": [], "top_issues": [], "fix_first": [] }`

- **GET `/api/repos/<repo_id>/score-trend?days=30`**  
  `[ { "date": "ISO8601", "overall_score": number, "grade": "A|B|C|D" }, ... ]`

- **GET `/api/repos/<repo_id>/commits`**  
  `{ "success": true, "commits": [ { "sha", "message", "author", "date", ... } ], "count": number }`  
  Or on token failure: `{ "success": false, "error": "string", "commits": [], "count": 0 }`

- **POST `/api/repos/<repo_id>/scan`** (body: `{}` or `{ "commit_sha": "optional" }`)  
  Success (Celery): `{ "success": true, "message": "...", "job_id": "string", "review_id": null }` (202)  
  Success (inline): `{ "success": true, "message": "...", "job_id": null, "review_id": null, "inline": true }` (202)  
  Idempotent (review exists): `{ "success": true, "message": "...", "review_id": "uuid", "idempotent": true, "job_id": null }` (200)

- **GET `/api/repos/<repo_id>/stats`**  
  `{ "success": true, "stats": { ... } }` or error.

### Review

- **GET `/api/reviews/<review_id>`**  
  `{ **Review.to_dict(), "issues": [ Issue.to_dict() ] }`

- **GET `/api/reviews/<review_id>/canonical`**  
  Canonical Commit Review JSON (see §1).

- **GET `/api/repos/<repo_id>/reviews`** (review blueprint)  
  `{ "success": true, "reviews": [ Review.to_dict() ] }`

### Issues

- **GET `/api/issues`** (query: review_id, severity, status, etc.)  
  `{ "success": true, "items": [ Issue.to_dict() ], "total": number }`

- **GET `/api/issues/<issue_id>`**  
  `{ "success": true, "issue": Issue.to_dict() }`

### Feedback

- **POST `/api/feedback`** (body: `{ "issue_id", "review_id", "action", "comment?" }`)  
  `{ "success": true, "feedback": Feedback.to_dict() }`

- **GET `/api/feedback?review_id=...`**  
  `{ "success": true, "feedback": [ Feedback.to_dict() ] }`

### Metrics / Jobs / Events

- **GET `/api/metrics/summary`**  
  `{ "repos_count", "reviews_count", "issues_count", ... }`

- **GET `/api/events`**  
  `{ "events": [ ... ] }` (or safe empty on error)

- **GET `/api/jobs`**  
  `{ "jobs": [ ... ] }` (or safe empty on error)

- **GET `/api/jobs/<job_id>`**  
  Single job object or `{ "error": "Job not found or no longer in cache" }`

### Analyze (dimension analyzer)

- **POST `/api/analyze`** (body: `{ "analyzer_key": "security|code_quality|...", "files": [ { "path", "content" } ] }`)  
  `DimensionAnalyzerResult.to_json_dict()` (see §5).

- **GET `/api/analyze`**  
  `{ "analyzer_keys": [ "architecture", "code_quality", "security", ... ] }`

### GitHub

- **GET `/api/github/install-url`**  
  `{ "url": "https://github.com/apps/..." }`

- **POST `/github/installations/sync`**  
  `{ "success": true, "message": "...", "repos": [ Repository.to_dict() ] }` or error.

- **GET `/api/github/repos`**  
  `{ "repos": [ Repository.to_dict() ], "count": number }`

---

## 3. Model `to_dict()` Shapes

### Repository

```json
{
  "id": "uuid",
  "owner": "string",
  "name": "string",
  "full_name": "string",
  "description": "string | null",
  "language": "string | null",
  "is_private": false,
  "status": "string",
  "connected_at": "ISO8601 | null",
  "created_at": "ISO8601 | null"
}
```

### Review (legacy Review model)

```json
{
  "id": "uuid",
  "repository_id": "uuid",
  "pr_number": "number | null",
  "commit_sha": "string",
  "branch": "string",
  "trigger_type": "string",
  "status": "completed|pending|failed",
  "overall_health_score": 0,
  "category_scores": { "security": 85, "code_quality": 70, ... },
  "findings_count": 0,
  "started_at": "ISO8601 | null",
  "completed_at": "ISO8601 | null",
  "error_message": "string | null",
  "top_risks": [ "issue_id", ... ],
  "quick_wins": [ "issue_id", ... ],
  "extra_metadata": { "analyzers_run": [], "by_tool": {}, "duration_seconds": 0, ... },
  "created_at": "ISO8601 | null"
}
```

### Issue

```json
{
  "id": "uuid",
  "review_id": "uuid",
  "module": "string",
  "severity": "critical|major|minor|info",
  "category": "string",
  "title": "string",
  "description": "string | null",
  "file": "file_path",
  "line": "number | null",
  "column": "number | null",
  "code_snippet": "string | null",
  "tool": "string",
  "confidence": 0.5,
  "evidence": [],
  "suggested_fix": [],
  "references": [],
  "ai_explanation": "string | null",
  "priority_score": "number | null",
  "status": "open|resolved|ignored",
  "created_at": "ISO8601 | null"
}
```

### User

```json
{
  "id": "uuid",
  "github_id": "number",
  "username": "string",
  "email": "string | null",
  "avatar_url": "string | null",
  "created_at": "ISO8601 | null"
}
```

### Feedback

```json
{
  "id": "uuid",
  "issue_id": "uuid",
  "review_id": "uuid",
  "user_id": "uuid | null",
  "action": "accept|dismiss|resolve|ignore",
  "comment": "string | null",
  "created_at": "ISO8601 | null"
}
```

### ReviewRun (scored review)

```json
{
  "review_id": "uuid",
  "repository_id": "string",
  "repo_full_name": "string",
  "commit_sha": "string",
  "trigger_source": "webhook|manual|scheduled",
  "overall_score": 0,
  "overall_grade": "A|B|C|D|F",
  "production_readiness": "yes|no|conditional",
  "created_at": "ISO8601 | null"
}
```

### CategoryScore (per review run)

```json
{
  "key": "string",
  "label": "string | null",
  "score": 0,
  "weight": "number | null",
  "not_applicable": false,
  "rationale": "string | null"
}
```

### ScoredIssue

```json
{
  "id": "uuid",
  "issue_id": "string",
  "title": "string",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "category_key": "string",
  "confidence": 0.5,
  "file_paths": [],
  "evidence": [],
  "impact": "string | null",
  "recommendation": "string | null",
  "effort": "S|M|L",
  "tags": [],
  "status": "open"
}
```

---

## 4. Orchestrator Result (internal)

Returned by `ReviewOrchestrator.analyze()` and persisted into Review + Issues + extra_metadata:

```json
{
  "review_id": null,
  "overall_health_score": 100,
  "category_scores": { "security": 85, "code_quality": 70, ... },
  "summary": {
    "total_issues": 0,
    "critical": 0,
    "major": 0,
    "minor": 0,
    "info": 0
  },
  "prioritized_issues": [ { "id", "title", "severity", "category", "file", "tool", "confidence", "evidence", ... } ],
  "quick_wins": [],
  "top_risks": [],
  "analysis_metadata": {
    "started_at": "ISO8601",
    "completed_at": "ISO8601",
    "duration_seconds": 0,
    "analyzers_run": [ "codeql", "security", "trufflehog", "semgrep", "lint", "performance", "iac", "accessibility", "maintainability", "frontend", "dimension", "codereviewer", "legacy_quality" ],
    "by_tool": { "pylint": 5, "security": 2, ... },
    "files_analyzed": 0,
    "lines_analyzed": 0
  },
  "dimension_results": { "security": { "analyzer": {}, "target": {}, "category_result": { "score": 0 }, "issues": [], "signals": [] }, ... },
  "raw_findings": []
}
```

---

## 5. Dimension Analyzer Result

**Used by:** `POST /api/analyze`, dimension analyzers, orchestrator dimension step.

```json
{
  "analyzer": { "key": "security", "label": "Security", "version": "1.0" },
  "target": {
    "repo_id": "unknown",
    "repo_full_name": "string",
    "repo_url": "string",
    "commit_sha": "string"
  },
  "category_result": { "score": 0, "not_applicable": false, "rationale": "" },
  "issues": [
    {
      "id": "string",
      "title": "string",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "category_key": "security|code_quality|...",
      "confidence": 0.5,
      "file_paths": [],
      "evidence": [],
      "impact": "",
      "recommendation": "",
      "effort": "S|M|L",
      "tags": []
    }
  ],
  "signals": [ { "key": "string", "label": "string", "value": 0, "unit": "none" } ]
}
```

**Supported analyzer keys:** `architecture`, `code_quality`, `security`, `performance`, `reliability`, `devops`, `observability`, `data`, `frontend`, `ai`.

---

## 6. Repo config (`.codebuster.yaml`)

Optional repo-level config; keys under `analyzers` override defaults (all default to `true`).

```yaml
analyzers:
  codeql: true
  security: true
  trufflehog: true
  semgrep: true
  lint: true
  performance: true
  iac: true
  accessibility: true
  maintainability: true
  frontend: true
  dimension: true
  codereviewer: true
  legacy_quality: false

app_url: "https://myapp.example.com"   # optional, for Lighthouse
```

---

## 7. Common Error Responses

- **401 Unauthorized**  
  `{ "error": "Unauthorized" }`

- **404 Not found**  
  `{ "error": "Repository not found" }` or `{ "error": "Review not found" }` etc.

- **400 Bad request**  
  `{ "error": "description" }` or `{ "error": "message", "troubleshooting": "..." }`

- **500 Server error**  
  `{ "error": "string" }`

- **503 Service unavailable**  
  `{ "error": "Scan failed and fallback unavailable.", "detail": "string" }`

---

## 8. Health Check

**GET `/health`**

```json
{
  "status": "ok",
  "timestamp": "ISO8601",
  "checks": [
    { "name": "database", "status": "ok" },
    { "name": "redis", "status": "ok" }
  ]
}
```

On failure, `status` may be `"degraded"` or `"error"` and checks include `"message"` where applicable.
