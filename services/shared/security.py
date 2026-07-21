"""Security helpers: token encryption and simple RBAC primitives."""

import base64
import os
from typing import Optional

from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Header

from .config import settings
from .db import get_db
from . import models
from sqlalchemy.orm import Session


def _get_fernet_key() -> bytes:
    """Derive a Fernet key from an environment secret.

    In production this should be backed by a dedicated KMS-managed secret
    rather than the generic application secret.
    """
    key = os.getenv("ENCRYPTION_SECRET_KEY") or os.getenv(
        "FLASK_SECRET_KEY", "codebuster-secret-key-change-in-production"
    )
    key_bytes = key.encode("utf-8")
    if len(key_bytes) < 32:
        key_bytes = key_bytes.ljust(32, b"=")
    else:
        key_bytes = key_bytes[:32]
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    f = Fernet(_get_fernet_key())
    return f.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: Optional[str]) -> Optional[str]:
    if not ciphertext:
        return None
    f = Fernet(_get_fernet_key())
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


class Principal:
    """Authenticated principal used in RBAC checks."""

    def __init__(self, user: models.User, org: models.Organization, role: str):
        self.user = user
        self.org = org
        self.role = role


async def get_principal(
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
) -> Principal:
    """Resolve current principal from headers.

    In production this would be derived from a signed JWT or session. For the
    new services we keep the contract explicit via headers so they can be
    fronted by an auth gateway.
    """
    if not x_user_id or not x_org_id:
        raise HTTPException(status_code=401, detail="Missing authentication context")

    user = db.get(models.User, x_user_id)
    org = db.get(models.Organization, x_org_id)
    if not user or not org:
        raise HTTPException(status_code=401, detail="Unknown user or organization")

    membership = (
        db.query(models.OrganizationMembership)
        .filter_by(user_id=user.id, org_id=org.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    return Principal(user=user, org=org, role=membership.role)


def require_org_role(*allowed_roles: str):
    """Dependency factory that enforces org-scoped RBAC."""

    async def _checker(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return principal

    return _checker

