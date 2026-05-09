"""Mod compatibility checking endpoint."""

import logging
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

_KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"

# Slug-to-filename mapping for game knowledge bases
_GAME_FILES: dict[str, str] = {
    "skyrimspecialedition": "skyrim.md",
    "skyrimse": "skyrim.md",
    "skyrim": "skyrim.md",
    "fallout4": "fallout4.md",
}


class CompatibilityCheckRequest(BaseModel):
    mod_a_name: str
    mod_b_name: str
    game_slug: str = "skyrimspecialedition"


class CompatibilityIssue(BaseModel):
    description: str
    severity: str  # "warning" | "critical"
    source: str  # "knowledge_base" | "heuristic"


class CompatibilityCheckResponse(BaseModel):
    compatible: bool
    issues: list[CompatibilityIssue] = []
    suggested_patches: list[str] = []
    confidence: str  # "high" | "medium" | "low"


# Known incompatibilities from community knowledge (seed data)
_KNOWN_CONFLICTS: list[dict] = [
    {
        "mods": {"skse", "skse64"},
        "issue": "Multiple SKSE versions cannot coexist",
        "severity": "critical",
    },
    {
        "mods": {"unofficial skyrim special edition patch", "ussep"},
        "aliases": True,
        "issue": "These are the same mod (aliases)",
        "severity": "warning",
    },
    {
        "mods": {"enb", "reshade"},
        "issue": "ENB and ReShade can conflict — use one or the other",
        "severity": "warning",
    },
    {
        "mods": {"alternate start - live another life", "realm of lorkhan - alternate starts"},
        "issue": "Both mods replace the vanilla start — only one alternate start mod should be active",
        "severity": "critical",
        "patch": None,
    },
    {
        "mods": {"alternate start", "realm of lorkhan"},
        "issue": "Both mods replace the vanilla start — only one alternate start mod should be active",
        "severity": "critical",
    },
    {
        "mods": {"fnis", "nemesis"},
        "issue": "FNIS and Nemesis manage animations differently — use Nemesis as a drop-in replacement, not both simultaneously",
        "severity": "critical",
    },
    {
        "mods": {"open cities skyrim", "jk's skyrim"},
        "issue": "Open Cities and JK's Skyrim require a compatibility patch to avoid mesh conflicts",
        "severity": "warning",
        "suggested_patch": "Open Cities Skyrim - JK's Skyrim Patch",
    },
    {
        "mods": {"wet and cold", "frostfall"},
        "issue": "Wet and Cold and Frostfall both manage wetness/cold — configure them together or use only one",
        "severity": "warning",
    },
    {
        "mods": {"immersive armors", "armor variants expansion"},
        "issue": "Both mods distribute large armour levelled lists — a patch is recommended to prevent overwriting",
        "severity": "warning",
        "suggested_patch": "Immersive Armors + Armor Variants Patch",
    },
]

# Pairs confirmed compatible — raises confidence to medium when matched
_KNOWN_COMPATIBLE: list[frozenset] = [
    frozenset({"unofficial skyrim special edition patch", "skyui"}),
    frozenset({"ussep", "skyui"}),
    frozenset({"skse64", "skyui"}),
    frozenset({"skse", "skyui"}),
    frozenset({"ussep", "skse64"}),
    frozenset({"ussep", "skse"}),
    frozenset({"racemenu", "skse64"}),
    frozenset({"dyndolod", "ssedit"}),
    frozenset({"loot", "mod organizer 2"}),
]


def _load_knowledge(game_slug: str) -> str | None:
    """Load game-specific knowledge base text."""
    filename = _GAME_FILES.get(game_slug.lower())
    if not filename:
        return None
    filepath = _KNOWLEDGE_DIR / filename
    if filepath.exists():
        return filepath.read_text(encoding="utf-8")
    return None


@router.post("/check", response_model=CompatibilityCheckResponse)
async def check_compatibility(request: CompatibilityCheckRequest):
    """Check compatibility between two mods using knowledge base rules."""
    mod_a = request.mod_a_name.lower().strip()
    mod_b = request.mod_b_name.lower().strip()
    issues: list[CompatibilityIssue] = []
    patches: list[str] = []

    # Check known conflicts
    known_hit = False
    for conflict in _KNOWN_CONFLICTS:
        if conflict.get("aliases"):
            continue  # Same mod under different names — not a conflict
        names = frozenset(n.lower() for n in conflict["mods"])
        # Match if both input names appear in (or contain) conflict names
        if all(any(inp in cname or cname in inp for cname in names) for inp in (mod_a, mod_b)):
            known_hit = True
            issues.append(CompatibilityIssue(
                description=conflict["issue"],
                severity=conflict["severity"],
                source="knowledge_base",
            ))
            if conflict.get("suggested_patch"):
                patches.append(conflict["suggested_patch"])

    # Search game knowledge base for mentions of both mods
    knowledge = _load_knowledge(request.game_slug)
    kb_hit = False
    if knowledge:
        knowledge_lower = knowledge.lower()
        a_mentioned = mod_a in knowledge_lower
        b_mentioned = mod_b in knowledge_lower
        if a_mentioned and b_mentioned:
            kb_hit = True
            if not known_hit:
                # Only add a KB note if no structured conflict was found
                issues.append(CompatibilityIssue(
                    description=(
                        f"Both '{request.mod_a_name}' and '{request.mod_b_name}' "
                        f"are referenced in compatibility guidelines — "
                        f"review recommended"
                    ),
                    severity="warning",
                    source="knowledge_base",
                ))

    # Check known-compatible pairs for a confidence boost
    is_known_compatible = any(
        all(any(inp in cname or cname in inp for cname in cp) for inp in (mod_a, mod_b))
        for cp in _KNOWN_COMPATIBLE
    )

    # Determine overall compatibility and confidence
    has_critical = any(i.severity == "critical" for i in issues)
    compatible = not has_critical

    if known_hit or kb_hit:
        confidence = "high" if has_critical else "medium"
    elif is_known_compatible:
        confidence = "medium"
    else:
        confidence = "low"

    return CompatibilityCheckResponse(
        compatible=compatible,
        issues=issues,
        suggested_patches=patches,
        confidence=confidence,
    )
