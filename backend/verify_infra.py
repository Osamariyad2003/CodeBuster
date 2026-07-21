import os
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from app.redis_client import get_redis, mask_url
from app.tasks import process_github_event
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VerifyInfra")

def verify_all():
    print("\n" + "="*50)
    print("[SEARCH] CODEBUSTER INFRASTRUCTURE VERIFICATION")
    print("="*50)
    
    # 1. Redis Check
    print("\n[1/2] Testing Redis connectivity...")
    try:
        r = get_redis()
        ping = r.ping()
        url = os.getenv("REDIS_URL")
        print(f"[OK] Redis Ping: {ping}")
        print(f"[OK] Connected to: {mask_url(url)}")
    except Exception as e:
        print(f"[ERR] Redis Connection Failed: {e}")
        return

    # 2. Celery Check
    print("\n[2/2] Testing Celery task enqueuing...")
    try:
        test_payload = {
            'delivery_id': 'verify-infra-test',
            'event_type': 'infrastructure_verification',
            'repo': 'CodeBuster/IntegrationTest',
            'payload': {'status': 'testing'}
        }
        task = process_github_event.delay(test_payload)
        print(f"[OK] Celery Task Enqueued: {task.id}")
        print(f"[INFO]️ Status: {task.status}")
        print("\nSUCCESS: Worker nodes should see and process this job.")
    except Exception as e:
        print(f"[ERR] Celery Enqueue Failed: {e}")

    # 3. Metrics Check
    print("\n[3/3] Checking Metrics persistence...")
    try:
        r = get_redis()
        from routes.metrics import REDIS_KEY_EVENTS, REDIS_KEY_JOBS
        events_count = r.llen(REDIS_KEY_EVENTS)
        jobs_count = r.llen(REDIS_KEY_JOBS)
        print(f"[OK] Dashboard Events in Redis: {events_count}")
        print(f"[OK] Dashboard Jobs in Redis: {jobs_count}")
        print("\nSUCCESS: All systems active and reporting to Dashboard.")
    except Exception as e:
        print(f"[ERR] Metrics Check Failed: {e}")

if __name__ == "__main__":
    verify_all()


