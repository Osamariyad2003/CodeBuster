
import os
import json
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from services.ai_review_service import AIReviewService

def test_ai_quality():
    print(f"DEBUG: GEMINI_API_KEY present: {bool(os.getenv('GEMINI_API_KEY'))}")
    print(f"DEBUG: GEMINI_MODEL: {os.getenv('GEMINI_MODEL')}")
    
    ai = AIReviewService()
    print(f"DEBUG: AI Provider: {ai.provider}")
    
    # Mock findings with generic titles but specific snippets
    findings = [
        {
            "id": "find-001",
            "tool": "pylint",
            "title": "Magic Number",
            "description": "Magic number 5000 found in request timeout.",
            "file": "backend/api/client.py",
            "line": 12,
            "code_snippet": "10 | def fetch_data(url):\n11 |     # Default configuration\n12 | --> timeout_ms = 5000\n13 |     return requests.get(url, timeout=timeout_ms/1000)"
        },
        {
            "id": "find-002",
            "tool": "eslint",
            "title": "Hardcoded String",
            "description": "Literal string found in sensitive context.",
            "file": "frontend/src/auth/AuthProvider.tsx",
            "line": 85,
            "code_snippet": "83 |     const login = async (creds) => {\n84 |         const url = '/api/login';\n85 | -->     const apiKey = 'CB-PROD-SECRET-KEY-2024';\n86 |         return axios.post(url, creds, { headers: { 'Authorization': apiKey } });"
        }
    ]
    
    repo_ctx = {
        "full_name": "demo/codebuster-app",
        "languages": ["python", "typescript"]
    }
    
    print("Running AI Quality Verification...")
    result = ai.generate_review(findings, repo_ctx)
    
    with open('verification_results.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    
    print("\n=== AI QUALITY RESULTS SAVED TO verification_results.json ===")

if __name__ == "__main__":
    test_ai_quality()
