"""Tests for OAuth endpoints, cookie-bound state, and PKCE."""

import time
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.oauth import (
    OAUTH_FLOW_COOKIE,
    consume_oauth_flow,
    create_oauth_flow,
    get_configured_providers,
)


# ---------------------------------------------------------------------------
# Unit tests: cookie-bound OAuth flow state
# ---------------------------------------------------------------------------


class TestOAuthFlowCookie:
    def test_create_returns_signed_cookie_and_state(self):
        cookie, flow = create_oauth_flow("google")
        assert isinstance(cookie, str)
        assert "." in cookie  # body.signature format
        assert flow.provider == "google"
        assert len(flow.state) >= 32
        assert len(flow.code_verifier) >= 43  # RFC 7636 minimum

    def test_roundtrip_valid(self):
        cookie, flow = create_oauth_flow("google")
        result = consume_oauth_flow(cookie, "google", flow.state)
        assert result is not None
        assert result.state == flow.state
        assert result.code_verifier == flow.code_verifier

    def test_reject_wrong_provider(self):
        cookie, flow = create_oauth_flow("google")
        assert consume_oauth_flow(cookie, "discord", flow.state) is None

    def test_reject_missing_cookie(self):
        assert consume_oauth_flow(None, "google", "anything") is None
        assert consume_oauth_flow("", "google", "anything") is None

    def test_reject_missing_url_state(self):
        cookie, _ = create_oauth_flow("google")
        assert consume_oauth_flow(cookie, "google", None) is None
        assert consume_oauth_flow(cookie, "google", "") is None

    def test_reject_state_mismatch(self):
        """Cookie state must match URL state (double-submit CSRF check)."""
        cookie, _ = create_oauth_flow("google")
        assert consume_oauth_flow(cookie, "google", "attacker-state") is None

    def test_reject_tampered_signature(self):
        cookie, flow = create_oauth_flow("google")
        body, _sig = cookie.rsplit(".", 1)
        tampered = f"{body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        assert consume_oauth_flow(tampered, "google", flow.state) is None

    def test_reject_tampered_body(self):
        cookie, flow = create_oauth_flow("google")
        _body, sig = cookie.rsplit(".", 1)
        # Valid base64url body but different payload (won't match original sig)
        tampered = f"eyJzIjoiWCIsInYiOiJZIiwicCI6Imdvb2dsZSIsImUiOjk5OTk5OTk5OTl9.{sig}"
        assert consume_oauth_flow(tampered, "google", flow.state) is None

    def test_reject_malformed_cookie(self):
        assert consume_oauth_flow("no-dot-here", "google", "x") is None
        assert consume_oauth_flow("a.b.c.d", "google", "x") is None

    def test_reject_expired(self):
        cookie, flow = create_oauth_flow("google")
        # Fast-forward past the 10-minute TTL
        with patch("app.services.oauth.time.time", return_value=time.time() + 700):
            assert consume_oauth_flow(cookie, "google", flow.state) is None

    def test_state_values_are_unique(self):
        """Each flow should have distinct state + verifier (no reuse)."""
        _c1, f1 = create_oauth_flow("google")
        _c2, f2 = create_oauth_flow("google")
        assert f1.state != f2.state
        assert f1.code_verifier != f2.code_verifier


# ---------------------------------------------------------------------------
# Unit tests: get_configured_providers
# ---------------------------------------------------------------------------


class TestGetConfiguredProviders:
    def test_returns_list(self):
        result = get_configured_providers()
        assert isinstance(result, list)

    def test_empty_when_no_credentials(self):
        """With empty config, no providers should be configured."""
        from app.services.oauth import _PROVIDERS

        with patch.object(
            _PROVIDERS["google"].__class__, "is_configured", return_value=False
        ), patch.object(
            _PROVIDERS["discord"].__class__, "is_configured", return_value=False
        ):
            result = get_configured_providers()
            assert result == []

    def test_only_returns_configured(self):
        """Only providers with credentials should appear."""
        result = get_configured_providers()
        from app.services.oauth import get_oauth_provider

        for name in result:
            provider = get_oauth_provider(name)
            assert provider is not None
            assert provider.is_configured() is True


# ---------------------------------------------------------------------------
# Integration tests: OAuth API endpoints
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_oauth_providers_endpoint(client):
    """GET /api/auth/oauth/providers should return configured providers list."""
    resp = await client.get("/api/auth/oauth/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert isinstance(data["providers"], list)


@pytest.mark.asyncio
async def test_oauth_providers_empty_when_unconfigured(client):
    """With no credentials, providers list should be empty."""
    from app.services.oauth import _PROVIDERS

    with patch.object(
        _PROVIDERS["google"].__class__, "is_configured", return_value=False
    ), patch.object(
        _PROVIDERS["discord"].__class__, "is_configured", return_value=False
    ):
        resp = await client.get("/api/auth/oauth/providers")
        assert resp.status_code == 200
        assert resp.json()["providers"] == []


@pytest.mark.asyncio
async def test_oauth_authorize_unknown_provider(client):
    """Requesting an unknown provider should return 400."""
    resp = await client.get("/api/auth/oauth/unknown_provider")
    assert resp.status_code == 400
    assert "Unknown OAuth provider" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_oauth_authorize_unconfigured_provider(client):
    """Requesting an unconfigured provider should return 501."""
    from app.services.oauth import _PROVIDERS

    with patch.object(
        _PROVIDERS["google"].__class__, "is_configured", return_value=False
    ):
        resp = await client.get("/api/auth/oauth/google")
        assert resp.status_code == 501
        assert "not configured" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_oauth_authorize_redirects_with_cookie_and_pkce(client):
    """Configured provider → 302 to provider URL with PKCE params + oauth_flow cookie."""
    from app.services.oauth import _PROVIDERS

    if not _PROVIDERS["google"].is_configured():
        pytest.skip("Google OAuth not configured")

    resp = await client.get("/api/auth/oauth/google", follow_redirects=False)
    assert resp.status_code == 302

    location = resp.headers.get("location", "")
    assert "accounts.google.com" in location
    assert "code_challenge=" in location
    assert "code_challenge_method=S256" in location
    assert "state=" in location

    # Cookie must be HttpOnly + Secure + SameSite=Lax + scoped to /api/auth/oauth
    set_cookie = resp.headers.get("set-cookie", "").lower()
    assert OAUTH_FLOW_COOKIE in set_cookie
    assert "httponly" in set_cookie
    assert "secure" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/api/auth/oauth" in set_cookie


@pytest.mark.asyncio
async def test_oauth_callback_missing_state(client):
    """Callback without state → redirect to frontend with invalid_state."""
    resp = await client.get(
        "/api/auth/oauth/google/callback",
        params={"code": "fake_code"},
        follow_redirects=False,
    )
    assert resp.status_code == 307
    assert "error=" in resp.headers.get("location", "")


@pytest.mark.asyncio
async def test_oauth_callback_invalid_state(client):
    """Callback with URL state but no cookie → invalid_state."""
    resp = await client.get(
        "/api/auth/oauth/google/callback",
        params={"code": "fake_code", "state": "invalid-state"},
        follow_redirects=False,
    )
    assert resp.status_code == 307
    assert "error=" in resp.headers.get("location", "")


@pytest.mark.asyncio
async def test_oauth_callback_rejects_mismatched_cookie_state(client):
    """Cookie present but URL state differs → invalid_state (double-submit check)."""
    cookie, flow = create_oauth_flow("google")
    resp = await client.get(
        "/api/auth/oauth/google/callback",
        params={"code": "fake_code", "state": "attacker-controlled"},
        cookies={OAUTH_FLOW_COOKIE: cookie},
        follow_redirects=False,
    )
    assert resp.status_code == 307
    location = resp.headers.get("location", "")
    assert "error=invalid_state" in location


@pytest.mark.asyncio
async def test_oauth_callback_rejects_cross_provider_cookie(client):
    """Cookie issued for 'google' must not validate a 'discord' callback."""
    cookie, flow = create_oauth_flow("google")
    resp = await client.get(
        "/api/auth/oauth/discord/callback",
        params={"code": "fake_code", "state": flow.state},
        cookies={OAUTH_FLOW_COOKIE: cookie},
        follow_redirects=False,
    )
    assert resp.status_code == 307
    location = resp.headers.get("location", "")
    assert "error=invalid_state" in location
