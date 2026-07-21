# CodeBuster - Output Schemas & Sample JSON

## Overview

All AI outputs must be valid JSON conforming to these schemas. The system produces structured outputs for reviews, health scores, issues, and suggested fixes.

---

## 1. Review Output Schema

### 1.1 Complete Review Response

```json
{
  "review_id": "550e8400-e29b-41d4-a716-446655440000",
  "repository": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "full_name": "owner/repo",
    "owner": "owner",
    "name": "repo"
  },
  "pr": {
    "number": 123,
    "title": "Add user authentication",
    "branch": "feature/auth",
    "commit_sha": "abc123def456..."
  },
  "status": "completed",
  "overall_health_score": 75,
  "category_scores": {
    "security": 85,
    "performance": 70,
    "code_quality": 80,
    "maintainability": 75,
    "devops": 90,
    "frontend": 65
  },
  "summary": {
    "total_issues": 15,
    "critical": 1,
    "major": 4,
    "minor": 10,
    "info": 0
  },
  "prioritized_issues": [
    {
      "id": "issue-001",
      "severity": "critical",
      "category": "security",
      "module": "security",
      "title": "SQL Injection Vulnerability",
      "description": "User input is directly concatenated into SQL query without parameterization, allowing potential SQL injection attacks.",
      "file": "src/api/users.py",
      "line": 42,
      "column": 15,
      "code_snippet": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
      "tool": "bandit",
      "confidence": 0.95,
      "evidence": [
        "Bandit detected SQL injection at line 42",
        "User input 'user_id' is used in f-string SQL query",
        "No parameterization or sanitization detected"
      ],
      "suggested_fix": {
        "code": "query = \"SELECT * FROM users WHERE id = %s\"\nparams = (user_id,)\ncursor.execute(query, params)",
        "explanation": "Use parameterized queries to prevent SQL injection. Replace f-string with parameterized query using %s placeholder.",
        "safety_score": 0.98,
        "automated": true
      },
      "references": [
        "CWE-89",
        "OWASP-A03:2021"
      ],
      "related_issues": ["issue-002"],
      "priority_score": 95
    }
  ],
  "quick_wins": [
    {
      "issue_id": "issue-003",
      "title": "Remove unused import",
      "effort": "low",
      "impact": "minor"
    }
  ],
  "top_risks": [
    {
      "issue_id": "issue-001",
      "title": "SQL Injection Vulnerability",
      "risk_level": "critical",
      "explanation": "This vulnerability could allow attackers to execute arbitrary SQL commands, potentially leading to data breach."
    }
  ],
  "analysis_metadata": {
    "started_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:32:45Z",
    "duration_seconds": 165,
    "analyzers_run": [
      "security",
      "code_quality",
      "performance",
      "maintainability",
      "devops"
    ],
    "files_analyzed": 45,
    "lines_analyzed": 5234
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### 1.2 Schema Definition (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["review_id", "overall_health_score", "prioritized_issues"],
  "properties": {
    "review_id": {"type": "string", "format": "uuid"},
    "repository": {
      "type": "object",
      "required": ["full_name"],
      "properties": {
        "id": {"type": "string", "format": "uuid"},
        "full_name": {"type": "string"},
        "owner": {"type": "string"},
        "name": {"type": "string"}
      }
    },
    "pr": {
      "type": "object",
      "properties": {
        "number": {"type": "integer"},
        "title": {"type": "string"},
        "branch": {"type": "string"},
        "commit_sha": {"type": "string"}
      }
    },
    "status": {
      "type": "string",
      "enum": ["pending", "running", "completed", "failed"]
    },
    "overall_health_score": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100
    },
    "category_scores": {
      "type": "object",
      "properties": {
        "security": {"type": "integer", "minimum": 0, "maximum": 100},
        "performance": {"type": "integer", "minimum": 0, "maximum": 100},
        "code_quality": {"type": "integer", "minimum": 0, "maximum": 100},
        "maintainability": {"type": "integer", "minimum": 0, "maximum": 100},
        "devops": {"type": "integer", "minimum": 0, "maximum": 100},
        "frontend": {"type": "integer", "minimum": 0, "maximum": 100}
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_issues": {"type": "integer", "minimum": 0},
        "critical": {"type": "integer", "minimum": 0},
        "major": {"type": "integer", "minimum": 0},
        "minor": {"type": "integer", "minimum": 0},
        "info": {"type": "integer", "minimum": 0}
      }
    },
    "prioritized_issues": {
      "type": "array",
      "items": {"$ref": "#/definitions/Issue"}
    },
    "quick_wins": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "issue_id": {"type": "string"},
          "title": {"type": "string"},
          "effort": {"type": "string", "enum": ["low", "medium", "high"]},
          "impact": {"type": "string", "enum": ["low", "medium", "high"]}
        }
      }
    },
    "top_risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "issue_id": {"type": "string"},
          "title": {"type": "string"},
          "risk_level": {"type": "string", "enum": ["critical", "major", "minor"]},
          "explanation": {"type": "string"}
        }
      }
    },
    "definitions": {
      "Issue": {
        "type": "object",
        "required": ["id", "severity", "title", "confidence"],
        "properties": {
          "id": {"type": "string"},
          "severity": {"type": "string", "enum": ["critical", "major", "minor", "info"]},
          "category": {"type": "string"},
          "module": {"type": "string"},
          "title": {"type": "string"},
          "description": {"type": "string"},
          "file": {"type": "string"},
          "line": {"type": "integer"},
          "column": {"type": "integer"},
          "code_snippet": {"type": "string"},
          "tool": {"type": "string"},
          "confidence": {"type": "number", "minimum": 0, "maximum": 1},
          "evidence": {
            "type": "array",
            "items": {"type": "string"}
          },
          "suggested_fix": {"$ref": "#/definitions/SuggestedFix"},
          "references": {
            "type": "array",
            "items": {"type": "string"}
          },
          "related_issues": {
            "type": "array",
            "items": {"type": "string"}
          },
          "priority_score": {"type": "integer", "minimum": 0, "maximum": 100}
        }
      },
      "SuggestedFix": {
        "type": "object",
        "properties": {
          "code": {"type": "string"},
          "explanation": {"type": "string"},
          "safety_score": {"type": "number", "minimum": 0, "maximum": 1},
          "automated": {"type": "boolean"}
        }
      }
    }
  }
}
```

---

## 2. Issue Schema

### 2.1 Individual Issue

```json
{
  "id": "issue-001",
  "review_id": "550e8400-e29b-41d4-a716-446655440000",
  "module": "security",
  "severity": "critical",
  "category": "sql_injection",
  "title": "SQL Injection Vulnerability",
  "description": "User input is directly concatenated into SQL query without parameterization, allowing potential SQL injection attacks. This is a critical security vulnerability that could lead to data breach.",
  "file": "src/api/users.py",
  "line": 42,
  "column": 15,
  "code_snippet": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
  "tool": "bandit",
  "confidence": 0.95,
  "evidence": [
    "Bandit detected SQL injection at line 42",
    "User input 'user_id' is used in f-string SQL query",
    "No parameterization or sanitization detected",
    "Similar issue was fixed in PR #89"
  ],
  "suggested_fix": {
    "code": "query = \"SELECT * FROM users WHERE id = %s\"\nparams = (user_id,)\ncursor.execute(query, params)",
    "explanation": "Use parameterized queries to prevent SQL injection. Replace f-string with parameterized query using %s placeholder.",
    "safety_score": 0.98,
    "automated": true,
    "diff": "@@ -42,1 +42,3 @@\n-query = f\"SELECT * FROM users WHERE id = {user_id}\"\n+query = \"SELECT * FROM users WHERE id = %s\"\n+params = (user_id,)\n+cursor.execute(query, params)"
  },
  "references": [
    "CWE-89",
    "OWASP-A03:2021"
  ],
  "related_issues": ["issue-002"],
  "priority_score": 95,
  "metadata": {
    "detected_by": ["bandit", "semgrep"],
    "similar_issues_count": 3,
    "first_seen": "2024-01-10T08:00:00Z"
  }
}
```

---

## 3. Health Score Response

### 3.1 Repository Health Score

```json
{
  "repository_id": "660e8400-e29b-41d4-a716-446655440000",
  "repository_full_name": "owner/repo",
  "overall_health_score": 75,
  "category_scores": {
    "security": {
      "score": 85,
      "trend": "improving",
      "change": 5,
      "issues_count": {
        "critical": 0,
        "major": 2,
        "minor": 5
      }
    },
    "performance": {
      "score": 70,
      "trend": "stable",
      "change": 0,
      "issues_count": {
        "critical": 1,
        "major": 3,
        "minor": 8
      }
    },
    "code_quality": {
      "score": 80,
      "trend": "improving",
      "change": 3,
      "issues_count": {
        "critical": 0,
        "major": 1,
        "minor": 12
      }
    },
    "maintainability": {
      "score": 75,
      "trend": "stable",
      "change": 0,
      "issues_count": {
        "critical": 0,
        "major": 2,
        "minor": 10
      }
    },
    "devops": {
      "score": 90,
      "trend": "improving",
      "change": 2,
      "issues_count": {
        "critical": 0,
        "major": 0,
        "minor": 3
      }
    },
    "frontend": {
      "score": 65,
      "trend": "declining",
      "change": -5,
      "issues_count": {
        "critical": 0,
        "major": 4,
        "minor": 15
      }
    }
  },
  "trends": {
    "last_7_days": [72, 73, 74, 75, 75, 75, 75],
    "last_30_days": [70, 71, 72, 73, 74, 75],
    "last_90_days": [65, 68, 70, 72, 74, 75]
  },
  "last_review": {
    "review_id": "550e8400-e29b-41d4-a716-446655440000",
    "pr_number": 123,
    "commit_sha": "abc123def456...",
    "completed_at": "2024-01-15T10:32:45Z"
  },
  "generated_at": "2024-01-15T11:00:00Z"
}
```

---

## 4. Frontend DevTools Output

### 4.1 DevTools Analysis Result

```json
{
  "review_id": "550e8400-e29b-41d4-a716-446655440000",
  "app_url": "https://staging.example.com",
  "lighthouse": {
    "performance": {
      "score": 72,
      "metrics": {
        "first_contentful_paint": 1.2,
        "largest_contentful_paint": 2.5,
        "total_blocking_time": 300,
        "cumulative_layout_shift": 0.1,
        "speed_index": 3.2
      }
    },
    "accessibility": {
      "score": 85,
      "issues": [
        {
          "id": "color-contrast",
          "title": "Background and foreground colors do not have sufficient contrast ratio",
          "severity": "minor"
        }
      ]
    },
    "best_practices": {
      "score": 90,
      "issues": []
    },
    "seo": {
      "score": 88,
      "issues": []
    }
  },
  "network": {
    "total_requests": 45,
    "total_size_bytes": 2048576,
    "total_time_ms": 1250,
    "slow_requests": [
      {
        "url": "https://api.example.com/users",
        "duration_ms": 450,
        "size_bytes": 102400,
        "type": "xhr"
      }
    ],
    "large_resources": [
      {
        "url": "https://cdn.example.com/bundle.js",
        "size_bytes": 512000,
        "type": "script"
      }
    ],
    "blocking_requests": [
      {
        "url": "https://fonts.googleapis.com/css",
        "duration_ms": 200,
        "type": "css"
      }
    ]
  },
  "memory": {
    "heap_size_mb": 45.2,
    "used_heap_size_mb": 32.1,
    "heap_size_limit_mb": 2048,
    "potential_leaks": [
      {
        "type": "event_listener",
        "count": 15,
        "description": "Multiple event listeners not removed"
      }
    ]
  },
  "performance_timeline": {
    "long_tasks": [
      {
        "start_time": 1000,
        "duration": 65,
        "name": "script evaluation",
        "file": "bundle.js"
      }
    ],
    "slow_interactions": [
      {
        "type": "click",
        "duration": 120,
        "target": "button.submit"
      }
    ],
    "excessive_re_renders": [
      {
        "component": "UserList",
        "render_count": 15,
        "duration_ms": 45
      }
    ]
  },
  "storage": {
    "localStorage": {
      "total_size_kb": 45.2,
      "keys": ["user_prefs", "theme"],
      "issues": []
    },
    "sessionStorage": {
      "total_size_kb": 12.5,
      "keys": ["session_id"],
      "issues": []
    },
    "indexedDB": {
      "databases": [
        {
          "name": "user_cache",
          "size_mb": 2.5,
          "object_stores": ["users", "posts"]
        }
      ],
      "issues": []
    }
  },
  "issues": [
    {
      "id": "frontend-001",
      "severity": "major",
      "category": "performance",
      "title": "Large JavaScript Bundle",
      "description": "bundle.js is 512KB, exceeding recommended 200KB threshold. Consider code splitting.",
      "file": "bundle.js",
      "suggested_fix": {
        "code": "// Use dynamic imports for route-based code splitting\nconst Dashboard = lazy(() => import('./Dashboard'));",
        "explanation": "Implement route-based code splitting to reduce initial bundle size.",
        "automated": false
      }
    }
  ]
}
```

---

## 5. Inline Comment Format (GitHub PR)

### 5.1 GitHub PR Comment Body

```markdown
## 🔴 Critical: SQL Injection Vulnerability

**File**: `src/api/users.py:42`

**Issue**: User input is directly concatenated into SQL query without parameterization.

**Code**:
```python
query = f"SELECT * FROM users WHERE id = {user_id}"
```

**Evidence**:
- Bandit detected SQL injection at line 42
- User input 'user_id' is used in f-string SQL query
- No parameterization or sanitization detected

**Suggested Fix**:
```python
query = "SELECT * FROM users WHERE id = %s"
params = (user_id,)
cursor.execute(query, params)
```

**References**: CWE-89, OWASP-A03:2021

**Confidence**: 95%

---
*Generated by CodeBuster AI Review*
```

### 5.2 GitHub API Comment Payload

```json
{
  "body": "## 🔴 Critical: SQL Injection Vulnerability\n\n...",
  "commit_id": "abc123def456...",
  "path": "src/api/users.py",
  "line": 42,
  "side": "RIGHT"
}
```

---

## 6. Analytics/Stats Output

### 6.1 Repository Analytics

```json
{
  "repository_id": "660e8400-e29b-41d4-a716-446655440000",
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "overview": {
    "total_reviews": 45,
    "completed_reviews": 43,
    "failed_reviews": 2,
    "avg_health_score": 75.5,
    "health_score_trend": "improving"
  },
  "issues_by_severity": {
    "critical": 5,
    "major": 23,
    "minor": 156,
    "info": 45
  },
  "issues_by_category": {
    "security": 12,
    "performance": 28,
    "code_quality": 89,
    "maintainability": 45,
    "devops": 8,
    "frontend": 15
  },
  "feedback_stats": {
    "total_feedback": 120,
    "accepted": 85,
    "dismissed": 25,
    "resolved": 10,
    "acceptance_rate": 0.71
  },
  "top_issues": [
    {
      "issue_id": "issue-001",
      "title": "SQL Injection Vulnerability",
      "occurrences": 5,
      "severity": "critical"
    }
  ],
  "improvements": [
    {
      "category": "security",
      "improvement": 15,
      "description": "Security score improved from 70 to 85"
    }
  ]
}
```

---

## 7. Error Response Schema

### 7.1 Error Response

```json
{
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "Analysis failed due to timeout",
    "details": "The security analyzer exceeded the 5-minute timeout limit.",
    "review_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

### 7.2 Error Codes

- `ANALYSIS_FAILED`: Analysis job failed
- `TIMEOUT`: Analysis exceeded time limit
- `INVALID_INPUT`: Invalid input data
- `REPOSITORY_NOT_FOUND`: Repository not found
- `UNAUTHORIZED`: Authentication required
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INTERNAL_ERROR`: Internal server error

---

## 8. Validation

All outputs are validated against JSON schemas using `jsonschema` library:

```python
import jsonschema

def validate_review_output(output: dict) -> bool:
    """Validate review output against schema."""
    schema = load_json_schema('review_output_schema.json')
    try:
        jsonschema.validate(instance=output, schema=schema)
        return True
    except jsonschema.ValidationError as e:
        logger.error(f"Schema validation failed: {e}")
        return False
```

---

## 9. Sample Complete Review (Real-World Example)

```json
{
  "review_id": "550e8400-e29b-41d4-a716-446655440000",
  "repository": {
    "full_name": "acme/webapp"
  },
  "pr": {
    "number": 456,
    "title": "Add payment processing",
    "commit_sha": "def789abc123"
  },
  "status": "completed",
  "overall_health_score": 68,
  "category_scores": {
    "security": 60,
    "performance": 75,
    "code_quality": 70,
    "maintainability": 65,
    "devops": 80,
    "frontend": 55
  },
  "summary": {
    "total_issues": 23,
    "critical": 2,
    "major": 8,
    "minor": 13
  },
  "prioritized_issues": [
    {
      "id": "issue-001",
      "severity": "critical",
      "category": "security",
      "title": "Hardcoded API Key",
      "description": "API key is hardcoded in source code. This is a critical security vulnerability.",
      "file": "src/payment/processor.py",
      "line": 15,
      "code_snippet": "API_KEY = 'sk_live_1234567890abcdef'",
      "tool": "trufflehog",
      "confidence": 0.99,
      "evidence": [
        "TruffleHog detected API key pattern",
        "Key appears to be a Stripe live key",
        "No environment variable usage detected"
      ],
      "suggested_fix": {
        "code": "API_KEY = os.getenv('STRIPE_API_KEY')",
        "explanation": "Move API key to environment variable for security.",
        "safety_score": 1.0,
        "automated": true
      },
      "priority_score": 100
    },
    {
      "id": "issue-002",
      "severity": "major",
      "category": "performance",
      "title": "N+1 Query Pattern",
      "description": "Database queries are executed in a loop, causing N+1 query problem.",
      "file": "src/payment/processor.py",
      "line": 89,
      "code_snippet": "for order in orders:\n    user = get_user(order.user_id)",
      "tool": "static_analysis",
      "confidence": 0.85,
      "evidence": [
        "Query executed inside loop",
        "Could fetch all users in single query"
      ],
      "suggested_fix": {
        "code": "user_ids = [o.user_id for o in orders]\nusers = get_users_bulk(user_ids)\nuser_map = {u.id: u for u in users}",
        "explanation": "Batch queries to reduce database round trips.",
        "safety_score": 0.95,
        "automated": false
      },
      "priority_score": 75
    }
  ],
  "quick_wins": [
    {
      "issue_id": "issue-015",
      "title": "Remove unused import",
      "effort": "low",
      "impact": "minor"
    }
  ],
  "top_risks": [
    {
      "issue_id": "issue-001",
      "title": "Hardcoded API Key",
      "risk_level": "critical",
      "explanation": "Exposed API key could lead to unauthorized access and financial loss."
    }
  ]
}
```

