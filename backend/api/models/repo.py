"""Repository and repo-level settings (policy toggles)."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from backend.api.database import Base


class Repository(Base):
    __tablename__ = "repos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    full_name = Column(String(512), unique=True, nullable=False, index=True)
    default_branch = Column(String(255), default="main")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    settings = relationship("RepoSettings", back_populates="repo", uselist=False, cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="repo", lazy="dynamic", cascade="all, delete-orphan")
    review_jobs = relationship("ReviewJob", back_populates="repo", lazy="dynamic", cascade="all, delete-orphan")


class RepoSettings(Base):
    __tablename__ = "repo_settings"

    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), primary_key=True)
    enabled_analyzers = Column(JSONB, default=list)  # ["security", "quality", "performance", "maintainability", "devops", "frontend"]
    min_severity = Column(String(20), default="MINOR")  # CRITICAL, MAJOR, MINOR, INFO
    fail_pr_on_grade_below = Column(String(2), default="D")  # A..F
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    repo = relationship("Repository", back_populates="settings")
