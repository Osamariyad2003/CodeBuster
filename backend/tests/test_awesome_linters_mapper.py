"""Unit tests for AwesomeLintersMapper cross-referencing."""
import unittest


class TestAwesomeLintersMapper(unittest.TestCase):

    def _make_mapper(self):
        from backend.services.awesome_linters_mapper import AwesomeLintersMapper
        return AwesomeLintersMapper()

    def test_exact_rule_match_python(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('python:S3776')
        self.assertGreaterEqual(len(refs), 1)
        linter_names = [r['linter_name'] for r in refs]
        self.assertIn('pylint', linter_names)

    def test_exact_rule_match_returns_flake8(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('python:S3776')
        linter_names = [r['linter_name'] for r in refs]
        self.assertIn('flake8', linter_names)

    def test_exact_rule_match_javascript(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('javascript:S1481')
        self.assertEqual(len(refs), 1)
        self.assertEqual(refs[0]['linter_name'], 'eslint')
        self.assertEqual(refs[0]['linter_rule_id'], 'no-unused-vars')

    def test_exact_rule_match_java(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('java:S2077')
        self.assertEqual(len(refs), 1)
        self.assertEqual(refs[0]['linter_name'], 'spotbugs')

    def test_category_fallback_python_bug(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('python:S9999', issue_type='BUG', file_path='app.py')
        self.assertGreater(len(refs), 0)
        linter_names = [r['linter_name'] for r in refs]
        self.assertIn('pylint', linter_names)

    def test_category_fallback_js_vulnerability(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('javascript:SXXXX', issue_type='VULNERABILITY', file_path='index.js')
        self.assertGreater(len(refs), 0)
        linter_names = [r['linter_name'] for r in refs]
        self.assertIn('eslint-plugin-security', linter_names)

    def test_unknown_rule_no_match(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('unknown:XXXX')
        self.assertEqual(refs, [])

    def test_unknown_rule_with_unknown_file_no_match(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('unknown:XXXX', issue_type='BUG', file_path='file.xyz')
        self.assertEqual(refs, [])

    def test_detect_language_python(self):
        mapper = self._make_mapper()
        self.assertEqual(mapper._detect_language('src/app.py'), 'py')

    def test_detect_language_javascript(self):
        mapper = self._make_mapper()
        self.assertEqual(mapper._detect_language('src/app.js'), 'js')
        self.assertEqual(mapper._detect_language('src/app.tsx'), 'js')

    def test_detect_language_java(self):
        mapper = self._make_mapper()
        self.assertEqual(mapper._detect_language('App.java'), 'java')

    def test_detect_language_go(self):
        mapper = self._make_mapper()
        self.assertEqual(mapper._detect_language('main.go'), 'go')

    def test_detect_language_unknown(self):
        mapper = self._make_mapper()
        self.assertEqual(mapper._detect_language('file.xyz'), 'unknown')

    def test_security_rule_cross_reference(self):
        mapper = self._make_mapper()
        refs = mapper.get_linter_references('python:S2077')
        linter_names = [r['linter_name'] for r in refs]
        self.assertIn('bandit', linter_names)
        self.assertIn('semgrep', linter_names)

    def test_returns_copies_not_originals(self):
        """Ensure returned lists are copies so callers can modify safely."""
        mapper = self._make_mapper()
        refs1 = mapper.get_linter_references('python:S3776')
        refs2 = mapper.get_linter_references('python:S3776')
        self.assertIsNot(refs1, refs2)


if __name__ == '__main__':
    unittest.main()
