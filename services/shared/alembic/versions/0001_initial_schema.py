"""Initial CodeBuster schema.

This migration captures the core tables described in the production
architecture plan. It is intentionally minimal but complete enough for the
new FastAPI services and Celery workers to run end-to-end.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Organizations and repositories
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("billing_tier", sa.String(length=50), nullable=False, server_default="free"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
    )

    op.create_table(
        "repositories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("installation_id", sa.BigInteger(), nullable=True),
        sa.Column("full_name", sa.String(length=500), nullable=False),
        sa.Column("default_branch", sa.String(length=255), server_default="main"),
        sa.Column("visibility", sa.String(length=50), server_default="private"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("language", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Review runs & related scoring
    op.create_table(
        "review_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "repo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "trigger_source",
            sa.Enum("webhook", "manual", "scheduled", name="trigger_source"),
            nullable=False,
        ),
        sa.Column(
            "trigger_type",
            sa.Enum("pr", "commit", "branch", name="trigger_type"),
            nullable=False,
        ),
        sa.Column("commit_sha", sa.String(length=40), nullable=False),
        sa.Column("pr_number", sa.Integer(), nullable=True),
        sa.Column("branch", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            sa.Enum("queued", "running", "completed", "failed", name="review_status"),
            nullable=False,
        ),
        sa.Column("overall_score", sa.Integer(), nullable=True),
        sa.Column("overall_grade", sa.CHAR(length=1), nullable=True),
        sa.Column("production_readiness", sa.String(length=20), nullable=True),
        sa.Column("raw_report_url", sa.String(length=1024), nullable=True),
        sa.Column("canonical_payload", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "category_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "review_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("review_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category_key", sa.String(length=100), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # Findings and fix-first items
    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "review_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("review_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "repo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(length=50), nullable=True),
        sa.Column(
            "severity",
            sa.Enum("CRITICAL", "MAJOR", "MINOR", "INFO", name="finding_severity"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("module", sa.String(length=50), nullable=True),
        sa.Column("rule_id", sa.String(length=100), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("start_line", sa.Integer(), nullable=False),
        sa.Column("end_line", sa.Integer(), nullable=True),
        sa.Column("start_column", sa.Integer(), nullable=True),
        sa.Column("end_column", sa.Integer(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("suggested_fix", postgresql.JSONB(), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("open", "resolved", "ignored", name="finding_status"),
            nullable=False,
            server_default="open",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "fix_first_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "review_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("review_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("why", sa.Text(), nullable=True),
        sa.Column("owner_hint", sa.String(length=50), nullable=True),
        sa.Column(
            "effort",
            sa.Enum("S", "M", "L", name="fix_first_effort"),
            nullable=False,
            server_default="M",
        ),
        sa.Column(
            "related_finding_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "in_progress", "done", name="fix_first_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # Jobs
    op.create_table(
        "review_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "repo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "review_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("review_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("trigger_source", sa.String(length=50), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("queued", "running", "completed", "failed", name="job_status"),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
    )

    # Settings / policies
    op.create_table(
        "org_settings",
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("default_policies", postgresql.JSONB(), nullable=True),
        sa.Column("notification_settings", postgresql.JSONB(), nullable=True),
    )

    op.create_table(
        "repo_settings",
        sa.Column(
            "repo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("enabled_analyzers", postgresql.JSONB(), nullable=True),
        sa.Column("min_severity", sa.String(length=20), server_default="MINOR"),
        sa.Column("fail_pr_on_grade_below", sa.CHAR(length=1), server_default="C"),
        sa.Column(
            "protected_branches",
            postgresql.ARRAY(sa.String(length=255)),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Audit logs
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=255), nullable=False),
        sa.Column("resource_type", sa.String(length=100), nullable=False),
        sa.Column("resource_id", sa.String(length=255), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("repo_settings")
    op.drop_table("org_settings")
    op.drop_table("review_jobs")
    op.drop_table("fix_first_items")
    op.drop_table("findings")
    op.drop_table("category_scores")
    op.drop_table("review_runs")
    op.drop_table("repositories")
    op.drop_table("organizations")

