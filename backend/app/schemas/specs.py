from pydantic import BaseModel


class SpecsInput(BaseModel):
    raw_text: str


class HardwareSpecs(BaseModel):
    gpu: str | None = None
    vram_mb: int | None = None
    cpu: str | None = None
    ram_gb: int | None = None
    cpu_cores: int | None = None
    cpu_speed_ghz: float | None = None
    storage_drives: str | None = None  # e.g. "C: 110GB free / 931GB, D: 412GB free / 1863GB"


class TierScores(BaseModel):
    vram: float = 0
    cpu: float = 0
    ram: float = 0
    gpu_gen: float = 0
    overall: float = 0


class SpecsParseResponse(BaseModel):
    specs: HardwareSpecs
    raw_text: str
    parse_method: str  # "regex" or "llm"
    tier: str | None = None  # "low", "mid", "high", "ultra"
    tier_scores: TierScores | None = None
