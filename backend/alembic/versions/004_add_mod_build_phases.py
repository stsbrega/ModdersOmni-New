"""Add mod_build_phases table for phased generation

Revision ID: 004_add_mod_build_phases
Revises: 003_add_llm_api_keys_json
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

revision = "004_add_mod_build_phases"
down_revision = "003_add_llm_api_keys_json"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Idempotent: only create if table doesn't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_name = 'mod_build_phases'"
    ))
    if result.scalar() is None:
        op.create_table(
            "mod_build_phases",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("game_id", sa.Integer(), sa.ForeignKey("games.id"), nullable=False),
            sa.Column("phase_number", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("search_guidance", sa.Text(), nullable=False),
            sa.Column("rules", sa.Text(), nullable=False),
            sa.Column("example_mods", sa.Text(), server_default="", nullable=False),
            sa.Column("is_playstyle_driven", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("max_mods", sa.Integer(), server_default="5", nullable=False),
        )


def downgrade() -> None:
    op.drop_table("mod_build_phases")
