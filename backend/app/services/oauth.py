"""OAuth provider abstraction for Google and Discord sign-in.

Implements the authorization-code flow with PKCE (S256) and a stateless,
cookie-bound CSRF state mechanism, per RFC 9700 §4.7.1 and OAuth 2.1.

Flow overview:
  1. Init endpoint generates (state, code_verifier), sets a signed HttpOnly
     cookie binding state+verifier to the user agent, and 302-redirects to
     the provider with state + code_challenge in the URL.
  2. Provider redirects back to callback endpoint with code + state.
  3. Callback reads and verifies the cookie, checks state matches URL state,
     then exchanges code + code_verifier with the provider.

The cookie is signed with HMAC-SHA256 using the app SECRET_KEY so it is
tamper-evident even though it is also HttpOnly (defense in depth).
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass

from authlib.integrations.httpx_client import AsyncOAuth2Client

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cookie-bound OAuth flow state (CSRF + PKCE container)
# ---------------------------------------------------------------------------

OAUTH_FLOW_COOKIE = "oauth_flow"
OAUTH_FLOW_COOKIE_PATH = "/api/auth/oauth"
_FLOW_TTL_SECONDS = 600  # 10 minutes


@dataclass
class OAuthFlowState:
    """Decoded contents of the oauth_flow cookie."""

    state: str
    code_verifier: str
    provider: str
    expires_at: int


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes:
    padded = encoded + "=" * ((4 - len(encoded) % 4) % 4)
    return base64.urlsafe_b64decode(padded)


def _sign(body: str, secret: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return _b64url_encode(mac)


def create_oauth_flow(provider: str) -> tuple[str, OAuthFlowState]:
    """Generate a new (state, code_verifier) pair and return a signed cookie value.

    Returns (cookie_value, flow_state). Caller sets the cookie on the response
    and uses flow_state.state + flow_state.code_verifier when building the
    authorization URL.
    """
    settings = get_settings()
    # state: opaque random value echoed back in the URL
    state = secrets.token_urlsafe(32)
    # code_verifier: 43-128 chars per RFC 7636; 64 bytes → 86 url-safe chars
    code_verifier = secrets.token_urlsafe(64)

    flow = OAuthFlowState(
        state=state,
        code_verifier=code_verifier,
        provider=provider,
        expires_at=int(time.time()) + _FLOW_TTL_SECONDS,
    )

    payload = {
        "s": flow.state,
        "v": flow.code_verifier,
        "p": flow.provider,
        "e": flow.expires_at,
    }
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _sign(body, settings.secret_key)
    cookie_value = f"{body}.{sig}"
    return cookie_value, flow


def consume_oauth_flow(
    cookie_value: str | None, provider: str, url_state: str | None
) -> OAuthFlowState | None:
    """Verify the oauth_flow cookie and return its decoded state if valid.

    Returns None if the cookie is missing, tampered, expired, for the wrong
    provider, or does not match the state echoed back in the URL.
    The cookie is single-use; callers should unconditionally delete it after
    either success or failure.
    """
    if not cookie_value or not url_state:
        return None
    settings = get_settings()

    try:
        body, sig = cookie_value.rsplit(".", 1)
    except ValueError:
        return None

    expected_sig = _sign(body, settings.secret_key)
    if not hmac.compare_digest(sig, expected_sig):
        return None

    try:
        payload = json.loads(_b64url_decode(body).decode("utf-8"))
        flow = OAuthFlowState(
            state=payload["s"],
            code_verifier=payload["v"],
            provider=payload["p"],
            expires_at=int(payload["e"]),
        )
    except (ValueError, KeyError, TypeError):
        return None

    # Constant-time comparison of state to avoid timing leaks
    if not hmac.compare_digest(flow.state, url_state):
        return None
    if flow.provider != provider:
        return None
    if int(time.time()) > flow.expires_at:
        return None

    return flow


def _code_challenge_s256(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return _b64url_encode(digest)


# ---------------------------------------------------------------------------
# Provider abstraction
# ---------------------------------------------------------------------------


@dataclass
class OAuthUserInfo:
    """Normalized user info from any OAuth provider."""

    provider: str  # "google", "discord"
    provider_user_id: str
    email: str
    email_verified: bool
    display_name: str | None = None
    avatar_url: str | None = None


class OAuthProvider:
    """Base OAuth provider interface."""

    provider_name: str = ""

    def get_authorization_url(self, state: str, code_verifier: str) -> str:
        raise NotImplementedError

    async def get_user_info(self, code: str, code_verifier: str) -> OAuthUserInfo:
        raise NotImplementedError

    def is_configured(self) -> bool:
        raise NotImplementedError


class GoogleOAuthProvider(OAuthProvider):
    provider_name = "google"

    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

    def is_configured(self) -> bool:
        settings = get_settings()
        return bool(settings.google_client_id and settings.google_client_secret)

    def get_authorization_url(self, state: str, code_verifier: str) -> str:
        settings = get_settings()
        client = AsyncOAuth2Client(
            client_id=settings.google_client_id,
            redirect_uri=settings.google_redirect_uri,
            scope="openid email profile",
            code_challenge_method="S256",
        )
        url, _ = client.create_authorization_url(
            self.AUTHORIZE_URL, state=state, code_verifier=code_verifier
        )
        return url

    async def get_user_info(self, code: str, code_verifier: str) -> OAuthUserInfo:
        settings = get_settings()
        async with AsyncOAuth2Client(
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            redirect_uri=settings.google_redirect_uri,
            code_challenge_method="S256",
        ) as client:
            await client.fetch_token(
                self.TOKEN_URL,
                code=code,
                grant_type="authorization_code",
                code_verifier=code_verifier,
            )
            resp = await client.get(self.USERINFO_URL)
            data = resp.json()

        return OAuthUserInfo(
            provider="google",
            provider_user_id=data["sub"],
            email=data["email"],
            email_verified=data.get("email_verified", False),
            display_name=data.get("name"),
            avatar_url=data.get("picture"),
        )


class DiscordOAuthProvider(OAuthProvider):
    provider_name = "discord"

    AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize"
    TOKEN_URL = "https://discord.com/api/oauth2/token"
    USERINFO_URL = "https://discord.com/api/users/@me"

    def is_configured(self) -> bool:
        settings = get_settings()
        return bool(settings.discord_client_id and settings.discord_client_secret)

    def get_authorization_url(self, state: str, code_verifier: str) -> str:
        settings = get_settings()
        client = AsyncOAuth2Client(
            client_id=settings.discord_client_id,
            redirect_uri=settings.discord_redirect_uri,
            scope="identify email",
            code_challenge_method="S256",
        )
        url, _ = client.create_authorization_url(
            self.AUTHORIZE_URL, state=state, code_verifier=code_verifier
        )
        return url

    async def get_user_info(self, code: str, code_verifier: str) -> OAuthUserInfo:
        settings = get_settings()
        async with AsyncOAuth2Client(
            client_id=settings.discord_client_id,
            client_secret=settings.discord_client_secret,
            redirect_uri=settings.discord_redirect_uri,
            code_challenge_method="S256",
        ) as client:
            await client.fetch_token(
                self.TOKEN_URL,
                code=code,
                grant_type="authorization_code",
                code_verifier=code_verifier,
            )
            resp = await client.get(self.USERINFO_URL)
            data = resp.json()

        avatar_url = None
        if data.get("avatar"):
            avatar_url = (
                f"https://cdn.discordapp.com/avatars/{data['id']}/{data['avatar']}.png"
            )

        return OAuthUserInfo(
            provider="discord",
            provider_user_id=str(data["id"]),
            email=data["email"],
            email_verified=data.get("verified", False),
            display_name=data.get("global_name") or data.get("username"),
            avatar_url=avatar_url,
        )


_PROVIDERS: dict[str, OAuthProvider] = {
    "google": GoogleOAuthProvider(),
    "discord": DiscordOAuthProvider(),
}


def get_oauth_provider(name: str) -> OAuthProvider | None:
    """Get an OAuth provider by name. Returns None if not found."""
    return _PROVIDERS.get(name)


def get_configured_providers() -> list[str]:
    """Return the names of all OAuth providers that are fully configured."""
    return [name for name, p in _PROVIDERS.items() if p.is_configured()]
