"""Per-phase quality review of mod selections.

After each phase completes, an independent reviewer instance reviews the
newly added mods for stability, compatibility, theme fit, and performance.
Rejected mods are removed from the modlist; flagged mods get review_flags
entries. If the reviewer is unavailable, generation continues without review.

Supports configurable reviewer provider: defaults to Gemini Pro, but can be
overridden to use a local model (e.g., Ollama with Gemma 4) via env config.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Callable

import httpx

from app.config import get_settings
from app.llm.provider import LLMProvider, LLMProviderFactory

from .session import GenerationSession

logger = logging.getLogger(__name__)


@dataclass
class ReviewResult:
    """Outcome of a per-phase quality review."""
    approved: list[int] = field(default_factory=list)
    flagged: list[dict] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)
    skipped: bool = False  # True if review was skipped (no key, error, etc.)


def _build_review_prompt(
    session: GenerationSession,
    phase_name: str,
    game_name: str,
    game_version: str | None,
    playstyle_name: str,
    hardware_context: str,
    new_mod_ids: set[int],
) -> str:
    """Build the reviewer system prompt with all context needed for evaluation."""

    # Existing mods from prior phases
    existing_mods = [
        m for m in session.modlist
        if m["nexus_mod_id"] not in new_mod_ids
    ]
    existing_summary = "\n".join(
        f"  {i+1}. {m['name']} (ID: {m['nexus_mod_id']})"
        for i, m in enumerate(existing_mods)
    ) if existing_mods else "  (none — this is the first phase)"

    # New mods with cached descriptions
    new_mods = [m for m in session.modlist if m["nexus_mod_id"] in new_mod_ids]
    new_mods_lines = []
    for m in new_mods:
        desc = session.description_cache.get(m["nexus_mod_id"], "")
        desc_preview = desc[:1500] + "..." if len(desc) > 1500 else desc
        new_mods_lines.append(
            f"- **{m['name']}** (ID: {m['nexus_mod_id']})\n"
            f"  Reason: {m.get('reason', 'N/A')}\n"
            f"  Description: {desc_preview}"
        )
    new_mods_text = "\n".join(new_mods_lines) if new_mods_lines else "  (no mods added)"

    return f"""You are a mod compatibility and stability expert for {game_name} ({game_version or "any version"}).

Your job: review the mods just added in the "{phase_name}" phase. Evaluate each for
stability, compatibility with the existing modlist, theme fit, and performance impact.

{hardware_context}

PLAYSTYLE: {playstyle_name}

EXISTING MODLIST (from prior phases — already approved):
{existing_summary}

NEW MODS ADDED IN THIS PHASE ("{phase_name}"):
{new_mods_text}

Return ONLY valid JSON (no markdown fences, no explanation):
{{
  "approved": [<list of nexus_mod_id integers that are safe>],
  "flagged": [
    {{"mod_id": <int>, "name": "<str>", "issue": "<str>", "severity": "warning"}}
  ],
  "rejected": [
    {{"mod_id": <int>, "name": "<str>", "reason": "<str>"}}
  ]
}}

Criteria:
- REJECT mods with known stability issues or crashes for {game_version or "this game version"}
- REJECT mods that directly conflict with existing modlist entries
- REJECT mods that are clearly redundant (another mod already does the same thing)
- FLAG mods with potential compatibility concerns (severity: "warning")
- FLAG mods that may push VRAM or storage over budget (severity: "warning")
- APPROVE mods that are safe, compatible, and fit the playstyle
- When in doubt, APPROVE — false rejections are worse than false approvals"""


_cached_reviewer: LLMProvider | None = None
_reviewer_resolved = False
_reviewer_lock = asyncio.Lock()


async def _create_reviewer_provider() -> LLMProvider | None:
    """Create the reviewer LLM provider, trying alternative config first.

    Caches the result within a process to avoid repeated health checks
    on every phase review call. Uses a lock to prevent duplicate work
    from concurrent generations.
    """
    global _cached_reviewer, _reviewer_resolved
    if _reviewer_resolved:
        return _cached_reviewer

    async with _reviewer_lock:
        # Double-check after acquiring lock
        if _reviewer_resolved:
            return _cached_reviewer

        settings = get_settings()
        provider = await _resolve_reviewer_provider(settings)
        _cached_reviewer = provider
        _reviewer_resolved = True
        return provider


async def _resolve_reviewer_provider(settings) -> LLMProvider | None:  # noqa: ANN001
    """Internal: resolve the reviewer provider (called under lock)."""

    # Option 1: Configured alternative reviewer (e.g., local Ollama with Gemma 4)
    if settings.reviewer_provider:
        try:
            api_key = (
                "ollama" if settings.reviewer_provider == "ollama"
                else settings.reviewer_api_key
            )
            provider = LLMProviderFactory.create_from_request(
                settings.reviewer_provider,
                api_key=api_key,
                base_url=settings.reviewer_base_url or None,
                model=settings.reviewer_model or None,
            )
            # Quick health check for local providers
            if settings.reviewer_provider == "ollama":
                base = (
                    settings.reviewer_base_url or "http://localhost:11434/v1"
                ).rstrip("/")
                if base.endswith("/v1"):
                    base = base[:-3]
                async with httpx.AsyncClient(timeout=3.0) as client:
                    await client.get(f"{base}/api/tags")
            return provider
        except Exception as e:
            logger.warning(
                "Alternative reviewer (%s) unavailable: %s, "
                "falling back to Gemini Pro",
                settings.reviewer_provider, e,
            )

    # Option 2: Gemini Pro (existing default behavior)
    pro_key = settings.gemini_pro_api_key or settings.gemini_api_key
    if not pro_key:
        return None
    return LLMProviderFactory.create_from_request("gemini_pro", pro_key)


async def review_phase(
    session: GenerationSession,
    phase_name: str,
    game_name: str,
    game_version: str | None,
    playstyle_name: str,
    hardware_context: str,
    pre_phase_mod_ids: set[int],
    event_callback: Callable[[dict], None] | None = None,
) -> ReviewResult:
    """Run Gemini Pro review on the mods added during the current phase.

    Args:
        session: Current generation session with modlist and caches
        phase_name: Name of the phase that just completed
        game_name: Game name for context
        game_version: Game version for context
        playstyle_name: Selected playstyle for theme evaluation
        hardware_context: Hardware specs string
        pre_phase_mod_ids: Set of nexus_mod_ids that existed BEFORE this phase
        event_callback: Optional SSE event emitter

    Returns:
        ReviewResult with approved/flagged/rejected mod lists
    """
    # Identify which mods are new in this phase
    current_mod_ids = {m["nexus_mod_id"] for m in session.modlist}
    new_mod_ids = current_mod_ids - pre_phase_mod_ids

    if not new_mod_ids:
        logger.debug("Skipping phase review: no new mods added")
        return ReviewResult(skipped=True)

    try:
        reviewer = await _create_reviewer_provider()
        if reviewer is None:
            logger.debug("Skipping phase review: no reviewer provider available")
            return ReviewResult(skipped=True)

        prompt = _build_review_prompt(
            session, phase_name, game_name, game_version,
            playstyle_name, hardware_context, new_mod_ids,
        )

        logger.info("Running Gemini Pro review for phase '%s' (%d new mods)",
                     phase_name, len(new_mod_ids))

        response = await reviewer.generate(
            system_prompt=prompt,
            user_prompt="Review the new mods listed above. Return JSON only.",
        )

        result = _parse_review_response(response, new_mod_ids)

        # Apply rejections — remove rejected mods from the session modlist
        if result.rejected:
            rejected_ids = {r["mod_id"] for r in result.rejected}
            before_count = len(session.modlist)
            session.modlist = [
                m for m in session.modlist
                if m["nexus_mod_id"] not in rejected_ids
            ]
            removed_count = before_count - len(session.modlist)
            logger.info("Review rejected %d mods: %s",
                        removed_count,
                        [r["name"] for r in result.rejected])

        # Store flagged items in session
        for flag in result.flagged:
            session.review_flags.append({
                "phase": phase_name,
                **flag,
            })

        # Emit review event for frontend
        if event_callback:
            from .handlers import emit
            emit(event_callback, "phase_reviewed", {
                "phase": phase_name,
                "approved_count": len(result.approved),
                "flagged": result.flagged,
                "rejected": result.rejected,
            })

        return result

    except Exception as e:
        # Never block generation on a review failure
        logger.warning("Phase review failed (non-fatal): %s", e)
        return ReviewResult(skipped=True)


def _parse_review_response(
    response: str,
    valid_mod_ids: set[int],
) -> ReviewResult:
    """Parse the JSON response from the reviewer, with defensive handling."""
    # Strip markdown code fences if present
    text = response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Review response was not valid JSON, skipping")
        return ReviewResult(skipped=True)

    result = ReviewResult()

    # Parse approved IDs (filter to only valid mod IDs from this phase)
    for mod_id in data.get("approved", []):
        if isinstance(mod_id, int) and mod_id in valid_mod_ids:
            result.approved.append(mod_id)

    # Parse flagged entries
    for entry in data.get("flagged", []):
        if isinstance(entry, dict) and entry.get("mod_id") in valid_mod_ids:
            result.flagged.append({
                "mod_id": entry["mod_id"],
                "name": entry.get("name", "Unknown"),
                "issue": entry.get("issue", ""),
                "severity": entry.get("severity", "warning"),
            })

    # Parse rejected entries
    for entry in data.get("rejected", []):
        if isinstance(entry, dict) and entry.get("mod_id") in valid_mod_ids:
            result.rejected.append({
                "mod_id": entry["mod_id"],
                "name": entry.get("name", "Unknown"),
                "reason": entry.get("reason", ""),
            })

    return result


# ── Final comprehensive review (Option B) ──────────────────────────────


def _build_comprehensive_review_prompt(
    session: GenerationSession,
    game_name: str,
    game_version: str | None,
    playstyle_name: str,
    hardware_context: str,
) -> str:
    """Build the final review prompt with the complete modlist + descriptions."""

    # Full modlist with descriptions
    mod_lines = []
    for i, m in enumerate(session.modlist):
        desc = session.description_cache.get(m["nexus_mod_id"], "")
        desc_preview = desc[:800] + "..." if len(desc) > 800 else desc
        mod_lines.append(
            f"{i+1}. **{m['name']}** (ID: {m['nexus_mod_id']}, "
            f"load_order: {m.get('load_order', '?')})\n"
            f"   Reason: {m.get('reason', 'N/A')}\n"
            f"   Description: {desc_preview}"
        )
    modlist_text = "\n".join(mod_lines) if mod_lines else "(empty modlist)"

    # Patches
    patch_lines = []
    for p in session.patches:
        patch_lines.append(
            f"- **{p['name']}** (ID: {p['nexus_mod_id']}) — "
            f"patches: {', '.join(p.get('patches_mods', []))}"
        )
    patches_text = "\n".join(patch_lines) if patch_lines else "(no patches)"

    # Existing knowledge flags from the generation
    kf_lines = []
    for kf in session.knowledge_flags:
        kf_lines.append(
            f"- {kf.get('mod_a', '?')} ↔ {kf.get('mod_b', '?')}: "
            f"{kf.get('issue', '')} (severity: {kf.get('severity', '?')})"
        )
    kf_text = "\n".join(kf_lines) if kf_lines else "(none flagged during generation)"

    return f"""You are a senior mod compatibility expert performing a FINAL REVIEW of a complete {game_name} ({game_version or "any version"}) modlist.

The modlist was generated by multiple AI models working phase-by-phase. Your job is to review
the COMPLETE list holistically — catching cross-phase issues that per-phase reviews would miss.

{hardware_context}

PLAYSTYLE: {playstyle_name}

=== COMPLETE MODLIST ({len(session.modlist)} mods) ===
{modlist_text}

=== COMPATIBILITY PATCHES ({len(session.patches)}) ===
{patches_text}

=== KNOWN ISSUES (flagged during generation) ===
{kf_text}

Perform the following analysis and return ONLY valid JSON (no markdown fences):
{{
  "cross_phase_conflicts": [
    {{"mod_a": "<name>", "mod_b": "<name>", "issue": "<description>", "severity": "warning|critical"}}
  ],
  "vram_assessment": {{
    "estimated_total_mb": <int>,
    "within_budget": <bool>,
    "heavy_mods": ["<mod names consuming most VRAM>"]
  }},
  "load_order_issues": [
    {{"mod": "<name>", "issue": "<what should load before/after what>"}}
  ],
  "theme_coherence": {{
    "score": <1-10>,
    "notes": "<brief assessment of how well the list fits the {playstyle_name} playstyle>"
  }},
  "missing_essentials": ["<mod names that are commonly needed but absent>"],
  "rejected": [
    {{"mod_id": <int>, "name": "<str>", "reason": "<str>"}}
  ]
}}

Guidelines:
- Only REJECT mods with CRITICAL issues (crashes, hard conflicts). Do NOT reject for minor concerns.
- Cross-phase conflicts are the main value here — the per-phase reviewer already caught single-phase issues.
- VRAM assessment should be a rough estimate, not precise. Flag if clearly over budget.
- For load_order_issues, focus on hard requirements (e.g., "SKSE must load before SkyUI").
- For missing_essentials, only flag truly critical omissions for this playstyle.
- theme_coherence score: 8+ means good fit, 5-7 means acceptable, <5 means poor fit."""


@dataclass
class ComprehensiveReviewResult:
    """Outcome of the final comprehensive review."""
    cross_phase_conflicts: list[dict] = field(default_factory=list)
    vram_assessment: dict = field(default_factory=dict)
    load_order_issues: list[dict] = field(default_factory=list)
    theme_coherence: dict = field(default_factory=dict)
    missing_essentials: list[str] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)
    skipped: bool = False


async def review_comprehensive(
    session: GenerationSession,
    game_name: str,
    game_version: str | None,
    playstyle_name: str,
    hardware_context: str,
    event_callback: Callable[[dict], None] | None = None,
) -> ComprehensiveReviewResult:
    """Run a final comprehensive review of the entire modlist after all phases.

    Uses Gemini Pro's 1M context to analyze the full modlist + all descriptions
    for cross-phase compatibility, VRAM budget, load order, and theme coherence.
    """
    if not session.modlist:
        logger.debug("Skipping comprehensive review: empty modlist")
        return ComprehensiveReviewResult(skipped=True)

    try:
        reviewer = await _create_reviewer_provider()
        if reviewer is None:
            logger.debug(
                "Skipping comprehensive review: no reviewer provider available",
            )
            return ComprehensiveReviewResult(skipped=True)

        prompt = _build_comprehensive_review_prompt(
            session, game_name, game_version, playstyle_name, hardware_context,
        )

        logger.info(
            "Running comprehensive review (%d mods, %d patches)",
            len(session.modlist), len(session.patches),
        )

        response = await reviewer.generate(
            system_prompt=prompt,
            user_prompt="Perform the final comprehensive review. Return JSON only.",
        )

        result = _parse_comprehensive_response(response, session)

        # Apply critical rejections
        if result.rejected:
            rejected_ids = {r["mod_id"] for r in result.rejected}
            before_count = len(session.modlist)
            session.modlist = [
                m for m in session.modlist
                if m["nexus_mod_id"] not in rejected_ids
            ]
            removed_count = before_count - len(session.modlist)
            logger.info("Comprehensive review rejected %d mods: %s",
                        removed_count,
                        [r["name"] for r in result.rejected])

        # Store cross-phase conflicts as review flags
        for conflict in result.cross_phase_conflicts:
            session.review_flags.append({
                "phase": "comprehensive_review",
                "mod_id": 0,
                "name": f"{conflict.get('mod_a', '?')} <> {conflict.get('mod_b', '?')}",
                "issue": conflict.get("issue", ""),
                "severity": conflict.get("severity", "warning"),
            })

        # Emit comprehensive review event for frontend
        if event_callback:
            from .handlers import emit
            emit(event_callback, "generation_reviewed", {
                "cross_phase_conflicts": result.cross_phase_conflicts,
                "vram_assessment": result.vram_assessment,
                "load_order_issues": result.load_order_issues,
                "theme_coherence": result.theme_coherence,
                "missing_essentials": result.missing_essentials,
                "rejected": result.rejected,
            })

        return result

    except Exception as e:
        logger.warning("Comprehensive review failed (non-fatal): %s", e)
        return ComprehensiveReviewResult(skipped=True)


def _parse_comprehensive_response(
    response: str,
    session: GenerationSession,
) -> ComprehensiveReviewResult:
    """Parse the comprehensive review JSON response."""
    text = response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Comprehensive review response was not valid JSON, skipping")
        return ComprehensiveReviewResult(skipped=True)

    # Validate rejected mod IDs against actual modlist
    all_mod_ids = {m["nexus_mod_id"] for m in session.modlist}
    validated_rejected = []
    for entry in data.get("rejected", []):
        if isinstance(entry, dict) and entry.get("mod_id") in all_mod_ids:
            validated_rejected.append({
                "mod_id": entry["mod_id"],
                "name": entry.get("name", "Unknown"),
                "reason": entry.get("reason", ""),
            })

    return ComprehensiveReviewResult(
        cross_phase_conflicts=data.get("cross_phase_conflicts", []),
        vram_assessment=data.get("vram_assessment", {}),
        load_order_issues=data.get("load_order_issues", []),
        theme_coherence=data.get("theme_coherence", {}),
        missing_essentials=data.get("missing_essentials", []),
        rejected=validated_rejected,
    )
