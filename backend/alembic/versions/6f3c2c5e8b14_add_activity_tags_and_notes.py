"""add_activity_tags_and_notes

Revision ID: 6f3c2c5e8b14
Revises: bd6717b330b9
Create Date: 2025-01-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f3c2c5e8b14'
down_revision: Union[str, None] = 'bd6717b330b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('activities', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('activities', sa.Column('rpe', sa.Integer(), nullable=True))

    op.create_table(
        'activity_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_activity_tags_user_name')
    )
    op.create_index(op.f('ix_activity_tags_id'), 'activity_tags', ['id'], unique=False)

    op.create_table(
        'activity_tag_associations',
        sa.Column('activity_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['activity_id'], ['activities.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['activity_tags.id'], ),
        sa.PrimaryKeyConstraint('activity_id', 'tag_id')
    )


def downgrade() -> None:
    op.drop_table('activity_tag_associations')
    op.drop_index(op.f('ix_activity_tags_id'), table_name='activity_tags')
    op.drop_table('activity_tags')
    op.drop_column('activities', 'rpe')
    op.drop_column('activities', 'notes')
