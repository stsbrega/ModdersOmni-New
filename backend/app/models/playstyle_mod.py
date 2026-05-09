from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PlaystyleMod(Base):
    __tablename__ = "playstyle_mods"

    playstyle_id: Mapped[int] = mapped_column(
        ForeignKey("playstyles.id"), primary_key=True
    )
    mod_id: Mapped[int] = mapped_column(ForeignKey("mods.id"), primary_key=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    hardware_tier_min: Mapped[str | None] = mapped_column(String(10), nullable=True)
