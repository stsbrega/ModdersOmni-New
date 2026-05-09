"""Tests for DELETE /api/user/me — account deletion with cascades."""

import uuid

import pytest
from sqlalchemy import select

from app.models.modlist import Modlist, ModlistEntry
from app.models.user import User


@pytest.mark.asyncio
async def test_delete_account_requires_auth(client):
    resp = await client.delete(
        "/api/user/me", headers={"X-Confirm-Delete": "DELETE"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_requires_confirmation_header(authed_client):
    """Client must send X-Confirm-Delete: DELETE header to prevent accidents."""
    resp = await authed_client.delete("/api/user/me")
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_delete_account_rejects_wrong_confirmation_value(authed_client):
    resp = await authed_client.delete(
        "/api/user/me", headers={"X-Confirm-Delete": "nope"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_account_removes_user_and_modlists(
    authed_client, db_session,
):
    user = authed_client.current_user
    modlist = Modlist(id=uuid.uuid4(), user_id=user.id, game_id=1)
    db_session.add(modlist)
    await db_session.flush()
    db_session.add(ModlistEntry(
        modlist_id=modlist.id, name="Test Mod", load_order=1,
    ))
    await db_session.commit()

    resp = await authed_client.delete(
        "/api/user/me", headers={"X-Confirm-Delete": "DELETE"},
    )
    assert resp.status_code == 204

    remaining_user = await db_session.execute(
        select(User).where(User.id == user.id)
    )
    assert remaining_user.scalar_one_or_none() is None

    remaining_modlist = await db_session.execute(
        select(Modlist).where(Modlist.user_id == user.id)
    )
    assert remaining_modlist.scalar_one_or_none() is None

    remaining_entries = await db_session.execute(
        select(ModlistEntry).where(ModlistEntry.modlist_id == modlist.id)
    )
    assert remaining_entries.scalar_one_or_none() is None
