"""Audit logging utilities shared across services."""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from . import models


def write_audit_log(
    db: Session,
    *,
    org_id: UUID,
    user_id: Optional[UUID],
    action: str,
    resource_type: str,
    resource_id: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    log = models.AuditLog(
        org_id=org_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata=metadata or {},
        created_at=datetime.utcnow(),
    )
    db.add(log)

