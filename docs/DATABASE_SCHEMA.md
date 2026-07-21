# CodeBuster - Database Schema Design

## Overview

PostgreSQL database schema for CodeBuster. All tables use UUID primary keys and include `created_at` and `updated_at` timestamps.

---

## Core Tables

### 1. users

Stores user accounts (GitHub OAuth).

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id INTEGER UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    access_token_encrypted TEXT,  -- Encrypted GitHub token
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_username ON users(username);
```

### 2. repositories

Stores connected GitHub repositories.

```sql
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(512) NOT NULL UNIQUE,
    github_repo_id INTEGER UNIQUE,
    description TEXT,
    language VARCHAR(100),
    is_private BOOLEAN DEFAULT FALSE,
    default_branch VARCHAR(255),
    webhook_secret_encrypted TEXT,
    installation_id INTEGER,  -- GitHub App installation ID
    config JSONB,  -- Repository-specific configuration (.codebuster.yml)
    status VARCHAR(50) DEFAULT 'active',  -- active, paused, disconnected
    connected_by UUID REFERENCES users(id),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_repos_full_name ON repositories(full_name);
CREATE INDEX idx_repos_owner ON repositories(owner);
CREATE INDEX idx_repos_status ON repositories(status);
CREATE INDEX idx_repos_config ON repositories USING GIN(config);
```

### 3. reviews

Stores analysis reviews (one per PR or manual analysis).

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    pr_number INTEGER,  -- NULL for manual reviews
    commit_sha VARCHAR(40),
    branch VARCHAR(255),
    trigger_type VARCHAR(50) NOT NULL,  -- webhook, manual, scheduled
    status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed
    overall_health_score INTEGER,  -- 0-100
    category_scores JSONB,  -- {security: 85, performance: 90, ...}
    findings_count JSONB,  -- {critical: 2, major: 5, minor: 10}
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB,  -- Additional metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_repo_id ON reviews(repository_id);
CREATE INDEX idx_reviews_pr_number ON reviews(repository_id, pr_number);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_commit_sha ON reviews(commit_sha);

-- Partition by month for large-scale deployments
-- CREATE TABLE reviews_2024_01 PARTITION OF reviews
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 4. issues

Stores individual findings/issues from analyzers.

```sql
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,  -- security, performance, code_quality, etc.
    severity VARCHAR(20) NOT NULL,  -- critical, major, minor, info
    category VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    column_number INTEGER,
    code_snippet TEXT,
    tool VARCHAR(100),  -- bandit, eslint, semgrep, etc.
    confidence DECIMAL(3,2) DEFAULT 0.5,  -- 0.00-1.00
    evidence JSONB,  -- Array of evidence strings
    suggested_fix TEXT,
    references JSONB,  -- CWE, OWASP, etc.
    metadata JSONB,  -- Tool-specific metadata
    ai_explanation TEXT,  -- LLM-generated explanation
    priority_score INTEGER,  -- ML-predicted priority (0-100)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_issues_review_id ON issues(review_id);
CREATE INDEX idx_issues_severity ON issues(severity);
CREATE INDEX idx_issues_module ON issues(module);
CREATE INDEX idx_issues_file_path ON issues(file_path);
CREATE INDEX idx_issues_confidence ON issues(confidence DESC);
CREATE INDEX idx_issues_priority_score ON issues(priority_score DESC);
```

### 5. feedback

Stores user feedback on issues (accept/dismiss/resolve).

```sql
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL,  -- accept, dismiss, resolve, ignore
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_issue_id ON feedback(issue_id);
CREATE INDEX idx_feedback_review_id ON feedback(review_id);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_action ON feedback(action);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
```

### 6. inline_comments

Stores inline comments posted to GitHub PRs.

```sql
CREATE TABLE inline_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    github_comment_id INTEGER,  -- GitHub API comment ID
    file_path TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    body TEXT NOT NULL,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inline_comments_review_id ON inline_comments(review_id);
CREATE INDEX idx_inline_comments_issue_id ON inline_comments(issue_id);
CREATE INDEX idx_inline_comments_github_id ON inline_comments(github_comment_id);
```

---

## ML & Training Tables

### 7. ml_training_data

Stores training examples for ML models.

```sql
CREATE TABLE ml_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Input features (serialized)
    finding_features JSONB NOT NULL,
    code_context JSONB,
    repository_metadata JSONB,
    
    -- Labels
    priority_label VARCHAR(20),  -- critical, major, minor, info
    acceptance_label BOOLEAN,  -- True if accepted, False if dismissed
    user_feedback_action VARCHAR(20),  -- accept, dismiss, resolve, ignore
    
    -- Metadata
    reviewer_id UUID REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_for_training BOOLEAN DEFAULT FALSE,
    training_run_id UUID  -- Link to training run
);

CREATE INDEX idx_ml_data_repo_id ON ml_training_data(repository_id);
CREATE INDEX idx_ml_data_issue_id ON ml_training_data(issue_id);
CREATE INDEX idx_ml_data_training_run ON ml_training_data(training_run_id);
CREATE INDEX idx_ml_data_used_for_training ON ml_training_data(used_for_training);
```

### 8. ml_models

Stores ML model metadata and versions.

```sql
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type VARCHAR(50) NOT NULL,  -- priority_classifier, acceptance_predictor, style_classifier
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,  -- NULL for global models
    version VARCHAR(50) NOT NULL,
    model_path TEXT NOT NULL,  -- S3 path or local path
    training_run_id UUID,
    
    -- Metrics
    accuracy DECIMAL(5,4),
    precision DECIMAL(5,4),
    recall DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    auc_roc DECIMAL(5,4),
    metrics JSONB,  -- Additional metrics
    
    -- Training info
    training_samples INTEGER,
    validation_samples INTEGER,
    training_duration_seconds INTEGER,
    hyperparameters JSONB,
    
    -- Status
    status VARCHAR(50) DEFAULT 'training',  -- training, active, deprecated
    is_production BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ml_models_type ON ml_models(model_type);
CREATE INDEX idx_ml_models_repo_id ON ml_models(repository_id);
CREATE INDEX idx_ml_models_status ON ml_models(status);
CREATE INDEX idx_ml_models_production ON ml_models(is_production) WHERE is_production = TRUE;
```

### 9. ml_training_runs

Stores training run metadata.

```sql
CREATE TABLE ml_training_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type VARCHAR(50) NOT NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'running',  -- running, completed, failed
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    metrics JSONB,
    config JSONB,  -- Training configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_runs_status ON ml_training_runs(status);
CREATE INDEX idx_training_runs_repo_id ON ml_training_runs(repository_id);
```

---

## RAG & Vector Store Tables

### 10. rag_documents

Stores documents indexed in vector DB (metadata only, actual vectors in ChromaDB/Pinecone).

```sql
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,  -- readme, style_guide, past_pr, issue, preference
    title VARCHAR(500),
    content_hash VARCHAR(64) NOT NULL,  -- SHA256 hash of content
    vector_id VARCHAR(255),  -- ID in vector DB (ChromaDB/Pinecone)
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rag_docs_repo_id ON rag_documents(repository_id);
CREATE INDEX idx_rag_docs_type ON rag_documents(document_type);
CREATE INDEX idx_rag_docs_vector_id ON rag_documents(vector_id);
```

---

## Job Queue Tables

### 11. analysis_jobs

Stores analysis job status (Celery tasks).

```sql
CREATE TABLE analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    celery_task_id VARCHAR(255) UNIQUE,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
    job_type VARCHAR(50) NOT NULL,  -- webhook, manual, scheduled
    status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed, retrying
    priority INTEGER DEFAULT 5,  -- 1-10, higher = more priority
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_status ON analysis_jobs(status);
CREATE INDEX idx_jobs_repo_id ON analysis_jobs(repository_id);
CREATE INDEX idx_jobs_priority ON analysis_jobs(priority DESC, created_at ASC);
CREATE INDEX idx_jobs_celery_task_id ON analysis_jobs(celery_task_id);
```

---

## Analytics & Stats Tables

### 12. repository_stats

Stores aggregated statistics per repository.

```sql
CREATE TABLE repository_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Review stats
    total_reviews INTEGER DEFAULT 0,
    completed_reviews INTEGER DEFAULT 0,
    failed_reviews INTEGER DEFAULT 0,
    avg_health_score DECIMAL(5,2),
    
    -- Issue stats
    total_issues INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    major_issues INTEGER DEFAULT 0,
    minor_issues INTEGER DEFAULT 0,
    
    -- Feedback stats
    accepted_issues INTEGER DEFAULT 0,
    dismissed_issues INTEGER DEFAULT 0,
    resolved_issues INTEGER DEFAULT 0,
    
    -- Performance
    avg_analysis_duration_seconds INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repository_id, date)
);

CREATE INDEX idx_repo_stats_repo_id ON repository_stats(repository_id);
CREATE INDEX idx_repo_stats_date ON repository_stats(date DESC);
```

### 13. user_activity

Stores user activity logs (optional, for analytics).

```sql
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,  -- login, view_dashboard, submit_feedback, etc.
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_repo_id ON user_activity(repository_id);
CREATE INDEX idx_user_activity_action ON user_activity(action);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);
```

---

## Views

### 14. review_summary_view

Convenience view for dashboard queries.

```sql
CREATE VIEW review_summary_view AS
SELECT
    r.id,
    r.repository_id,
    r.pr_number,
    r.commit_sha,
    r.overall_health_score,
    r.category_scores,
    r.status,
    r.completed_at,
    COUNT(i.id) as total_issues,
    COUNT(CASE WHEN i.severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN i.severity = 'major' THEN 1 END) as major_count,
    COUNT(CASE WHEN i.severity = 'minor' THEN 1 END) as minor_count,
    AVG(i.confidence) as avg_confidence
FROM reviews r
LEFT JOIN issues i ON r.id = i.review_id
GROUP BY r.id, r.repository_id, r.pr_number, r.commit_sha, r.overall_health_score, r.category_scores, r.status, r.completed_at;
```

### 15. issue_feedback_summary_view

Aggregated feedback per issue.

```sql
CREATE VIEW issue_feedback_summary_view AS
SELECT
    i.id as issue_id,
    i.review_id,
    i.severity,
    i.module,
    COUNT(f.id) as total_feedback,
    COUNT(CASE WHEN f.action = 'accept' THEN 1 END) as accept_count,
    COUNT(CASE WHEN f.action = 'dismiss' THEN 1 END) as dismiss_count,
    COUNT(CASE WHEN f.action = 'resolve' THEN 1 END) as resolve_count,
    MAX(f.created_at) as last_feedback_at
FROM issues i
LEFT JOIN feedback f ON i.id = f.issue_id
GROUP BY i.id, i.review_id, i.severity, i.module;
```

---

## Functions & Triggers

### Update timestamp trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at BEFORE UPDATE ON repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (apply to other tables)
```

### Health score calculation function

```sql
CREATE OR REPLACE FUNCTION calculate_health_score(review_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    critical_count INTEGER;
    major_count INTEGER;
    minor_count INTEGER;
    score INTEGER;
BEGIN
    SELECT
        COUNT(CASE WHEN severity = 'critical' THEN 1 END),
        COUNT(CASE WHEN severity = 'major' THEN 1 END),
        COUNT(CASE WHEN severity = 'minor' THEN 1 END)
    INTO critical_count, major_count, minor_count
    FROM issues
    WHERE review_id = review_uuid;
    
    -- Scoring formula: 100 - (critical*10 + major*5 + minor*1)
    score := 100 - (critical_count * 10 + major_count * 5 + minor_count * 1);
    
    RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;
```

---

## Indexes Summary

- **Primary keys**: All tables use UUID primary keys
- **Foreign keys**: Indexed for join performance
- **Query patterns**: Indexes on frequently queried columns (status, created_at, severity)
- **JSONB columns**: GIN indexes for JSON queries
- **Composite indexes**: For common query patterns (repo_id + pr_number)

---

## Migration Strategy

1. **Initial migration**: Create all tables
2. **Partitioning**: Add partitioning for large tables (reviews, issues) as needed
3. **Indexes**: Add indexes incrementally based on query performance
4. **Backwards compatibility**: Use ALTER TABLE for schema changes, never DROP

---

## Backup & Recovery

- **Daily backups**: Full database backup
- **Point-in-time recovery**: WAL archiving enabled
- **Replication**: Read replicas for scaling
- **Data retention**: 
  - Reviews: 1 year (then archive)
  - Training data: Indefinite
  - Activity logs: 90 days

