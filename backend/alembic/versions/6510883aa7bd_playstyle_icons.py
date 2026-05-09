"""playstyle_icons

Replaces the 2-letter placeholder icon strings on existing playstyle rows
with proper Lucide icon names. The seed inserts new rows but does not update
existing ones, so prod's pre-existing playstyles need an explicit UPDATE.

Matching is done on the compound key (game.slug, playstyle.slug) so the
migration is idempotent and survives seed-row reordering.

Revision ID: 6510883aa7bd
Revises: 0bb29e20bfe6
Create Date: 2026-04-21
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "6510883aa7bd"
down_revision: Union[str, None] = "0bb29e20bfe6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (game_slug, playstyle_slug, new_icon)
ICON_UPDATES: list[tuple[str, str, str]] = [
    ("skyrimse", "vanilla-plus", "sparkles"),
    ("skyrimse", "survival", "tent"),
    ("skyrimse", "combat", "swords"),
    ("skyrimse", "magic", "wand-2"),
    ("skyrimse", "visual", "camera"),
    ("skyrimse", "immersion", "drama"),
    ("fallout4", "vanilla-plus", "sparkles"),
    ("fallout4", "survival", "tent"),
    ("fallout4", "settlement", "hammer"),
    ("fallout4", "combat", "swords"),
    ("fallout4", "visual", "camera"),
    ("fallout4", "sim-settlements", "building-2"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for game_slug, ps_slug, icon in ICON_UPDATES:
        conn.execute(
            text(
                "UPDATE playstyles "
                "SET icon = :icon "
                "WHERE slug = :ps_slug "
                "AND game_id = (SELECT id FROM games WHERE slug = :game_slug)"
            ),
            {"icon": icon, "ps_slug": ps_slug, "game_slug": game_slug},
        )


def downgrade() -> None:
    # Best-effort restore of the prior 2-letter codes for parity with the
    # seed at the previous revision.
    reverse_map = {
        ("skyrimse", "vanilla-plus"): "V+",
        ("skyrimse", "survival"): "SV",
        ("skyrimse", "combat"): "CB",
        ("skyrimse", "magic"): "MG",
        ("skyrimse", "visual"): "GX",
        ("skyrimse", "immersion"): "RP",
        ("fallout4", "vanilla-plus"): "V+",
        ("fallout4", "survival"): "SV",
        ("fallout4", "settlement"): "SB",
        ("fallout4", "combat"): "CB",
        ("fallout4", "visual"): "GX",
        ("fallout4", "sim-settlements"): "SS",
    }
    conn = op.get_bind()
    for (game_slug, ps_slug), icon in reverse_map.items():
        conn.execute(
            text(
                "UPDATE playstyles "
                "SET icon = :icon "
                "WHERE slug = :ps_slug "
                "AND game_id = (SELECT id FROM games WHERE slug = :game_slug)"
            ),
            {"icon": icon, "ps_slug": ps_slug, "game_slug": game_slug},
        )
