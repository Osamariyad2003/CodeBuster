"""Stored GitHub webhook event + linked review job."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from backend.api.database import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    event_id = Column(String(64), unique=True, nullable=False, index=True)  # X-GitHub-Delivery
    event_type = Column(String(64), nullable=False, index=True)  # pull_request, push
    payload = Column(JSONB, nullable=False)
    signature_valid = Column(String(10), default="true")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    review_job_id = Column(UUID(as_uuid=True), ForeignKey("review_jobs.id", ondelete="SET NULL"))
    review_job = relationship("ReviewJob", back_populates="webhook_events")
