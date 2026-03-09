"""add session and email verification models

Revision ID: c4d5e6f7a8b9
Revises: a9f4e7c1b2d3
Create Date: 2026-03-08 16:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "a9f4e7c1b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("email_verification_token_hash", sa.String(), nullable=True))
    op.add_column("users", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("email_verification_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("login_locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_login_ip", sa.String(), nullable=True))
    op.create_index("ix_users_email_verification_token_hash", "users", ["email_verification_token_hash"], unique=False)

    op.create_table(
        "refresh_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_session_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["replaced_by_session_id"], ["refresh_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_refresh_sessions_id", "refresh_sessions", ["id"], unique=False)
    op.create_index("idx_refresh_sessions_token_hash", "refresh_sessions", ["token_hash"], unique=False)
    op.create_index("idx_refresh_sessions_user_active", "refresh_sessions", ["user_id", "revoked_at", "expires_at"], unique=False)

    op.create_table(
        "security_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("identifier", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_security_events_id", "security_events", ["id"], unique=False)
    op.create_index("idx_security_events_type_created", "security_events", ["event_type", "created_at"], unique=False)
    op.create_index("idx_security_events_user_created", "security_events", ["user_id", "created_at"], unique=False)

    op.execute("UPDATE users SET is_email_verified = TRUE")

    op.alter_column("users", "is_email_verified", server_default=None)
    op.alter_column("users", "failed_login_attempts", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_security_events_user_created", table_name="security_events")
    op.drop_index("idx_security_events_type_created", table_name="security_events")
    op.drop_index("ix_security_events_id", table_name="security_events")
    op.drop_table("security_events")

    op.drop_index("idx_refresh_sessions_user_active", table_name="refresh_sessions")
    op.drop_index("idx_refresh_sessions_token_hash", table_name="refresh_sessions")
    op.drop_index("ix_refresh_sessions_id", table_name="refresh_sessions")
    op.drop_table("refresh_sessions")

    op.drop_index("ix_users_email_verification_token_hash", table_name="users")
    op.drop_column("users", "last_login_ip")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "login_locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "email_verification_requested_at")
    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_token_hash")
    op.drop_column("users", "is_email_verified")
