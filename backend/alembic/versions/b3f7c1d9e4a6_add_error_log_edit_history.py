"""add error_log_edit_history

Revision ID: b3f7c1d9e4a6
Revises: 9d4e5f8a2c1b
Create Date: 2026-09-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b3f7c1d9e4a6'
down_revision: Union[str, None] = '9d4e5f8a2c1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_log_edit_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('error_log_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('changed_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['error_log_id'], ['error_logs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('error_log_edit_history')
