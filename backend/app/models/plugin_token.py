"""Plugin authentication tokens for MO2/Vortex mod manager plugins.

Long-lived tokens that plugins store locally to authenticate with the API
without requiring browser-based OAuth. Users generate these from the Settings
page and paste them into their mod manager plugin.

Security: Only the SHA-256 hash is stored — the raw token is shown once at
creation time and cannot be recovered. Same pattern as refresh tokens.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PluginToken(Base):
    __tablename__ = "plugin_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(100))  # User-visible label, e.g. "My MO2 Plugin"
    scopes: Mapped[str] = mapped_column(
        Text, default="export,download"
    )  # Comma-separated scopes
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime] = mapped_column()

    user: Mapped["User"] = relationship(back_populates="plugin_tokens")  # noqa: F821
