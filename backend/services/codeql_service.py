import requests
from typing import List, Dict, Any, Optional
from utils.github_auth import get_installation_access_token

class CodeQLService:
    """Service to interact with GitHub Code Scanning API."""
    
    def __init__(self, installation_id: str):
        self.installation_id = installation_id
        self.access_token = get_installation_access_token(installation_id)
        self.base_url = "https://api.github.com"
        
    def get_alerts(self, repo_full_name: str, state: str = "open", ref: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch code scanning alerts for a repository.
        
        Args:
            repo_full_name: Full name of the repo (owner/repo)
            state: Alert state (open, closed, dismissed)
            ref: Git reference (e.g. refs/heads/main)
            
        Returns:
            List of alert dicts
        """
        if not self.access_token:
            print(f"[ERR] No access token for installation {self.installation_id}")
            return []
            
        url = f"{self.base_url}/repos/{repo_full_name}/code-scanning/alerts"
        params = {
            "state": state,
            "per_page": 100
        }
        if ref:
            params["ref"] = ref
            
        headers = {
            "Authorization": f"token {self.access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"[ERR] Failed to fetch CodeQL alerts: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"[ERR] Error calling GitHub Code Scanning API: {str(e)}")
            return []

    def get_analysis_results(self, repo_full_name: str, analysis_id: int) -> Dict[str, Any]:
        """Fetch details of a specific analysis."""
        if not self.access_token:
            return {}
            
        url = f"{self.base_url}/repos/{repo_full_name}/code-scanning/analyses/{analysis_id}"
        headers = {
            "Authorization": f"token {self.access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception as e:
            print(f"[ERR] Error fetching CodeQL analysis: {str(e)}")
            return {}
