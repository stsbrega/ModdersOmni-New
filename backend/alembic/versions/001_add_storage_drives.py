"""add storage_drives column to users

Revision ID: 001_add_storage_drives
Revises:
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

revision = "001_add_storage_drives"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'users' AND column_name = 'storage_drives'"
    ))
    if result.scalar() is None:
        op.add_column("users", sa.Column("storage_drives", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "storage_drives")
