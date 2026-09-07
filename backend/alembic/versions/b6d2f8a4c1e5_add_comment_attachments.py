"""add error_log_comment_attachments

Revision ID: b6d2f8a4c1e5
Revises: a1e5c9d3b7f2
Create Date: 2026-09-07 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b6d2f8a4c1e5'
down_revision: Union[str, None] = 'a1e5c9d3b7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_log_comment_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('original_filename', sa.String(length=300), nullable=False),
        sa.Column('content_type', sa.String(length=150), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['comment_id'], ['error_log_comments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_error_log_comment_attachments_comment_id'),
        'error_log_comment_attachments',
        ['comment_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_error_log_comment_attachments_comment_id'), table_name='error_log_comment_attachments'
    )
    op.drop_table('error_log_comment_attachments')
