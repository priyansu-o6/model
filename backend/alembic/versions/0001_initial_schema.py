from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial schema for Pratyaksha."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), server_default=sa.text("'verifier'"), nullable=False),
        sa.Column("organization", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("TRUE"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "verification_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("subject_name", sa.String(), nullable=True),
        sa.Column("media_path", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_verification_sessions_user_id",
        "verification_sessions",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "detection_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("verification_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("verdict", sa.String(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(), nullable=False),
        sa.Column("xception_score", sa.Float(), nullable=True),
        sa.Column("temporal_score", sa.Float(), nullable=True),
        sa.Column("rppg_score", sa.Float(), nullable=True),
        sa.Column("liveness_score", sa.Float(), nullable=True),
        sa.Column("audio_score", sa.Float(), nullable=True),
        sa.Column("gradcam_path", sa.String(), nullable=True),
        sa.Column("suspicious_regions", postgresql.JSONB(), nullable=True),
        sa.Column("explanation_reasons", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("confidence_interval", postgresql.ARRAY(sa.Float()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_detection_results_session_id",
        "detection_results",
        ["session_id"],
        unique=False,
    )

    op.create_table(
        "frame_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("verification_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("frame_number", sa.Integer(), nullable=False),
        sa.Column("timestamp_ms", sa.Integer(), nullable=False),
        sa.Column("xception_score", sa.Float(), nullable=True),
        sa.Column("temporal_consistency", sa.Float(), nullable=True),
        sa.Column("rppg_value", sa.Float(), nullable=True),
        sa.Column("is_flagged", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_frame_results_session_id",
        "frame_results",
        ["session_id"],
        unique=False,
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=False,
        ),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_audit_logs_user_id",
        "audit_logs",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop all tables created in the initial schema."""
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_frame_results_session_id", table_name="frame_results")
    op.drop_table("frame_results")

    op.drop_index("ix_detection_results_session_id", table_name="detection_results")
    op.drop_table("detection_results")

    op.drop_index("ix_verification_sessions_user_id", table_name="verification_sessions")
    op.drop_table("verification_sessions")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

