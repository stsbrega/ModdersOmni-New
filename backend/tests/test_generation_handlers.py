"""Tests for generation tool handlers — dedup + int coercion.

Covers:
* ``_coerce_int`` — accepts int, numeric str, returns None for junk.
* ``add_to_modlist`` — rejects duplicates by ``nexus_mod_id``; for
  manual-download placeholders (id=0, e.g. F4SE) dedupes by name.
* ``add_to_modlist`` — coerces string ``mod_id`` and string ``sizeInBytes``
  (Nexus v2 returns int64 as a string) to ``int`` before the entry hits the
  session / DB boundary.
* ``add_patch`` — same dedup + coercion rules.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.generation.handlers import (
    _coerce_int,
    build_phase1_handlers,
    build_phase2_handlers,
)
from app.services.generation.session import GenerationSession


def _make_session(file_entries: list[dict] | None = None) -> GenerationSession:
    """Build a GenerationSession with a mocked Nexus client.

    ``file_entries`` is what ``get_mod_files`` returns — pass strings for
    sizeInBytes to simulate the real API's int64-as-string convention.
    """
    nexus = MagicMock()
    nexus.get_mod_files = AsyncMock(return_value=file_entries or [])
    return GenerationSession(game_domain="skyrimspecialedition", nexus=nexus)


# ────────────────────────── _coerce_int ──────────────────────────

def test_coerce_int_accepts_int():
    assert _coerce_int(42) == 42


def test_coerce_int_accepts_numeric_string():
    # Nexus v2 returns sizeInBytes as a string (int64 convention)
    assert _coerce_int("2497829") == 2497829


def test_coerce_int_returns_none_for_none():
    assert _coerce_int(None) is None


def test_coerce_int_returns_none_for_empty_string():
    assert _coerce_int("") is None


def test_coerce_int_returns_none_for_junk():
    assert _coerce_int("abc") is None
    assert _coerce_int({"bad": "dict"}) is None


# ────────────────────────── dedup: add_to_modlist ──────────────────────────

@pytest.mark.asyncio
async def test_add_to_modlist_rejects_duplicate_by_nexus_id():
    session = _make_session(file_entries=[
        {"fileId": 123, "sizeInBytes": "1000", "primary": True},
    ])
    handlers = build_phase1_handlers(session)

    first = json.loads(await handlers["add_to_modlist"](
        mod_id=47327, name="Address Library", reason="req", load_order=2,
    ))
    assert first["status"] == "added"

    second = json.loads(await handlers["add_to_modlist"](
        mod_id=47327, name="Address Library", reason="req (again)", load_order=2,
    ))
    assert second["status"] == "duplicate"
    assert len(session.modlist) == 1


@pytest.mark.asyncio
async def test_add_to_modlist_dedupes_manual_placeholder_by_name():
    """mod_id=0 is reserved for manual-download mods like F4SE / SKSE64.

    Two different manual mods can share id=0, so dedup must key on name.
    """
    session = _make_session()
    handlers = build_phase1_handlers(session)

    f4se = json.loads(await handlers["add_to_modlist"](
        mod_id=0, name="F4SE", reason="script extender", load_order=1,
    ))
    skse = json.loads(await handlers["add_to_modlist"](
        mod_id=0, name="SKSE64", reason="script extender", load_order=1,
    ))
    assert f4se["status"] == "added"
    assert skse["status"] == "added"  # different name, both allowed

    dupe = json.loads(await handlers["add_to_modlist"](
        mod_id=0, name="F4SE", reason="retry", load_order=1,
    ))
    assert dupe["status"] == "duplicate"
    assert len(session.modlist) == 2


# ────────────────────────── coercion at boundary ──────────────────────────

@pytest.mark.asyncio
async def test_add_to_modlist_coerces_string_mod_id():
    """LLM tool-call JSON occasionally sends mod_id as a string (root cause of
    the asyncpg DataError we saw in production)."""
    session = _make_session(file_entries=[
        {"fileId": "99", "sizeInBytes": "500", "primary": True},
    ])
    handlers = build_phase1_handlers(session)

    result = json.loads(await handlers["add_to_modlist"](
        mod_id="2497829", name="Some Mod", reason="r", load_order=1,
    ))
    assert result["status"] == "added"
    entry = session.modlist[0]
    assert entry["nexus_mod_id"] == 2497829
    assert isinstance(entry["nexus_mod_id"], int)


@pytest.mark.asyncio
async def test_add_to_modlist_coerces_string_size_in_bytes():
    """Nexus v2 GraphQL returns sizeInBytes as a string — must become int so
    the BigInteger column doesn't reject the insert, and so the size_update
    sum doesn't silently return 0."""
    session = _make_session(file_entries=[
        {"fileId": "42", "sizeInBytes": "1073741824", "primary": True},
    ])
    handlers = build_phase1_handlers(session)

    await handlers["add_to_modlist"](
        mod_id=100, name="Big Mod", reason="r", load_order=1,
    )
    entry = session.modlist[0]
    assert entry["file_size_bytes"] == 1073741824
    assert isinstance(entry["file_size_bytes"], int)
    assert entry["file_id"] == 42
    assert isinstance(entry["file_id"], int)


@pytest.mark.asyncio
async def test_add_to_modlist_rejects_non_numeric_mod_id():
    session = _make_session()
    handlers = build_phase1_handlers(session)

    result = json.loads(await handlers["add_to_modlist"](
        mod_id="not-a-number", name="X", reason="r", load_order=1,
    ))
    assert result["status"] == "error"
    assert len(session.modlist) == 0


@pytest.mark.asyncio
async def test_size_update_total_is_int_after_coercion():
    """Regression guard: sum(...) would return 0 silently if sizeInBytes
    stayed as strings mixed with None entries."""
    events: list[dict] = []
    session = _make_session(file_entries=[
        {"fileId": "42", "sizeInBytes": "500", "primary": True},
    ])
    handlers = build_phase1_handlers(session, event_callback=events.append)

    await handlers["add_to_modlist"](
        mod_id=1, name="A", reason="r", load_order=1,
    )
    size_events = [e for e in events if e["type"] == "size_update"]
    assert size_events, "expected a size_update event"
    assert size_events[-1]["total_bytes"] == 500


# ────────────────────────── dedup: add_patch ──────────────────────────

@pytest.mark.asyncio
async def test_add_patch_rejects_duplicate_against_modlist():
    session = _make_session(file_entries=[
        {"fileId": 1, "sizeInBytes": "100", "primary": True},
    ])
    phase1 = build_phase1_handlers(session)
    phase2 = build_phase2_handlers(session)

    await phase1["add_to_modlist"](
        mod_id=500, name="Base Mod", reason="r", load_order=1,
    )
    dupe = json.loads(await phase2["add_patch"](
        mod_id=500, name="Base Mod", patches_mods=["X"],
        reason="r", load_order=1,
    ))
    assert dupe["status"] == "duplicate"


@pytest.mark.asyncio
async def test_add_patch_coerces_string_mod_id():
    session = _make_session(file_entries=[
        {"fileId": "1", "sizeInBytes": "100", "primary": True},
    ])
    handlers = build_phase2_handlers(session)

    await handlers["add_patch"](
        mod_id="999", name="Patch", patches_mods=["A", "B"],
        reason="r", load_order=1,
    )
    assert session.patches[0]["nexus_mod_id"] == 999
    assert isinstance(session.patches[0]["nexus_mod_id"], int)


# ────────── monotonic load_order (session counter, LLM value ignored) ──────────

@pytest.mark.asyncio
async def test_add_to_modlist_assigns_monotonic_load_order():
    """LLM-supplied load_order is ignored; session counter assigns sequentially.

    Prevents the collision pattern seen in production where three mods shared
    the same load_order because each phase restarted the LLM's mental counter.
    """
    session = _make_session(file_entries=[
        {"fileId": 1, "sizeInBytes": "100", "primary": True},
    ])
    handlers = build_phase1_handlers(session)

    # LLM passes load_order=19 for every add — the old bug.
    await handlers["add_to_modlist"](mod_id=1, name="A", reason="r", load_order=19)
    await handlers["add_to_modlist"](mod_id=2, name="B", reason="r", load_order=19)
    await handlers["add_to_modlist"](mod_id=3, name="C", reason="r", load_order=19)

    orders = [m["load_order"] for m in session.modlist]
    assert orders == [1, 2, 3], f"expected monotonic counter, got {orders}"


@pytest.mark.asyncio
async def test_add_patch_continues_load_order_counter():
    """Patches share the same session counter as mods, so the final list has
    no collisions between the modlist and patches sections."""
    session = _make_session(file_entries=[
        {"fileId": 1, "sizeInBytes": "100", "primary": True},
    ])
    phase1 = build_phase1_handlers(session)
    phase2 = build_phase2_handlers(session)

    await phase1["add_to_modlist"](mod_id=1, name="A", reason="r", load_order=1)
    await phase1["add_to_modlist"](mod_id=2, name="B", reason="r", load_order=2)
    await phase2["add_patch"](
        mod_id=3, name="AB Patch", patches_mods=["A", "B"], reason="r", load_order=1,
    )

    assert session.modlist[0]["load_order"] == 1
    assert session.modlist[1]["load_order"] == 2
    assert session.patches[0]["load_order"] == 3


# ────────── requested_mods matching helper (sweep behavior) ──────────

def test_missing_requested_mods_exact_match():
    """User asked for 'X'; modlist contains 'X' — nothing missing."""
    from app.services.generation.pipeline import _missing_requested_mods

    session = _make_session()
    session.requested_mods = ["Sim Settlements 2"]
    session.modlist = [{"name": "Sim Settlements 2", "nexus_mod_id": 1}]
    assert _missing_requested_mods(session) == []


def test_missing_requested_mods_addon_does_not_satisfy_base_request():
    """User asked for 'Sim Settlements 2'; only an addon for it is present.

    The addon's name contains 'Sim Settlements 2' but does NOT start with it,
    so it must not falsely satisfy the request."""
    from app.services.generation.pipeline import _missing_requested_mods

    session = _make_session()
    session.requested_mods = ["Sim Settlements 2"]
    session.modlist = [{
        "name": "Wasteland Venturers Sim Settlements 2 Addon Pack",
        "nexus_mod_id": 1,
    }]
    assert _missing_requested_mods(session) == ["Sim Settlements 2"]


def test_missing_requested_mods_case_and_punctuation_insensitive():
    from app.services.generation.pipeline import _missing_requested_mods

    session = _make_session()
    session.requested_mods = ["sim settlements 2"]
    session.modlist = [{"name": "Sim Settlements 2!", "nexus_mod_id": 1}]
    assert _missing_requested_mods(session) == []


def test_missing_requested_mods_returns_absent_names():
    from app.services.generation.pipeline import _missing_requested_mods

    session = _make_session()
    session.requested_mods = ["Sim Settlements 2", "Totally Fake Mod"]
    session.modlist = [{"name": "Sim Settlements 2", "nexus_mod_id": 1}]
    assert _missing_requested_mods(session) == ["Totally Fake Mod"]


@pytest.mark.asyncio
async def test_sweep_clears_query_dedup_for_missing_mods(monkeypatch):
    """Regression: the main tool-loop's search_nexus dedupes queries across
    the whole session. Without clearing the dedup cache, the sweep would
    silently fail to re-query a mod the main loop already searched for."""
    from app.services.generation import pipeline as pipeline_mod

    session = _make_session()
    session.requested_mods = ["Sim Settlements 2"]
    session.modlist = []  # SS2 missing — sweep should trigger
    # Simulate an earlier phase already having searched for SS2
    session.searched_queries = {"sim settlements 2"}

    # Stub out the LLM call so we don't need real providers — we only want
    # to verify the dedup clearing behavior before the LLM runs.
    class _FakeProvider:
        def get_model_name(self):
            return "fake"

        async def generate_with_tools(self, **_):
            # Assert the missing mod name has been removed from the dedup set
            # BEFORE the LLM runs. Otherwise the LLM's search_nexus call
            # would be short-circuited.
            assert "sim settlements 2" not in session.searched_queries

    events: list[dict] = []
    await pipeline_mod._run_requested_mods_sweep(
        session=session,
        game=MagicMock(name="game", nexus_domain="fallout4"),
        game_version=None,
        request=MagicMock(requested_mods=["Sim Settlements 2"]),
        providers=[_FakeProvider()],
        exhausted_providers=set(),
        event_callback=events.append,
    )
    # Sanity: sweep emitted its start event
    assert any(e.get("type") == "sweep_start" for e in events)
