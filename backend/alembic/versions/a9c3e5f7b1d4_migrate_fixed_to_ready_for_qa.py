"""migrate existing Fixed error logs to ReadyForQA

Revision ID: a9c3e5f7b1d4
Revises: f2b6d8e0a3c7
Create Date: 2026-09-04 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a9c3e5f7b1d4'
down_revision: Union[str, None] = 'f2b6d8e0a3c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE error_logs SET status = 'READY_FOR_QA' WHERE status = 'FIXED'")
    op.execute("UPDATE error_log_status_history SET old_status = 'READY_FOR_QA' WHERE old_status = 'FIXED'")
    op.execute("UPDATE error_log_status_history SET new_status = 'READY_FOR_QA' WHERE new_status = 'FIXED'")


def downgrade() -> None:
    op.execute("UPDATE error_logs SET status = 'FIXED' WHERE status = 'READY_FOR_QA'")
    op.execute("UPDATE error_log_status_history SET old_status = 'FIXED' WHERE old_status = 'READY_FOR_QA'")
    op.execute("UPDATE error_log_status_history SET new_status = 'FIXED' WHERE new_status = 'READY_FOR_QA'")
