"""add_template_id_to_training_plans

Revision ID: c1d2e3f4a5b6
Revises: 6f3c2c5e8b14
Create Date: 2025-01-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = '6f3c2c5e8b14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('training_plans', sa.Column('template_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('training_plans', 'template_id')
