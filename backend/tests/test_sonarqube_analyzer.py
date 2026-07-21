"""Unit tests for SonarQubeAnalyzer finding transformation."""
import unittest


class TestSonarQubeAnalyzer(unittest.TestCase):

    def _make_analyzer(self):
        from backend.services.sonarqube_analyzer import SonarQubeAnalyzer
        return SonarQubeAnalyzer(project_key='test')

    def test_severity_mapping_blocker(self):
        analyzer = self._make_analyzer()
        issue = {
            'key': 'AX1', 'severity': 'BLOCKER', 'rule': 'python:S2077',
            'component': 'proj:src/api.py', 'line': 42,
            'message': 'SQL injection', 'type': 'VULNERABILITY',
            'effort': '30min', 'tags': ['cwe', 'owasp-a1'],
        }
        finding = analyzer._transform_issue(issue)
        self.assertEqual(finding['severity'], 'critical')
        self.assertEqual(finding['module'], 'security')
        self.assertEqual(finding['tool'], 'sonarqube')

    def test_severity_mapping_critical(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'CRITICAL',
                                              'rule': 'r', 'component': 'c',
                                              'line': 1, 'message': 'm', 'type': 'BUG',
                                              'effort': '', 'tags': []})
        self.assertEqual(finding['severity'], 'critical')

    def test_severity_mapping_major(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'MAJOR',
                                              'rule': 'r', 'component': 'c',
                                              'line': 1, 'message': 'm', 'type': 'CODE_SMELL',
                                              'effort': '', 'tags': []})
        self.assertEqual(finding['severity'], 'major')
        self.assertEqual(finding['module'], 'code_quality')

    def test_severity_mapping_minor(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'MINOR',
                                              'rule': 'r', 'component': 'c',
                                              'line': 1, 'message': 'm', 'type': 'CODE_SMELL',
                                              'effort': '', 'tags': []})
        self.assertEqual(finding['severity'], 'minor')

    def test_severity_mapping_info(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'INFO',
                                              'rule': 'r', 'component': 'c',
                                              'line': 1, 'message': 'm', 'type': 'CODE_SMELL',
                                              'effort': '', 'tags': []})
        self.assertEqual(finding['severity'], 'info')

    def test_file_extraction_from_component(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'MINOR',
                                              'rule': 'r', 'component': 'myproj:src/main.py',
                                              'line': 5, 'message': 'm', 'type': 'BUG',
                                              'effort': '', 'tags': []})
        self.assertEqual(finding['file'], 'src/main.py')

    def test_effort_parsing_minutes_only(self):
        analyzer = self._make_analyzer()
        self.assertEqual(analyzer._parse_effort('10min'), 10)

    def test_effort_parsing_hours_and_minutes(self):
        analyzer = self._make_analyzer()
        self.assertEqual(analyzer._parse_effort('1h30min'), 90)

    def test_effort_parsing_hours_only(self):
        analyzer = self._make_analyzer()
        self.assertEqual(analyzer._parse_effort('2h'), 120)

    def test_effort_parsing_empty(self):
        analyzer = self._make_analyzer()
        self.assertEqual(analyzer._parse_effort(''), 0)

    def test_security_hotspot_maps_to_security(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'MAJOR',
                                              'rule': 'r', 'component': 'c',
                                              'line': 1, 'message': 'm',
                                              'type': 'SECURITY_HOTSPOT',
                                              'effort': '', 'tags': []})
        self.assertEqual(finding['module'], 'security')

    def test_sonarqube_metadata_preserved(self):
        analyzer = self._make_analyzer()
        finding = analyzer._transform_issue({'key': 'X', 'severity': 'MINOR',
                                              'rule': 'python:S1192',
                                              'component': 'proj:app.py',
                                              'line': 1, 'message': 'm',
                                              'type': 'CODE_SMELL',
                                              'effort': '5min', 'tags': []})
        self.assertEqual(finding['sonarqube_rule_key'], 'python:S1192')
        self.assertEqual(finding['sonarqube_type'], 'CODE_SMELL')
        self.assertEqual(finding['effort_minutes'], 5)

    def test_analyze_returns_empty_when_no_key(self):
        from backend.services.sonarqube_analyzer import SonarQubeAnalyzer
        analyzer = SonarQubeAnalyzer(project_key=None)
        self.assertEqual(analyzer.analyze(project_key=None), [])


if __name__ == '__main__':
    unittest.main()
