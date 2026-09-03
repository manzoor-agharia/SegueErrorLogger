"""add environment to error_logs

Revision ID: 9d4e5f8a2c1b
Revises: 7a2c9e6f1b3d
Create Date: 2026-09-04 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '9d4e5f8a2c1b'
down_revision: Union[str, None] = '7a2c9e6f1b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_environment_enum = postgresql.ENUM(
    'DEV', 'STAGING', 'MASTER', 'QA', 'PRODUCTION', name='error_environment'
)


def upgrade() -> None:
    _environment_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'error_logs',
        sa.Column(
            'environment',
            _environment_enum,
            nullable=False,
            server_default='DEV',
        ),
    )
    op.alter_column('error_logs', 'environment', server_default=None)


def downgrade() -> None:
    op.drop_column('error_logs', 'environment')
    _environment_enum.drop(op.get_bind(), checkfirst=True)
