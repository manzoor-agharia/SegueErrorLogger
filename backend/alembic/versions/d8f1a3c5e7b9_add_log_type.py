"""add log_type (Error/Feature) to error_logs

Revision ID: d8f1a3c5e7b9
Revises: c7d2e4f6a8b0
Create Date: 2026-09-04 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd8f1a3c5e7b9'
down_revision: Union[str, None] = 'c7d2e4f6a8b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_log_type_enum = postgresql.ENUM('ERROR', 'FEATURE', name='log_type')


def upgrade() -> None:
    _log_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'error_logs',
        sa.Column('log_type', _log_type_enum, nullable=False, server_default='ERROR'),
    )
    op.alter_column('error_logs', 'log_type', server_default=None)


def downgrade() -> None:
    op.drop_column('error_logs', 'log_type')
    _log_type_enum.drop(op.get_bind(), checkfirst=True)
