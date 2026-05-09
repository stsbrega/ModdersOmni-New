"""
Central registry of known LLM providers.

To add a new provider, append a dict here. No other code changes needed
as long as the provider uses an OpenAI-compatible API (most do).
"""

PROVIDER_REGISTRY: list[dict] = [
    # ── BYOK / Premium providers ──
    {
        "id": "anthropic",
        "name": "Anthropic",
        "model": "claude-sonnet-4-20250514",
        "base_url": None,  # Uses native Anthropic API, not OpenAI-compatible
        "type": "anthropic",
        "placeholder": "sk-ant-...",
        "hint_url": "console.anthropic.com",
        "key_prefixes": ["sk-ant-"],
        "context_window": 200_000,
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "model": "gpt-4o",
        "base_url": "https://api.openai.com/v1",
        "type": "openai_compatible",
        "placeholder": "sk-...",
        "hint_url": "platform.openai.com",
        "key_prefixes": ["sk-proj-", "sk-"],
        "context_window": 128_000,
    },
    {
        "id": "gemini",
        "name": "Google Gemini",
        "model": "gemini-2.5-flash",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "type": "openai_compatible",
        "placeholder": "AIza...",
        "hint_url": "aistudio.google.com",
        "key_prefixes": ["AIza"],
        "context_window": 1_000_000,
    },
    {
        "id": "gemini_pro",
        "name": "Google Gemini Pro",
        "model": "gemini-2.5-pro",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "type": "openai_compatible",
        "placeholder": "AIza...",
        "hint_url": "aistudio.google.com",
        "key_prefixes": ["AIza"],
        "context_window": 1_000_000,
    },
    {
        "id": "groq",
        "name": "Groq",
        "model": "llama-3.3-70b-versatile",
        "base_url": "https://api.groq.com/openai/v1",
        "type": "openai_compatible",
        "placeholder": "gsk_...",
        "hint_url": "console.groq.com",
        "key_prefixes": ["gsk_"],
        "context_window": 128_000,
    },
    {
        "id": "groq_scout",
        "name": "Groq (Llama 4 Scout)",
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "base_url": "https://api.groq.com/openai/v1",
        "type": "openai_compatible",
        "placeholder": "gsk_...",
        "hint_url": "console.groq.com",
        "key_prefixes": ["gsk_"],
        "context_window": 328_000,
    },
    {
        "id": "together",
        "name": "Together AI",
        "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "base_url": "https://api.together.xyz/v1",
        "type": "openai_compatible",
        "placeholder": "",
        "hint_url": "api.together.ai",
        "key_prefixes": [],
        "context_window": 128_000,
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
        "type": "openai_compatible",
        "placeholder": "sk-...",
        "hint_url": "platform.deepseek.com",
        "key_prefixes": ["sk-"],
        "context_window": 128_000,
    },
    {
        "id": "mistral",
        "name": "Mistral AI",
        "model": "mistral-large-latest",
        "base_url": "https://api.mistral.ai/v1",
        "type": "openai_compatible",
        "placeholder": "",
        "hint_url": "console.mistral.ai",
        "key_prefixes": [],
        "context_window": 128_000,
    },
    {
        "id": "qwen",
        "name": "Qwen (DashScope)",
        "model": "qwen3.5-plus",
        "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "type": "openai_compatible",
        "placeholder": "sk-...",
        "hint_url": "bailian.console.alibabacloud.com",
        "key_prefixes": ["sk-"],
        "context_window": 128_000,
    },
    # ── Free-tier / infrastructure providers ──
    {
        "id": "cerebras",
        "name": "Cerebras",
        "model": "llama3.1-8b",
        "base_url": "https://api.cerebras.ai/v1",
        "type": "openai_compatible",
        "placeholder": "csk-...",
        "hint_url": "cloud.cerebras.ai",
        "key_prefixes": ["csk-"],
        "context_window": 128_000,
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "model": "openrouter/free",
        "base_url": "https://openrouter.ai/api/v1",
        "type": "openai_compatible",
        "placeholder": "sk-or-...",
        "hint_url": "openrouter.ai/keys",
        "key_prefixes": ["sk-or-"],
        "context_window": 128_000,
    },
    # Ollama local inference — Gemma 4 variants (model is overridden per-request):
    #   gemma4:e2b  — 7.2 GB,  128K ctx  (edge, 2B params, best for 8 GB VRAM)
    #   gemma4:e4b  — 9.6 GB,  128K ctx  (edge, 4B params, "latest" tag)
    #   gemma4:26b  — 18 GB,   256K ctx  (MoE, 4B active / 128 experts)
    #   gemma4:31b  — 20 GB,   256K ctx  (dense, best quality)
    # context_window here is the max across variants; smaller models cap at 128K.
    {
        "id": "ollama",
        "name": "Ollama (Local)",
        "model": "gemma4:e4b",  # default = latest tag; overridden per-request
        "base_url": "http://localhost:11434/v1",
        "type": "openai_compatible",
        "placeholder": "",
        "hint_url": "ollama.com",
        "key_prefixes": [],
        "context_window": 256_000,
        "keyless": True,
    },
    # Ollama Cloud — same models as local, hosted at ollama.com
    {
        "id": "ollama_cloud",
        "name": "Ollama Cloud",
        "model": "devstral-small-2:24b",
        "base_url": "https://ollama.com/v1",
        "type": "openai_compatible",
        "placeholder": "ollama_...",
        "hint_url": "ollama.com/settings",
        "key_prefixes": ["ollama_"],
        "context_window": 128_000,
    },
]


# Providers that share a base_url and accept the same keys.
# A key detected as "groq" is also valid for "groq_scout" (same Groq account).
# A key detected as "gemini" is also valid for "gemini_pro" (same Google project).
_COMPATIBLE_PROVIDERS: dict[str, set[str]] = {
    "groq": {"groq", "groq_scout"},
    "groq_scout": {"groq", "groq_scout"},
    "gemini": {"gemini", "gemini_pro"},
    "gemini_pro": {"gemini", "gemini_pro"},
}


def get_provider(provider_id: str) -> dict | None:
    """Look up a provider by ID. Returns None if not found."""
    for p in PROVIDER_REGISTRY:
        if p["id"] == provider_id:
            return p
    return None


def detect_provider_from_key(api_key: str) -> tuple[str, str] | None:
    """Detect the provider from an API key's prefix.

    Uses longest-prefix-match (same logic as the frontend's detectProvider).
    Returns (provider_id, provider_name) or None if unrecognized.

    When multiple providers share the same longest prefix (e.g., ``sk-``
    matches OpenAI, DeepSeek, and Qwen), returns the first match — callers
    should treat this as ambiguous.
    """
    key = api_key.strip()
    if not key:
        return None

    # Build (prefix, id, name) sorted by prefix length descending
    entries = []
    for p in PROVIDER_REGISTRY:
        for prefix in p["key_prefixes"]:
            entries.append((prefix, p["id"], p["name"]))
    entries.sort(key=lambda e: len(e[0]), reverse=True)

    for prefix, provider_id, name in entries:
        if key.startswith(prefix):
            return (provider_id, name)

    return None


def validate_key_provider(api_key: str, provider_id: str) -> dict:
    """Check whether an API key matches the claimed provider.

    Returns a dict with:
        match: True if the key looks correct for this provider
        detected_provider: The provider the key actually belongs to (or None)
        detected_name: Human-readable name of the detected provider
        suggestion: A message for the user, or None if everything is fine
    """
    detected = detect_provider_from_key(api_key)

    if detected is None:
        # Key prefix not recognized — could be a custom provider, let it through
        return {
            "match": True,
            "detected_provider": None,
            "detected_name": None,
            "suggestion": None,
        }

    detected_id, detected_name = detected

    # Check if the claimed provider is compatible with the detected one
    compatible = _COMPATIBLE_PROVIDERS.get(detected_id, {detected_id})
    if provider_id in compatible:
        return {
            "match": True,
            "detected_provider": detected_id,
            "detected_name": detected_name,
            "suggestion": None,
        }

    # Mismatch — the key belongs to a different provider
    claimed_entry = get_provider(provider_id)
    claimed_name = claimed_entry["name"] if claimed_entry else provider_id

    return {
        "match": False,
        "detected_provider": detected_id,
        "detected_name": detected_name,
        "suggestion": (
            f"This key looks like a {detected_name} key, "
            f"but you selected {claimed_name}. "
            f"The key will be routed to {detected_name} instead."
        ),
    }


def get_public_registry() -> list[dict]:
    """Return registry entries safe for the frontend (no internal fields)."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "model": p["model"],
            "placeholder": p["placeholder"],
            "hint_url": p["hint_url"],
            "key_prefixes": p["key_prefixes"],
            "context_window": p.get("context_window", 0),
            "keyless": p.get("keyless", False),
        }
        for p in PROVIDER_REGISTRY
    ]
