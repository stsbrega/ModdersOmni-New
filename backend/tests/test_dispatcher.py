"""Tests for phase-based server-side model routing."""

from app.llm.dispatcher import SmartDispatcher


class TestFreeCandidates:
    def test_high_complexity_returns_gemini_first(self):
        candidates = SmartDispatcher().get_free_candidates("Compatibility Patches")

        assert candidates[0][0] == "gemini"

    def test_low_complexity_returns_candidates(self):
        candidates = SmartDispatcher().get_free_candidates("UI")

        assert len(candidates) > 0
        provider_ids = [provider_id for provider_id, _, _ in candidates]
        assert "gemini" in provider_ids

    def test_unknown_phase_defaults_to_medium_complexity(self):
        candidates = SmartDispatcher().get_free_candidates("Unknown Phase Name")

        assert len(candidates) > 0
