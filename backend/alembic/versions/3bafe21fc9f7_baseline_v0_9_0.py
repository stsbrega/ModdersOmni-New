"""baseline_v0_9_0

Marker migration representing the ModdersOmni v0.9.0 schema: the combined
output of migrations 001..004 plus the current SQLAlchemy models under
``app/models``. Intentionally a no-op because, when combined with the four
prior idempotent migrations, ``alembic upgrade head`` on a fresh database
produces the exact schema described by ``Base.metadata`` at the v0.9.0 tag.

This file exists so that:

* Block B's schema additions (``modlist_entries.file_size_bytes``,
  ``mod_build_phases.scale_weight`` / ``sub_pass_guidance``) can cleanly
  revise off a named baseline rather than dangling off ``004_add_mod_build_phases``.
* Existing production databases (built via ``Base.metadata.create_all`` in
  prior releases) can be stamped to this revision so subsequent migrations
  do not try to recreate already-present tables.

Revision ID: 3bafe21fc9f7
Revises: 004_add_mod_build_phases
Create Date: 2026-04-20
"""
from typing import Sequence, Union


revision: str = "3bafe21fc9f7"
down_revision: Union[str, None] = "004_add_mod_build_phases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
