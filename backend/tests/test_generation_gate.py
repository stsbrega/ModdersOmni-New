"""Tests for the BYOK gate on Large/Massive/Ultimate presets in
`POST /api/generation/start`."""

import uuid

import pytest

from app.api.deps import get_current_user
from app.main import app
from app.models.user import User


def _fake_user() -> User:
    u = User(
        id=uuid.uuid4(),
        email="gate-test@example.com",
        password_hash="x",
        display_name="Gate Test",
        email_verified=True,
    )
    return u


@pytest.mark.asyncio
async def test_large_preset_without_byok_returns_402(client):
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    try:
        response = await client.post(
            "/api/generation/start",
            json={"game_id": 1, "preset": "large"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 402
    assert "LLM API key" in response.json()["detail"]


@pytest.mark.asyncio
async def test_massive_preset_without_byok_returns_402(client):
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    try:
        response = await client.post(
            "/api/generation/start",
            json={"game_id": 1, "preset": "massive"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 402


@pytest.mark.asyncio
async def test_ultimate_preset_without_byok_returns_402(client):
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    try:
        response = await client.post(
            "/api/generation/start",
            json={"game_id": 1, "preset": "ultimate"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 402


@pytest.mark.asyncio
async def test_medium_preset_does_not_require_byok(client):
    """Small/Medium are free-tier; the BYOK gate must NOT fire for them.

    We don't assert a success status (the background task may fail downstream
    because the fake user has no real DB row / no game record) — only that
    the 402 gate does not trip.
    """
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    try:
        response = await client.post(
            "/api/generation/start",
            json={"game_id": 1, "preset": "medium"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code != 402
