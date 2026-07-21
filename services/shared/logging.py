"""Shared logging/metrics/tracing setup for FastAPI services."""

import logging
import time
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST


REQUEST_COUNT = Counter(
    "codebuster_http_requests_total",
    "Total HTTP requests",
    ["service", "method", "path", "status"],
)

REQUEST_LATENCY = Histogram(
    "codebuster_http_request_duration_seconds",
    "HTTP request latency",
    ["service", "path"],
)


def configure_logging(service_name: str) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def setup_observability(app: FastAPI, service_name: str) -> None:
    """Attach basic logging and Prometheus metrics to a FastAPI app."""

    configure_logging(service_name)
    logger = logging.getLogger(service_name)

    @app.middleware("http")
    async def _metrics_middleware(request: Request, call_next: Callable):
        start = time.perf_counter()
        response = await call_next(request)
        latency = time.perf_counter() - start

        path = request.url.path
        REQUEST_COUNT.labels(
            service=service_name,
            method=request.method,
            path=path,
            status=response.status_code,
        ).inc()
        REQUEST_LATENCY.labels(service=service_name, path=path).observe(latency)

        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": path,
                "status": response.status_code,
                "duration_ms": int(latency * 1000),
            },
        )
        return response

    @app.get("/metrics")
    async def metrics() -> PlainTextResponse:  # type: ignore[override]
        return PlainTextResponse(
            generate_latest(), media_type=CONTENT_TYPE_LATEST  # type: ignore[arg-type]
        )

