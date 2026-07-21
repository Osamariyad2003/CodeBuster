import os
import logging
from celery import Celery
from dotenv import load_dotenv
from pathlib import Path
from .redis_client import mask_url

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

REDIS_URL = os.getenv('REDIS_URL')

# Fail fast if REDIS_URL is missing
if not REDIS_URL:
    logger.error("[STOP] REDIS_URL is missing! Celery cannot start.")
    raise RuntimeError("CRITICAL ERROR: REDIS_URL not found in environment. Celery integration requires Redis Cloud.")

# Startup Masked Log
masked_url = mask_url(REDIS_URL)
print(f"[PKG] CodeBuster Worker: Initializing with Redis Cloud @ {masked_url}")

# Use rediss:// if specified for TLS
if REDIS_URL.startswith('rediss://'):
    ssl_cert_reqs = os.getenv('CELERY_REDIS_SSL_CERT_REQS', 'none')
    broker_use_ssl = {
        'ssl_cert_reqs': ssl_cert_reqs
    }
else:
    broker_use_ssl = None

celery_app = Celery(
    'codebuster',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['app.tasks']
)

# Configuration
celery_app.conf.update(
    task_default_queue='codebuster',
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=300,
    task_soft_time_limit=270,
    broker_use_ssl=broker_use_ssl,
    redis_backend_use_ssl=broker_use_ssl,
    # System settings
    task_ignore_result=False,
    result_persistent=True,
    broker_connection_retry_on_startup=True
)

if __name__ == '__main__':
    print("[LAUNCH] Starting Celery process...")
    celery_app.start()


