"""Request ID and structured logging middleware."""
import structlog
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())


class RequestIdLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id, path=request.url.path)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
