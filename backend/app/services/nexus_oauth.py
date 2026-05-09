"""Nexus Mods OAuth2 client.

Implements Authorization Code + PKCE against Nexus's OAuth endpoints
(https://users.nexusmods.com/oauth). Unlike the Google/Discord login
providers in oauth.py, this flow is for **API access** — tokens are kept
and reused to call the Nexus API on the user's behalf.

The state cookie follows the same RFC 9700 §4.7.1 pattern as the login
providers, but also binds the caller's user_id: the callback endpoint
cannot read an Authorization header (browsers don't send it on a plain
redirect), so the authenticated user's id travels inside the signed
cookie itself. The cookie is HMAC-signed with SECRET_KEY so it is
tamper-evident.
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta

from authlib.integrations.httpx_client import AsyncOAuth2Client

from app.config import get_settings

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://users.nexusmods.com/oauth/authorize"
TOKEN_URL = "https://users.nexusmods.com/oauth/token"

# Cookie-bound flow state (CSRF + PKCE + user_id)
NEXUS_FLOW_COOKIE = "nexus_oauth_flow"
NEXUS_FLOW_COOKIE_PATH = "/api/nexus/oauth"
_FLOW_TTL_SECONDS = 600  # 10 minutes


@dataclass
class NexusFlowState:
    state: str
    code_verifier: str
    user_id: str
    expires_at: int


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes:
    padded = encoded + "=" * ((4 - len(encoded) % 4) % 4)
    return base64.urlsafe_b64decode(padded)


def _sign(body: str, secret: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return _b64url_encode(mac)


def create_flow(user_id: str) -> tuple[str, NexusFlowState]:
    """Generate a (state, verifier, user_id) flow and return a signed cookie."""
    settings = get_settings()
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    flow = NexusFlowState(
        state=state,
        code_verifier=code_verifier,
        user_id=user_id,
        expires_at=int(time.time()) + _FLOW_TTL_SECONDS,
    )
    payload = {"s": flow.state, "v": flow.code_verifier, "u": flow.user_id, "e": flow.expires_at}
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _sign(body, settings.secret_key)
    return f"{body}.{sig}", flow


def consume_flow(cookie_value: str | None, url_state: str | None) -> NexusFlowState | None:
    """Verify the nexus_oauth_flow cookie and return its decoded state if valid."""
    if not cookie_value or not url_state:
        return None
    settings = get_settings()
    try:
        body, sig = cookie_value.rsplit(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sign(body, settings.secret_key)):
        return None
    try:
        payload = json.loads(_b64url_decode(body).decode("utf-8"))
        flow = NexusFlowState(
            state=payload["s"],
            code_verifier=payload["v"],
            user_id=payload["u"],
            expires_at=int(payload["e"]),
        )
    except (ValueError, KeyError, TypeError):
        return None
    if not hmac.compare_digest(flow.state, url_state):
        return None
    if int(time.time()) > flow.expires_at:
        return None
    return flow


def is_configured() -> bool:
    """True once Nexus has issued us a client_id/secret."""
    s = get_settings()
    return bool(s.nexus_client_id and s.nexus_client_secret)


def build_authorize_url(state: str, code_verifier: str) -> str:
    """Construct the URL to send the user to Nexus for consent."""
    s = get_settings()
    client = AsyncOAuth2Client(
        client_id=s.nexus_client_id,
        redirect_uri=s.nexus_redirect_uri,
        scope=s.nexus_oauth_scopes or None,
        code_challenge_method="S256",
    )
    url, _ = client.create_authorization_url(
        AUTHORIZE_URL, state=state, code_verifier=code_verifier
    )
    return url


async def exchange_code_for_token(code: str, code_verifier: str) -> dict:
    """Exchange the authorization code for an access+refresh token pair.

    Returns the full token dict from Nexus. Raises on HTTP errors.
    """
    s = get_settings()
    async with AsyncOAuth2Client(
        client_id=s.nexus_client_id,
        client_secret=s.nexus_client_secret,
        redirect_uri=s.nexus_redirect_uri,
        code_challenge_method="S256",
    ) as client:
        token = await client.fetch_token(
            TOKEN_URL,
            code=code,
            grant_type="authorization_code",
            code_verifier=code_verifier,
        )
    return dict(token)


async def refresh_token(refresh_token_value: str) -> dict:
    """Swap a refresh_token for a fresh access_token. Returns new token dict."""
    s = get_settings()
    async with AsyncOAuth2Client(
        client_id=s.nexus_client_id,
        client_secret=s.nexus_client_secret,
    ) as client:
        token = await client.refresh_token(
            TOKEN_URL,
            refresh_token=refresh_token_value,
        )
    return dict(token)


def compute_expires_at(token: dict) -> datetime | None:
    """Turn a token dict's expires_in (seconds) into an absolute UTC datetime."""
    expires_in = token.get("expires_in")
    if not expires_in:
        return None
    return datetime.utcnow() + timedelta(seconds=int(expires_in))
