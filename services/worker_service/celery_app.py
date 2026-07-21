from celery import Celery

from services.shared.config import settings


celery_app = Celery(
    "codebuster-worker",
    broker=str(settings.redis_url),
    backend=str(settings.redis_url),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Autodiscover tasks in this package so `shared_task` decorators register
celery_app.autodiscover_tasks(["services.worker_service"])


@celery_app.task(name="healthcheck")
def healthcheck() -> str:
    return "ok"


if __name__ == "__main__":  # pragma: no cover
    celery_app.worker_main()


