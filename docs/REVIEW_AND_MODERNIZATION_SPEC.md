# CodeBuster Review & Modernization Specification

## 1. REVIEW OUTPUT

### 1.1 Executive Summary
CodeBuster is a **prototype** with strong architectural documentation but significant implementation gaps. It is **NOT** production-ready in its current state.
**Strengths:**
1.  **Documentation**: `ARCHITECTURE.md` provides a clear, scalable vision.
2.  **Frontend Structure**: Clean React codebase with good component separation.
3.  **CI/CD**: Existing workflows and custom CodeQL packs show advanced thinking.

**Risks:**
1.  **CRITICAL SECURITY**: GitHub Access Tokens are stored in plaintext (`backend/models/user.py`).
2.  **CRITICAL SECURITY**: Flask Debug Mode is enabled in production (`backend/main.py`).
3.  **Reliability**: Authentication flow is broken (Backend redirects HTML, Frontend expects JSON).
4.  **Scalability**: Critical reliance on SQLite (`codebuster.db`) prevents concurrent usage.
5.  **Integrity**: Security analyzers rely on simple Regex instead of robust CLI tools (Bandit/Semgrep).

### 1.2 Category Scores
| Category | Score | Weight | Rationale |
| :--- | :--- | :--- | :--- |
| **Architecture** | 40 | 15% | High-quality docs but monolithic prototype implementation. |
| **Code Quality** | 60 | 10% | Readable code but lacks strict typing and uses poor logging. |
| **Security** | 20 | 20% | Critical vulnerabilities (Plaintext tokens, Debug mode). |
| **Performance** | 30 | 10% | SQLite bottlenecks and sequential analyzer execution. |
| **Reliability** | 40 | 15% | Broken auth flow, single point of failure (SQLite). |
| **DevOps** | 30 | 10% | CI/CD exists but missing production Docker setup. |
| **Observability** | 20 | 8% | Heavy reliance on `print()` debugging; no structured logs. |
| **Data** | 30 | 7% | SQLite is inappropriate for production; schema is minimal. |
| **Frontend** | 75 | 3% | Clean React structure; good component usage. |
| **AI** | 20 | 2% | Rudimentary prompt construction; missing RAG implementation. |

**Overall Score**: **34/100 (Grade: F)**

### 1.3 Top Issues
1.  **ISSUE-001** (Critical, Security): **Plaintext GitHub Tokens** in DB.
    *   *Evidence*: `access_token_encrypted = db.Column(db.Text)` comment says "In production, encrypt this".
    *   *Recommendation*: Implement Fernet/AES encryption before saving.
2.  **ISSUE-002** (Critical, Security): **Debug Mode Enabled**.
    *   *Evidence*: `app.run(debug=True)` in `main.py`.
    *   *Recommendation*: Set `debug=False` via env var.
3.  **ISSUE-003** (High, Architecture): **SQLite Database**.
    *   *Evidence*: `DATABASE_URL` default in `config_loader.py`.
    *   *Recommendation*: UI migration to PostgreSQL.
4.  **ISSUE-004** (High, Reliability): **Broken Auth Flow**.
    *   *Evidence*: Backend returns 302 Redirect; Frontend `apiClient` expects JSON.
    *   *Recommendation*: Backend must return JSON with token.
5.  **ISSUE-005** (High, Security): **Weak Analyzer Implementation**.
    *   *Evidence*: `security_analyzer.py` uses simple Regex patterns.
    *   *Recommendation*: Integrate Bandit/Semgrep CLI tools.
6.  **ISSUE-006** (Medium, Performance): **Sequential Processing**.
    *   *Evidence*: `ReviewOrchestrator` calls analyzers one-by-one.
    *   *Recommendation*: Refactor to Async Celery tasks.
7.  **ISSUE-007** (Medium, DevOps): **No Production Dockerfile**.
    *   *Recommendation*: Create multi-stage Dockerfile.
8.  **ISSUE-008** (Low, Observability): **Unstructured Logging**.
    *   *Recommendation*: Replace `print()` with `structlog`.

### 1.4 STRICT JSON PAYLOAD

```json
{
  "project": {
    "name": "CodeBuster",
    "repo_url": "unknown",
    "version_or_commit": "unknown",
    "review_timestamp_utc": "2026-02-09T17:51:07Z"
  },
  "scores": {
    "overall_score": 34,
    "overall_grade": "F",
    "production_readiness": "no",
    "categories": [
      {
        "key": "architecture",
        "label": "Architecture",
        "score": 40,
        "weight": 0.15,
        "not_applicable": false,
        "rationale": "High-quality docs but monolithic prototype implementation."
      },
      {
        "key": "code_quality",
        "label": "Code Quality",
        "score": 60,
        "weight": 0.10,
        "not_applicable": false,
        "rationale": "Readable code but lacks strict typing and uses poor logging."
      },
      {
        "key": "security",
        "label": "Security",
        "score": 20,
        "weight": 0.20,
        "not_applicable": false,
        "rationale": "Critical vulnerabilities (Plaintext tokens, Debug mode)."
      },
      {
        "key": "performance",
        "label": "Performance",
        "score": 30,
        "weight": 0.10,
        "not_applicable": false,
        "rationale": "SQLite bottlenecks and sequential analyzer execution."
      },
      {
        "key": "reliability",
        "label": "Reliability",
        "score": 40,
        "weight": 0.15,
        "not_applicable": false,
        "rationale": "Broken auth flow, single point of failure (SQLite)."
      },
      {
        "key": "devops",
        "label": "DevOps",
        "score": 30,
        "weight": 0.10,
        "not_applicable": false,
        "rationale": "CI/CD exists but missing production Docker setup."
      },
      {
        "key": "observability",
        "label": "Observability",
        "score": 20,
        "weight": 0.08,
        "not_applicable": false,
        "rationale": "Heavy reliance on print debugging."
      },
      {
        "key": "data",
        "label": "Data",
        "score": 30,
        "weight": 0.07,
        "not_applicable": false,
        "rationale": "SQLite inappropriate for production."
      },
      {
        "key": "frontend",
        "label": "Frontend",
        "score": 75,
        "weight": 0.03,
        "not_applicable": false,
        "rationale": "Clean React structure."
      },
      {
        "key": "ai",
        "label": "AI",
        "score": 20,
        "weight": 0.02,
        "not_applicable": false,
        "rationale": "Rudimentary prompt construction."
      }
    ]
  },
  "issues": [
    {
      "id": "ISSUE-001",
      "title": "Plaintext GitHub Tokens",
      "severity": "CRITICAL",
      "category_key": "security",
      "confidence": 1.0,
      "file_paths": ["backend/models/user.py"],
      "evidence": ["access_token_encrypted field is not encrypted"],
      "impact": "Full repo access compromise if DB leak occurs.",
      "recommendation": "Encrypt tokens using AES/Fernet.",
      "effort": "M",
      "tags": ["security", "auth"]
    },
    {
      "id": "ISSUE-002",
      "title": "Debug Mode Enabled",
      "severity": "CRITICAL",
      "category_key": "security",
      "confidence": 1.0,
      "file_paths": ["backend/main.py"],
      "evidence": ["app.run(debug=True)"],
      "impact": "RCE vulnerability via Werkzeug debugger.",
      "recommendation": "Disable debug mode in production.",
      "effort": "S",
      "tags": ["security", "config"]
    },
    {
      "id": "ISSUE-003",
      "title": "SQLite Database",
      "severity": "HIGH",
      "category_key": "architecture",
      "confidence": 1.0,
      "file_paths": ["backend/utils/config_loader.py"],
      "evidence": ["DATABASE_URL defaults to sqlite"],
      "impact": "Concurrency failures during webhook spikes.",
      "recommendation": "Migrate to PostgreSQL.",
      "effort": "M",
      "tags": ["architecture", "database"]
    }
  ],
  "fix_first": [
    {
      "title": "Disable Debug Mode",
      "why": "Prevent RCE",
      "owner_hint": "backend",
      "effort": "S",
      "related_issue_ids": ["ISSUE-002"]
    },
    {
      "title": "Encrypt Tokens",
      "why": "Prevent credential leak",
      "owner_hint": "backend",
      "effort": "M",
      "related_issue_ids": ["ISSUE-001"]
    }
  ],
  "ui_hints": {
    "badges": [
      { "label": "Security Critical", "type": "danger" },
      { "label": "Grade F", "type": "danger" }
    ],
    "charts": [
      {
        "type": "radar",
        "title": "Category Scores",
        "data": [
          { "label": "Security", "value": 20 },
          { "label": "Reliability", "value": 40 },
          { "label": "Architecture", "value": 40 }
        ]
      }
    ]
  }
}
```

---

## 2. BACKEND API CONTRACT (FastAPI)

### Overview
- **Base URL**: `/api/v1`
- **Auth**: `Authorization: Bearer <jwt_token>` (Valid `sub` claim required)

### Endpoints

| Method | Path | Purpose | Request Body | Response Body | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/reviews` | Submit new review | `ReviewCreate` | `{"review_id": "uuid", "stored": true}` | 201 |
| **GET** | `/reviews` | List reviews | - | `List[ReviewSummary]` | 200 |
| **GET** | `/reviews/{id}` | Get review details | - | `ReviewDetail` | 200 |
| **GET** | `/reviews/{id}/issues` | Get issues | - | `List[Issue]` | 200 |
| **GET** | `/projects/{id}/latest` | Get latest review | - | `ReviewSummary` | 200 |
| **GET** | `/health` | Health check | - | `{"status": "ok"}` | 200 |

### Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
from uuid import UUID

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class CategoryKey(str, Enum):
    ARCHITECTURE = "architecture"
    SECURITY = "security"
    # ... other categories

class ProjectInfo(BaseModel):
    name: str
    repo_url: Optional[str] = None
    version_or_commit: Optional[str] = None
    review_timestamp_utc: datetime

class CategoryScore(BaseModel):
    key: CategoryKey
    label: str
    score: int = Field(ge=0, le=100)
    weight: float
    not_applicable: bool = False
    rationale: Optional[str] = None

class Issue(BaseModel):
    id: str
    title: str
    severity: Severity
    category_key: CategoryKey
    confidence: float = Field(ge=0.0, le=1.0)
    file_paths: List[str] = []
    evidence: List[str] = []
    impact: Optional[str] = None
    recommendation: Optional[str] = None
    effort: Optional[str] = None
    tags: List[str] = []

class ScoreSummary(BaseModel):
    overall_score: int
    overall_grade: str
    production_readiness: str
    categories: List[CategoryScore]

class ReviewCreate(BaseModel):
    project: ProjectInfo
    scores: ScoreSummary
    issues: List[Issue]
    fix_first: List[Dict] = []
    ui_hints: Dict = {}

class ReviewSummary(BaseModel):
    review_id: UUID
    project_name: str
    commit: Optional[str]
    score: int
    grade: str
    timestamp: datetime
```

---

## 3. DATABASE SCHEMA (PostgreSQL)

```sql
-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    repo_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review Runs Table
CREATE TABLE review_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    commit_hash VARCHAR(40),
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    overall_grade VARCHAR(2),
    production_readiness VARCHAR(20),
    review_timestamp_utc TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category Scores Table
CREATE TABLE category_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_run_id UUID REFERENCES review_runs(id) ON DELETE CASCADE,
    category_key VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    rationale TEXT,
    UNIQUE(review_run_id, category_key)
);

-- Issues Table
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_run_id UUID REFERENCES review_runs(id) ON DELETE CASCADE,
    issue_code VARCHAR(50) NOT NULL, -- e.g., ISSUE-001
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- CRITICAL, HIGH...
    category_key VARCHAR(50) NOT NULL,
    confidence FLOAT,
    impact TEXT,
    recommendation TEXT,
    effort VARCHAR(10),
    file_paths JSONB, -- Store list of files
    evidence JSONB,   -- Store list of evidence strings
    tags JSONB
);

-- Indexes
CREATE INDEX idx_reviews_project_id ON review_runs(project_id);
CREATE INDEX idx_reviews_timestamp ON review_runs(review_timestamp_utc DESC);
CREATE INDEX idx_issues_review_id ON issues(review_run_id);
CREATE INDEX idx_issues_severity ON issues(severity);
```

---

## 4. FRONTEND UI SPECIFICATION

### Pages

1.  **Dashboard (`/dashboard`)**
    *   **Components**:
        *   `HealthScoreCard`: Displays `overall_score` & Grade with circular progress.
        *   `CategoryRadarChart`: Radar chart of `category_scores`.
        *   `TopIssuesList`: Filtered list of CRITICAL/HIGH issues.
        *   `FixFirstWidget`: Checklist from `fix_first` data.
    *   **Data Fetching**: `useQuery(['latestReview', projectId], fetchLatestReview)`

2.  **Review Detail (`/reviews/:id`)**
    *   **Components**:
        *   `ReviewHeader`: Meta info (commit, time).
        *   `ScoreBreakdown`: Table of category scores with rationales.
        *   `IssueTable`: Sortable/Filterable table of all issues.
    *   **Data Fetching**: `useQuery(['review', id], fetchReviewById)`

### Components

*   **`IssueCard`**:
    *   Props: `issue` (Object)
    *   UI: Colored left border based on severity (Red=Critical).
    *   Collapsible "Evidence" section.
    *   "File Paths" as clickable links (to code viewer).

*   **`ConfidenceBadge`**:
    *   Props: `score` (0.0-1.0)
    *   UI: Green (>0.8), Yellow (>0.5), Red (<0.5).

---

## 5. EXAMPLE PAYLOADS

### 5.1 Request: `POST /reviews`

```json
{
  "project": {
    "name": "CodeBuster",
    "version_or_commit": "a1b2c3d",
    "review_timestamp_utc": "2026-02-09T17:51:07Z"
  },
  "scores": {
    "overall_score": 34,
    "overall_grade": "F",
    "production_readiness": "no",
    "categories": [
      {
        "key": "security",
        "label": "Security",
        "score": 20,
        "weight": 0.2,
        "rationale": "Critical tokens exposed."
      }
    ]
  },
  "issues": [
    {
      "id": "ISSUE-001",
      "title": "Plaintext Tokens",
      "severity": "CRITICAL",
      "category_key": "security",
      "confidence": 1.0,
      "file_paths": ["backend/models/user.py"],
      "evidence": ["access_token_encrypted field is plain text"],
      "impact": "Data leak risk.",
      "recommendation": "Encrypt with Fernet.",
      "effort": "M",
      "tags": ["security"]
    }
  ]
}
```
