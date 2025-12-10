"""Add Strava OAuth fields

Revision ID: 213f03d3694a
Revises: ea1f410664d0
Create Date: 2025-11-18 17:47:16.577305

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '213f03d3694a'
down_revision: Union[str, None] = 'ea1f410664d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All Strava fields and indexes are created in the base migration for SQLite compatibility.
    # No-op upgrade.
    pass


def downgrade() -> None:
    # No-op downgrade (fields already part of base schema).
    pass
