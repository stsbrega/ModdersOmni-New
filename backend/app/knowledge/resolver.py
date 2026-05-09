"""Resolves methodology knowledge relevant to a specific generation phase.

Parses structured markdown files (skyrim.md, fallout4.md) at import time
and provides phase-targeted methodology context for LLM prompts.

Also loads universal compatibility guidelines (compatibility_guidelines.md)
that apply across all games and phases.
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

_KNOWLEDGE_DIR = Path(__file__).parent

# Game slug → markdown filename
_GAME_FILES: dict[str, str] = {
    "skyrimse": "skyrim.md",
    "fallout4": "fallout4.md",
}

# Universal files loaded for all games (order matters — first = highest priority)
_UNIVERSAL_FILES: list[str] = [
    "compatibility_guidelines.md",
]


@dataclass(frozen=True)
class MethodologySection:
    """A parsed section from a game methodology file."""
    id: str
    title: str
    content: str
    phases: frozenset[int]
    is_universal: bool = False


@dataclass
class GameMethodology:
    """All parsed methodology content for a single game."""
    universal_principles: str
    sections: list[MethodologySection] = field(default_factory=list)


# Module-level cache: parsed once per process
_cache: dict[str, GameMethodology] = {}


def _parse_phases(phases_str: str) -> frozenset[int]:
    """Parse '1, 3, 10' into frozenset({1, 3, 10})."""
    return frozenset(
        int(p.strip()) for p in phases_str.split(",") if p.strip().isdigit()
    )


def _parse_methodology_file(filepath: Path) -> GameMethodology:
    """Parse a methodology markdown file into structured sections."""
    text = filepath.read_text(encoding="utf-8")

    # Split on section markers: <!-- section: id -->
    section_pattern = re.compile(r"<!--\s*section:\s*(\w+)\s*-->")
    parts = section_pattern.split(text)

    # parts[0] = content before first section marker (universal principles)
    # parts[1] = first section id, parts[2] = first section content, etc.
    universal_principles = parts[0].strip()

    # Strip markdown metadata comments from universal principles.
    # Negative lookahead preserves <!-- version_scope: ... --> / <!-- /version_scope -->
    # so get_methodology_context can filter them per user's game_version later.
    universal_principles = re.sub(
        r"<!--(?!\s*/?\s*version_scope).*?-->",
        "", universal_principles, flags=re.DOTALL,
    ).strip()
    # Remove the top-level heading (e.g., "# Skyrim SE/AE Modding Methodology")
    lines = universal_principles.split("\n")
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    universal_principles = "\n".join(lines).strip()

    sections: list[MethodologySection] = []
    for i in range(1, len(parts), 2):
        section_id = parts[i]
        if i + 1 >= len(parts):
            break
        section_content = parts[i + 1]

        # Extract metadata comments from section content
        phases_match = re.search(
            r"<!--\s*phases:\s*([\d\s,]+)\s*-->", section_content
        )
        universal_match = re.search(
            r"<!--\s*universal:\s*(true|false)\s*-->", section_content, re.IGNORECASE
        )

        phases = _parse_phases(phases_match.group(1)) if phases_match else frozenset()
        is_universal = (
            universal_match.group(1).lower() == "true" if universal_match else False
        )

        # Clean content: remove metadata comments, preserving version_scope markers
        clean_content = re.sub(
            r"<!--(?!\s*/?\s*version_scope).*?-->",
            "", section_content, flags=re.DOTALL,
        ).strip()

        # Extract title from first heading
        title = section_id
        title_match = re.match(r"#\s+(.+)", clean_content)
        if title_match:
            title = title_match.group(1).strip()

        sections.append(
            MethodologySection(
                id=section_id,
                title=title,
                content=clean_content,
                phases=phases,
                is_universal=is_universal,
            )
        )

    return GameMethodology(
        universal_principles=universal_principles,
        sections=sections,
    )


def _get_game_methodology(game_slug: str) -> GameMethodology | None:
    """Get parsed methodology for a game, using cache."""
    if game_slug in _cache:
        return _cache[game_slug]

    filename = _GAME_FILES.get(game_slug)
    if not filename:
        return None

    filepath = _KNOWLEDGE_DIR / filename
    if not filepath.exists():
        logger.warning("Methodology file not found: %s", filepath)
        return None

    try:
        methodology = _parse_methodology_file(filepath)
        _cache[game_slug] = methodology
        logger.info(
            "Loaded %s methodology: %d sections",
            game_slug,
            len(methodology.sections),
        )
        return methodology
    except Exception:
        logger.exception("Failed to parse methodology file: %s", filepath)
        return None


@dataclass(frozen=True)
class _UniversalSection:
    """A parsed section from a universal knowledge file."""
    tag: str
    content: str
    phases: frozenset[int]  # empty = all phases


# Phase ranges for each XML-tagged section in compatibility_guidelines.md
_SECTION_PHASE_MAP: dict[str, frozenset[int]] = {
    "mod_type_compatibility_matrix": frozenset(range(5, 14)),  # content + patches
    "pre_selection_conflict_check": frozenset(range(4, 14)),  # all content + patches
    "dependency_chain_rules": frozenset(),  # all phases (empty = universal)
    "conflict_detection_heuristics": frozenset(range(5, 14)),
    "patch_discovery_patterns": frozenset({11, 12, 13}),  # patch/late phases only
    "quality_signals": frozenset(range(4, 11)),  # content phases
    "cross_game_differences": frozenset({1, 2, 3, 11}),  # engine phases + patches
    "generation_quality_rules": frozenset(),  # all phases
    # These are system-config guidance, not LLM selection guidance — never inject
    "scale_strategies": frozenset({-1}),  # sentinel: never matches a real phase
    "phase_cap_guidelines": frozenset({-1}),
}

_universal_sections_cache: list[_UniversalSection] | None = None


def _parse_universal_files() -> list[_UniversalSection]:
    """Parse universal knowledge files into tagged sections."""
    global _universal_sections_cache
    if _universal_sections_cache is not None:
        return _universal_sections_cache

    sections: list[_UniversalSection] = []
    tag_pattern = re.compile(r"<(\w+)>(.*?)</\1>", re.DOTALL)

    for filename in _UNIVERSAL_FILES:
        filepath = _KNOWLEDGE_DIR / filename
        if not filepath.exists():
            logger.warning("Universal knowledge file not found: %s", filepath)
            continue
        try:
            text = filepath.read_text(encoding="utf-8")
            # Strip system_context metadata
            text = re.sub(
                r"<system_context>.*?</system_context>",
                "", text, flags=re.DOTALL,
            )
            for match in tag_pattern.finditer(text):
                tag = match.group(1)
                content = match.group(2).strip()
                phases = _SECTION_PHASE_MAP.get(tag, frozenset())
                sections.append(_UniversalSection(
                    tag=tag, content=content, phases=phases,
                ))
            logger.info(
                "Loaded universal knowledge: %s (%d sections)",
                filename, len(sections),
            )
        except Exception:
            logger.exception("Failed to load universal knowledge: %s", filepath)

    _universal_sections_cache = sections
    return sections


def _get_universal_guidelines(phase_number: int) -> str:
    """Return universal guidelines relevant to a specific phase."""
    sections = _parse_universal_files()
    relevant = [
        s.content for s in sections
        if not s.phases or phase_number in s.phases  # empty = all phases
    ]
    return "\n\n".join(relevant)


# Matches a block scoped to one or more user_game_version values.
# Example in a methodology markdown file:
#   <!-- version_scope: AE -->
#   ...rule body that only applies when user is on AE...
#   <!-- /version_scope -->
# Multiple versions may be comma-separated: version_scope: AE,Next-Gen
_VERSION_SCOPE_PATTERN = re.compile(
    r"<!--\s*version_scope:\s*([\w\-,\s]+)\s*-->(.*?)<!--\s*/version_scope\s*-->",
    re.DOTALL,
)


def _apply_version_scope(text: str, game_version: str | None) -> str:
    """Strip version_scope blocks whose version does not match the user's version.

    If game_version is None (legacy modlists without a stored version), keep ALL
    blocks but drop the marker comments so they don't leak into the prompt.
    """
    if game_version is None:
        return re.sub(
            r"<!--\s*/?version_scope(?::[^>]*)?\s*-->",
            "", text,
        )

    def _replace(match: re.Match) -> str:
        scopes = {s.strip() for s in match.group(1).split(",") if s.strip()}
        if game_version in scopes:
            return match.group(2)
        return ""

    return _VERSION_SCOPE_PATTERN.sub(_replace, text)


def get_methodology_context(
    game_slug: str,
    phase_number: int,
    game_version: str | None = None,
) -> str:
    """Return methodology text relevant to a specific game, phase, and version.

    Args:
        game_slug: "skyrimse" or "fallout4"
        phase_number: The current phase number (1-based)
        game_version: One of "SE", "AE", "Standard", "Next-Gen", or None.
            When provided, version_scope-tagged blocks that don't match are
            dropped — shaves ~100-200 tokens off each phase prompt.

    Returns:
        A formatted string block to inject into the system prompt,
        or empty string if no methodology exists for this game.
    """
    methodology = _get_game_methodology(game_slug)
    if not methodology:
        return ""

    # Collect relevant sections for this phase
    relevant = [
        s
        for s in methodology.sections
        if s.is_universal or phase_number in s.phases
    ]

    parts = [methodology.universal_principles]

    for section in relevant:
        parts.append(section.content)

    # Append universal compatibility guidelines (phase-filtered)
    universal = _get_universal_guidelines(phase_number)
    if universal:
        parts.append(universal)

    methodology_block = "\n\n".join(parts)

    # Strip blocks not matching the user's game version (or just strip markers
    # if version is unknown).
    methodology_block = _apply_version_scope(methodology_block, game_version)

    return (
        "\nREFERENCE METHODOLOGY (community best practices — "
        "use this knowledge when selecting and evaluating mods):\n"
        f"{methodology_block}"
    )
