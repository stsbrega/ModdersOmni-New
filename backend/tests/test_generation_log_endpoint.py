"""Tests for the /generation/{id}/log download shape.

Focus is on ``_scrub_request_snapshot`` — it must strip API keys from every
credential entry but preserve everything else (preset, requested_mods, etc.)
so the download is safe to share in a bug report.
"""

from app.api.generation import _scrub_request_snapshot


def test_scrub_removes_api_key_but_keeps_provider():
    snapshot = {
        "preset": "medium",
        "requested_mods": ["SkyUI", "SKSE"],
        "llm_credentials": [
            {"provider": "anthropic", "api_key": "sk-ant-secret", "model": "claude"},
            {"provider": "groq", "api_key": "gsk-secret"},
        ],
    }
    scrubbed = _scrub_request_snapshot(snapshot)
    assert scrubbed is not None
    assert scrubbed["preset"] == "medium"
    assert scrubbed["requested_mods"] == ["SkyUI", "SKSE"]

    creds = scrubbed["llm_credentials"]
    assert len(creds) == 2
    for c in creds:
        # Key is redacted, never the raw secret
        assert c.get("api_key") == "[redacted]"
        assert "sk-ant-secret" not in str(c)
        assert "gsk-secret" not in str(c)

    # Non-secret fields survive
    assert creds[0]["provider"] == "anthropic"
    assert creds[0]["model"] == "claude"
    assert creds[1]["provider"] == "groq"


def test_scrub_handles_none():
    assert _scrub_request_snapshot(None) is None


def test_scrub_handles_missing_credentials():
    """A snapshot without an llm_credentials key (e.g. free tier) is returned
    untouched."""
    snapshot = {"preset": "small", "game_id": 1}
    scrubbed = _scrub_request_snapshot(snapshot)
    assert scrubbed == snapshot


def test_scrub_does_not_mutate_input():
    snapshot = {
        "preset": "large",
        "llm_credentials": [{"provider": "anthropic", "api_key": "sk-original"}],
    }
    _scrub_request_snapshot(snapshot)
    # Original dict must be untouched — important if the caller reuses it
    assert snapshot["llm_credentials"][0]["api_key"] == "sk-original"


def test_scrub_handles_credential_without_key():
    """Some credentials (e.g. Ollama local) may have no api_key — don't
    add a bogus [redacted] where there was nothing."""
    snapshot = {
        "llm_credentials": [
            {"provider": "ollama", "base_url": "http://localhost:11434"},
        ],
    }
    scrubbed = _scrub_request_snapshot(snapshot)
    assert "api_key" not in scrubbed["llm_credentials"][0]
    assert scrubbed["llm_credentials"][0]["provider"] == "ollama"
