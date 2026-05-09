from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompatibilityRule(Base):
    __tablename__ = "compatibility_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    mod_id: Mapped[int] = mapped_column(ForeignKey("mods.id"))
    related_mod_id: Mapped[int] = mapped_column(ForeignKey("mods.id"))
    rule_type: Mapped[str] = mapped_column(String(20))  # requires, conflicts, patch_available, load_after
    patch_mod_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("mods.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
