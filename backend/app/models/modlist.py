import uuid
from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.database import Base


class Modlist(Base):
    __tablename__ = "modlists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"))
    game_version: Mapped[str | None] = mapped_column(String(30), nullable=True)
    playstyle_id: Mapped[int | None] = mapped_column(ForeignKey("playstyles.id"), nullable=True)
    custom_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_mods: Mapped[list | None] = mapped_column(JSON, nullable=True)
    gpu_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cpu_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ram_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vram_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    llm_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    debug_log: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    entries: Mapped[list["ModlistEntry"]] = relationship(back_populates="modlist")
    knowledge_flags: Mapped[list["ModlistKnowledgeFlag"]] = relationship(back_populates="modlist")
    user: Mapped["User | None"] = relationship(back_populates="modlists")  # noqa: F821


class ModlistEntry(Base):
    __tablename__ = "modlist_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    modlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modlists.id")
    )
    # mod_id is nullable — Nexus-discovered mods may not be in our mods table
    mod_id: Mapped[int | None] = mapped_column(ForeignKey("mods.id"), nullable=True)
    nexus_mod_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Denormalized fields so we don't need the mods FK for display
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    load_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    download_status: Mapped[str] = mapped_column(String(20), default="pending")
    is_patch: Mapped[bool] = mapped_column(Boolean, default=False)
    patches_mods: Mapped[list | None] = mapped_column(JSON, nullable=True)
    compatibility_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    modlist: Mapped["Modlist"] = relationship(back_populates="entries")


class ModlistKnowledgeFlag(Base):
    __tablename__ = "modlist_knowledge_flags"

    id: Mapped[int] = mapped_column(primary_key=True)
    modlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modlists.id")
    )
    mod_a_name: Mapped[str] = mapped_column(String(255))
    mod_b_name: Mapped[str] = mapped_column(String(255))
    issue: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20))  # "warning" or "critical"

    modlist: Mapped["Modlist"] = relationship(back_populates="knowledge_flags")
