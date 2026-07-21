"""CodeBuster Frontend AI - Interactive assistant for real-time UI interactions and incremental reasoning."""
import os
import json
import requests
from typing import List, Dict, Any, Optional

class FrontendAIService:
    """Service for handling UI-side incremental reasoning and user interactions."""

    def __init__(self):
        self.api_key = os.getenv('OPEN_AI_KEY') or os.getenv('OPENAI_API_KEY')
        self.api_url = 'https://api.openai.com/v1/chat/completions'
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')

    def react_to_user_action(self, 
                             action_type: str, 
                             payload: Dict[str, Any], 
                             context: Dict[str, Any]) -> Dict[str, Any]:
        """
        React to a user action from the UI (edit, dismissal, config change).
        
        Args:
            action_type: 'code_edit', 'issue_dismissed', 'config_updated'
            payload: The data associated with the action (e.g., new code snippet, dismissal reason)
            context: PR state, history of issues, and repo conventions
            
        Returns:
            JSON response for UI updates.
        """
        if not self.api_key:
            return {
                "status": "Offline",
                "message": "AI services are currently unavailable.",
                "updates": []
            }

        prompt = self._build_frontend_prompt(action_type, payload, context)
        
        try:
            response = self._call_ai(prompt)
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "status": "Error",
                "message": f"Interactive reasoning failed: {str(e)}",
                "updates": []
            }

    def _build_frontend_prompt(self, action_type: str, payload: Dict, context: Dict) -> str:
        """Build the specialized prompt for CodeBuster Frontend AI."""
        
        prompt = f"""You are **CodeBuster Frontend AI**, an interactive assistant embedded in the UI.
Your job is to help developers understand, refine, and act on code review feedback AFTER they edit code, dismiss issues, or adjust settings.

# Operating Mode
- **Incremental reasoning only**: DO NOT reanalyze the entire repository.
- **Respect user intent**: Treat user edits and dismissals as the primary source of truth.
- **Be concise**: Outputs are for tooltips, side panels, and inline UI elements.

# User Action: {action_type}
Payload: {json.dumps(payload)}

# Context
- Current PR Issues: {json.dumps(context.get('issues', []))}
- Repo Conventions: {json.dumps(context.get('conventions', {}))}
- Previous User Comments: {json.dumps(context.get('comments', []))}

# Core Tasks
1. **Analyze the Change**: 
   - If `code_edit`: check if the associated issue is Resolved, Partially Resolved, or Still Risky. 
   - If `issue_dismissed`: accept it, then optionally suggest 1 safer alternative if high risk.
   - If `config_updated`: explain the impact on future analysis runs.
2. **Detect Regressions**: Only warn if the new edit introduces a HIGHER-risk flaw than the one being fixed.
3. **Draft UI Response**: Keep it short (1-3 sentences).

# Output Schema (JSON Only)
{{
  "overall_status": "Resolved | Partially Resolved | Risk Detected | Configuration Updated",
  "explanation": "Short summary for the user.",
  "updates": [
    {{
      "issue_id": "original-id",
      "new_status": "resolved | open | dismissed",
      "message": "Specific feedback for this issue.",
      "next_action": "e.g., 'Run tests' or 'Verify on staging'"
    }}
  ],
  "regression_warning": {{
    "severity": "critical|major|null",
    "description": "Short warning if a new risk was added."
  }}
}}
"""
        return prompt

    def _call_ai(self, prompt: str) -> str:
        """Execute the AI request."""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': 'You are CodeBuster Frontend AI. Respond with STICT JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.1,
            'response_format': {'type': 'json_object'}
        }
        
        response = requests.post(self.api_url, headers=headers, json=data, timeout=15)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']

    def _parse_json_response(self, content: str) -> Dict:
        """Parse and safety-check the JSON content."""
        try:
            return json.loads(content)
        except Exception:
            return {
                "overall_status": "Error",
                "explanation": "Could not process AI response.",
                "updates": []
            }
