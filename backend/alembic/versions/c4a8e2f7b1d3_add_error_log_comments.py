"""add error_log_comments

Revision ID: c4a8e2f7b1d3
Revises: b3f7c1d9e4a6
Create Date: 2026-09-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c4a8e2f7b1d3'
down_revision: Union[str, None] = 'b3f7c1d9e4a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_log_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('error_log_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.ForeignKeyConstraint(['error_log_id'], ['error_logs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_error_log_comments_error_log_id'), 'error_log_comments', ['error_log_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_error_log_comments_error_log_id'), table_name='error_log_comments')
    op.drop_table('error_log_comments')
