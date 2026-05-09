import json
import re
import logging

from app.schemas.specs import HardwareSpecs

logger = logging.getLogger(__name__)

# GPU patterns
GPU_PATTERNS = [
    re.compile(r"(NVIDIA\s+GeForce\s+[A-Z]{2,3}\s+\d{3,4}\s*(?:Ti\s*(?:SUPER)?|SUPER|XT)?)", re.IGNORECASE),
    re.compile(r"(GeForce\s+[A-Z]{2,3}\s+\d{3,4}\s*(?:Ti\s*(?:SUPER)?|SUPER|XT)?)", re.IGNORECASE),
    re.compile(r"(AMD\s+Radeon\s+RX\s+\d{3,4}\s*(?:XTX|XT)?)", re.IGNORECASE),
    re.compile(r"(Radeon\s+RX\s+\d{3,4}\s*(?:XTX|XT)?)", re.IGNORECASE),
    re.compile(r"(Intel\s+Arc\s+[A-Z]\d{3,4}[A-Z]?)", re.IGNORECASE),
    # Catch NVIDIA RTX/GTX without GeForce prefix
    re.compile(r"((?:RTX|GTX)\s+\d{3,4}\s*(?:Ti\s*(?:SUPER)?|SUPER)?)", re.IGNORECASE),
]

# VRAM patterns
VRAM_PATTERNS = [
    re.compile(r"(\d+)(?:\.\d+)?\s*GB\s*(?:GDDR\d[A-Z]?|VRAM|Video\s*(?:RAM|Memory))", re.IGNORECASE),
    re.compile(r"(?:VRAM|Video\s*(?:RAM|Memory)|Dedicated\s*(?:GPU|Video)\s*Memory|Total\s*Available\s*Graphics\s*Memory)\s*[:=]?\s*(\d+)(?:\.\d+)?\s*(?:GB|MB)", re.IGNORECASE),
    re.compile(r"(\d{4,})\s*MB\s*(?:GDDR|VRAM|Video|Dedicated)", re.IGNORECASE),
    re.compile(r"(?:GDDR\d[A-Z]?)\s*[:=]?\s*(\d+)(?:\.\d+)?\s*(?:GB|MB)", re.IGNORECASE),
]

# CPU patterns
CPU_PATTERNS = [
    re.compile(r"(Intel\s+Core\s+(?:Ultra\s+)?\d?\s*i\d[- ]\d{4,5}[A-Z]{0,3})", re.IGNORECASE),
    re.compile(r"(Intel\s+Core\s+i\d[- ]\d{4,5}[A-Z]{0,3})", re.IGNORECASE),
    re.compile(r"(AMD\s+Ryzen\s+\d\s+\d{4}X?\d?[A-Z]*(?:\s*3D)?)", re.IGNORECASE),
    re.compile(r"(Intel\s+Core\s+Ultra\s+\d\s+\d{3}[A-Z]?)", re.IGNORECASE),
    re.compile(r"(AMD\s+Ryzen\s+\d\s+\d{3,4}[A-Z]*)", re.IGNORECASE),
    # Catch processor lines from system info
    re.compile(r"(?:Processor|CPU)\s*[:=]?\s*(.+?)(?:\s*@|\s*\d+\.\d+\s*GHz|\n|$)", re.IGNORECASE),
]

# RAM patterns (ordered from most specific to least; avoid matching VRAM/GDDR lines)
RAM_PATTERNS = [
    # "System Memory: 32 GB", "Available System Memory: 31.9 GB"
    re.compile(r"(?:System\s*Memory|System\s*RAM)\s*[:=]?\s*(\d{1,3})(?:\.\d+)?\s*GB", re.IGNORECASE),
    # "RAM: 32 GB DDR5", "32 GB DDR5 RAM"
    re.compile(r"(\d{1,3})\s*GB\s*DDR\d", re.IGNORECASE),
    re.compile(r"(?<!V)(?:RAM)\s*[:=]?\s*(\d{1,3})(?:\.\d+)?\s*GB", re.IGNORECASE),
    # "Installed Physical Memory (RAM): 32 GB", "Total Physical Memory: 32,651 MB"
    re.compile(r"(?:Installed\s*(?:Physical\s*)?Memory|Total\s*Physical\s*Memory)\s*(?:\(RAM\))?\s*[:=]?\s*(\d{1,3})(?:[.,]\d+)?\s*GB", re.IGNORECASE),
    # "Memory: 32768 MB" or "32,651 MB" (but NOT "Video Memory" or "GDDR")
    re.compile(r"(?<!Video\s)(?<!GPU\s)(?<!Dedicated\s)Memory\s*(?:\(RAM\))?\s*[:=]?\s*(\d[\d,]{3,6})\s*MB", re.IGNORECASE),
    # "Memory: 32 GB" (but NOT "Video Memory" or lines containing GDDR)
    re.compile(r"(?<!Video\s)(?<!GPU\s)(?<!Dedicated\s)Memory\s*[:=]?\s*(\d{1,3})(?:\.\d+)?\s*GB", re.IGNORECASE),
    # "32 GB installed", "32 GB total", "32 GB physical", "32 GB usable"
    re.compile(r"(\d{1,3})\s*GB\s*(?:installed|total|physical|usable)", re.IGNORECASE),
]

# CPU core count patterns
CPU_CORE_PATTERNS = [
    re.compile(r"(\d{1,2})\s*-?\s*[Cc]ore", re.IGNORECASE),
    re.compile(r"(\d{1,2})\s*[Cc]ores", re.IGNORECASE),
    re.compile(r"(\d{1,2})\s*C\s*/\s*\d{1,2}\s*T", re.IGNORECASE),  # "8C/16T"
    re.compile(r"[Cc]ores?\s*[:=]?\s*(\d{1,2})", re.IGNORECASE),
    re.compile(r"(\d{1,2})\s*(?:physical\s+)?(?:cores|processors)", re.IGNORECASE),
]

# CPU speed patterns
CPU_SPEED_PATTERNS = [
    re.compile(r"(\d+\.\d+)\s*GHz", re.IGNORECASE),
    re.compile(r"(?:Base|Boost|Clock|Speed|Frequency)\s*[:=]?\s*(\d+\.\d+)\s*GHz", re.IGNORECASE),
    re.compile(r"@\s*(\d+\.\d+)\s*GHz", re.IGNORECASE),
]


# Storage drive patterns - matches "Drives: C: 110GB free / 931GB, D: 412GB free / 1863GB"
DRIVE_PATTERN = re.compile(
    r"[Dd]rives?\s*[:=]?\s*(.+)",
)


LLM_PARSE_PROMPT = """Extract hardware specifications from the following text.
Return ONLY a JSON object with these fields (use null if not found):
{
  "gpu": "GPU model name (e.g. NVIDIA GeForce RTX 4070 Ti)",
  "vram_mb": VRAM in megabytes as integer (e.g. 12288 for 12GB),
  "cpu": "CPU model name (e.g. AMD Ryzen 7 7800X3D)",
  "ram_gb": RAM in gigabytes as integer (e.g. 32),
  "cpu_cores": Number of CPU cores as integer (e.g. 8),
  "cpu_speed_ghz": CPU clock speed in GHz as float (e.g. 4.5)
}

Text to parse:
"""


def _extract_first_match(text: str, patterns: list[re.Pattern]) -> str | None:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            return match.group(1).strip()
    return None


def _parse_vram(text: str) -> int | None:
    for pattern in VRAM_PATTERNS:
        match = pattern.search(text)
        if match:
            value = int(match.group(1))
            if value >= 1024:
                return value
            return value * 1024
    return None


def _parse_ram(text: str) -> int | None:
    for pattern in RAM_PATTERNS:
        match = pattern.search(text)
        if match:
            raw = match.group(1).replace(",", "")
            value = int(raw)
            # If the value is large (e.g. 32768 MB), convert to GB
            if value >= 1024:
                return round(value / 1024)
            return value
    return None


def _parse_cpu_cores(text: str) -> int | None:
    """Extract CPU core count from text."""
    for pattern in CPU_CORE_PATTERNS:
        match = pattern.search(text)
        if match:
            cores = int(match.group(1))
            if 1 <= cores <= 128:
                return cores
    return None


def _parse_cpu_speed(text: str) -> float | None:
    """Extract CPU clock speed in GHz from text."""
    for pattern in CPU_SPEED_PATTERNS:
        match = pattern.search(text)
        if match:
            speed = float(match.group(1))
            if 0.5 <= speed <= 8.0:
                return speed
    return None


# GPU model → VRAM in MB lookup table.
# Used to infer VRAM when the text contains a GPU name but no explicit VRAM value
# (e.g., browser auto-detection via WebGL only returns the GPU model).
# Ordered from most specific to least specific so longer names match first.
GPU_VRAM_TABLE: dict[str, int] = {
    # NVIDIA RTX 50 series
    "rtx 5090": 32 * 1024,
    "rtx 5080": 16 * 1024,
    "rtx 5070 ti": 16 * 1024,
    "rtx 5070": 12 * 1024,
    "rtx 5060 ti": 16 * 1024,
    "rtx 5060": 8 * 1024,
    # NVIDIA RTX 40 series
    "rtx 4090": 24 * 1024,
    "rtx 4080 super": 16 * 1024,
    "rtx 4080": 16 * 1024,
    "rtx 4070 ti super": 16 * 1024,
    "rtx 4070 ti": 12 * 1024,
    "rtx 4070 super": 12 * 1024,
    "rtx 4070": 12 * 1024,
    "rtx 4060 ti": 8 * 1024,
    "rtx 4060": 8 * 1024,
    # NVIDIA RTX 30 series
    "rtx 3090 ti": 24 * 1024,
    "rtx 3090": 24 * 1024,
    "rtx 3080 ti": 12 * 1024,
    "rtx 3080": 10 * 1024,
    "rtx 3070 ti": 8 * 1024,
    "rtx 3070": 8 * 1024,
    "rtx 3060 ti": 8 * 1024,
    "rtx 3060": 12 * 1024,
    "rtx 3050": 8 * 1024,
    # NVIDIA RTX 20 series
    "rtx 2080 ti": 11 * 1024,
    "rtx 2080 super": 8 * 1024,
    "rtx 2080": 8 * 1024,
    "rtx 2070 super": 8 * 1024,
    "rtx 2070": 8 * 1024,
    "rtx 2060 super": 8 * 1024,
    "rtx 2060": 6 * 1024,
    # NVIDIA GTX 16 series
    "gtx 1660 ti": 6 * 1024,
    "gtx 1660 super": 6 * 1024,
    "gtx 1660": 6 * 1024,
    "gtx 1650 super": 4 * 1024,
    "gtx 1650": 4 * 1024,
    # NVIDIA GTX 10 series
    "gtx 1080 ti": 11 * 1024,
    "gtx 1080": 8 * 1024,
    "gtx 1070 ti": 8 * 1024,
    "gtx 1070": 8 * 1024,
    "gtx 1060": 6 * 1024,
    "gtx 1050 ti": 4 * 1024,
    "gtx 1050": 2 * 1024,
    # AMD RX 9000 series
    "rx 9070 xt": 16 * 1024,
    "rx 9070": 16 * 1024,
    # AMD RX 7000 series
    "rx 7900 xtx": 24 * 1024,
    "rx 7900 xt": 20 * 1024,
    "rx 7900 gre": 16 * 1024,
    "rx 7800 xt": 16 * 1024,
    "rx 7700 xt": 12 * 1024,
    "rx 7600 xt": 16 * 1024,
    "rx 7600": 8 * 1024,
    # AMD RX 6000 series
    "rx 6950 xt": 16 * 1024,
    "rx 6900 xt": 16 * 1024,
    "rx 6800 xt": 16 * 1024,
    "rx 6800": 16 * 1024,
    "rx 6750 xt": 12 * 1024,
    "rx 6700 xt": 12 * 1024,
    "rx 6650 xt": 8 * 1024,
    "rx 6600 xt": 8 * 1024,
    "rx 6600": 8 * 1024,
    "rx 6500 xt": 4 * 1024,
    # AMD RX 5000 series
    "rx 5700 xt": 8 * 1024,
    "rx 5700": 8 * 1024,
    "rx 5600 xt": 6 * 1024,
    "rx 5500 xt": 8 * 1024,
    # Intel Arc
    "arc b580": 12 * 1024,
    "arc a770": 16 * 1024,
    "arc a750": 8 * 1024,
    "arc a580": 8 * 1024,
    "arc a380": 6 * 1024,
}


def _infer_vram_from_gpu(gpu_name: str) -> int | None:
    """Infer VRAM from a known GPU model name.

    This is used when the input text has a GPU name but no explicit VRAM
    value — for example, when the browser auto-detects via WebGL.
    """
    if not gpu_name:
        return None
    gpu_lower = gpu_name.lower()
    # Check from most specific (longest key) to least specific
    for key, vram_mb in sorted(GPU_VRAM_TABLE.items(), key=lambda x: -len(x[0])):
        if key in gpu_lower:
            return vram_mb
    return None


# CPU model → core count / boost clock lookup table.
# Used to infer cores/speed when the text has a CPU name but no explicit values
# (e.g., user types "AMD Ryzen 7 7800X3D" without "8 cores @ 5.0 GHz").
CPU_SPECS_TABLE: dict[str, dict] = {
    # AMD Ryzen — 3D V-Cache
    "7800x3d": {"cores": 8, "speed_ghz": 5.0},
    "9800x3d": {"cores": 8, "speed_ghz": 5.2},
    # AMD Ryzen 9000/7000/5000
    "9950x": {"cores": 16, "speed_ghz": 5.7},
    "9900x": {"cores": 12, "speed_ghz": 5.6},
    "7950x": {"cores": 16, "speed_ghz": 5.7},
    "7900x": {"cores": 12, "speed_ghz": 5.6},
    "7700x": {"cores": 8, "speed_ghz": 5.4},
    "5800x3d": {"cores": 8, "speed_ghz": 4.5},
    "5800x": {"cores": 8, "speed_ghz": 4.7},
    "5600x": {"cores": 6, "speed_ghz": 4.6},
    "5600": {"cores": 6, "speed_ghz": 4.4},
    # Intel 14th/13th/12th gen
    "14900k": {"cores": 24, "speed_ghz": 6.0},
    "14700k": {"cores": 20, "speed_ghz": 5.6},
    "14600k": {"cores": 14, "speed_ghz": 5.3},
    "13900k": {"cores": 24, "speed_ghz": 5.8},
    "13700k": {"cores": 16, "speed_ghz": 5.4},
    "13600k": {"cores": 14, "speed_ghz": 5.1},
    "12900k": {"cores": 16, "speed_ghz": 5.2},
    "12700k": {"cores": 12, "speed_ghz": 5.0},
    "12600k": {"cores": 10, "speed_ghz": 4.9},
    "12400f": {"cores": 6, "speed_ghz": 4.4},
    # Intel Core Ultra
    "ultra 9 285k": {"cores": 24, "speed_ghz": 5.7},
    "ultra 7 265k": {"cores": 20, "speed_ghz": 5.5},
    "ultra 5 245k": {"cores": 14, "speed_ghz": 5.2},
}


def _infer_cpu_specs(
    cpu_name: str,
    cores: int | None,
    speed: float | None,
) -> tuple[int | None, float | None]:
    """Infer CPU cores/speed from a known CPU model name.

    Only fills in values that are still None — explicit user-provided
    values always take priority.
    """
    if not cpu_name:
        return cores, speed
    cpu_lower = cpu_name.lower()
    # Check from most specific (longest key) to least specific
    for key, specs in sorted(CPU_SPECS_TABLE.items(), key=lambda x: -len(x[0])):
        if key in cpu_lower:
            if cores is None:
                cores = specs["cores"]
            if speed is None:
                speed = specs["speed_ghz"]
            break
    return cores, speed


def _parse_drives(text: str) -> str | None:
    """Extract storage drive info from text."""
    match = DRIVE_PATTERN.search(text)
    if match:
        return match.group(1).strip()
    return None


def parse_specs_regex(raw_text: str) -> HardwareSpecs:
    """Parse hardware specs using regex patterns."""
    gpu = _extract_first_match(raw_text, GPU_PATTERNS)
    vram_mb = _parse_vram(raw_text)

    # If we found a GPU but no VRAM in the text, try to infer VRAM from the GPU model
    if gpu and not vram_mb:
        vram_mb = _infer_vram_from_gpu(gpu)

    cpu = _extract_first_match(raw_text, CPU_PATTERNS)
    cores = _parse_cpu_cores(raw_text)
    speed = _parse_cpu_speed(raw_text)

    # Infer CPU cores/speed from known model names if not explicitly provided
    if cpu and (not cores or not speed):
        cores, speed = _infer_cpu_specs(cpu, cores, speed)

    return HardwareSpecs(
        gpu=gpu,
        vram_mb=vram_mb,
        cpu=cpu,
        ram_gb=_parse_ram(raw_text),
        cpu_cores=cores,
        cpu_speed_ghz=speed,
        storage_drives=_parse_drives(raw_text),
    )


async def parse_specs_llm(raw_text: str) -> HardwareSpecs | None:
    """Fallback: use LLM to extract specs from freeform text."""
    try:
        from app.llm.provider import LLMProviderFactory

        llm = LLMProviderFactory.create()
        response = await llm.generate(
            system_prompt="You are a hardware specification parser. Extract PC hardware details and return ONLY valid JSON.",
            user_prompt=LLM_PARSE_PROMPT + raw_text,
        )

        # Try to extract JSON from response
        response = response.strip()
        if response.startswith("```"):
            # Strip markdown code block
            lines = response.split("\n")
            response = "\n".join(
                line for line in lines if not line.strip().startswith("```")
            )

        data = json.loads(response)
        return HardwareSpecs(
            gpu=data.get("gpu"),
            vram_mb=data.get("vram_mb"),
            cpu=data.get("cpu"),
            ram_gb=data.get("ram_gb"),
            cpu_cores=data.get("cpu_cores"),
            cpu_speed_ghz=data.get("cpu_speed_ghz"),
        )
    except Exception as e:
        logger.warning(f"LLM spec parsing failed: {e}")
        return None


async def parse_specs(raw_text: str) -> tuple[HardwareSpecs, str]:
    """Parse hardware specs from freeform text.

    Uses regex first, falls back to LLM if regex can't find GPU or CPU.
    Returns (specs, method) where method is 'regex', 'llm', or 'regex_partial'.
    """
    specs = parse_specs_regex(raw_text)

    # If regex found at least GPU or CPU, we're good
    if specs.gpu or specs.cpu:
        return specs, "regex"

    # Fallback to LLM
    llm_specs = await parse_specs_llm(raw_text)
    if llm_specs and (llm_specs.gpu or llm_specs.cpu):
        return llm_specs, "llm"

    # Return partial regex results
    return specs, "regex_partial"
