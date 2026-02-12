"""Add route polyline to activities

Revision ID: b7a4e5c6d7e8
Revises: e3a1f9c2b7d4
Create Date: 2026-01-03 20:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7a4e5c6d7e8"
down_revision: Union[str, None] = "e3a1f9c2b7d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("route_polyline", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "route_polyline")
