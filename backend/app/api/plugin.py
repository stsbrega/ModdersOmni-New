"""Plugin authentication API endpoints.

Endpoints for managing long-lived plugin tokens used by MO2/Vortex
mod manager plugins. Users create tokens in the Settings page and
paste them into their plugin configuration.
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.services.plugin_auth import (
    create_plugin_token,
    list_plugin_tokens,
    revoke_all_plugin_tokens,
    revoke_plugin_token,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Resolve the MO2 plugin file once at import time so a missing/renamed file
# is a loud startup failure rather than a silent 404 per request. The file
# lives at the repo root (plugins/mo2/moddersomni_import.py); this module
# sits at backend/app/api/plugin.py, so four parents up lands at the repo root.
_MO2_PLUGIN_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "plugins" / "mo2" / "moddersomni_import.py"
)
try:
    _MO2_PLUGIN_SOURCE = _MO2_PLUGIN_PATH.read_text(encoding="utf-8")
except FileNotFoundError:
    logger.warning(
        "MO2 plugin file not found at %s — /mo2-import.py will 503 until resolved.",
        _MO2_PLUGIN_PATH,
    )
    _MO2_PLUGIN_SOURCE = None


# ── Request/Response schemas ──


class CreateTokenRequest(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=100,
        description="A label for this token, e.g. 'My MO2 Plugin'",
    )
    scopes: str = Field(
        default="export,download",
        description="Comma-separated scopes: export, download",
    )
    expiry_days: int = Field(
        default=90, ge=1, le=365,
        description="Token lifetime in days (1-365)",
    )


class TokenResponse(BaseModel):
    """Returned when listing tokens (no raw token)."""
    id: int
    name: str
    scopes: str
    revoked: bool
    created_at: str
    last_used_at: str | None
    expires_at: str


class TokenCreatedResponse(BaseModel):
    """Returned only at creation — includes the raw token (shown once)."""
    token: str  # The raw token — only returned once!
    id: int
    name: str
    scopes: str
    expires_at: str


# ── Endpoints ──


@router.post("/tokens", response_model=TokenCreatedResponse)
async def create_token(
    request: CreateTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new plugin authentication token.

    The raw token is returned only in this response — store it securely.
    It cannot be retrieved later (only the hash is stored).
    """
    try:
        raw_token, db_token = await create_plugin_token(
            user_id=current_user.id,
            name=request.name,
            db=db,
            scopes=request.scopes,
            expiry_days=request.expiry_days,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()

    return TokenCreatedResponse(
        token=raw_token,
        id=db_token.id,
        name=db_token.name,
        scopes=db_token.scopes,
        expires_at=db_token.expires_at.isoformat(),
    )


@router.get("/tokens", response_model=list[TokenResponse])
async def list_tokens(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active (non-revoked) plugin tokens for the current user."""
    tokens = await list_plugin_tokens(current_user.id, db)
    return [
        TokenResponse(
            id=t.id,
            name=t.name,
            scopes=t.scopes,
            revoked=t.revoked,
            created_at=t.created_at.isoformat(),
            last_used_at=t.last_used_at.isoformat() if t.last_used_at else None,
            expires_at=t.expires_at.isoformat(),
        )
        for t in tokens
    ]


@router.delete("/tokens/{token_id}", status_code=204)
async def revoke_token(
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific plugin token."""
    revoked = await revoke_plugin_token(token_id, current_user.id, db)
    if not revoked:
        raise HTTPException(status_code=404, detail="Token not found")
    await db.commit()


@router.delete("/tokens", status_code=200)
async def revoke_all_tokens(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all active plugin tokens for the current user."""
    count = await revoke_all_plugin_tokens(current_user.id, db)
    await db.commit()
    return {"revoked_count": count}


@router.get("/mo2-import.py")
async def download_mo2_plugin():
    """Serve the MO2 import plugin (moddersomni_import.py) for download.

    Public endpoint — the plugin itself is inert without a user-supplied
    plugin token, so there is no credential to protect here.
    """
    if _MO2_PLUGIN_SOURCE is None:
        raise HTTPException(
            status_code=503,
            detail="MO2 plugin file is unavailable on this server.",
        )
    return Response(
        content=_MO2_PLUGIN_SOURCE,
        media_type="text/x-python; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="moddersomni_import.py"',
            "Cache-Control": "public, max-age=300",
        },
    )
