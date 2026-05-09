"""Prompt builders for the generation pipeline.

Constructs system prompts and user messages for each build phase,
including hardware context, playstyle focus, and methodology injection.
"""

import logging

from app.knowledge import get_methodology_context
from app.llm.provider import LLMProvider
from app.models.game import Game
from app.models.mod_build_phase import ModBuildPhase
from app.models.playstyle import Playstyle
from app.schemas.modlist import ModlistGenerateRequest

from .session import GenerationSession

logger = logging.getLogger(__name__)


def _build_user_preferences_context(
    playstyle: Playstyle | None,
    custom_description: str | None,
    requested_mods: list[str],
    is_playstyle_driven: bool,
) -> str:
    """Build the user preferences context block for system prompts.

    Combines playstyle presets, custom descriptions, and specific mod requests
    into a single coherent context block.
    """
    parts: list[str] = []

    # Playstyle preset (if selected)
    if playstyle:
        if is_playstyle_driven:
            parts.append(
                f"PLAYSTYLE FOCUS: {playstyle.name}\n"
                f"The user wants a {playstyle.name} experience. Your mod choices in this phase should\n"
                f"directly support this playstyle. Prioritize mods that enhance the {playstyle.name} feel."
            )
        else:
            parts.append(
                f"PLAYSTYLE: {playstyle.name} (for context — this phase is not heavily playstyle-driven,\n"
                f"but keep the overall experience in mind)."
            )

    # Custom description (free-text from user)
    if custom_description:
        parts.append(
            f"USER'S VISION:\n"
            f'The user described their ideal experience: "{custom_description}"\n'
            f"Use this to guide your mod selections — prioritize mods that match this vision."
        )

    # Specific mod requests
    if requested_mods:
        mod_list = "\n".join(f"  - {mod}" for mod in requested_mods)
        parts.append(
            f"REQUESTED MODS (USER EXPLICITLY ASKED FOR THESE):\n"
            f"{mod_list}\n"
            f"If any of these fit this phase's theme, search for and add them NOW.\n"
            f"Do NOT defer them to a later phase — there is no guarantee a later phase\n"
            f"will come around to them. A dedicated sweep pass runs at the end to pick up\n"
            f"anything missed, but it costs an extra LLM turn, so prefer to add each\n"
            f"requested mod in the first phase where it fits."
        )

    if not parts:
        parts.append("No specific playstyle selected — build a well-rounded, balanced modlist.")

    return "\n\n".join(parts)


def _get_experience_label(
    playstyle: Playstyle | None,
    custom_description: str | None,
) -> str:
    """Get a short label describing the user's desired experience for user messages."""
    if playstyle and custom_description:
        return f"{playstyle.name} ({custom_description[:80]})"
    if playstyle:
        return playstyle.name
    if custom_description:
        return custom_description[:100]
    return "custom"


# Sub-pass hints for phases with high max_mods caps.
# Guides the LLM to search different subcategories systematically.
_SUB_PASS_HINTS: dict[str, str] = {
    "Foundation Textures & Meshes": (
        "SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n"
        "Work through these subcategories in order, searching 2-3 times per subcategory:\n"
        "  1. Base meshes & mesh fixes (SMIM, mesh improvements)\n"
        "  2. Architecture textures (cities, castles, forts, ruins)\n"
        "  3. Landscape textures (mountains, terrain, roads)\n"
        "  4. Dungeon textures (caves, mines, Nordic ruins, Dwemer)\n"
        "  5. Clutter & objects (furniture, food, books, candles)\n"
        "  6. Flora textures (trees, grass, plants, flowers)\n"
        "  7. Water textures (rivers, lakes, waterfalls)\n"
        "  8. Creature & animal retextures\n"
        "  9. Weapon & armor retextures\n"
        "  10. Effects & particles (fire, magic, smoke)\n"
        "Pick the BEST mod per subcategory — don't add two full replacers for the same surface.\n\n"
    ),
    "Foundation Textures": (
        "SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n"
        "Work through these subcategories in order:\n"
        "  1. Comprehensive landscape/architecture overhauls (Vivid Fallout, FlaconOil — pick ONE)\n"
        "  2. Per-material textures (concrete, metal, wood, asphalt)\n"
        "  3. Clutter & interior objects\n"
        "  4. Weapon retextures (per-weapon packs)\n"
        "  5. Armor & clothing retextures\n"
        "  6. Creature retextures\n"
        "  7. Effects & particles\n"
        "Pick ONE base pack, then layer specific replacers on top.\n\n"
    ),
    "Gameplay & Playstyle": (
        "SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n"
        "Work through these gameplay domains, picking mods that match the playstyle:\n"
        "  1. Primary overhaul (combat, perks, or magic — ONE per cluster)\n"
        "  2. Economy & loot distribution\n"
        "  3. Crafting & smithing\n"
        "  4. AI & NPC behavior\n"
        "  5. Immersion (needs, camping, religion, consequences)\n"
        "  6. Items & equipment (new weapons, armor with distribution)\n"
        "  7. Character appearance (body, NPC replacers)\n"
        "Remember: ONE primary overhaul per system. Small tweaks can stack.\n\n"
    ),
    "Gameplay": (
        "SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n"
        "Work through these gameplay domains, picking mods that match the playstyle:\n"
        "  1. Primary combat overhaul (ONE only — Arbitration, True Damage, etc.)\n"
        "  2. Survival/needs mods (ONE comprehensive — NICER, Horizon, etc.)\n"
        "  3. Loot & economy rebalance\n"
        "  4. Crafting improvements\n"
        "  5. Enemy/spawn modifications\n"
        "  6. Settlement improvements (if applicable)\n"
        "  7. Small targeted tweaks\n"
        "Remember: ONE primary overhaul per system. Small tweaks can stack.\n\n"
    ),
}


def _build_sub_pass_hint(phase: "ModBuildPhase") -> str:
    """Return a sub-pass strategy hint for phases with high mod budgets."""
    if phase.max_mods < 15:
        return ""
    return _SUB_PASS_HINTS.get(phase.name, "")


def build_phase_prompt(
    phase: ModBuildPhase,
    game: Game,
    playstyle: Playstyle | None,
    game_version: str | None,
    version_notes: str,
    hardware_context: str,
    session: GenerationSession,
    total_phases: int,
    custom_description: str | None = None,
    requested_mods: list[str] | None = None,
    cap: int | None = None,
    already_added: list[dict] | None = None,
    sub_pass_guidance: str | None = None,
    sub_pass_index: int = 0,
    sub_pass_total: int = 1,
) -> str:
    """Build a focused system prompt for a single build phase.

    ``cap`` defaults to ``phase.max_mods`` so legacy callers still work.
    When a phase splits into N sub-passes, callers pass the per-sub-pass
    cap and a compact ``already_added`` list of mods picked earlier in
    this same phase, letting each sub-pass start with fresh LLM context.
    """

    effective_cap = cap if cap is not None else phase.max_mods
    already_added = already_added or []
    # IDs added in this phase are surfaced in a dedicated "already added
    # this pass" section below; exclude them from the generic "earlier
    # phases" list to avoid duplicate framing.
    already_added_ids = {m.get("nexus_mod_id") for m in already_added}

    mods_so_far = ""
    prior_phase_mods = [
        m for m in session.modlist if m.get("nexus_mod_id") not in already_added_ids
    ]
    if prior_phase_mods:
        mods_so_far = "\n\nMODS ALREADY IN YOUR MODLIST (from earlier phases — do NOT re-add these):\n"
        mods_so_far += "\n".join(
            f"  {i+1}. {m['name']} (Nexus ID: {m['nexus_mod_id']})"
            for i, m in enumerate(prior_phase_mods)
        )

    already_this_phase = ""
    if already_added:
        already_this_phase = (
            "\n\nMODS ALREADY ADDED EARLIER IN THIS PHASE "
            "(do NOT re-add; pick different mods):\n"
        )
        already_this_phase += "\n".join(
            f"  - {m['name']} by {m.get('author') or 'Unknown'} "
            f"(Nexus ID: {m['nexus_mod_id']})"
            for m in already_added
        )

    sub_pass_header = ""
    if sub_pass_total > 1:
        sub_pass_header = (
            f"\n── SUB-PASS {sub_pass_index + 1}/{sub_pass_total} ──\n"
            "This phase is split into multiple sub-passes to keep context focused. "
            "Add DIFFERENT mods than previous sub-passes (see list below).\n"
        )

    guidance_line = ""
    if sub_pass_guidance:
        guidance_line = f"\nFOCUS FOR THIS BATCH: {sub_pass_guidance}\n"

    preferences_context = _build_user_preferences_context(
        playstyle, custom_description, requested_mods or [], phase.is_playstyle_driven,
    )

    methodology_context = get_methodology_context(game.slug, phase.phase_number, game_version)

    return f"""You are an expert {game.name} mod curator working on Phase {phase.phase_number}/{total_phases}: "{phase.name}".

GAME: {game.name} ({game_version or "Unknown"} edition)
{version_notes}

{hardware_context}

{preferences_context}
{methodology_context}

── PHASE {phase.phase_number}: {phase.name} ──
{phase.description}
{sub_pass_header}{guidance_line}
SEARCH GUIDANCE:
{phase.search_guidance}

RULES FOR THIS PHASE:
{phase.rules}

{f"EXAMPLE MODS (for reference — verify these exist and are current before adding):{chr(10)}{phase.example_mods}" if phase.example_mods else ""}
{mods_so_far}{already_this_phase}

{_build_sub_pass_hint(phase)}INSTRUCTIONS:
1. Search using SHORT, SPECIFIC mod names (1-4 words). The search API matches against mod
   TITLES only, not descriptions. Do NOT prefix searches with the game name.
   GOOD: "Buffout 4", "FallUI", "True Storms", "damage overhaul", "texture pack"
   BAD:  "Fallout 4 texture overhaul", "visual overhaul environment", "Fallout 4 NPC bug fix"
   If a search returns 0 results, try SHORTER or DIFFERENT keywords — do NOT repeat the same query.
2. Use get_mod_details to read about a mod BEFORE adding it. Check:
   - Compatibility with {game_version or "the user's"} game version
   - Performance impact relative to the user's hardware
   - Whether it actually fits this phase's purpose
3. BEFORE adding any mod, check if another mod already in the modlist covers the same system
   (e.g., two weather overhauls, two combat overhauls, two full texture packs). If a mod from
   the same mutually exclusive cluster is already present, do NOT add the new one — pick the
   better fit and skip the other.
4. Add up to {effective_cap} mods in this sub-pass (fewer is fine if quality is high).
5. Do NOT pass load_order — the system assigns it automatically based on add order.
6. Call finalize() when you are done with this sub-pass.
7. Keep your thinking concise. Do NOT write phase summaries listing every mod added —
   the system already tracks this. Focus reasoning on mod selection decisions only."""


def build_sweep_prompt(
    missing_mods: list[str],
    game: Game,
    game_version: str | None,
    session: GenerationSession,
) -> str:
    """System prompt for the post-phase sweep that adds any requested mods
    the per-phase loops didn't pick up.

    Deliberately narrow: one LLM turn, one job — find and add exactly these
    mods. No category exploration, no sub-categorization, no tangents.
    """
    missing_list = "\n".join(f"  - {m}" for m in missing_mods)
    modlist_summary = "\n".join(
        f"  - {m['name']}" for m in session.modlist
    ) or "  (modlist is empty)"
    return f"""You are running a SWEEP PASS for a {game.name} ({game_version or 'any'}) modlist.

The user explicitly requested these mods, and the per-phase build loop did NOT add them:
{missing_list}

Your ONLY job is to find and add these specific mods. Do not explore categories, do not
search for alternatives, do not add patches, and do not add anything the user didn't ask
for. If a requested mod simply doesn't exist on Nexus under any reasonable spelling, skip
it — the system will surface it to the user as "not found."

PROCESS FOR EACH MISSING MOD:
1. Call search_nexus with the exact user-provided name (no game prefix, no category tags).
2. If results look correct, call get_mod_details on the top hit to confirm it's the right mod
   (right author, right description — not a fan patch or sequel).
3. Call add_to_modlist with the mod's ID. The system assigns load_order automatically —
   do NOT pass load_order.
4. Move on to the next missing mod.
5. Call finalize() when you're done (all requested mods either added or skipped).

CURRENT MODLIST (do NOT re-add anything below):
{modlist_summary}
"""


def build_patch_phase_prompt(
    phase: ModBuildPhase,
    game: Game,
    game_version: str | None,
    session: GenerationSession,
    total_phases: int,
) -> str:
    """Build system prompt for the final compatibility patches phase."""
    modlist_summary = "\n".join(
        f"  {i+1}. {m['name']} (Nexus ID: {m['nexus_mod_id']}) — {m.get('reason', '')}"
        for i, m in enumerate(session.modlist)
    )

    methodology_context = get_methodology_context(game.slug, phase.phase_number, game_version)

    return f"""You are reviewing a {game.name} ({game_version or "Unknown"} edition) modlist for compatibility.

This is Phase {phase.phase_number}/{total_phases}: "{phase.name}".
{methodology_context}

THE MODLIST TO REVIEW:
{modlist_summary}

{phase.search_guidance}

RULES:
{phase.rules}

PROCESS:
1. For key mods that edit the same game systems, use get_mod_description to check if
   the mod page mentions patches, compatibility notes, or known conflicts.
2. Use get_reverse_deps on major mods (unofficial patches, weather overhauls, large
   content mods) — patches are often listed under "Mods requiring this file" on Nexus.
   Look for entries whose names contain "patch", "compatibility", or reference another
   mod in the list.
3. Only use search_patches as a last resort if a mod description explicitly mentions
   a patch by name that you need to find. Do NOT blindly search "mod A mod B patch" —
   the Nexus name search rarely matches patch naming conventions.
4. If you find a patch, use add_patch. The system assigns load_order automatically —
   because patches are added last in this final phase, they will naturally load after
   the mods they patch. Do NOT pass load_order.
5. If a patch is NEEDED but doesn't exist, use flag_user_knowledge to alert the user.

IMPORTANT:
- Not every mod pair needs a patch. Only flag genuine conflicts.
- Framework mods (SKSE, Address Library, etc.) don't need patches with each other.
- Focus on mods that edit the same game systems.
- Call finalize_review when done."""


def build_phase_user_msg(
    phase: ModBuildPhase,
    playstyle: Playstyle | None,
    game: Game,
    game_version: str | None,
    custom_description: str | None = None,
    requested_mods: list[str] | None = None,
) -> str:
    """Build the user message that kicks off a phase."""
    experience = _get_experience_label(playstyle, custom_description)

    if phase.is_playstyle_driven:
        msg = (
            f"Build the {phase.name} section of a {experience} modlist for "
            f"{game.name} ({game_version or 'any version'}). "
            f"Focus on mods that enhance the {experience} experience."
        )
    else:
        msg = (
            f"Build the {phase.name} section of a modlist for "
            f"{game.name} ({game_version or 'any version'})."
        )

    # Remind about requested mods relevant to this phase
    if requested_mods:
        msg += (
            f"\n\nReminder: the user specifically requested these mods: "
            f"{', '.join(requested_mods)}. "
            f"If any belong in this phase, search for and include them."
        )

    return msg


def build_hardware_context(
    request: ModlistGenerateRequest,
    tier_info: dict,
    vram_budget: int,
    storage_budget_gb: int,
) -> str:
    """Build the hardware context block for system prompts."""
    return f"""USER HARDWARE:
- GPU: {request.gpu or "Unknown"} ({request.vram_mb or 6144}MB VRAM)
- CPU: {request.cpu or "Unknown"}
- RAM: {request.ram_gb or "Unknown"}GB
- Available disk space: {request.available_storage_gb or 50}GB (budget: {storage_budget_gb}GB)
- VRAM budget: {vram_budget}MB
- Hardware tier: {tier_info["tier"]}"""


def classify_error(llm: LLMProvider, e: Exception) -> tuple[str, str]:
    """Classify an exception into (error_type, friendly_message).

    Returns:
        error_type: machine-readable error classification
        friendly: human-readable message for the frontend
    """
    error_msg = str(e)
    model_name = llm.get_model_name()

    if "rate" in error_msg.lower() or "429" in error_msg:
        return "rate_limit", f"{model_name}: Rate limited — too many requests"
    if "auth" in error_msg.lower() or "401" in error_msg or ("invalid" in error_msg.lower() and "key" in error_msg.lower()):
        return "auth_error", f"{model_name}: Invalid API key"
    if "quota" in error_msg.lower() or "insufficient" in error_msg.lower() or "billing" in error_msg.lower():
        return "token_limit", f"{model_name}: Quota exceeded or billing issue"
    if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
        return "timeout", f"{model_name}: Request timed out"
    if "connect" in error_msg.lower() or "network" in error_msg.lower():
        return "connection", f"{model_name}: Connection failed"
    if "token" in error_msg.lower() and ("limit" in error_msg.lower() or "max" in error_msg.lower()):
        return "token_limit", f"{model_name}: Token limit exceeded"

    error_type_name = type(e).__name__
    return "unknown", f"{model_name}: {error_type_name} — {error_msg[:120]}"


# ──────────────────────────────────────────────
# Legacy two-phase prompts (used when no DB phases exist)
# ──────────────────────────────────────────────

LEGACY_DISCOVERY_PROMPT = """You are an expert video game mod curator for {game_name} ({game_version} edition).

USER HARDWARE:
- GPU: {gpu} ({vram_mb}MB VRAM)
- CPU: {cpu}
- RAM: {ram_gb}GB
- Available disk space: {available_storage_gb}GB (budget: {storage_budget_gb}GB)
- VRAM budget: {vram_budget}MB

{experience_context}

{version_notes}

YOUR TASK: Build a high-quality modlist by searching Nexus Mods. Follow these rules:

1. Search for mods using varied, specific terms — don't use one generic search.
   Good: "texture overhaul", "combat mechanics", "weather effects", "UI improvements"
   Bad: "best mods", "popular mods"

2. DON'T just pick the most popular mods. Use both "endorsements" and "updated" sort orders.
   Newer mods with fewer endorsements can be excellent — evaluate them on merit.

3. Use get_mod_details to read about a mod BEFORE adding it. Check for:
   - Compatibility with the user's game version
   - Performance impact relative to the user's hardware
   - Whether it actually fits the requested playstyle

4. Stay within the storage budget ({storage_budget_gb}GB) and VRAM budget ({vram_budget}MB).
   Estimate sizes: texture packs 1-4GB, gameplay mods <100MB, overhauls 500MB-2GB.

5. Do NOT pass load_order — the system assigns it automatically based on add order.
   Add framework mods (SKSE, USSEP, etc.) first, then overhauls, then tweaks last, and
   the ordering falls out naturally.

6. Call finalize() when you're satisfied with the list. Aim for 15-30 mods depending on the playstyle."""

LEGACY_PATCH_REVIEW_PROMPT = """You are reviewing a modlist for {game_name} ({game_version} edition) for compatibility issues.

THE MODLIST:
{modlist_summary}

YOUR TASK: Check each mod for compatibility patches needed with other mods in this list.

PROCESS (follow this order for each potential conflict):
1. FIRST: Use get_mod_description to check if the mod page mentions patches or compatibility.
   Mod authors often list required patches or link to them directly.
2. SECOND: If the description doesn't mention a patch, use search_patches to search Nexus.
   Search with terms like "ModA ModB patch" or "ModA compatibility".
3. If you find a patch mod, use add_patch. The system assigns load_order automatically —
   because patches are added last in this review pass, they will naturally load after
   the mods they patch. Do NOT pass load_order.
4. If a patch is NEEDED but doesn't exist, use flag_user_knowledge to alert the user.
   This is important for future AI patch generation.

IMPORTANT:
- Not every mod pair needs a patch. Only flag genuine conflicts.
- Common framework mods (SKSE, Address Library, etc.) don't need patches with each other.
- Focus on mods that edit the same game systems (e.g., two combat mods, or a texture mod + ENB).
- Call finalize_review when done."""
