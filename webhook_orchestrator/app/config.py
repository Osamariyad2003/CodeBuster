import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
    MAX_PAYLOAD_SIZE = 2 * 1024 * 1024  # 2MB
    IDEMPOTENCY_TTL = 24 * 60 * 60  # 24 hours in seconds
