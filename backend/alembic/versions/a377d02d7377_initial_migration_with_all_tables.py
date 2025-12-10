"""Initial migration with all tables

Revision ID: a377d02d7377
Revises:
Create Date: 2025-11-02 10:45:53.369503
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a377d02d7377"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ftp", sa.Float(), nullable=True, server_default=sa.text("250")),
        sa.Column("weight", sa.Float(), nullable=True, server_default=sa.text("70")),
        sa.Column("hr_max", sa.Integer(), nullable=True, server_default=sa.text("190")),
        sa.Column("hr_rest", sa.Integer(), nullable=True, server_default=sa.text("60")),
        sa.Column("strava_athlete_id", sa.Integer(), nullable=True),
        sa.Column("strava_access_token", sa.String(), nullable=True),
        sa.Column("strava_refresh_token", sa.String(), nullable=True),
        sa.Column("strava_token_expires_at", sa.Integer(), nullable=True),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("strava_athlete_id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # Activities
    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("start_time", sa.DateTime(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_hash", sa.String(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("distance", sa.Float(), nullable=True),
        sa.Column("strava_activity_id", sa.Integer(), nullable=True),
        sa.Column("avg_power", sa.Float(), nullable=True),
        sa.Column("normalized_power", sa.Float(), nullable=True),
        sa.Column("max_5sec_power", sa.Float(), nullable=True),
        sa.Column("max_1min_power", sa.Float(), nullable=True),
        sa.Column("max_3min_power", sa.Float(), nullable=True),
        sa.Column("max_5min_power", sa.Float(), nullable=True),
        sa.Column("max_10min_power", sa.Float(), nullable=True),
        sa.Column("max_20min_power", sa.Float(), nullable=True),
        sa.Column("max_30min_power", sa.Float(), nullable=True),
        sa.Column("max_60min_power", sa.Float(), nullable=True),
        sa.Column("avg_heart_rate", sa.Float(), nullable=True),
        sa.Column("max_heart_rate", sa.Float(), nullable=True),
        sa.Column("tss", sa.Float(), nullable=True),
        sa.Column("intensity_factor", sa.Float(), nullable=True),
        sa.Column("efficiency_factor", sa.Float(), nullable=True),
        sa.Column("critical_power", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_activities_id", "activities", ["id"])
    op.create_index("ix_activities_strava_activity_id", "activities", ["strava_activity_id"])

    # Training load
    op.create_table(
        "training_load",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("ctl", sa.Float(), nullable=True),
        sa.Column("atl", sa.Float(), nullable=True),
        sa.Column("tsb", sa.Float(), nullable=True),
    )
    op.create_index("ix_training_load_id", "training_load", ["id"])

    # Power zones
    op.create_table(
        "power_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id"), nullable=False),
        sa.Column("zone_label", sa.String(), nullable=False),
        sa.Column("seconds_in_zone", sa.Integer(), nullable=False),
    )
    op.create_index("ix_power_zones_id", "power_zones", ["id"])

    # HR zones
    op.create_table(
        "hr_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id"), nullable=False),
        sa.Column("zone_label", sa.String(), nullable=False),
        sa.Column("seconds_in_zone", sa.Integer(), nullable=False),
    )
    op.create_index("ix_hr_zones_id", "hr_zones", ["id"])


def downgrade() -> None:
    op.drop_index("ix_hr_zones_id", table_name="hr_zones")
    op.drop_table("hr_zones")

    op.drop_index("ix_power_zones_id", table_name="power_zones")
    op.drop_table("power_zones")

    op.drop_index("ix_training_load_id", table_name="training_load")
    op.drop_table("training_load")

    op.drop_index("ix_activities_strava_activity_id", table_name="activities")
    op.drop_index("ix_activities_id", table_name="activities")
    op.drop_table("activities")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
