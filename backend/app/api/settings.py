import logging
import time
from collections import defaultdict

import httpx
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.llm.registry import get_public_registry, validate_key_provider
from app.models.user import User
from app.models.user_settings import UserSettings
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

# Simple in-memory rate limiter for sensitive endpoints
_raw_keys_requests: dict[str, list[float]] = defaultdict(list)
_RAW_KEYS_LIMIT = 10  # max requests per window
_RAW_KEYS_WINDOW = 60  # seconds

router = APIRouter()


_NOTIF_FIELDS = {
    "email_alerts",
    "mod_recommendations",
    "compat_warnings",
    "email_on_generation_complete",
}


class AppSettings(BaseModel):
    """Response model for GET /settings/ — always returns concrete values."""
    email_alerts: bool = True
    mod_recommendations: bool = True
    compat_warnings: bool = True
    email_on_generation_complete: bool = True

    model_config = {"from_attributes": True}


class AppSettingsUpdate(BaseModel):
    """Request model for PUT /settings/ — all fields optional for partial updates."""
    email_alerts: Optional[bool] = None
    mod_recommendations: Optional[bool] = None
    compat_warnings: Optional[bool] = None
    email_on_generation_complete: Optional[bool] = None


async def _get_or_create_settings(
    user: User, db: AsyncSession
) -> UserSettings:
    """Get user settings, creating with defaults if missing."""
    if user.settings:
        return user.settings

    settings_row = UserSettings(user_id=user.id)
    db.add(settings_row)
    await db.flush()
    await db.refresh(user, ["settings"])
    return settings_row


# ── Provider Registry (public, no auth) ──────────────────────

@router.get("/llm-providers")
async def list_llm_providers():
    """Return the list of supported LLM providers for frontend rendering."""
    return get_public_registry()


# ── LLM API Keys (auth required) ─────────────────────────────

@router.get("/llm-keys")
async def get_llm_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's saved LLM API keys (provider_id → masked key)."""
    settings_row = await _get_or_create_settings(current_user, db)
    await db.commit()
    keys: dict = settings_row.llm_api_keys or {}
    # Mask keys for security: show only first 6 + last 4 chars
    masked = {}
    for provider_id, key in keys.items():
        if isinstance(key, str) and len(key) > 12:
            masked[provider_id] = key[:6] + "..." + key[-4:]
        elif isinstance(key, str) and key:
            masked[provider_id] = "***"
        # Skip empty keys
    return masked


@router.get("/llm-keys/raw")
async def get_llm_keys_raw(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return unmasked keys — used by the setup flow to pre-populate inputs.

    Rate-limited to 10 requests per minute per user to limit blast radius
    if an account token is compromised.
    """
    user_id = str(current_user.id)
    now = time.monotonic()
    # Prune old entries outside the window
    _raw_keys_requests[user_id] = [
        t for t in _raw_keys_requests[user_id] if now - t < _RAW_KEYS_WINDOW
    ]
    if len(_raw_keys_requests[user_id]) >= _RAW_KEYS_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Try again shortly.")
    _raw_keys_requests[user_id].append(now)

    settings_row = await _get_or_create_settings(current_user, db)
    await db.commit()
    keys: dict = settings_row.llm_api_keys or {}
    # Only return non-empty keys
    return {k: v for k, v in keys.items() if isinstance(v, str) and v}


@router.patch("/llm-keys")
async def patch_llm_keys(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Merge submitted keys into the user's llm_api_keys JSON.

    - Non-empty string values are upserted.
    - Empty string values remove that provider's key.
    - Returns mismatch warnings if any key doesn't match its provider.
    """
    settings_row = await _get_or_create_settings(current_user, db)
    current_keys: dict = dict(settings_row.llm_api_keys or {})
    warnings: list[dict] = []

    for provider_id, api_key in data.items():
        if not isinstance(api_key, str):
            continue
        if api_key:
            # Check for key/provider mismatch
            check = validate_key_provider(api_key, provider_id)
            if not check["match"]:
                warnings.append({
                    "provider": provider_id,
                    "detected_provider": check["detected_provider"],
                    "message": check["suggestion"],
                })
            current_keys[provider_id] = api_key
        else:
            current_keys.pop(provider_id, None)

    settings_row.llm_api_keys = current_keys
    await db.commit()
    return {
        "status": "ok",
        "keys_saved": len(current_keys),
        "warnings": warnings,
    }


@router.post("/validate-llm-key")
async def validate_llm_key(data: dict):
    """Check if an API key matches the claimed provider.

    Request body: {"api_key": "sk-...", "provider": "openai"}
    Returns: {"match": bool, "detected_provider": str|null, "suggestion": str|null}
    """
    api_key = data.get("api_key", "")
    provider_id = data.get("provider", "")
    if not api_key or not provider_id:
        raise HTTPException(status_code=400, detail="api_key and provider required")
    return validate_key_provider(api_key, provider_id)


# ── Full Settings (existing) ─────────────────────────────────

@router.get("/", response_model=AppSettings)
async def get_app_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await _get_or_create_settings(current_user, db)
    await db.commit()
    result = AppSettings.model_validate(settings_row)
    # Overlay notification prefs from JSON column
    prefs = settings_row.notification_prefs or {}
    result.email_alerts = prefs.get("email_alerts", True)
    result.mod_recommendations = prefs.get("mod_recommendations", True)
    result.compat_warnings = prefs.get("compat_warnings", True)
    result.email_on_generation_complete = prefs.get("email_on_generation_complete", True)
    return result


@router.put("/")
async def update_settings(
    data: AppSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await _get_or_create_settings(current_user, db)
    provided = data.model_dump(exclude_none=True)

    # Notification prefs → merge into JSON column (only overwrite provided fields)
    notif_update = {k: v for k, v in provided.items() if k in _NOTIF_FIELDS}
    if notif_update:
        current_prefs = dict(settings_row.notification_prefs or {})
        current_prefs.update(notif_update)
        settings_row.notification_prefs = current_prefs

    await db.commit()
    return {"status": "ok", "message": "Settings saved"}


# ── Ollama Connection Test ──────────────────────────────────


class OllamaTestRequest(BaseModel):
    base_url: str = "http://localhost:11434/v1"


class OllamaTestResponse(BaseModel):
    connected: bool
    models: list[str] = []
    error: str = ""


@router.post("/ollama/test", response_model=OllamaTestResponse)
async def test_ollama_connection(data: OllamaTestRequest):
    """Test connectivity to a local Ollama instance."""
    base = data.base_url.rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base}/api/tags")
            resp.raise_for_status()
            tags = resp.json()
            model_names = [m["name"] for m in tags.get("models", [])]
            return OllamaTestResponse(connected=True, models=model_names)
    except httpx.ConnectError:
        return OllamaTestResponse(
            connected=False, error="Cannot connect to Ollama. Is it running?",
        )
    except httpx.TimeoutException:
        return OllamaTestResponse(connected=False, error="Connection timed out")
    except Exception as e:
        return OllamaTestResponse(connected=False, error=str(e))
