"""Add sort_order to planned_workouts

Revision ID: f2b4c6d8e0f1
Revises: d7b8c9e0f1a2
Create Date: 2025-12-30 19:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2b4c6d8e0f1"
down_revision = "d7b8c9e0f1a2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "planned_workouts",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0")
    )
    op.alter_column("planned_workouts", "sort_order", server_default=None)


def downgrade():
    op.drop_column("planned_workouts", "sort_order")
