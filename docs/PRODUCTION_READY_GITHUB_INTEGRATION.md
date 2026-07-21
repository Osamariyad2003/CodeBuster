# Production-Ready GitHub Integration Design

## 1. Tool Initialization Registry

In a production environment, tools should be initialized lazily to avoid unnecessary startup overhead and to ensure that transient failures in one service don't crash the entire application.

### Required Tools & Services

| Tool | Purpose | Initialization Timing |
| :--- | :--- | :--- |
| **GitHub App** | Principal identity for API access and webhooks. | Initialized on first API request. |
| **Redis Cache** | Caching Installation Access Tokens (IATs) and idempotency keys. | Initialized at startup (connection pool). |
| **PostgreSQL** | Source of truth for repo metadata, analysis results, and user settings. | Initialized at startup (connection pool). |
| **Secrets Manager** | Secure storage for Private Keys and Webhook Secrets. | Initialized once at startup to populate initial config. |
| **Celery Worker** | Background processing for expensive code analysis tasks. | Initialized at startup; scales horizontally. |
| **Octokit/API Client** | Wrapper for GitHub REST/GraphQL APIs. | Initialized per-task context with appropriate IAT. |

### Lazy Initialization Pattern

We use a "Provider" pattern to manage these tools:

```python
class ToolProvider:
    _github_client = None
    _db_pool = None

    @classmethod
    def get_github_client(cls, installation_id: str):
        # Lazy initialization of the client for a specific installation
        token = GitHubAuthService.get_token(installation_id)
        return GitHubClient(token)

    @classmethod
    def get_db(cls):
        if not cls._db_pool:
            cls._db_pool = create_engine(settings.DATABASE_URL)
        return cls._db_pool
```

---

## 2. Authorization & Authentication

### GitHub App Workflow
CodeBuster uses **GitHub App-based authentication**, which provides fine-grained permissions and better security than personal access tokens or OAuth.

#### Flow Diagram
1. **App Identity**: Private Key (stored in Secrets Manager) -> **JWT** (Signed locally, valid for 10 mins).
2. **Access Scopes**: JWT -> Call `POST /app/installations/{id}/access_tokens`.
3. **Resource Access**: GitHub returns an **Installation Access Token (IAT)** (Valid for 1 hour).
4. **Caching**: IAT is cached in Redis with a TTL slightly shorter than its expiry (e.g., 55 mins).

#### Required Permissions (Least Privilege)
- `metadata:read`: Basic repo info.
- `pull_requests:write`: Post comments and summaries.
- `contents:read`: Read source code for analysis.
- `checks:write`: Update GitHub Check Runs.
- `security_events:read`: **CRITICAL** - Required to fetch CodeQL analysis results.

---

## 3. CodeQL Compatibility & Augmentation

CodeBuster is designed to **augment** CodeQL by providing high-level reasoning that static analysis engines typically miss.

### Consumption of CodeQL Results
Instead of re-running static analysis, CodeBuster fetches CodeQL alerts via the GitHub API:
- Endpoint: `GET /repos/{owner}/{repo}/code-scanning/alerts`
- We filter for `tool.name: 'CodeQL'`.
- Status: `open` or `fixed` (to verify remediation).

### Unique Insights (Augmentation)
| Category | What CodeBuster Adds |
| :--- | :--- |
| **Logic Flaws** | Detection of business logic errors (e.g., missing authorization checks on specific business routes) that generic rules miss. |
| **Architectural Risks** | Identification of circular dependencies, layer violations, and "hot-file" clusters with high complexity. |
| **PR Context** | A natural language summary of the PR's intent and high-level risk profile for reviewers. |
| IaC Security | Static analysis for **Terraform**, **Kubernetes**, and **Dockerfiles** using **Checkov** and **Hadolint** patterns to prevent infrastructure misconfigurations. |
| Maintainability | **Code Coverage** analysis via **Cobertura**, **OpenClover (clover.xml)**, and **JaCoCo (jacoco.xml)**, providing unified visibility into untested logic. |
| **Frontend Audits**| Implementation of **Chrome DevTools** insights (Network blocking, Layout Thrashing, Memory Hotspots) and **Lighthouse** scores for Performance, Accessibility, and SEO. |
| **Secrets (TruffleHog)**| Integration with **TruffleHog V3** for 800+ secret detectors with active verification support, augmenting CodeQL's base secret scanning. |
| **Remediation** | LLM-generated code fixes that are context-aware (CodeQL only points at the problem). |

---

## 4. Secure Event Flow

### Full Lifecycle
1. **Installation**: GitHub App installed/updated. Webhook syncs metadata.
2. **PR Event**: Webhook received (`pull_request.opened`).
3. **Verification**: Verify `X-Hub-Signature-256` using the App's Secret.
4. **Idempotency**: Check `X-GitHub-Delivery` against Redis to prevent double-processing.
5. **Fetch Status**: Check if CodeQL Action is running. Wait for completion or poll.
6. **Aggregate**: Fetch CodeQL results + Run CodeBuster internal analyzers.
7. **Reasoning**: LLM processes all findings + repository context.
8. **Feedback**: 
    - Update Check Run to `success`/`failure`.
    - Post a single consolidated summary comment to the PR.
    - Add inline comments for high-severity logic flaws.

---

## 5. Production Security Standards

1. **No Inline Secrets**: All keys (Private Key, Webhook Secret) are fetched via environment variables or a secure Secrets Manager (AWS/GCP).
2. **Webhook Verification**: Every inbound request MUST be verified against the SHA256 HMAC signature.
3. **Restricted Scopes**: Never request `admin` or `delete` permissions.
4. **Error Masking**: Production API responses never leak stack traces.
5. **Rate Limiting**: Tiered rate limiting (IP-based + Repository-based) to prevent DoS.

---

## 6. Security Decisions & Tradeoffs

### Decision: Caching IATs in Redis
- **Security Logic**: Fetching a new token for every API call increases load on GitHub and delays response.
- **Tradeoff**: If the Redis instance is compromised, an attacker gains active tokens valid for up to 60 minutes.
- **Mitigation**: Redis is configured with TLS and is not accessible from the public internet. Tokens are never logged.

### Decision: Read-Only Scopes Where Possible
- **Security Logic**: By default, we request `contents:read` but NOT `contents:write`.
- **Tradeoff**: We cannot automatically "autofix" code by pushing to the branch directly.
- **Mitigation**: We use `pull_requests:write` to suggest fixes via PR comments (Standard Reviewer pattern), which requires human approval.

### Decision: Webhook Verification (HMAC-SHA256)
- **Security Logic**: Prevents spoofing of events from malicious actors claiming to be GitHub.
- **Tradeoff**: Adds a small computational overhead to every inbound request.
- **Decision**: Mandatory for production. No "skip verification" flag exists in the codebase.

### Decision: JWT Offset for Clock Skew
- **Security Logic**: Servers often have slight clock drifts (< 60s).
- **Technique**: We set `iat` to `now - 60s`.
- **Tradeoff**: Increases the window of validity for a stolen JWT by 1 minute, but prevents valid requests from failing due to sync issues.

