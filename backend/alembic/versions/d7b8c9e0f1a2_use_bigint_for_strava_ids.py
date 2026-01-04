"""Use BigInteger for Strava IDs.

Revision ID: d7b8c9e0f1a2
Revises: c1d2e3f4a5b6
Create Date: 2025-01-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "d7b8c9e0f1a2"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "strava_athlete_id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=True
    )
    op.alter_column(
        "activities",
        "strava_activity_id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "activities",
        "strava_activity_id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=True
    )
    op.alter_column(
        "users",
        "strava_athlete_id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=True
    )
