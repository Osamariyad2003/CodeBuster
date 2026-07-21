"""Consistent exception handling and error responses."""
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse

from backend.api.config import settings
from backend.api.schemas.common import ErrorDetail, ErrorResponse


def error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: Optional[str] = None,
    field: Optional[str] = None,
    details: Any = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorDetail(code=code, message=message, field=field, details=details),
        request_id=request_id,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return error_response(
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred.",
        request_id=request_id,
        details=str(exc) if settings.environment == "development" else None,
    )
