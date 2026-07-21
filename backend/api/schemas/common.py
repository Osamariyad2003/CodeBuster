"""Consistent error schema for all API responses."""
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable message")
    field: Optional[str] = None
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail = Field(..., description="Single error detail")
    request_id: Optional[str] = None
