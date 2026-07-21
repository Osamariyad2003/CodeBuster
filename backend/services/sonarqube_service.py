"""SonarQube API client for fetching issues, rules, and project status."""
import os
from typing import Dict, List, Optional, Any

import requests


class SonarQubeService:
    """Client for the SonarQube Web API."""

    def __init__(self, base_url: str = None, token: str = None):
        self.base_url = (base_url or os.getenv('SONARQUBE_URL', 'http://sonarqube:9000')).rstrip('/')
        self.token = token or os.getenv('SONARQUBE_TOKEN', '')

    def _auth(self) -> tuple:
        """SonarQube authenticates via token as Basic auth username, empty password."""
        if self.token:
            return (self.token, '')
        return None

    def get_issues(
        self,
        project_key: str,
        branch: str = None,
        severities: str = None,
        statuses: str = "OPEN,CONFIRMED",
        page_size: int = 500,
    ) -> List[Dict[str, Any]]:
        """Fetch issues from /api/issues/search with pagination."""
        all_issues: List[Dict[str, Any]] = []
        page = 1

        while True:
            params: Dict[str, Any] = {
                'componentKeys': project_key,
                'statuses': statuses,
                'ps': page_size,
                'p': page,
            }
            if branch:
                params['branch'] = branch
            if severities:
                params['severities'] = severities

            try:
                resp = requests.get(
                    f'{self.base_url}/api/issues/search',
                    params=params,
                    auth=self._auth(),
                    timeout=30,
                )
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as e:
                print(f"SonarQube API error: {e}")
                break

            issues = data.get('issues', [])
            all_issues.extend(issues)

            total = data.get('total', 0)
            if page * page_size >= total:
                break
            page += 1

        return all_issues

    def get_rule_details(self, rule_key: str) -> Optional[Dict[str, Any]]:
        """Fetch rule metadata from /api/rules/show."""
        try:
            resp = requests.get(
                f'{self.base_url}/api/rules/show',
                params={'key': rule_key},
                auth=self._auth(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get('rule', {})
        except requests.RequestException as e:
            print(f"SonarQube rule fetch error for {rule_key}: {e}")
            return None

    def get_project_status(self, project_key: str) -> Optional[Dict[str, Any]]:
        """Fetch quality gate status from /api/qualitygates/project_status."""
        try:
            resp = requests.get(
                f'{self.base_url}/api/qualitygates/project_status',
                params={'projectKey': project_key},
                auth=self._auth(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get('projectStatus', {})
        except requests.RequestException as e:
            print(f"SonarQube project status error for {project_key}: {e}")
            return None
