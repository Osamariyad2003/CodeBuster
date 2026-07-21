"""Claude AI enrichment service for SonarQube + Awesome-Linters review output.

Uses the Anthropic Claude API to enrich SonarQube findings cross-referenced
with Awesome-Linters into the standardized review response formula.
"""
import json
import os
from typing import Any, Dict, List, Optional


class ClaudeEnrichmentService:
    """Produces the SonarQube + AwesomeLinters enriched JSON via Claude AI."""

    def __init__(self):
        self.api_key = os.getenv('ANTHROPIC_API_KEY', '')
        self.model = os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')
        self.client = None
        if self.api_key:
            try:
                from anthropic import Anthropic
                self.client = Anthropic(api_key=self.api_key)
            except ImportError:
                print("anthropic package not installed; Claude enrichment will use fallback.")

    def enrich_findings(
        self,
        sonarqube_findings: List[Dict[str, Any]],
        linter_references: Dict[str, List[Dict[str, str]]],
        project_name: str = "codebuster",
        repository_context: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Enrich SonarQube findings with Claude AI, producing the standardized JSON output."""
        if not self.client:
            return self._fallback_enrichment(sonarqube_findings, linter_references, project_name)

        prompt = self._build_enrichment_prompt(
            sonarqube_findings, linter_references, project_name, repository_context
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="You are an expert code reviewer. Always respond with valid JSON only, no markdown.",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            content = response.content[0].text if response.content else "{}"
            return self._parse_enriched_response(content, sonarqube_findings, linter_references, project_name)

        except Exception as e:
            print(f"Claude enrichment failed: {e}")
            return self._fallback_enrichment(sonarqube_findings, linter_references, project_name)

    def _build_enrichment_prompt(
        self,
        findings: List[Dict],
        linter_refs: Dict[str, List[Dict]],
        project: str,
        repo_ctx: Optional[Dict],
    ) -> str:
        """Build the prompt for Claude to enrich and format findings."""
        findings_text = self._format_findings_for_prompt(findings, linter_refs)
        repo_info = ""
        if repo_ctx:
            repo_info = f"Repository: {repo_ctx.get('full_name', 'unknown')}, Branch: {repo_ctx.get('branch', 'unknown')}"

        return f"""I will send you static analysis results from SonarQube for a project named "{project}".
You have a reference list of rules from the Awesome-Linters repository on GitHub (https://github.com/caramelomartins/awesome-linters).

{repo_info}

Your task is to:

1. Match each SonarQube issue with any applicable Awesome-Linters rule(s) if they align logically.
2. For each issue, produce ONE JSON object with the following fields:

{{
  "issue_id": "the SonarQube rule ID (example: S2131)",
  "rule": "Short title of the rule / descriptive name",
  "severity": "Blocker | Critical | Major | Minor | Info",
  "file": "File path where the issue occurred",
  "line": numeric line number,
  "description": "Clear text description of the issue",
  "recommended_fix": "Detailed suggestion on how to fix it",
  "effort_minutes": estimated minutes to fix as integer,
  "linters_reference": [
    {{
      "linter_name": "Name of matching linter when possible",
      "linter_rule_id": "ID or key from Awesome-Linters for that rule",
      "linter_rule_desc": "Short text description from Awesome-Linters"
    }}
  ],
  "tags": ["bug", "security", "code-smell", "style", "complexity", "other"]
}}

3. If there is no direct match with an Awesome-Linters rule, set
   "linters_reference" to an empty array [].

4. For each issue, suggest a realistic "recommended_fix" as if you
   were a senior dev reviewer.

5. Output the FULL project result as a single JSON object:

{{
  "project": "{project}",
  "scan_source": "SonarQube + AwesomeLinters",
  "issue_list": [
    {{...}}, {{...}}, ...
  ]
}}

Do NOT add text outside of JSON. Do NOT provide explanations.

Here are the SonarQube results with their pre-matched Awesome-Linters references:

{findings_text}"""

    def _format_findings_for_prompt(
        self,
        findings: List[Dict],
        linter_refs: Dict[str, List[Dict]],
    ) -> str:
        """Format findings with their linter cross-references for the prompt."""
        lines = []
        for i, f in enumerate(findings, 1):
            finding_id = f.get('id', f'sq-{i}')
            refs = linter_refs.get(finding_id, [])
            refs_text = json.dumps(refs) if refs else "[]"
            lines.append(
                f"Issue {i}:\n"
                f"  Rule: {f.get('rule_id', f.get('sonarqube_rule_key', 'unknown'))}\n"
                f"  Severity: {f.get('severity', 'minor')}\n"
                f"  Type: {f.get('sonarqube_type', f.get('category', 'unknown'))}\n"
                f"  File: {f.get('file', 'unknown')}\n"
                f"  Line: {f.get('line', 0)}\n"
                f"  Message: {f.get('description', f.get('title', ''))}\n"
                f"  Effort: {f.get('effort_minutes', 0)} min\n"
                f"  Pre-matched linter refs: {refs_text}\n"
            )
        return "\n".join(lines)

    def _parse_enriched_response(
        self,
        raw_text: str,
        findings: List[Dict],
        linter_refs: Dict[str, List[Dict]],
        project: str,
    ) -> Dict[str, Any]:
        """Parse Claude's response and validate structure."""
        raw = raw_text.strip()
        # Strip markdown code fences if present
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[-1] if '\n' in raw else raw[3:]
            if raw.rstrip().endswith('```'):
                raw = raw.rstrip()[:-3].rstrip()
            if raw.startswith('json'):
                raw = raw[4:].lstrip()

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            print("Failed to parse Claude response as JSON, using fallback.")
            return self._fallback_enrichment(findings, linter_refs, project)

        # Validate required top-level keys
        if 'issue_list' not in result:
            result['issue_list'] = []
        if 'project' not in result:
            result['project'] = project
        if 'scan_source' not in result:
            result['scan_source'] = 'SonarQube + AwesomeLinters'

        return result

    def _fallback_enrichment(
        self,
        findings: List[Dict],
        linter_refs: Dict[str, List[Dict]],
        project: str,
    ) -> Dict[str, Any]:
        """Deterministic enrichment when Claude is unavailable."""
        severity_map = {
            'critical': 'Critical',
            'major': 'Major',
            'minor': 'Minor',
            'info': 'Info',
        }

        type_to_tags = {
            'vulnerability': ['security'],
            'security_hotspot': ['security'],
            'bug': ['bug'],
            'code_smell': ['code-smell'],
        }

        issue_list = []
        for f in findings:
            finding_id = f.get('id', '')
            refs = linter_refs.get(finding_id, [])
            category = f.get('category', f.get('sonarqube_type', '')).lower()

            issue_list.append({
                'issue_id': f.get('rule_id', f.get('sonarqube_rule_key', finding_id)),
                'rule': f.get('title', f.get('description', 'Unknown rule')),
                'severity': severity_map.get(f.get('severity', 'minor'), 'Minor'),
                'file': f.get('file', ''),
                'line': f.get('line', 0),
                'description': f.get('description', f.get('title', '')),
                'recommended_fix': f.get('suggested_fix', {}).get('explanation', 'Review and fix per rule guidance.'),
                'effort_minutes': f.get('effort_minutes', 5),
                'linters_reference': refs,
                'tags': type_to_tags.get(category, ['other']),
            })

        return {
            'project': project,
            'scan_source': 'SonarQube + AwesomeLinters',
            'issue_list': issue_list,
        }
