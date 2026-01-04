"""add strava_last_sync to users

Revision ID: e3a1f9c2b7d4
Revises: f2b4c6d8e0f1
Create Date: 2026-01-03 21:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e3a1f9c2b7d4"
down_revision = "f2b4c6d8e0f1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("strava_last_sync", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("users", "strava_last_sync")
