"""Add Strava upload tracking fields

Revision ID: f1a2b3c4d5e6
Revises: f7c1a2b3c4d5
Create Date: 2026-01-26 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "f7c1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("strava_upload_id", sa.BigInteger(), nullable=True))
    op.add_column("activities", sa.Column("strava_uploaded_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_activities_strava_upload_id", "activities", ["strava_upload_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_activities_strava_upload_id", table_name="activities")
    op.drop_column("activities", "strava_uploaded_at")
    op.drop_column("activities", "strava_upload_id")
