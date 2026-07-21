## CodeQL Deep Security Queries in CodeBuster

This repository now includes a basic setup for **CodeQL** to run deep security analysis on your code as part of GitHub Actions.

### 1. What was added

- `.github/workflows/codeql.yml`
  - Standard CodeQL analysis workflow.
  - Runs on:
    - `push` to `main`/`master`
    - `pull_request` to `main`/`master`
    - Weekly scheduled run.
  - Languages:
    - `javascript-typescript` (for frontend)
    - `python` (for backend)
  - Uses custom packs (if present):
    - `codeql-packs/codebuster-security-javascript-typescript/codeql-pack.yml`
    - `codeql-packs/codebuster-security-python/codeql-pack.yml`
  - Falls back to `security-extended` queries if packs are missing.

- `codeql-packs/codebuster-security-javascript-typescript/codeql-pack.yml`
  - Extends default JavaScript/TypeScript security and quality queries.
  - Designed to include any custom queries placed in `./queries`.

- `codeql-packs/codebuster-security-python/codeql-pack.yml`
  - Extends default Python security and quality queries.
  - Designed to include any custom queries placed in `./queries`.

> Note: This setup assumes you are using **GitHub's hosted CodeQL** via GitHub Actions (recommended). You do **not** need the CodeQL CLI locally to benefit from it.

---

### 2. How to enable CodeQL in your repo

1. **Push these files to GitHub**
   - `.github/workflows/codeql.yml`
   - `codeql-packs/**`

2. **Enable GitHub Actions**
   - Go to `Settings` → `Actions` → ensure Actions are allowed for this repo.

3. **(Optional) Restrict permissions**
   - Under `Settings` → `Actions` → `General`:
     - Set default permissions to:
       - `Read repository contents permission`
       - `Read and write permissions for GitHub Advanced Security` (if using advanced features).

4. **Trigger a run**
   - Push to `main` or open a PR targeting `main`.
   - Go to the `Actions` tab → `CodeQL Security Analysis` → see the run status.

---

### 3. Where to see results

- GitHub UI:
  - `Security` → `Code scanning` → `CodeQL` alerts.
  - From each alert, you can see:
    - File & line
    - Query details
    - Suggested remediation

- API (for future integration with CodeBuster backend):
  - `GET /repos/{owner}/{repo}/code-scanning/alerts`
  - `GET /repos/{owner}/{repo}/code-scanning/analyses`

You can later extend the backend to ingest these alerts and map them into CodeBuster's `Finding` format.

---

### 4. Adding custom CodeQL queries

For **JavaScript/TypeScript**:

1. Create directory:
   - `codeql-packs/codebuster-security-javascript-typescript/queries`

2. Add `.ql` files (e.g. `hardcoded-secrets.ql`).

3. Update `codeql-pack.yml` if you want to control inclusion more precisely (currently includes all queries in `./queries`).

For **Python**:

1. Create directory:
   - `codeql-packs/codebuster-security-python/queries`

2. Add `.ql` files and re-run CodeQL workflow.

---

### 5. How this fits into CodeBuster

- **Short term (already usable)**:
  - GitHub Actions runs CodeQL.
  - Developers see deep security findings in GitHub's Security tab.

- **Next step (backend integration idea)**:
  - Extend `backend/routes/github.py` or a new service to:
    - Call GitHub's code scanning API when a PR webhook arrives.
    - Transform CodeQL alerts into `Finding` objects.
    - Merge them with existing `SecurityAnalyzer` findings.
  - This will surface CodeQL findings inside the CodeBuster dashboard and PR comments alongside LLM explanations.

---

### 6. Security and performance notes

- **Least privilege**:
  - Workflow uses `security-events: write` and `contents: read` only.
- **Runtime**:
  - CodeQL analysis can be heavy on large repos; consider:
    - Restricting languages (if not needed).
    - Running on `pull_request` only.
    - Keeping the scheduled run weekly (not daily) for large codebases.

