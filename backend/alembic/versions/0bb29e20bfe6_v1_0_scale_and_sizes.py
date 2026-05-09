"""v1_0_scale_and_sizes

Adds the three v1.0 Block B columns:
    - modlist_entries.file_size_bytes (BigInteger, nullable) — captured from
      Nexus on every add_to_modlist for the post-generation size summary.
    - mod_build_phases.scale_weight (Float, default 1.0, not null) — per-phase
      budget multiplier used by the sub-pass planner.
    - mod_build_phases.sub_pass_guidance (JSON, nullable) — optional list of
      sub-pass themes for phases that split into more than one pass.

``scale_weight`` uses ``server_default="1.0"`` so the non-null column can be
added to the already-populated mod_build_phases table without a manual
backfill. The server default is retained rather than dropped because new
phases should continue to default to 1.0 when seeded without an explicit
weight.

Revision ID: 0bb29e20bfe6
Revises: 3bafe21fc9f7
Create Date: 2026-04-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0bb29e20bfe6"
down_revision: Union[str, None] = "3bafe21fc9f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "modlist_entries",
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "mod_build_phases",
        sa.Column(
            "scale_weight",
            sa.Float(),
            server_default="1.0",
            nullable=False,
        ),
    )
    op.add_column(
        "mod_build_phases",
        sa.Column("sub_pass_guidance", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mod_build_phases", "sub_pass_guidance")
    op.drop_column("mod_build_phases", "scale_weight")
    op.drop_column("modlist_entries", "file_size_bytes")
