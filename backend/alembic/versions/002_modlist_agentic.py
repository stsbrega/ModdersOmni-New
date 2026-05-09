"""Agentic modlist: denormalize entries, add knowledge flags

Revision ID: 002_modlist_agentic
Revises: 001_add_storage_drives
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "002_modlist_agentic"
down_revision = "001_add_storage_drives"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.scalar() is not None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :table"
    ), {"table": table})
    return result.scalar() is not None


def upgrade() -> None:
    # Make mod_id nullable (Nexus-discovered mods won't be in mods table)
    op.alter_column("modlist_entries", "mod_id", nullable=True)

    # Add denormalized + agentic fields to modlist_entries
    new_columns = [
        ("nexus_mod_id", sa.Column("nexus_mod_id", sa.Integer(), nullable=True)),
        ("name", sa.Column("name", sa.String(255), nullable=True)),
        ("author", sa.Column("author", sa.String(100), nullable=True)),
        ("summary", sa.Column("summary", sa.Text(), nullable=True)),
        ("reason", sa.Column("reason", sa.Text(), nullable=True)),
        ("is_patch", sa.Column("is_patch", sa.Boolean(), server_default="false", nullable=False)),
        ("patches_mods", sa.Column("patches_mods", sa.JSON(), nullable=True)),
        ("compatibility_notes", sa.Column("compatibility_notes", sa.Text(), nullable=True)),
    ]
    for col_name, col in new_columns:
        if not _column_exists("modlist_entries", col_name):
            op.add_column("modlist_entries", col)

    # Create knowledge flags table
    if not _table_exists("modlist_knowledge_flags"):
        op.create_table(
            "modlist_knowledge_flags",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("modlist_id", UUID(as_uuid=True), sa.ForeignKey("modlists.id"), nullable=False),
            sa.Column("mod_a_name", sa.String(255), nullable=False),
            sa.Column("mod_b_name", sa.String(255), nullable=False),
            sa.Column("issue", sa.Text(), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("modlist_knowledge_flags")

    op.drop_column("modlist_entries", "compatibility_notes")
    op.drop_column("modlist_entries", "patches_mods")
    op.drop_column("modlist_entries", "is_patch")
    op.drop_column("modlist_entries", "reason")
    op.drop_column("modlist_entries", "summary")
    op.drop_column("modlist_entries", "author")
    op.drop_column("modlist_entries", "name")
    op.drop_column("modlist_entries", "nexus_mod_id")

    op.alter_column("modlist_entries", "mod_id", nullable=False)
