"""add Suggestion log_type value

Revision ID: f4c8b1a3d6e9
Revises: d8f1a3c5e7b9
Create Date: 2026-09-05 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'f4c8b1a3d6e9'
down_revision: Union[str, None] = 'd8f1a3c5e7b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # See f2b6d8e0a3c7 -- a new enum value can't be used in the same transaction that adds
    # it, so this is kept as its own migration ahead of the one that assigns reference_ids.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE log_type ADD VALUE IF NOT EXISTS 'SUGGESTION'")


def downgrade() -> None:
    # Removing a value from a Postgres enum requires recreating the type; not supported here.
    pass
