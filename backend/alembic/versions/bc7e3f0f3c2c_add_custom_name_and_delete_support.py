"""Add custom_name column to activities for user overrides

Revision ID: bc7e3f0f3c2c
Revises: 213f03d3694a
Create Date: 2025-12-03 11:05:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "bc7e3f0f3c2c"
down_revision: Union[str, None] = "213f03d3694a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("custom_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "custom_name")
