"""add ReadyForQA error status

Revision ID: f2b6d8e0a3c7
Revises: e1a4b7c9d2f5
Create Date: 2026-09-04 11:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'f2b6d8e0a3c7'
down_revision: Union[str, None] = 'e1a4b7c9d2f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A new enum value can't be used in the same transaction that adds it -- not even from a
    # later migration, since `alembic upgrade head` runs the whole batch on one connection.
    # autocommit_block() forces a real commit here so the next revision's UPDATE can see it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE error_status ADD VALUE IF NOT EXISTS 'READY_FOR_QA'")


def downgrade() -> None:
    # Removing a value from a Postgres enum requires recreating the type; not supported here.
    pass
