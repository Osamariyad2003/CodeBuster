"""Review run and review job (webhook → job → review)."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from backend.api.database import Base


class ReviewJob(Base):
    __tablename__ = "review_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger = Column(String(32), nullable=False)  # webhook, manual
    event_type = Column(String(64))  # pull_request, push
    commit_sha = Column(String(40))
    pr_number = Column(Integer)
    branch = Column(String(255))
    status = Column(String(32), default="queued", nullable=False)  # queued, running, completed, failed
    payload = Column(JSONB)  # raw webhook payload snapshot
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)

    repo = relationship("Repository", back_populates="review_jobs")
    review = relationship("Review", back_populates="job", uselist=False, cascade="all, delete-orphan")
    webhook_events = relationship(
        "WebhookEvent",
        back_populates="review_job",
        lazy="dynamic",
        foreign_keys="WebhookEvent.review_job_id",
    )


class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("review_jobs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False, index=True)
    overall_score = Column(Integer)  # 0-100
    overall_grade = Column(String(2))  # A..F
    category_scores = Column(JSONB)  # [{ "key": "security", "score": 85 }, ...]
    canonical_payload = Column(JSONB)  # full merged review (findings, severity, file/line, etc.)
    artifact_path = Column(String(512))  # S3 key or local path
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)

    job = relationship("ReviewJob", back_populates="review")
    repo = relationship("Repository", back_populates="reviews")
