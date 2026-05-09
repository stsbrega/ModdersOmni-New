"""Session state and result types for the generation pipeline."""

import logging
import re
from dataclasses import dataclass, field

from html_to_markdown import convert as html_to_md

from app.services.generation.preset import SizePreset
from app.services.nexus_client import NexusModsClient

logger = logging.getLogger(__name__)


@dataclass
class GenerationSession:
    """Mutable state shared across tool handler calls within one generation."""
    game_domain: str
    nexus: NexusModsClient
    modlist: list[dict] = field(default_factory=list)
    patches: list[dict] = field(default_factory=list)
    knowledge_flags: list[dict] = field(default_factory=list)
    review_flags: list[dict] = field(default_factory=list)
    description_cache: dict[int, str] = field(default_factory=dict)
    author_cache: dict[int, str] = field(default_factory=dict)
    reverse_deps_cache: dict[int, list[dict]] = field(default_factory=dict)
    searched_queries: set[str] = field(default_factory=set)
    fetched_mod_ids: set[int] = field(default_factory=set)
    finalized: bool = False
    completed_phases: list[int] = field(default_factory=list)
    # Size preset drives effective_cap & sub-pass splitting per phase.
    preset: SizePreset = SizePreset.MEDIUM
    # Current phase id while a phase is running. The add_to_modlist handler
    # reads this to stamp `phase_id` on each mod dict, which lets subsequent
    # sub-passes in the same phase surface an "already added this phase" list.
    current_phase_id: int | None = None
    # Monotonic load-order counter. Each successful add_to_modlist / add_patch
    # consumes the current value and increments. The LLM no longer chooses
    # load_order — leaving that to the model produced frequent collisions.
    next_load_order: int = 1
    # Mod names the user explicitly asked for (from request.requested_mods).
    # Carried on the session so the post-phase sweep can check what's missing
    # and pause/resume restores the user's intent across resume boundaries.
    requested_mods: list[str] = field(default_factory=list)

    def entries_for_phase(self, phase_id: int) -> list[dict]:
        """Return mod entries added to the modlist during the given phase.

        Used by the sub-pass loop to inject a compact "already added in this
        phase" summary into the next sub-pass's system prompt, since each
        sub-pass starts with fresh LLM context.
        """
        return [e for e in self.modlist if e.get("phase_id") == phase_id]

    def to_snapshot(self) -> dict:
        """Serialize session state for pause/resume."""
        return {
            "game_domain": self.game_domain,
            "modlist": list(self.modlist),
            "patches": list(self.patches),
            "knowledge_flags": list(self.knowledge_flags),
            "review_flags": list(self.review_flags),
            "description_cache": {str(k): v for k, v in self.description_cache.items()},
            "author_cache": {str(k): v for k, v in self.author_cache.items()},
            "reverse_deps_cache": {str(k): v for k, v in self.reverse_deps_cache.items()},
            "searched_queries": list(self.searched_queries),
            "fetched_mod_ids": list(self.fetched_mod_ids),
            "completed_phases": list(self.completed_phases),
            "preset": self.preset.value,
            "next_load_order": self.next_load_order,
            "requested_mods": list(self.requested_mods),
        }

    @classmethod
    def from_snapshot(cls, snapshot: dict, nexus: NexusModsClient) -> "GenerationSession":
        """Reconstruct a session from a saved snapshot."""
        preset_value = snapshot.get("preset", SizePreset.MEDIUM.value)
        try:
            preset = SizePreset(preset_value)
        except ValueError:
            preset = SizePreset.MEDIUM
        return cls(
            game_domain=snapshot["game_domain"],
            nexus=nexus,
            modlist=snapshot.get("modlist", []),
            patches=snapshot.get("patches", []),
            knowledge_flags=snapshot.get("knowledge_flags", []),
            review_flags=snapshot.get("review_flags", []),
            description_cache={int(k): v for k, v in snapshot.get("description_cache", {}).items()},
            author_cache={int(k): v for k, v in snapshot.get("author_cache", {}).items()},
            reverse_deps_cache={int(k): v for k, v in snapshot.get("reverse_deps_cache", {}).items()},
            searched_queries=set(snapshot.get("searched_queries", [])),
            fetched_mod_ids=set(snapshot.get("fetched_mod_ids", [])),
            completed_phases=snapshot.get("completed_phases", []),
            preset=preset,
            next_load_order=snapshot.get("next_load_order", 1),
            requested_mods=list(snapshot.get("requested_mods", [])),
        )


@dataclass
class GenerationResult:
    """Complete output of the agentic modlist generation."""
    entries: list[dict]
    knowledge_flags: list[dict]
    review_flags: list[dict] = field(default_factory=list)
    llm_provider: str = ""


def strip_html(html: str, max_length: int = 5000) -> str:
    """Convert HTML to LLM-friendly markdown, preserving structure.

    Uses html-to-markdown for semantic conversion (links, lists, tables,
    headings) then falls back to naive regex if the library fails.
    """
    if not html or not html.strip():
        return ""
    try:
        text = html_to_md(html)["content"]
    except Exception:
        logger.debug("html-to-markdown failed, falling back to regex strip")
        text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)

    # Collapse excessive blank lines (3+ → 2)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if len(text) > max_length:
        text = text[:max_length] + "\n\n... [truncated]"
    return text
