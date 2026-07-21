from pathlib import Path
from dotenv import load_dotenv
import os
from celery import Celery
import structlog

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

logger = structlog.get_logger()

def make_celery(app_name=__name__):
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    return Celery(
        app_name,
        broker=redis_url,
        backend=redis_url,
        include=['tasks.analysis_tasks']
    )

celery_app = make_celery()

# Optional: Configuration overrides
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    # Keep Redis connections low for the free-tier client limit (30 total).
    broker_pool_limit=2,
    redis_max_connections=4,
    result_backend_transport_options={'max_connections': 2},
)
