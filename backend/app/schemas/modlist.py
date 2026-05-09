from pydantic import BaseModel
import uuid

from app.services.generation.preset import SizePreset


class LLMCredential(BaseModel):
    provider: str  # provider ID from registry, or custom ID
    api_key: str
    base_url: str | None = None  # Required for custom OpenAI-compatible providers
    model: str | None = None  # Override the registry default model


class ModlistGenerateRequest(BaseModel):
    game_id: int
    playstyle_id: int | None = None  # Optional — user may use custom description instead
    game_version: str | None = None  # e.g. "SE", "AE", "Standard", "Next-Gen"
    gpu: str | None = None
    vram_mb: int | None = None
    cpu: str | None = None
    ram_gb: int | None = None
    cpu_cores: int | None = None
    cpu_speed_ghz: float | None = None
    available_storage_gb: int | None = None
    # Free-text description of desired modding experience
    custom_description: str | None = None
    # Specific mods the user wants included by name
    requested_mods: list[str] = []
    # User-supplied LLM credentials — tried in order, falls back on failure
    llm_credentials: list[LLMCredential] = []
    # Size preset — Large/Massive/Ultimate gate on BYOK in start_generation
    preset: SizePreset = SizePreset.MEDIUM


class ModEntry(BaseModel):
    mod_id: int | None = None
    nexus_mod_id: int | None = None
    name: str
    author: str | None = None
    summary: str | None = None
    reason: str | None = None
    load_order: int | None = None
    is_patch: bool = False
    patches_mods: list[str] | None = None
    compatibility_notes: str | None = None


class UserKnowledgeFlag(BaseModel):
    mod_a: str
    mod_b: str
    issue: str
    severity: str  # "warning" or "critical"


class ModlistResponse(BaseModel):
    id: uuid.UUID
    game_id: int
    game_version: str | None = None  # "SE"/"AE"/"Standard"/"Next-Gen", used by install guide
    game_domain: str | None = None
    playstyle_id: int | None = None
    entries: list[ModEntry] = []
    llm_provider: str | None = None
    user_knowledge_flags: list[UserKnowledgeFlag] = []
    used_fallback: bool = False
    generation_error: str | None = None
    has_debug_log: bool = False


class ExportModEntry(BaseModel):
    nexus_mod_id: int | None = None
    file_id: int | None = None
    name: str
    author: str | None = None
    load_order: int | None = None
    is_patch: bool = False
    patches_mods: list[str] | None = None


class ModlistExportResponse(BaseModel):
    id: uuid.UUID
    game_domain: str
    game_name: str
    mod_count: int
    entries: list[ExportModEntry] = []


class SizeSummary(BaseModel):
    download_bytes: int
    installed_estimate_bytes: int  # 2.5 x download_bytes
    sized_count: int
    unsized_count: int
    total_count: int
    largest_drive_free_bytes: int | None
    # One of: "comfortable" | "tight" | "insufficient" | "unknown"
    fit_status: str


