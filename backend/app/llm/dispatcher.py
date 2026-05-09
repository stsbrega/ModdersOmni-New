"""Smart Dispatcher: routes each build phase to the optimal LLM model.

Selects models based on phase complexity and available BYOK keys.
All users generate freely — no credit system.
"""

import logging
from dataclasses import dataclass

from app.llm.registry import get_provider

logger = logging.getLogger(__name__)


# Model tier classification — maps model ID to cost tier
MODEL_TIERS: dict[str, str] = {
    # Free tier (no credits)
    "openrouter/free": "free",
    "meta-llama/llama-4-scout-17b-16e-instruct": "free",
    "llama3.1-8b": "free",  # Cerebras (8B only)
    # Budget tier (~$0.50/M tokens)
    "llama-3.3-70b-versatile": "budget",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo": "budget",
    "qwen3.5-plus": "budget",
    "deepseek-chat": "budget",
    # Standard tier (~$2/M tokens)
    "gemini-2.5-flash": "standard",
    "gemini-2.5-pro": "standard",
    "mistral-large-latest": "standard",
    "gpt-4o-mini": "standard",
    # Premium tier (~$8/M tokens)
    "claude-sonnet-4-20250514": "premium",
    "gpt-4o": "premium",
    # Ollama Cloud fallback
    "devstral-small-2:24b": "free",
    # Gemma 4 (local via Ollama — BYOK)
    "gemma4:26b": "free",
    "gemma4:e2b": "free",
    "gemma4:e4b": "free",
    "gemma4:31b": "free",
    # Gemma 4 cloud (when available on OpenRouter/Groq)
    "google/gemma-4-26b-it": "free",
}

# Phase complexity: maps phase name patterns to complexity level.
# Names are matched case-insensitively using substring matching.
PHASE_COMPLEXITY: dict[str, str] = {
    # Low complexity — well-known mods, formulaic selection
    "essentials": "low",
    "ui": "low",
    "interface": "low",
    "bug fix": "low",
    "fixes": "low",
    # Medium complexity — VRAM reasoning, compatibility awareness
    "texture": "low",
    "foundation": "medium",
    "animation": "medium",
    "physics": "medium",
    "audio": "medium",
    "lighting": "medium",
    "weather": "medium",
    "visual": "medium",
    "tweaks": "medium",
    "quality of life": "medium",
    "locations": "medium",
    "world": "medium",
    # High complexity — deep reasoning, playstyle interpretation
    "gameplay": "high",
    "combat": "high",
    "quest": "high",
    "content": "high",
    "compatibility": "high",
    "patches": "high",
}

# Free tier model candidates by complexity.
# Each entry is (provider_id, model, tier). The pipeline tries them in order.
# gemini_pro uses the same Google API key as gemini — both are available with one key.
# ollama_cloud is the fallback if Gemini fails or hits a context limit.
_FREE_MODEL_MAP: dict[str, list[tuple[str, str, str]]] = {
    "high": [
        ("gemini", "gemini-2.5-flash", "free"),
        ("gemini_pro", "gemini-2.5-pro", "free"),
        ("ollama_cloud", "devstral-small-2:24b", "free"),
    ],
    "medium": [
        ("gemini", "gemini-2.5-flash", "free"),
        ("gemini_pro", "gemini-2.5-pro", "free"),
        ("ollama_cloud", "devstral-small-2:24b", "free"),
    ],
    "low": [
        ("gemini", "gemini-2.5-flash", "free"),
        ("gemini_pro", "gemini-2.5-pro", "free"),
        ("ollama_cloud", "devstral-small-2:24b", "free"),
    ],
}


@dataclass
class DispatchResult:
    """Result of model selection for a phase."""
    provider_id: str
    model: str
    tier: str


def get_model_tier(model_name: str) -> str:
    """Look up the cost tier for a model. Defaults to 'standard'."""
    return MODEL_TIERS.get(model_name, "standard")


def get_phase_complexity(phase_name: str) -> str:
    """Determine complexity level from phase name. Defaults to 'medium'."""
    name_lower = phase_name.lower()
    for pattern, complexity in PHASE_COMPLEXITY.items():
        if pattern in name_lower:
            return complexity
    return "medium"


class SmartDispatcher:
    """Routes each build phase to the optimal model based on user resources."""

    def select_model(
        self,
        phase_name: str,
        available_keys: dict[str, str] | None = None,
        estimated_context: int = 0,
    ) -> DispatchResult:
        """Pick the best model for this phase given user's resources.

        Args:
            phase_name: Name of the build phase (e.g., "Gameplay & Playstyle")
            available_keys: Dict of {provider_id: api_key} from user's BYOK keys.
                            None or empty falls through to free-tier server keys.
            estimated_context: Estimated token count needed for this phase.
                               Used to skip providers with insufficient context windows.

        Returns:
            DispatchResult with the selected model and metadata
        """
        complexity = get_phase_complexity(phase_name)

        # If user has BYOK keys, prefer those
        if available_keys:
            result = self._select_from_byok(available_keys, complexity, estimated_context)
            if result:
                return result

        # Fallback to free tier (first candidate for this complexity)
        candidates = _FREE_MODEL_MAP.get(complexity, _FREE_MODEL_MAP["medium"])
        provider_id, model, tier = candidates[0]
        return DispatchResult(provider_id=provider_id, model=model, tier=tier)

    def get_free_candidates(self, phase_name: str) -> list[tuple[str, str, str]]:
        """Return the ordered list of free-tier provider candidates for a phase.

        Each entry is (provider_id, model_name, tier). The pipeline should try
        them in order, skipping any whose server-side API key is not configured.
        """
        complexity = get_phase_complexity(phase_name)
        return list(_FREE_MODEL_MAP.get(complexity, _FREE_MODEL_MAP["medium"]))

    def _select_from_byok(
        self,
        available_keys: dict[str, str],
        complexity: str,
        estimated_context: int = 0,
    ) -> DispatchResult | None:
        """Select the best BYOK provider for the given complexity.

        When estimated_context > 0, providers whose context_window is
        smaller than the estimate are skipped. If no provider has enough
        context, the one with the largest window is used as a fallback.
        """
        if complexity == "high":
            preferred = ["anthropic", "openai", "gemini", "mistral", "groq", "deepseek", "qwen", "ollama"]
        elif complexity == "medium":
            preferred = ["gemini", "openai", "anthropic", "mistral", "groq", "deepseek", "qwen", "ollama"]
        else:
            preferred = ["gemini", "groq", "deepseek", "qwen", "mistral", "openai", "anthropic", "ollama"]

        candidates: list[tuple[str, dict]] = []
        for provider_id in preferred:
            if provider_id in available_keys and available_keys[provider_id]:
                entry = get_provider(provider_id)
                if entry:
                    candidates.append((provider_id, entry))

        if not candidates:
            return None

        if estimated_context > 0:
            fits = [
                (pid, e) for pid, e in candidates
                if e.get("context_window", 0) >= estimated_context
            ]
            if fits:
                candidates = fits
            else:
                candidates = [max(candidates, key=lambda x: x[1].get("context_window", 0))]

        provider_id, entry = candidates[0]
        model = entry["model"]
        tier = get_model_tier(model)
        return DispatchResult(provider_id=provider_id, model=model, tier=tier)
