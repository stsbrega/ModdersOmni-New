"""Background refresh for stored Nexus OAuth tokens.

Iterates UserNexusToken rows, and for any whose access token is within
the refresh window (configurable, default 5 minutes), swaps the refresh
token for a fresh access token. Tokens without a refresh_token are left
alone — we can't refresh them, so they'll stop working when they expire
and the user will need to re-consent.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.database import async_session
from app.models.user_nexus_token import UserNexusToken
from app.services import nexus_oauth

logger = logging.getLogger(__name__)

# Refresh tokens that expire within this window
_REFRESH_AHEAD = timedelta(minutes=5)


async def refresh_expiring_tokens() -> dict:
    """Run one pass: refresh every token within _REFRESH_AHEAD of expiry.

    Returns a stats dict for logging/observability.
    """
    if not nexus_oauth.is_configured():
        return {"refreshed": 0, "skipped": 0, "errors": 0, "reason": "not_configured"}

    now = datetime.utcnow()
    cutoff = now + _REFRESH_AHEAD
    stats = {"refreshed": 0, "skipped": 0, "errors": 0}

    async with async_session() as db:
        result = await db.execute(
            select(UserNexusToken).where(
                UserNexusToken.expires_at.is_not(None),
                UserNexusToken.expires_at <= cutoff,
                UserNexusToken.refresh_token.is_not(None),
            )
        )
        tokens = list(result.scalars().all())

        for t in tokens:
            if not t.refresh_token:
                stats["skipped"] += 1
                continue
            try:
                new_token = await nexus_oauth.refresh_token(t.refresh_token)
            except Exception as e:
                logger.warning("Nexus token refresh failed for user %s: %s", t.user_id, e)
                stats["errors"] += 1
                continue

            access_token = new_token.get("access_token")
            if not access_token:
                logger.warning("Refresh returned no access_token for user %s", t.user_id)
                stats["errors"] += 1
                continue

            t.access_token = access_token
            # Nexus may or may not rotate the refresh_token — keep the old one
            # if a new one isn't provided, per OAuth2 best practice.
            if new_token.get("refresh_token"):
                t.refresh_token = new_token["refresh_token"]
            t.expires_at = nexus_oauth.compute_expires_at(new_token)
            scope = new_token.get("scope")
            if scope:
                t.scope = scope
            stats["refreshed"] += 1

        await db.commit()

    if stats["refreshed"] or stats["errors"]:
        logger.info(
            "Nexus token refresh pass: refreshed=%d skipped=%d errors=%d",
            stats["refreshed"], stats["skipped"], stats["errors"],
        )
    return stats
