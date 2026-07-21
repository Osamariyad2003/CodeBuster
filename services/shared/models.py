"""Shared SQLAlchemy models for the new FastAPI services.

These are intentionally scoped to the production-ready architecture described
in `codebuster-production-architecture.plan.md`. They do not replace the
existing Flask/SQLite models, but provide a clean PostgreSQL schema that new
services can use.
"""

from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CHAR,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID
from sqlalchemy.orm import relationship

from .db import Base


def _uuid_str() -> str:
    return str(uuid4())


# --- Core / organizations ---


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    billing_tier = Column(String(50), nullable=False, default="free")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    members = relationship("OrganizationMembership", back_populates="organization")
    repositories = relationship("Repository", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    github_user_id = Column(BigInteger, unique=True, index=True, nullable=False)
    github_login = Column(String(255), nullable=False, index=True)
    email = Column(String(255))
    name = Column(String(255))
    avatar_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime)

    memberships = relationship("OrganizationMembership", back_populates="user")


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(
        Enum("owner", "admin", "member", "read_only", name="org_role"),
        nullable=False,
        default="member",
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")

    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_user"),)


class GitHubInstallation(Base):
    __tablename__ = "github_installations"

    id = Column(BigInteger, primary_key=True)  # Installation ID from GitHub
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL")
    )
    account_login = Column(String(255), nullable=False)
    app_id = Column(BigInteger, nullable=False)
    permissions = Column(JSONB)
    repositories = Column(JSONB)  # Optional cached repo list
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    organization = relationship("Organization")
    repositories_rel = relationship("Repository", back_populates="installation")


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    installation_id = Column(
        BigInteger, ForeignKey("github_installations.id", ondelete="SET NULL")
    )
    full_name = Column(String(500), nullable=False, index=True)  # owner/name
    default_branch = Column(String(255), default="main")
    visibility = Column(String(50), default="private")
    is_active = Column(Boolean, default=True, nullable=False)
    language = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    organization = relationship("Organization", back_populates="repositories")
    installation = relationship("GitHubInstallation", back_populates="repositories_rel")
    review_runs = relationship("ReviewRun", back_populates="repository")


# --- Review & findings ---


class ReviewRun(Base):
    __tablename__ = "review_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    repo_id = Column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    trigger_source = Column(
        Enum("webhook", "manual", "scheduled", name="trigger_source"),
        nullable=False,
    )
    trigger_type = Column(
        Enum("pr", "commit", "branch", name="trigger_type"), nullable=False
    )
    commit_sha = Column(String(40), nullable=False)
    pr_number = Column(Integer)
    branch = Column(String(255))
    status = Column(
        Enum(
            "queued",
            "running",
            "completed",
            "failed",
            name="review_status",
        ),
        nullable=False,
        default="queued",
    )
    overall_score = Column(Integer)
    overall_grade = Column(CHAR(1))
    production_readiness = Column(String(20))
    raw_report_url = Column(String(1024))
    canonical_payload = Column(JSONB)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    repository = relationship("Repository", back_populates="review_runs")
    category_scores = relationship("CategoryScore", back_populates="review_run")
    findings = relationship("Finding", back_populates="review_run")
    fix_first_items = relationship("FixFirstItem", back_populates="review_run")


class CategoryScore(Base):
    __tablename__ = "category_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    review_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("review_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_key = Column(String(100), nullable=False)
    score = Column(Integer, nullable=False)
    weight = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    review_run = relationship("ReviewRun", back_populates="category_scores")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    review_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("review_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    repo_id = Column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )

    external_id = Column(String(50), nullable=True)  # e.g. cb-001
    severity = Column(
        Enum("CRITICAL", "MAJOR", "MINOR", "INFO", name="finding_severity"),
        nullable=False,
    )
    category = Column(String(100))
    module = Column(String(50))
    rule_id = Column(String(100))

    file_path = Column(Text, nullable=False)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=True)
    start_column = Column(Integer, nullable=True)
    end_column = Column(Integer, nullable=True)

    summary = Column(Text, nullable=False)
    explanation = Column(Text)
    suggested_fix = Column(JSONB)
    confidence = Column(Integer)
    status = Column(
        Enum("open", "resolved", "ignored", name="finding_status"),
        nullable=False,
        default="open",
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    review_run = relationship("ReviewRun", back_populates="findings")


class FixFirstItem(Base):
    __tablename__ = "fix_first_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    review_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("review_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(Text, nullable=False)
    why = Column(Text)
    owner_hint = Column(String(50))
    effort = Column(
        Enum("S", "M", "L", name="fix_first_effort"), nullable=False, default="M"
    )
    related_finding_ids = Column(ARRAY(UUID(as_uuid=True)))
    status = Column(
        Enum("pending", "in_progress", "done", name="fix_first_status"),
        nullable=False,
        default="pending",
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    review_run = relationship("ReviewRun", back_populates="fix_first_items")


# --- Jobs & pipeline ---


class ReviewJob(Base):
    __tablename__ = "review_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    repo_id = Column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    review_run_id = Column(
        UUID(as_uuid=True), ForeignKey("review_runs.id", ondelete="SET NULL")
    )
    trigger_source = Column(String(50), nullable=False)
    payload = Column(JSONB)
    status = Column(
        Enum("queued", "running", "completed", "failed", name="job_status"),
        nullable=False,
        default="queued",
    )
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)


class AnalyzerRun(Base):
    __tablename__ = "analyzer_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    review_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("review_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    analyzer_key = Column(String(100), nullable=False)
    status = Column(
        Enum("queued", "running", "completed", "failed", name="analyzer_status"),
        nullable=False,
        default="queued",
    )
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    raw_output_url = Column(String(1024))
    metrics = Column(JSONB)


# --- Settings & policies ---


class OrgSettings(Base):
    __tablename__ = "org_settings"

    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    default_policies = Column(JSONB, default=dict)
    notification_settings = Column(JSONB, default=dict)


class RepoSettings(Base):
    __tablename__ = "repo_settings"

    repo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        primary_key=True,
    )
    enabled_analyzers = Column(JSONB, default=list)
    min_severity = Column(String(20), default="MINOR")
    fail_pr_on_grade_below = Column(CHAR(1), default="C")
    protected_branches = Column(ARRAY(String(255)), default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class ApiToken(Base):
    __tablename__ = "api_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    token_hash = Column(String(128), nullable=False, unique=True)
    scopes = Column(ARRAY(String(100)), default=list)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# --- Security & audit ---


class EncryptedSecret(Base):
    __tablename__ = "encrypted_secrets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    type = Column(String(100), nullable=False)
    ciphertext = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action = Column(String(255), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(255), nullable=False)
    ip = Column(String(64))
    user_agent = Column(String(512))
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

