"""add is_active to users

Revision ID: 5f3a1b8c2d4e
Revises: 304132447c9a
Create Date: 2026-09-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5f3a1b8c2d4e'
down_revision: Union[str, None] = '304132447c9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column('users', 'is_active', server_default=None)


def downgrade() -> None:
    op.drop_column('users', 'is_active')
