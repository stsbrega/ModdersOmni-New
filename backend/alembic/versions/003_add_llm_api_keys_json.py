"""Add llm_api_keys JSON column to user_settings

Revision ID: 003_add_llm_api_keys_json
Revises: 002_modlist_agentic
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

revision = "003_add_llm_api_keys_json"
down_revision = "002_modlist_agentic"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Idempotent: only add if column doesn't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'user_settings' AND column_name = 'llm_api_keys'"
    ))
    if result.scalar() is None:
        op.add_column(
            "user_settings",
            sa.Column("llm_api_keys", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        )

    # Migrate existing individual key columns into the JSON column. On DBs where
    # seeds/run_seed.py's inline migration has already dropped the legacy
    # per-provider columns (current state on prod), skip the backfill — there
    # is no source data left to migrate.
    legacy_count = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name = 'user_settings' "
        "AND column_name IN ('groq_api_key', 'together_api_key', 'huggingface_api_key')"
    )).scalar()
    if legacy_count == 3:
        conn.execute(sa.text("""
            UPDATE user_settings
            SET llm_api_keys = json_build_object(
                'groq', COALESCE(NULLIF(groq_api_key, ''), ''),
                'together', COALESCE(NULLIF(together_api_key, ''), ''),
                'huggingface', COALESCE(NULLIF(huggingface_api_key, ''), '')
            )
            WHERE llm_api_keys::text = '{}'
        """))


def downgrade() -> None:
    op.drop_column("user_settings", "llm_api_keys")
