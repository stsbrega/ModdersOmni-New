"""Nexus Mods OAuth2 endpoints.

Flow:
  GET  /api/nexus/oauth/authorize  → { authorize_url }  (auth required: creates flow cookie)
  GET  /api/nexus/oauth/callback   → Nexus redirects here; validates cookie (no header auth)
  GET  /api/nexus/oauth/status     → { configured, connected, username?, expires_at?, scope? }
  POST /api/nexus/oauth/disconnect → delete stored token

The callback uses a self-contained HMAC-signed cookie (nexus_oauth_flow)
that carries state + PKCE verifier + the initiating user's id — browsers
don't send custom Authorization headers on a plain OAuth redirect, so we
can't rely on get_current_user there.
"""

import logging
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.user_nexus_token import UserNexusToken
from app.services import nexus_oauth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/authorize")
async def authorize(
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """Kick off the Nexus OAuth flow. Returns a redirect URL in JSON.

    Frontend opens this URL (window.location = r.authorize_url). On return,
    Nexus redirects to /callback which completes the exchange.
    """
    if not nexus_oauth.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Nexus OAuth is not configured yet. Client registration pending with Nexus Support.",
        )

    cookie_value, flow = nexus_oauth.create_flow(str(current_user.id))
    url = nexus_oauth.build_authorize_url(flow.state, flow.code_verifier)

    response.set_cookie(
        nexus_oauth.NEXUS_FLOW_COOKIE,
        cookie_value,
        max_age=600,
        httponly=True,
        secure=True,
        samesite="lax",
        path=nexus_oauth.NEXUS_FLOW_COOKIE_PATH,
    )
    return {"authorize_url": url}


@router.get("/callback")
async def callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Nexus redirects here with ?code=...&state=...

    No auth header is expected on this request (browser redirect). The
    signed cookie carries the initiating user's id; we trust it after
    HMAC verification.
    """
    settings = get_settings()
    code = request.query_params.get("code")
    url_state = request.query_params.get("state")
    cookie_value = request.cookies.get(nexus_oauth.NEXUS_FLOW_COOKIE)

    def _redirect_err(reason: str) -> RedirectResponse:
        resp = RedirectResponse(
            url=f"{settings.frontend_url}/settings?nexus=error",
            status_code=302,
        )
        resp.delete_cookie(
            nexus_oauth.NEXUS_FLOW_COOKIE,
            path=nexus_oauth.NEXUS_FLOW_COOKIE_PATH,
        )
        logger.warning("Nexus OAuth callback failed: %s", reason)
        return resp

    if not code:
        return _redirect_err("missing code")

    flow = nexus_oauth.consume_flow(cookie_value, url_state)
    if not flow:
        return _redirect_err("invalid or expired state cookie")

    try:
        user_uuid = _uuid.UUID(flow.user_id)
    except ValueError:
        return _redirect_err("invalid user_id in cookie")

    user = await db.get(User, user_uuid)
    if not user:
        return _redirect_err("user not found")

    try:
        token = await nexus_oauth.exchange_code_for_token(code, flow.code_verifier)
    except Exception as e:
        logger.warning("Nexus token exchange failed: %s", e)
        return _redirect_err(f"token exchange: {type(e).__name__}")

    access_token = token.get("access_token")
    if not access_token:
        return _redirect_err("no access_token in response")

    existing = await db.get(UserNexusToken, user.id)
    if existing:
        existing.access_token = access_token
        existing.refresh_token = token.get("refresh_token")
        existing.expires_at = nexus_oauth.compute_expires_at(token)
        existing.scope = token.get("scope", "") or ""
    else:
        db.add(UserNexusToken(
            user_id=user.id,
            access_token=access_token,
            refresh_token=token.get("refresh_token"),
            expires_at=nexus_oauth.compute_expires_at(token),
            scope=token.get("scope", "") or "",
        ))
    await db.commit()

    resp = RedirectResponse(
        url=f"{settings.frontend_url}/settings?nexus=connected",
        status_code=302,
    )
    resp.delete_cookie(
        nexus_oauth.NEXUS_FLOW_COOKIE,
        path=nexus_oauth.NEXUS_FLOW_COOKIE_PATH,
    )
    return resp


@router.get("/status")
async def status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Is this user connected to Nexus? What scope + when does it expire?"""
    token = await db.get(UserNexusToken, current_user.id)
    return {
        "configured": nexus_oauth.is_configured(),
        "connected": token is not None,
        "username": token.nexus_username if token else None,
        "scope": token.scope if token else None,
        "expires_at": token.expires_at.isoformat() if (token and token.expires_at) else None,
    }


@router.post("/disconnect")
async def disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete the user's stored Nexus token. Does not revoke on Nexus's side."""
    await db.execute(
        delete(UserNexusToken).where(UserNexusToken.user_id == current_user.id)
    )
    await db.commit()
    return {"status": "disconnected"}
