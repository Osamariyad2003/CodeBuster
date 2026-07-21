"""Unit tests for ClaudeEnrichmentService."""
import json
import os
import unittest
from unittest.mock import patch, MagicMock


SAMPLE_FINDINGS = [
    {
        'id': 'sq-001',
        'severity': 'major',
        'category': 'code_smell',
        'module': 'code_quality',
        'title': 'String literal duplication',
        'description': 'Define a constant instead of duplicating this literal 3 times.',
        'file': 'src/app.py',
        'line': 10,
        'tool': 'sonarqube',
        'rule_id': 'python:S1192',
        'sonarqube_rule_key': 'python:S1192',
        'sonarqube_type': 'CODE_SMELL',
        'effort_minutes': 10,
        'suggested_fix': {'explanation': 'Extract to a constant.'},
    },
]

SAMPLE_LINTER_REFS = {
    'sq-001': [
        {'linter_name': 'pylint', 'linter_rule_id': 'R0801', 'linter_rule_desc': 'Duplicate code'},
    ],
}


class TestClaudeEnrichmentService(unittest.TestCase):

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''})
    def test_fallback_when_no_api_key(self):
        from backend.services.claude_enrichment_service import ClaudeEnrichmentService
        service = ClaudeEnrichmentService()
        result = service.enrich_findings(SAMPLE_FINDINGS, SAMPLE_LINTER_REFS)

        self.assertIn('issue_list', result)
        self.assertEqual(result['project'], 'codebuster')
        self.assertEqual(result['scan_source'], 'SonarQube + AwesomeLinters')
        self.assertEqual(len(result['issue_list']), 1)

        issue = result['issue_list'][0]
        self.assertEqual(issue['issue_id'], 'python:S1192')
        self.assertEqual(issue['severity'], 'Major')
        self.assertEqual(issue['file'], 'src/app.py')
        self.assertEqual(issue['line'], 10)
        self.assertEqual(len(issue['linters_reference']), 1)
        self.assertEqual(issue['linters_reference'][0]['linter_name'], 'pylint')

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''})
    def test_fallback_empty_findings(self):
        from backend.services.claude_enrichment_service import ClaudeEnrichmentService
        service = ClaudeEnrichmentService()
        result = service.enrich_findings([], {})
        self.assertEqual(result['issue_list'], [])

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''})
    def test_fallback_tags_for_vulnerability(self):
        from backend.services.claude_enrichment_service import ClaudeEnrichmentService
        service = ClaudeEnrichmentService()
        findings = [{
            'id': 'sq-002', 'severity': 'critical', 'category': 'vulnerability',
            'title': 'SQL Injection', 'description': 'SQL inj', 'file': 'api.py',
            'line': 5, 'rule_id': 'python:S2077', 'sonarqube_rule_key': 'python:S2077',
            'sonarqube_type': 'VULNERABILITY', 'effort_minutes': 30,
            'suggested_fix': {'explanation': 'Use parameterized queries.'},
        }]
        result = service.enrich_findings(findings, {'sq-002': []})
        self.assertIn('security', result['issue_list'][0]['tags'])

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'test-key'})
    def test_enrichment_with_mock_claude(self):
        from backend.services.claude_enrichment_service import ClaudeEnrichmentService

        mock_response_json = {
            'project': 'codebuster',
            'scan_source': 'SonarQube + AwesomeLinters',
            'issue_list': [{
                'issue_id': 'S1192', 'rule': 'String Duplication',
                'severity': 'Major', 'file': 'src/app.py', 'line': 10,
                'description': 'Duplicated string literal found.',
                'recommended_fix': 'Extract to a constant variable.',
                'effort_minutes': 10,
                'linters_reference': [
                    {'linter_name': 'pylint', 'linter_rule_id': 'R0801',
                     'linter_rule_desc': 'Duplicate code'}
                ],
                'tags': ['code-smell', 'style'],
            }],
        }

        service = ClaudeEnrichmentService()
        # Mock the client
        mock_client = MagicMock()
        mock_content = MagicMock()
        mock_content.text = json.dumps(mock_response_json)
        mock_client.messages.create.return_value = MagicMock(content=[mock_content])
        service.client = mock_client

        result = service.enrich_findings(SAMPLE_FINDINGS, SAMPLE_LINTER_REFS)
        self.assertEqual(result['project'], 'codebuster')
        self.assertEqual(len(result['issue_list']), 1)
        self.assertEqual(result['issue_list'][0]['effort_minutes'], 10)
        self.assertEqual(result['issue_list'][0]['rule'], 'String Duplication')

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'test-key'})
    def test_parse_strips_markdown_fences(self):
        from backend.services.claude_enrichment_service import ClaudeEnrichmentService
        service = ClaudeEnrichmentService()
        service.client = MagicMock()  # avoid actual API calls

        raw = '```json\n{"project":"x","scan_source":"y","issue_list":[]}\n```'
        result = service._parse_enriched_response(raw, [], {}, 'x')
        self.assertEqual(result['project'], 'x')
        self.assertEqual(result['issue_list'], [])

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'test-key'})
    def test_parse_handles_invalid_json(self):
        from backend.services.claude_enrichment_service import ClaudeEnrichmentService
        service = ClaudeEnrichmentService()
        service.client = MagicMock()

        result = service._parse_enriched_response('NOT JSON', SAMPLE_FINDINGS, SAMPLE_LINTER_REFS, 'codebuster')
        # Should fall back
        self.assertIn('issue_list', result)


if __name__ == '__main__':
    unittest.main()
