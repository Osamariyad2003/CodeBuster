"""Unit tests for SonarQubeService API client."""
import unittest
from unittest.mock import patch, MagicMock


class TestSonarQubeService(unittest.TestCase):

    def _make_service(self, base_url='http://test:9000', token='test-token'):
        from backend.services.sonarqube_service import SonarQubeService
        return SonarQubeService(base_url=base_url, token=token)

    @patch('backend.services.sonarqube_service.requests.get')
    def test_get_issues_returns_issues(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'issues': [
                {'key': 'AXyz', 'rule': 'python:S1192', 'severity': 'MAJOR',
                 'component': 'proj:src/app.py', 'line': 10, 'message': 'Dup string',
                 'type': 'CODE_SMELL', 'effort': '10min', 'tags': ['convention']},
            ],
            'total': 1, 'p': 1, 'ps': 500,
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        svc = self._make_service()
        issues = svc.get_issues('my_project')
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]['rule'], 'python:S1192')

    @patch('backend.services.sonarqube_service.requests.get')
    def test_get_issues_pagination(self, mock_get):
        """Two pages of results."""
        page1 = MagicMock()
        page1.json.return_value = {
            'issues': [{'key': f'A{i}'} for i in range(500)],
            'total': 600, 'p': 1, 'ps': 500,
        }
        page1.raise_for_status = MagicMock()

        page2 = MagicMock()
        page2.json.return_value = {
            'issues': [{'key': f'B{i}'} for i in range(100)],
            'total': 600, 'p': 2, 'ps': 500,
        }
        page2.raise_for_status = MagicMock()

        mock_get.side_effect = [page1, page2]
        svc = self._make_service()
        issues = svc.get_issues('my_project')
        self.assertEqual(len(issues), 600)

    @patch('backend.services.sonarqube_service.requests.get')
    def test_get_issues_handles_api_error(self, mock_get):
        import requests as req
        mock_get.side_effect = req.ConnectionError("refused")
        svc = self._make_service()
        issues = svc.get_issues('my_project')
        self.assertEqual(issues, [])

    @patch('backend.services.sonarqube_service.requests.get')
    def test_get_rule_details(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {'rule': {'key': 'python:S1192', 'name': 'String dup'}}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        svc = self._make_service()
        rule = svc.get_rule_details('python:S1192')
        self.assertEqual(rule['key'], 'python:S1192')

    @patch('backend.services.sonarqube_service.requests.get')
    def test_get_project_status(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {'projectStatus': {'status': 'OK'}}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        svc = self._make_service()
        status = svc.get_project_status('my_project')
        self.assertEqual(status['status'], 'OK')

    def test_auth_returns_tuple_when_token_set(self):
        svc = self._make_service(token='abc')
        self.assertEqual(svc._auth(), ('abc', ''))

    def test_auth_returns_none_when_no_token(self):
        svc = self._make_service(token='')
        self.assertIsNone(svc._auth())


if __name__ == '__main__':
    unittest.main()
