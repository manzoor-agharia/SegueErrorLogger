"""add error_log_assignment_history

Revision ID: d5b9f3a1c6e8
Revises: c4a8e2f7b1d3
Create Date: 2026-09-04 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd5b9f3a1c6e8'
down_revision: Union[str, None] = 'c4a8e2f7b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_log_assignment_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('error_log_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('old_assigned_to_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('new_assigned_to_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('changed_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['error_log_id'], ['error_logs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['new_assigned_to_id'], ['users.id']),
        sa.ForeignKeyConstraint(['old_assigned_to_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_error_log_assignment_history_error_log_id'),
        'error_log_assignment_history',
        ['error_log_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_error_log_assignment_history_error_log_id'), table_name='error_log_assignment_history'
    )
    op.drop_table('error_log_assignment_history')
