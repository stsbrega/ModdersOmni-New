"""Plugin token authentication service.

Handles creation, validation, listing, and revocation of long-lived plugin
tokens used by MO2/Vortex mod manager plugins. Follows the same SHA-256
hash-and-store pattern as refresh tokens in services/auth.py.
"""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plugin_token import PluginToken

logger = logging.getLogger(__name__)

# Default token lifetime: 90 days
DEFAULT_EXPIRY_DAYS = 90
# Maximum active (non-revoked) tokens per user
MAX_TOKENS_PER_USER = 5


def _hash_token(raw_token: str) -> str:
    """SHA-256 hash a raw token for storage."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def create_plugin_token(
    user_id: uuid.UUID,
    name: str,
    db: AsyncSession,
    scopes: str = "export,download",
    expiry_days: int = DEFAULT_EXPIRY_DAYS,
) -> tuple[str, PluginToken]:
    """Create a new plugin token. Returns (raw_token, db_record).

    The raw token is a URL-safe random string prefixed with 'mopl_' for
    easy identification. It is only returned once — the DB stores the hash.
    """
    # Check active token count
    result = await db.execute(
        select(PluginToken).where(
            PluginToken.user_id == user_id,
            PluginToken.revoked == False,  # noqa: E712
        )
    )
    active_tokens = list(result.scalars().all())
    if len(active_tokens) >= MAX_TOKENS_PER_USER:
        raise ValueError(
            f"Maximum of {MAX_TOKENS_PER_USER} active plugin tokens allowed. "
            "Revoke an existing token first."
        )

    # Generate token with recognizable prefix
    raw_token = f"mopl_{secrets.token_urlsafe(32)}"
    token_hash = _hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(days=expiry_days)

    db_token = PluginToken(
        user_id=user_id,
        token_hash=token_hash,
        name=name[:100],  # Enforce max length
        scopes=scopes,
        expires_at=expires_at,
    )
    db.add(db_token)
    await db.flush()

    logger.info(f"Created plugin token '{name}' for user {user_id}")
    return raw_token, db_token


async def validate_plugin_token(
    raw_token: str,
    db: AsyncSession,
    required_scope: str | None = None,
) -> PluginToken | None:
    """Validate a plugin token and return the DB record if valid.

    Checks: exists, not revoked, not expired, has required scope.
    Updates last_used_at on successful validation.
    """
    token_hash = _hash_token(raw_token)
    result = await db.execute(
        select(PluginToken).where(
            PluginToken.token_hash == token_hash,
            PluginToken.revoked == False,  # noqa: E712
        )
    )
    token = result.scalar_one_or_none()

    if token is None:
        return None

    # Check expiration
    if token.expires_at < datetime.utcnow():
        return None

    # Check scope if required
    if required_scope:
        token_scopes = {s.strip() for s in token.scopes.split(",")}
        if required_scope not in token_scopes:
            return None

    # Update last-used timestamp
    token.last_used_at = datetime.utcnow()
    await db.flush()

    return token


async def list_plugin_tokens(
    user_id: uuid.UUID,
    db: AsyncSession,
    include_revoked: bool = False,
) -> list[PluginToken]:
    """List plugin tokens for a user, newest first."""
    query = select(PluginToken).where(PluginToken.user_id == user_id)
    if not include_revoked:
        query = query.where(PluginToken.revoked == False)  # noqa: E712
    query = query.order_by(PluginToken.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def revoke_plugin_token(
    token_id: int,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Revoke a specific plugin token. Returns True if found and revoked."""
    result = await db.execute(
        select(PluginToken).where(
            PluginToken.id == token_id,
            PluginToken.user_id == user_id,
        )
    )
    token = result.scalar_one_or_none()
    if token is None:
        return False

    token.revoked = True
    await db.flush()
    logger.info(f"Revoked plugin token {token_id} for user {user_id}")
    return True


async def revoke_all_plugin_tokens(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> int:
    """Revoke all active plugin tokens for a user. Returns count revoked."""
    result = await db.execute(
        select(PluginToken).where(
            PluginToken.user_id == user_id,
            PluginToken.revoked == False,  # noqa: E712
        )
    )
    tokens = list(result.scalars().all())
    for token in tokens:
        token.revoked = True

    if tokens:
        await db.flush()
        logger.info(f"Revoked {len(tokens)} plugin tokens for user {user_id}")
    return len(tokens)
