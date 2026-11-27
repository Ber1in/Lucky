"""allow multiplier 1

Revision ID: b1c2d3e4f5a6
Revises: 4a82f337bd4f
Create Date: 2026-11-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "4a82f337bd4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("ck_bets_multiplier", "bets", type_="check")
        op.create_check_constraint(
            "ck_bets_multiplier", "bets", "multiplier >= 1 AND multiplier <= 99"
        )
    else:
        with op.batch_alter_table("bets") as batch_op:
            batch_op.drop_constraint("ck_bets_multiplier", type_="check")
            batch_op.create_check_constraint(
                "ck_bets_multiplier", "multiplier >= 1 AND multiplier <= 99"
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("ck_bets_multiplier", "bets", type_="check")
        op.create_check_constraint(
            "ck_bets_multiplier", "bets", "multiplier >= 2 AND multiplier <= 99"
        )
    else:
        with op.batch_alter_table("bets") as batch_op:
            batch_op.drop_constraint("ck_bets_multiplier", type_="check")
            batch_op.create_check_constraint(
                "ck_bets_multiplier", "multiplier >= 2 AND multiplier <= 99"
            )
