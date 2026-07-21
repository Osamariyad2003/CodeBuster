# CodeBuster Review Flow - CodeQL First, Then AI

## Overview
The review process has been updated to prioritize **CodeQL deep security analysis** before running other analyzers and AI reasoning. This ensures that critical security findings from CodeQL are given the highest priority and properly contextualized by AI.

## Review Flow Order

### Step 1: CodeQL Deep Security Analysis (FIRST)
- **When**: Runs first if repository context is available
- **What**: Fetches CodeQL alerts from GitHub's Code Scanning API
- **Why First**: CodeQL provides deep, semantic security analysis that should inform all subsequent analysis
- **Output**: High-confidence security findings with severity levels (critical, major, minor, info)

**Requirements**:
- Repository must have `installation_id` and `full_name` in context
- CodeQL must be enabled in repository configuration (default: enabled)
- GitHub App must have access to code scanning alerts

**Example Output**:
```
🔍 STEP 1: Running CodeQL deep security analysis FIRST...
✅ CodeQL found 5 security alerts
   📊 CodeQL breakdown: 2 critical, 2 major, 1 other
```

### Step 2: Additional Static Analyzers
After CodeQL completes, other analyzers run in parallel/sequence:
- **Security Analyzer**: Basic security checks (secrets, SQL injection, XSS)
- **Semgrep Analyzer**: Pattern-based security and quality rules
- **Lint Analyzer**: Code style and basic quality issues
- **IaC Analyzer**: Infrastructure-as-Code validation
- **Accessibility Analyzer**: Frontend accessibility checks
- **Code Quality Analyzer**: Legacy quality metrics (optional)

**Example Output**:
```
🔍 STEP 2: Running additional analyzers...
🔍 Running security analyzer...
   ✅ Security analyzer: 3 findings
🔍 Running semgrep analyzer...
   ✅ Semgrep analyzer: 7 findings
...
✅ Total findings from all analyzers: 15
```

### Step 3: Deduplication
- Merges duplicate findings from different tools
- Combines evidence from multiple sources
- Increases confidence when multiple tools agree

**Example Output**:
```
🔍 STEP 3: Deduplicating findings...
✅ After deduplication: 12 unique issues
```

### Step 4: AI Reasoning (After All Analyzers)
- **Input**: All findings (CodeQL + other analyzers), deduplicated
- **Process**: AI analyzes findings with special attention to CodeQL results
- **Output**: Prioritized issues, health scores, explanations, suggested fixes

**AI Prompt Enhancements**:
- CodeQL findings are marked as "HIGH PRIORITY" in the prompt
- AI is instructed to prioritize CodeQL findings
- CodeQL evidence is explicitly cited in AI explanations

**Example Output**:
```
🤖 STEP 4: Running AI reasoning on all findings (CodeQL + analyzers)...
✅ AI reasoning complete. Health score: 72
```

## Benefits of CodeQL-First Approach

1. **Security-First**: Critical security issues from CodeQL are surfaced immediately
2. **Better AI Context**: AI receives CodeQL findings first, allowing it to prioritize security
3. **Reduced False Positives**: CodeQL's deep analysis helps AI filter noise
4. **Comprehensive Coverage**: CodeQL catches complex vulnerabilities that static analyzers miss

## Configuration

### Enable/Disable CodeQL
In `.codebuster.yaml`:
```yaml
analyzers:
  codeql: true  # Default: true
  security: true
  semgrep: true
  lint: true
  iac: true
  accessibility: true
  legacy_quality: false
```

### Repository Context Requirements
For CodeQL to run, the repository context must include:
```python
{
    'installation_id': 123456,  # GitHub App installation ID
    'full_name': 'owner/repo',  # Repository full name
    'repo_id': 'uuid'           # Optional: internal repo ID
}
```

## Analysis Metadata

The review result includes metadata about the analysis order:
```json
{
  "analysis_metadata": {
    "analyzers_run": ["codeql", "security", "semgrep", "lint", "iac", "accessibility"],
    "analysis_order": "codeql_first_then_ai",
    "codeql_findings_count": 5,
    "files_analyzed": 42,
    "lines_analyzed": 1234
  }
}
```

## Troubleshooting

### CodeQL Not Running
- **Check**: Repository context includes `installation_id` and `full_name`
- **Check**: CodeQL is enabled in configuration (`codeql: true`)
- **Check**: GitHub App has `security-events: read` permission
- **Check**: Repository has CodeQL alerts available (run CodeQL workflow first)

### CodeQL Findings Not Prioritized
- **Check**: AI prompt includes CodeQL findings in the "HIGH PRIORITY" section
- **Check**: Findings have `tool: 'codeql'` in their metadata
- **Check**: AI service is receiving all findings (check logs)

### Performance Issues
- CodeQL API calls may add 1-3 seconds to review time
- If CodeQL is slow, consider caching results or running asynchronously
- Other analyzers run in parallel to minimize total time

## Example Review Timeline

```
00:00 - Start review
00:00 - Step 1: CodeQL analysis (2.5s)
00:02 - Step 2: Other analyzers (1.8s)
00:04 - Step 3: Deduplication (0.1s)
00:04 - Step 4: AI reasoning (3.2s)
00:07 - Complete review
```

Total: ~7 seconds for a typical PR review with CodeQL + AI
