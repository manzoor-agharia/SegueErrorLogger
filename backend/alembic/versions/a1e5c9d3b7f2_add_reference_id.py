"""add reference_id (type-date-daily-counter) to error_logs

Revision ID: a1e5c9d3b7f2
Revises: f4c8b1a3d6e9
Create Date: 2026-09-05 09:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1e5c9d3b7f2'
down_revision: Union[str, None] = 'f4c8b1a3d6e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_log_type_enum = postgresql.ENUM('ERROR', 'FEATURE', 'SUGGESTION', name='log_type', create_type=False)


def upgrade() -> None:
    op.create_table(
        'reference_counters',
        sa.Column('log_type', _log_type_enum, nullable=False),
        sa.Column('ref_date', sa.Date(), nullable=False),
        sa.Column('counter', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('log_type', 'ref_date'),
    )

    op.add_column('error_logs', sa.Column('reference_id', sa.String(length=20), nullable=True))

    # Backfill existing rows in creation order, grouped by (log_type, day) -- matches the
    # exact scheme _next_reference_id() uses for new rows, so old and new ids look the same.
    op.execute(
        """
        WITH numbered AS (
            SELECT id, log_type, created_at::date AS d,
                   ROW_NUMBER() OVER (PARTITION BY log_type, created_at::date ORDER BY created_at, id) AS rn
            FROM error_logs
        )
        UPDATE error_logs e
        SET reference_id = (
                CASE numbered.log_type
                    WHEN 'ERROR' THEN 'ERR'
                    WHEN 'FEATURE' THEN 'FEA'
                    WHEN 'SUGGESTION' THEN 'SUG'
                END
            ) || '-' || to_char(numbered.d, 'DDMMYYYY') || '-' || lpad(numbered.rn::text, 2, '0')
        FROM numbered
        WHERE e.id = numbered.id
        """
    )

    op.execute(
        """
        INSERT INTO reference_counters (log_type, ref_date, counter)
        SELECT log_type, created_at::date, COUNT(*)
        FROM error_logs
        GROUP BY log_type, created_at::date
        """
    )

    op.alter_column('error_logs', 'reference_id', nullable=False)
    op.create_index(op.f('ix_error_logs_reference_id'), 'error_logs', ['reference_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_error_logs_reference_id'), table_name='error_logs')
    op.drop_column('error_logs', 'reference_id')
    op.drop_table('reference_counters')
