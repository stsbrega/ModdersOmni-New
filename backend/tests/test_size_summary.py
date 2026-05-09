"""Tests for GET /api/modlist/{id}/size-summary.

Fixtures (`authed_client`, `seeded_modlist`, `seeded_modlist_huge`,
`seeded_modlist_partial`, `seeded_modlist_no_drives`) live in conftest.py.
"""

import pytest


@pytest.mark.asyncio
async def test_size_summary_comfortable_fit(authed_client, seeded_modlist):
    """Download size well under largest free drive (10 GB dl vs 500 GB free)."""
    resp = await authed_client.get(f"/api/modlist/{seeded_modlist.id}/size-summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["download_bytes"] == 10 * 1024 ** 3
    # installed = 2.5 x download
    assert body["installed_estimate_bytes"] == int(10 * 1024 ** 3 * 2.5)
    assert body["sized_count"] == 3
    assert body["unsized_count"] == 0
    assert body["total_count"] == 3
    assert body["fit_status"] == "comfortable"
    assert body["largest_drive_free_bytes"] == 500 * 1024 ** 3


@pytest.mark.asyncio
async def test_size_summary_insufficient(authed_client, seeded_modlist_huge):
    """Installed estimate exceeds largest free drive → insufficient."""
    resp = await authed_client.get(
        f"/api/modlist/{seeded_modlist_huge.id}/size-summary"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fit_status"] == "insufficient"


@pytest.mark.asyncio
async def test_size_summary_unsized_entries_excluded_from_total(
    authed_client, seeded_modlist_partial,
):
    """Entries with NULL file_size_bytes contribute to unsized_count, not to total."""
    resp = await authed_client.get(
        f"/api/modlist/{seeded_modlist_partial.id}/size-summary"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sized_count"] + body["unsized_count"] == body["total_count"]
    assert body["unsized_count"] >= 1
    # Download total must match only the sized entries (2 GB + 3 GB = 5 GB)
    assert body["download_bytes"] == 5 * 1024 ** 3


@pytest.mark.asyncio
async def test_size_summary_unknown_storage_returns_unknown_status(
    authed_client, seeded_modlist_no_drives,
):
    resp = await authed_client.get(
        f"/api/modlist/{seeded_modlist_no_drives.id}/size-summary"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["fit_status"] == "unknown"
    assert body["largest_drive_free_bytes"] is None
