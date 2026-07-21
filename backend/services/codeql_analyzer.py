from typing import List, Dict, Any, Optional
from .codeql_service import CodeQLService

class CodeQLAnalyzer:
    """Analyzer that integrates results from GitHub CodeQL."""
    
    def __init__(self, installation_id: str):
        self.service = CodeQLService(installation_id)
        
    def analyze(self, repo_full_name: str, ref: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch CodeQL alerts and transform them into Findings.
        """
        if not repo_full_name:
            return []
            
        alerts = self.service.get_alerts(repo_full_name, state="open", ref=ref)
        findings = []
        
        for alert in alerts:
            findings.append(self._transform_alert_to_finding(alert))
            
        return findings
        
    def _transform_alert_to_finding(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Map a GitHub CodeQL alert to a CodeBuster Finding."""
        
        # Map GitHub severity to standard levels
        severity_map = {
            'critical': 'critical',
            'high': 'major',
            'medium': 'minor',
            'low': 'info',
            'warning': 'minor',
            'error': 'major',
            'note': 'info'
        }
        
        rule = alert.get('rule', {})
        most_recent_instance = alert.get('most_recent_instance', {})
        location = most_recent_instance.get('location', {})
        
        severity = severity_map.get(rule.get('security_severity_level', '').lower(), 
                                 severity_map.get(alert.get('state', '').lower(), 'minor'))
        
        finding = {
            'module': 'security',
            'severity': severity,
            'category': 'codeql_vulnerability',
            'title': rule.get('description', 'CodeQL Vulnerability'),
            'description': alert.get('tool', {}).get('name', 'CodeQL') + ": " + rule.get('full_description', rule.get('description', '')),
            'file': location.get('path', 'unknown'),
            'line': location.get('start_line', 0),
            'code_snippet': f"Check GitHub for details: {alert.get('html_url')}",
            'tool': 'codeql',
            'confidence': 0.9, # CodeQL is high confidence
            'evidence': [
                f"Rule ID: {rule.get('id')}",
                f"Tool: {alert.get('tool', {}).get('name')}",
                f"GitHub URL: {alert.get('html_url')}"
            ],
            'suggested_fix': {
                'code': "# Recommendation from CodeQL",
                'explanation': rule.get('help', 'See GitHub alert for remediation steps.'),
                'safety_score': 0.8,
                'automated': False
            },
            'references': [rule.get('id')] + rule.get('tags', [])
        }
        
        # If there are CWE tags, add them to references
        tags = rule.get('tags', [])
        for tag in tags:
            if tag.startswith('external/cwe/'):
                finding['references'].append(tag.replace('external/cwe/', 'CWE-'))
                
        return finding
