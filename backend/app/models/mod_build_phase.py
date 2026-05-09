from __future__ import annotations

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ModBuildPhase(Base):
    """Defines an ordered phase for building a modlist for a specific game.

    Each game has its own set of phases (e.g., Skyrim has 10 phases from
    Essentials to Compatibility Patches). The AI generation pipeline
    iterates through phases in order, using phase-specific prompts and rules.
    """

    __tablename__ = "mod_build_phases"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"))
    phase_number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    search_guidance: Mapped[str] = mapped_column(Text)
    rules: Mapped[str] = mapped_column(Text)
    example_mods: Mapped[str] = mapped_column(Text, default="")
    is_playstyle_driven: Mapped[bool] = mapped_column(Boolean, default=False)
    max_mods: Mapped[int] = mapped_column(Integer, default=5)
    scale_weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    sub_pass_guidance: Mapped[list | None] = mapped_column(JSON, nullable=True)
