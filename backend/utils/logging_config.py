import structlog
import logging
import sys
from flask import request, g
import uuid

def setup_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

def init_app_logging(app):
    setup_logging()
    
    @app.before_request
    def add_request_id():
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        g.request_id = request_id
        structlog.contextvars.bind_contextvars(request_id=request_id)

    @app.after_request
    def log_request(response):
        log = structlog.get_logger()
        log.info(
            "request_processed",
            path=request.path,
            method=request.method,
            status=response.status_code,
            request_id=g.get("request_id")
        )
        return response
