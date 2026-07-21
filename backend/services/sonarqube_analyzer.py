"""SonarQube analyzer - fetches issues and transforms to CodeBuster finding format."""
from typing import Dict, List, Any, Optional

from .sonarqube_service import SonarQubeService


SEVERITY_MAP = {
    'BLOCKER': 'critical',
    'CRITICAL': 'critical',
    'MAJOR': 'major',
    'MINOR': 'minor',
    'INFO': 'info',
}

TYPE_TO_MODULE = {
    'BUG': 'code_quality',
    'VULNERABILITY': 'security',
    'CODE_SMELL': 'code_quality',
    'SECURITY_HOTSPOT': 'security',
}


class SonarQubeAnalyzer:
    """Analyzer that integrates results from SonarQube."""

    def __init__(self, project_key: str = None):
        self.service = SonarQubeService()
        self.project_key = project_key

    def analyze(self, project_key: str = None, branch: str = None) -> List[Dict[str, Any]]:
        """Fetch SonarQube issues and transform to CodeBuster finding format."""
        key = project_key or self.project_key
        if not key:
            return []

        issues = self.service.get_issues(key, branch=branch)
        return [self._transform_issue(issue) for issue in issues]

    def _transform_issue(self, issue: Dict[str, Any]) -> Dict[str, Any]:
        """Map a SonarQube issue to a CodeBuster finding dict."""
        severity = SEVERITY_MAP.get(issue.get('severity', 'MINOR'), 'minor')
        issue_type = issue.get('type', 'CODE_SMELL')
        module = TYPE_TO_MODULE.get(issue_type, 'code_quality')

        # Extract file path from component (format: project:path/to/file.py)
        component = issue.get('component', '')
        file_path = component.split(':', 1)[-1] if ':' in component else component

        rule_key = issue.get('rule', '')
        effort = issue.get('effort', '0min')
        effort_minutes = self._parse_effort(effort)

        return {
            'id': issue.get('key', ''),
            'module': module,
            'severity': severity,
            'category': issue_type.lower(),
            'title': issue.get('message', 'SonarQube Issue'),
            'description': issue.get('message', ''),
            'file': file_path,
            'line': issue.get('line', 0),
            'code_snippet': '',
            'tool': 'sonarqube',
            'confidence': 0.85,
            'evidence': [
                f"Rule: {rule_key}",
                f"Type: {issue_type}",
                f"SonarQube severity: {issue.get('severity', 'unknown')}",
            ],
            'suggested_fix': {
                'code': '',
                'explanation': f"Review SonarQube rule {rule_key} for remediation guidance.",
                'safety_score': 0.7,
                'automated': False,
            },
            'references': issue.get('tags', []),
            'rule_id': rule_key,
            'sonarqube_rule_key': rule_key,
            'sonarqube_type': issue_type,
            'effort_minutes': effort_minutes,
        }

    def _parse_effort(self, effort: str) -> int:
        """Parse SonarQube effort string (e.g. '10min', '1h30min') to minutes."""
        if not effort:
            return 0
        minutes = 0
        effort = effort.strip()
        if 'h' in effort:
            parts = effort.split('h')
            try:
                minutes += int(parts[0].strip()) * 60
            except ValueError:
                pass
            effort = parts[1] if len(parts) > 1 else ''
        if 'min' in effort:
            try:
                minutes += int(effort.replace('min', '').strip())
            except ValueError:
                pass
        return minutes
