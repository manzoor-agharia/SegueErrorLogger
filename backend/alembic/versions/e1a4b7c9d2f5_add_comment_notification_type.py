"""add Comment notification type

Revision ID: e1a4b7c9d2f5
Revises: d5b9f3a1c6e8
Create Date: 2026-09-04 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e1a4b7c9d2f5'
down_revision: Union[str, None] = 'd5b9f3a1c6e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'COMMENT'")


def downgrade() -> None:
    # Removing a value from a Postgres enum requires recreating the type; not supported here.
    pass
