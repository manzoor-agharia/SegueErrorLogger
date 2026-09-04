"""revert the earlier Fixed -> ReadyForQA rename; they're separate statuses now

Revision ID: c7d2e4f6a8b0
Revises: a9c3e5f7b1d4
Create Date: 2026-09-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c7d2e4f6a8b0'
down_revision: Union[str, None] = 'a9c3e5f7b1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # "Fixed" and "Ready for QA" are distinct statuses now rather than a rename, so undo the
    # earlier data migration (a9c3e5f7b1d4) that moved existing FIXED rows to READY_FOR_QA.
    op.execute("UPDATE error_logs SET status = 'FIXED' WHERE status = 'READY_FOR_QA'")
    op.execute("UPDATE error_log_status_history SET old_status = 'FIXED' WHERE old_status = 'READY_FOR_QA'")
    op.execute("UPDATE error_log_status_history SET new_status = 'FIXED' WHERE new_status = 'READY_FOR_QA'")


def downgrade() -> None:
    op.execute("UPDATE error_logs SET status = 'READY_FOR_QA' WHERE status = 'FIXED'")
    op.execute("UPDATE error_log_status_history SET old_status = 'READY_FOR_QA' WHERE old_status = 'FIXED'")
    op.execute("UPDATE error_log_status_history SET new_status = 'READY_FOR_QA' WHERE new_status = 'FIXED'")
