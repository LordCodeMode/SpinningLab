"""Add additional performance indexes

Revision ID: f7c1a2b3c4d5
Revises: b7a4e5c6d7e8
Create Date: 2026-01-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7c1a2b3c4d5"
down_revision: Union[str, None] = "b7a4e5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Activities: support pagination, Strava/FIT lookups, and filters.
    op.create_index(
        "idx_activity_user_time_id",
        "activities",
        ["user_id", "start_time", "id"],
        unique=False
    )
    op.create_index(
        "idx_activity_user_strava",
        "activities",
        ["user_id", "strava_activity_id"],
        unique=False
    )
    op.create_index(
        "idx_activity_user_file_hash",
        "activities",
        ["user_id", "file_hash"],
        unique=False
    )
    op.create_index(
        "idx_activity_user_tss",
        "activities",
        ["user_id", "tss"],
        unique=False
    )
    op.create_index(
        "idx_activity_user_avg_power",
        "activities",
        ["user_id", "avg_power"],
        unique=False
    )

    # Planned workouts: optimize date range ordering.
    op.create_index(
        "idx_plannedworkout_user_date_order",
        "planned_workouts",
        ["user_id", "scheduled_date", "sort_order", "created_at"],
        unique=False
    )

    # Workouts and training plans: speed list views.
    op.create_index(
        "idx_workout_user_created",
        "workouts",
        ["user_id", "created_at"],
        unique=False
    )
    op.create_index(
        "idx_workout_user_template_type",
        "workouts",
        ["user_id", "is_template", "workout_type"],
        unique=False
    )
    op.create_index(
        "idx_trainingplan_user_created",
        "training_plans",
        ["user_id", "created_at"],
        unique=False
    )


def downgrade() -> None:
    op.drop_index("idx_trainingplan_user_created", table_name="training_plans")
    op.drop_index("idx_workout_user_template_type", table_name="workouts")
    op.drop_index("idx_workout_user_created", table_name="workouts")
    op.drop_index("idx_plannedworkout_user_date_order", table_name="planned_workouts")
    op.drop_index("idx_activity_user_avg_power", table_name="activities")
    op.drop_index("idx_activity_user_tss", table_name="activities")
    op.drop_index("idx_activity_user_file_hash", table_name="activities")
    op.drop_index("idx_activity_user_strava", table_name="activities")
    op.drop_index("idx_activity_user_time_id", table_name="activities")
