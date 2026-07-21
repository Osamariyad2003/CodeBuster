import os
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from services.ai_review_service import AIReviewService
from dotenv import load_dotenv

def test_enhancement():
    load_dotenv()
    
    service = AIReviewService()
    if not service.provider:
        print("[ERR] No AI provider configured. Check .env")
        return

    sample_issue = {
        "title": "SQL Injection vulnerability",
        "category": "security",
        "severity": "critical",
        "confidence": 0.9,
        "file": "app/db.py",
        "line": 15,
        "description": "Raw string formatting used in SQL query."
    }
    
    sample_file_content = """
import sqlite3

def get_user(user_id):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # Problematic line below
    query = "SELECT * FROM users WHERE id = '%s'" % user_id
    cursor.execute(query)
    return cursor.fetchone()
    
def log_access(user_id):
    print(f"User {user_id} accessed the DB")
"""
    # Adjust line number in sample to match the content (query is line 8 in the block above)
    # Lines:
    # 1: import
    # 2: 
    # 3: def
    # 4:    conn
    # 5:    cursor
    # 6:    # comment
    # 7:    query <-- ISSUE
    sample_issue["line"] = 8

    print(f"[LAUNCH] Testing enhancement for issue: {sample_issue['title']}")
    enhanced = service.enhance_issue(sample_issue, sample_file_content, "python")
    
    print("\n[OK] Enhanced Issue Result:")
    print(json.dumps(enhanced, indent=2))
    
    # Validation checks
    if "snippet" in enhanced and "suggested_fix" in enhanced:
        print("\n[?] SUCCESS: AI enhancement added snippet and suggested fix!")
    else:
        print("\n[ERR] FAILURE: Missing expected fields in enhanced output.")

if __name__ == "__main__":
    test_enhancement()
