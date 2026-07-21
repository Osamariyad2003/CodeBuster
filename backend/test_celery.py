import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from app.tasks import process_github_event
import time

def test_enqueue():
    print("Testing Celery task enqueuing...")
    
    payload = {
        'delivery_id': 'test-123',
        'event_type': 'test_manual',
        'repo': 'CodeBuster/IntegrationTest',
        'payload': {'action': 'verification'}
    }
    
    try:
        result = process_github_event.delay(payload)
        print(f"[OK] Task enqueued successfully! ID: {result.id}")
        print("Wait for worker logs to see execution...")
    except Exception as e:
        print(f"[ERR] Failed to enqueue task: {e}")

if __name__ == "__main__":
    test_enqueue()
