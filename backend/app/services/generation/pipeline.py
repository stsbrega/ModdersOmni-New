"""Main generation pipeline orchestrator.

Contains the phased agentic generation loop and the legacy two-phase fallback.
"""

import logging
from typing import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm.dispatcher import SmartDispatcher
from app.llm.provider import LLMProvider, LLMProviderFactory
from app.llm.registry import get_provider, validate_key_provider
from app.models.compatibility import CompatibilityRule
from app.models.game import Game
from app.models.mod import Mod
from app.models.mod_build_phase import ModBuildPhase
from app.models.playstyle import Playstyle
from app.models.playstyle_mod import PlaystyleMod
from app.schemas.modlist import ModlistGenerateRequest
from app.services.nexus_client import NexusModsClient
from app.services.tier_classifier import classify_hardware_tier

from .exceptions import PauseGeneration
from .handlers import build_phase1_handlers, build_phase2_handlers, emit
from .preset import preset_multiplier
from .reviewer import review_comprehensive, review_phase
from .prompts import (
    LEGACY_DISCOVERY_PROMPT,
    LEGACY_PATCH_REVIEW_PROMPT,
    _build_user_preferences_context,
    _get_experience_label,
    build_hardware_context,
    build_patch_phase_prompt,
    build_phase_prompt,
    build_phase_user_msg,
    build_sweep_prompt,
    classify_error,
)
from .session import GenerationResult, GenerationSession
from .sub_pass import plan_sub_passes
from .tools import PHASE1_TOOLS, PHASE2_TOOLS
from .version import TIER_MIN_VRAM, VERSION_NOTES, is_version_compatible

logger = logging.getLogger(__name__)

# VRAM budget percentages by hardware tier
_TIER_VRAM_PCT = {"low": 0.60, "mid": 0.70, "high": 0.80, "ultra": 0.85}


def _build_provider_list(request: ModlistGenerateRequest) -> list[LLMProvider]:
    """Build ordered list of LLM providers to try from request credentials.

    Validates each key against its claimed provider. If a mismatch is detected
    (e.g., a Groq key assigned to OpenAI), the key is auto-corrected to the
    detected provider so it actually works.
    """
    providers: list[LLMProvider] = []
    for cred in request.llm_credentials:
        provider_id = cred.provider
        api_key = cred.api_key

        # Guardrail: detect key/provider mismatch and auto-correct
        check = validate_key_provider(api_key, provider_id)
        if not check["match"] and check["detected_provider"]:
            logger.warning(
                "Key mismatch: user selected '%s' but key matches '%s' — auto-correcting",
                provider_id, check["detected_provider"],
            )
            provider_id = check["detected_provider"]

        try:
            providers.append(
                LLMProviderFactory.create_from_request(
                    provider_id, api_key,
                    base_url=cred.base_url, model=cred.model,
                )
            )
        except ValueError:
            logger.warning("Skipping unknown provider: %s", provider_id)

    return providers


def _build_free_tier_providers(phase_name: str) -> list[LLMProvider]:
    """Build ordered list of free-tier LLM providers for a specific phase.

    Uses the SmartDispatcher to pick models by phase complexity, then creates
    provider instances using server-side API keys from config. Providers whose
    keys are not configured are silently skipped.
    """
    settings = get_settings()
    dispatcher = SmartDispatcher()
    candidates = dispatcher.get_free_candidates(phase_name)

    # gemini and gemini_pro share the same Google API key.
    # ollama_cloud is the fallback if Gemini fails or hits a context limit.
    key_map: dict[str, str] = {
        "gemini": settings.gemini_api_key,
        "gemini_pro": settings.gemini_api_key,
        "ollama_cloud": settings.ollama_api_key,
    }

    providers: list[LLMProvider] = []
    for provider_id, _model, _tier in candidates:
        api_key = key_map.get(provider_id, "")
        if not api_key:
            continue
        try:
            providers.append(
                LLMProviderFactory.create_from_request(provider_id, api_key)
            )
        except ValueError:
            logger.warning("Skipping free-tier provider: %s", provider_id)

    return providers


def _compute_budgets(
    request: ModlistGenerateRequest,
) -> tuple[dict, int, int]:
    """Compute hardware tier, VRAM budget, and storage budget from request."""
    user_vram = request.vram_mb or 6144
    tier_info = classify_hardware_tier(
        gpu=request.gpu, vram_mb=request.vram_mb,
        cpu=request.cpu, ram_gb=request.ram_gb,
        cpu_cores=request.cpu_cores, cpu_speed_ghz=request.cpu_speed_ghz,
    )
    vram_budget = int(user_vram * _TIER_VRAM_PCT.get(tier_info["tier"], 0.75))
    available_storage = request.available_storage_gb or 50
    storage_budget_gb = max(10, int(available_storage * 0.80))
    return tier_info, vram_budget, storage_budget_gb


async def _run_single_sub_pass(
    *,
    llm: LLMProvider,
    phase: ModBuildPhase,
    game: Game,
    playstyle: Playstyle | None,
    game_version: str | None,
    version_notes: str,
    hardware_context: str,
    session: GenerationSession,
    total_phases: int,
    request: ModlistGenerateRequest,
    event_callback: Callable[[dict], None] | None,
    is_patch_phase: bool,
    cap: int,
    already_added: list[dict],
    sub_pass_guidance: str | None,
    sub_pass_index: int,
    sub_pass_total: int,
) -> None:
    """Run a single LLM tool-calling pass for one sub-pass of a phase.

    Raises on provider failure so the caller's provider-fallback loop can
    try the next provider. Uses `cap * 3 + 10` iterations so the per-pass
    budget scales with the per-sub-pass cap rather than the whole phase.
    """
    session.finalized = False

    if is_patch_phase:
        system_prompt = build_patch_phase_prompt(
            phase, game, game_version, session, total_phases,
        )
        user_msg = "Review the modlist above for compatibility patches."
        tools = PHASE2_TOOLS
        handlers = build_phase2_handlers(session, event_callback)
    else:
        system_prompt = build_phase_prompt(
            phase, game, playstyle, game_version, version_notes,
            hardware_context, session, total_phases,
            custom_description=request.custom_description,
            requested_mods=request.requested_mods,
            cap=cap,
            already_added=already_added,
            sub_pass_guidance=sub_pass_guidance,
            sub_pass_index=sub_pass_index,
            sub_pass_total=sub_pass_total,
        )
        user_msg = build_phase_user_msg(
            phase, playstyle, game, game_version,
            custom_description=request.custom_description,
            requested_mods=request.requested_mods,
        )
        tools = PHASE1_TOOLS
        handlers = build_phase1_handlers(session, event_callback)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg},
    ]

    logger.info(
        f"Phase {phase.phase_number}/{total_phases}: {phase.name} "
        f"sub-pass {sub_pass_index + 1}/{sub_pass_total} "
        f"(provider: {llm.get_model_name()}, cap: {cap})"
    )

    def _on_text(text: str) -> None:
        logger.debug("LLM reasoning: %s", text)
        emit(event_callback, "thinking", {"text": text[:200]}, debug_data={"full_text": text})

    await llm.generate_with_tools(
        messages=messages,
        tools=tools,
        tool_handlers=handlers,
        max_iterations=cap * 3 + 10,
        on_text=_on_text,
        is_finalized=lambda: session.finalized,
    )

    if not session.finalized:
        logger.warning(
            f"Phase {phase.phase_number} ({phase.name}) sub-pass "
            f"{sub_pass_index + 1}/{sub_pass_total} ended without finalize()"
            " — LLM may have hit max iterations or stopped early"
        )


def _normalize_mod_name(name: str) -> str:
    """Normalize a mod name for fuzzy comparison.

    Lowercases, strips punctuation, collapses whitespace. Used to compare a
    user-requested name against the names of mods actually added to the
    modlist, so we don't re-sweep for a mod that was added under a slightly
    different capitalization / punctuation.
    """
    import re
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return " ".join(cleaned.split())


def _missing_requested_mods(session: GenerationSession) -> list[str]:
    """Return requested mod names that are not yet in session.modlist.

    Uses a two-sided substring check on normalized names so that e.g.
    "Sim Settlements 2" matches an added "Sim Settlements 2 - Official"
    without also matching "Wasteland Venturers Sim Settlements 2 Addon Pack"
    (the requested name must be a full normalized token-prefix of the
    added name).
    """
    added_norms = [_normalize_mod_name(e["name"]) for e in session.modlist]
    missing: list[str] = []
    for requested in session.requested_mods:
        req_norm = _normalize_mod_name(requested)
        if not req_norm:
            continue
        # Match if the requested name appears as a prefix in any added mod's
        # normalized name (token-boundary), catching "X" ≈ "X - Official" but
        # not "X" ≈ "Some Addon for X".
        found = any(
            added == req_norm or added.startswith(req_norm + " ")
            for added in added_norms
        )
        if not found:
            missing.append(requested)
    return missing


async def _run_requested_mods_sweep(
    *,
    session: GenerationSession,
    game: Game,
    game_version: str | None,
    request: ModlistGenerateRequest,
    providers: list[LLMProvider],
    exhausted_providers: set[str],
    event_callback: Callable[[dict], None] | None,
) -> None:
    """Post-phase sweep: try once more to add any requested_mods still missing.

    This closes the gap where the per-phase LLM deferred an explicit user
    request to a phase that never came. The sweep is a narrow single-pass
    prompt restricted to the missing names. Anything still absent after the
    sweep is emitted as ``missing_requested_mod`` so the frontend can tell
    the user the mod couldn't be located.
    """
    if not session.requested_mods:
        return

    missing = _missing_requested_mods(session)
    if not missing:
        return

    emit(event_callback, "sweep_start", {
        "missing_count": len(missing),
        "missing_mods": missing,
    })

    # The main tool-loop's search_nexus dedupes queries across the whole
    # session and returns empty results for repeats. If an earlier phase
    # searched for a requested mod name and didn't add it (exactly the
    # deferral bug the sweep exists to catch), the sweep LLM would hit
    # that dedup, get zero results, and give up. Drop the normalized
    # forms of every missing mod name so the sweep can re-query them.
    # Results themselves aren't cached — only the query set — so this
    # just permits one more Nexus call per missing name, nothing else.
    for name in missing:
        session.searched_queries.discard(name.strip().lower())

    usable_providers = [
        p for p in providers if p.get_model_name() not in exhausted_providers
    ]
    if not usable_providers:
        logger.warning(
            "Requested-mods sweep skipped: no providers available. "
            "Missing: %s", missing,
        )
    else:
        system_prompt = build_sweep_prompt(missing, game, game_version, session)
        user_msg = (
            "Add the missing requested mods listed above. "
            "Call finalize() when done."
        )
        handlers = build_phase1_handlers(session, event_callback)

        def _on_text(text: str) -> None:
            emit(event_callback, "thinking", {"text": text[:200]},
                 debug_data={"full_text": text})

        sweep_iter_cap = max(len(missing) * 6, 20)
        session.finalized = False
        for llm in usable_providers:
            try:
                await llm.generate_with_tools(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_msg},
                    ],
                    tools=PHASE1_TOOLS,
                    tool_handlers=handlers,
                    max_iterations=sweep_iter_cap,
                    on_text=_on_text,
                    is_finalized=lambda: session.finalized,
                )
                break
            except Exception as e:
                error_type, friendly = classify_error(llm, e)
                logger.warning(
                    "Sweep provider %s failed (%s): %s",
                    llm.get_model_name(), error_type, e,
                )
                emit(event_callback, "provider_error", {
                    "provider": llm.get_model_name(),
                    "type": error_type,
                    "message": friendly,
                })
                continue

    # Re-check what's still missing after the sweep and flag it.
    still_missing = _missing_requested_mods(session)
    for name in still_missing:
        emit(event_callback, "missing_requested_mod", {"name": name})
    emit(event_callback, "sweep_complete", {
        "still_missing_count": len(still_missing),
        "still_missing": still_missing,
        "added_by_sweep": [m for m in missing if m not in still_missing],
    })


async def generate_modlist(
    db: AsyncSession,
    request: ModlistGenerateRequest,
    event_callback: Callable[[dict], None] | None = None,
    resume_from_phase: int | None = None,
    resume_session: GenerationSession | None = None,
) -> GenerationResult:
    """Generate a modlist using the phased agentic pipeline.

    Iterates through game-specific build phases from the DB. Each phase runs
    its own LLM tool-calling loop with focused prompts. The final phase always
    handles compatibility patches.

    Args:
        db: Database session
        request: Generation request with hardware info, playstyle, credentials
        event_callback: Optional callback for real-time event streaming
        resume_from_phase: If resuming, which phase number to start from
        resume_session: If resuming, the restored GenerationSession
    """
    game = await db.get(Game, request.game_id)
    if not game:
        raise ValueError("Invalid game ID")

    playstyle = None
    if request.playstyle_id:
        playstyle = await db.get(Playstyle, request.playstyle_id)
        if not playstyle:
            raise ValueError("Invalid playstyle ID")

    # Must have at least one form of guidance
    if not playstyle and not request.custom_description and not request.requested_mods:
        raise ValueError("Provide a playstyle, custom description, or requested mods")

    game_version = request.game_version
    tier_info, vram_budget, storage_budget_gb = _compute_budgets(request)
    version_notes = VERSION_NOTES.get(game_version or "", "No specific version selected.")
    hardware_context = build_hardware_context(request, tier_info, vram_budget, storage_budget_gb)

    # Load ordered phases for this game
    result = await db.execute(
        select(ModBuildPhase)
        .where(ModBuildPhase.game_id == request.game_id)
        .order_by(ModBuildPhase.phase_number)
    )
    phase_list = result.scalars().all()

    # If no phases in DB, fall back to legacy two-phase pipeline
    if not phase_list:
        return await _generate_legacy(
            db,
            request,
            event_callback,
        )

    byok_providers = _build_provider_list(request)
    is_server_routed = not request.llm_credentials

    # Notify frontend which providers are available
    if is_server_routed:
        sample_providers = _build_free_tier_providers("gameplay")
        emit(event_callback, "providers_ready", {
            "providers": [
                {
                    "provider_id": p.provider_id,
                    "name": (get_provider(p.provider_id) or {}).get("name", p.provider_id),
                    "model": p.get_model_name(),
                }
                for p in sample_providers
            ],
            "count": len(sample_providers),
            "free_tier": True,
        })
    else:
        emit(event_callback, "providers_ready", {
            "providers": [
                {
                    "provider_id": p.provider_id,
                    "name": (get_provider(p.provider_id) or {}).get("name", p.provider_id),
                    "model": p.get_model_name(),
                }
                for p in byok_providers
            ],
            "count": len(byok_providers),
        })

    # The Nexus GraphQL v2 API allows read-only mod data fetching without
    # authentication per Nexus policy — no personal key or OAuth needed for reads.
    nexus = NexusModsClient()

    if resume_session:
        session = resume_session
        session.nexus = nexus
        # A resumed session was snapshotted before requested_mods was tracked;
        # restore from the live request so the sweep still honors user asks.
        if request.requested_mods and not session.requested_mods:
            session.requested_mods = list(request.requested_mods)
    else:
        session = GenerationSession(
            game_domain=game.nexus_domain,
            nexus=nexus,
            preset=request.preset,
            requested_mods=list(request.requested_mods or []),
        )

    total_phases = len(phase_list)
    last_successful_provider: LLMProvider | None = (
        byok_providers[0] if byok_providers else None
    )
    # Permanent failure types — these providers won't recover mid-generation
    _PERMANENT_ERRORS = {"auth_error", "token_limit"}
    exhausted_providers: set[str] = set()

    # ── Phased generation loop ──
    for phase in phase_list:
        if resume_from_phase and phase.phase_number < resume_from_phase:
            continue

        is_patch_phase = (phase.phase_number == phase_list[-1].phase_number)

        # Build the provider order for this phase.
        # Server-hosted mode: per-phase provider selection based on complexity.
        # BYOK: same provider list for all phases (user's own keys).
        if is_server_routed:
            providers_to_try = _build_free_tier_providers(phase.name)
        else:
            providers_to_try = byok_providers

        phase_providers = [
            p for p in providers_to_try
            if p.get_model_name() not in exhausted_providers
        ]
        if not phase_providers:
            raise PauseGeneration(
                reason="All LLM providers are exhausted",
                phase_number=phase.phase_number,
                phase_name=phase.name,
                session_snapshot=session.to_snapshot(),
            )
        # Move last successful provider to front (sticky provider preference)
        if last_successful_provider and last_successful_provider in phase_providers:
            phase_providers.remove(last_successful_provider)
            phase_providers.insert(0, last_successful_provider)

        # ── Sub-pass planning ──
        # Patch phase is always a single pass (there's no per-sub-pass cap
        # concept there). For non-patch phases, split when effective_cap > 25.
        if is_patch_phase:
            sub_pass_total = 1
            per_sub_pass_cap = phase.max_mods
            sub_pass_guidance_list: list = []
        else:
            plan = plan_sub_passes(
                phase_max_mods=phase.max_mods,
                phase_scale_weight=phase.scale_weight,
                preset_multiplier=preset_multiplier(session.preset),
            )
            if plan.sub_pass_count == 0:
                # Phase scaled to zero under this preset (e.g. weight 0).
                session.completed_phases.append(phase.phase_number)
                continue
            sub_pass_total = plan.sub_pass_count
            per_sub_pass_cap = plan.per_sub_pass_cap
            sub_pass_guidance_list = list(phase.sub_pass_guidance or [])

        emit(event_callback, "phase_start", {
            "phase": phase.name,
            "number": phase.phase_number,
            "total_phases": total_phases,
            "is_patch_phase": is_patch_phase,
            "provider": phase_providers[0].get_model_name(),
            "sub_pass_total": sub_pass_total,
            "per_sub_pass_cap": per_sub_pass_cap,
        })

        # Snapshot mod IDs before this phase (for reviewer to identify new additions)
        pre_phase_mod_ids = {m["nexus_mod_id"] for m in session.modlist}
        pre_phase_count = len(session.modlist)
        session.current_phase_id = phase.id

        # Run each sub-pass with provider fallback. Each sub-pass gets a
        # fresh LLM context plus a compact "already added this phase" list.
        for sub_pass_index in range(sub_pass_total):
            guidance = None
            if sub_pass_index < len(sub_pass_guidance_list):
                guidance = sub_pass_guidance_list[sub_pass_index]

            sub_pass_succeeded = False
            provider_errors: list[str] = []

            for i, llm in enumerate(phase_providers):
                # Refresh per provider attempt: a failed provider may have
                # added mods before erroring, and the next provider should
                # see them in the "already added this phase" list.
                already_added = (
                    session.entries_for_phase(phase.id) if not is_patch_phase else []
                )
                try:
                    await _run_single_sub_pass(
                        llm=llm,
                        phase=phase,
                        game=game,
                        playstyle=playstyle,
                        game_version=game_version,
                        version_notes=version_notes,
                        hardware_context=hardware_context,
                        session=session,
                        total_phases=total_phases,
                        request=request,
                        event_callback=event_callback,
                        is_patch_phase=is_patch_phase,
                        cap=per_sub_pass_cap,
                        already_added=already_added,
                        sub_pass_guidance=guidance,
                        sub_pass_index=sub_pass_index,
                        sub_pass_total=sub_pass_total,
                    )
                    sub_pass_succeeded = True
                    last_successful_provider = llm
                    break

                except Exception as e:
                    error_type, friendly = classify_error(llm, e)
                    logger.warning(
                        f"Provider {llm.get_model_name()} failed on phase "
                        f"{phase.phase_number} sub-pass {sub_pass_index + 1}/"
                        f"{sub_pass_total} ({error_type}): {e}"
                    )
                    provider_errors.append(friendly)

                    if error_type in _PERMANENT_ERRORS:
                        exhausted_providers.add(llm.get_model_name())
                        logger.info(
                            f"Provider {llm.get_model_name()} marked as exhausted "
                            f"({error_type}) — will not retry on future phases"
                        )

                    emit(event_callback, "provider_error", {
                        "provider": llm.get_model_name(),
                        "type": error_type,
                        "message": friendly,
                    })

                    remaining = [
                        p for p in phase_providers[i + 1:]
                        if p.get_model_name() not in exhausted_providers
                    ]
                    if remaining:
                        emit(event_callback, "provider_switch", {
                            "from_provider": llm.get_model_name(),
                            "to_provider": remaining[0].get_model_name(),
                        })
                    continue

            if not sub_pass_succeeded:
                error_summary = "; ".join(provider_errors)
                raise PauseGeneration(
                    reason=error_summary,
                    phase_number=phase.phase_number,
                    phase_name=phase.name,
                    session_snapshot=session.to_snapshot(),
                )

        session.completed_phases.append(phase.phase_number)
        session.current_phase_id = None

        # ── Gemini Pro overseer review (runs ONCE per phase after all sub-passes) ──
        experience_label = _get_experience_label(playstyle, request.custom_description)
        await review_phase(
            session=session,
            phase_name=phase.name,
            game_name=game.name,
            game_version=game_version,
            playstyle_name=experience_label,
            hardware_context=hardware_context,
            pre_phase_mod_ids=pre_phase_mod_ids,
            event_callback=event_callback,
        )

        emit(event_callback, "phase_complete", {
            "phase": phase.name,
            "number": phase.phase_number,
            "mod_count": len(session.modlist) - pre_phase_count,
            "patch_count": len(session.patches),
            "provider": last_successful_provider.get_model_name() if last_successful_provider else "unknown",
        })

        logger.info(
            f"Phase {phase.phase_number} complete: "
            f"{len(session.modlist)} mods, {len(session.patches)} patches "
            f"(sub-passes: {sub_pass_total})"
        )
        logger.debug("Modlist after phase %d: %s",
                     phase.phase_number,
                     [m["name"] for m in session.modlist])

    # ── Requested-mods sweep ──
    # Before the final review, one last narrow pass to pick up any mods the
    # user explicitly asked for that the phased loop missed. Anything still
    # missing after this is surfaced to the user as "not found."
    sweep_providers = (
        _build_free_tier_providers("gameplay")
        if is_server_routed else byok_providers
    )
    await _run_requested_mods_sweep(
        session=session,
        game=game,
        game_version=game_version,
        request=request,
        providers=sweep_providers,
        exhausted_providers=exhausted_providers,
        event_callback=event_callback,
    )

    # ── All phases complete — run final comprehensive review ──
    experience_label = _get_experience_label(playstyle, request.custom_description)
    await review_comprehensive(
        session=session,
        game_name=game.name,
        game_version=game_version,
        playstyle_name=experience_label,
        hardware_context=hardware_context,
        event_callback=event_callback,
    )

    all_entries = session.modlist + session.patches
    return GenerationResult(
        entries=all_entries,
        knowledge_flags=session.knowledge_flags,
        review_flags=session.review_flags,
        llm_provider=last_successful_provider.get_model_name() if last_successful_provider else "unknown",
    )


async def _generate_legacy(
    db: AsyncSession,
    request: ModlistGenerateRequest,
    event_callback: Callable[[dict], None] | None = None,
) -> GenerationResult:
    """Legacy two-phase pipeline for games without DB-defined phases."""
    game = await db.get(Game, request.game_id)
    if not game:
        raise ValueError("Invalid game ID")

    playstyle = None
    if request.playstyle_id:
        playstyle = await db.get(Playstyle, request.playstyle_id)
        if not playstyle:
            raise ValueError("Invalid playstyle ID")

    experience_label = _get_experience_label(playstyle, request.custom_description)

    game_version = request.game_version
    tier_info, vram_budget, storage_budget_gb = _compute_budgets(request)
    version_notes = VERSION_NOTES.get(game_version or "", "No specific version selected.")

    nexus = NexusModsClient()
    session = GenerationSession(
        game_domain=game.nexus_domain,
        nexus=nexus,
        preset=request.preset,
        requested_mods=list(request.requested_mods or []),
    )

    providers_to_try = _build_provider_list(request)
    if not providers_to_try:
        providers_to_try = _build_free_tier_providers("gameplay")

    emit(event_callback, "providers_ready", {
        "providers": [
            {
                "provider_id": p.provider_id,
                "name": (get_provider(p.provider_id) or {}).get("name", p.provider_id),
                "model": p.get_model_name(),
            }
            for p in providers_to_try
        ],
        "count": len(providers_to_try),
    })

    # Build experience context for legacy prompt
    experience_context = _build_user_preferences_context(
        playstyle, request.custom_description, request.requested_mods or [], True,
    )

    discovery_prompt = LEGACY_DISCOVERY_PROMPT.format(
        game_name=game.name,
        game_version=game_version or "Unknown",
        gpu=request.gpu or "Unknown",
        cpu=request.cpu or "Unknown",
        ram_gb=request.ram_gb or "Unknown",
        vram_mb=request.vram_mb or 6144,
        available_storage_gb=request.available_storage_gb or 50,
        storage_budget_gb=storage_budget_gb,
        vram_budget=vram_budget,
        experience_context=experience_context,
        version_notes=version_notes,
    )

    provider_errors: list[str] = []
    for i, llm in enumerate(providers_to_try):
        try:
            session.modlist.clear()
            session.patches.clear()
            session.knowledge_flags.clear()
            session.description_cache.clear()
            session.finalized = False

            logger.info(f"Trying provider {i+1}/{len(providers_to_try)}: {llm.get_model_name()}")

            emit(event_callback, "phase_start", {
                "phase": "Discovery",
                "number": 1,
                "total_phases": 2,
                "provider": llm.get_model_name(),
            })

            def _on_text(text: str) -> None:
                logger.debug("LLM reasoning: %s", text)
                emit(event_callback, "thinking", {"text": text[:200]}, debug_data={"full_text": text})

            messages = [
                {"role": "system", "content": discovery_prompt},
                {"role": "user", "content": f"Build a {experience_label} modlist for {game.name} ({game_version or 'any version'})."},
            ]

            await llm.generate_with_tools(
                messages=messages,
                tools=PHASE1_TOOLS,
                tool_handlers=build_phase1_handlers(session, event_callback),
                max_iterations=20,
                on_text=_on_text,
                is_finalized=lambda: session.finalized,
            )

            emit(event_callback, "phase_complete", {
                "phase": "Discovery",
                "number": 1,
                "mod_count": len(session.modlist),
                "provider": llm.get_model_name(),
            })

            if session.modlist:
                modlist_summary = "\n".join(
                    f"{i+1}. {m['name']} (Nexus ID: {m['nexus_mod_id']}) — {m.get('reason', '')}"
                    for i, m in enumerate(session.modlist)
                )

                patch_prompt = LEGACY_PATCH_REVIEW_PROMPT.format(
                    game_name=game.name,
                    game_version=game_version or "Unknown",
                    modlist_summary=modlist_summary,
                )

                session.finalized = False
                pre_patch_mod_count = len(session.modlist)

                emit(event_callback, "phase_start", {
                    "phase": "Patch Review",
                    "number": 2,
                    "total_phases": 2,
                    "provider": llm.get_model_name(),
                })

                await llm.generate_with_tools(
                    messages=[
                        {"role": "system", "content": patch_prompt},
                        {"role": "user", "content": "Review the modlist above for compatibility patches."},
                    ],
                    tools=PHASE2_TOOLS,
                    tool_handlers=build_phase2_handlers(session, event_callback),
                    max_iterations=15,
                    on_text=_on_text,
                    is_finalized=lambda: session.finalized,
                )

                emit(event_callback, "phase_complete", {
                    "phase": "Patch Review",
                    "number": 2,
                    "mod_count": len(session.modlist) - pre_patch_mod_count,
                    "patch_count": len(session.patches),
                    "provider": llm.get_model_name(),
                })

            all_entries = session.modlist + session.patches
            return GenerationResult(
                entries=all_entries,
                knowledge_flags=session.knowledge_flags,
                llm_provider=llm.get_model_name(),
            )

        except Exception as e:
            _, friendly = classify_error(llm, e)
            logger.warning(f"Provider {llm.get_model_name()} failed: {e}")
            provider_errors.append(friendly)
            continue

    error_summary = "; ".join(provider_errors) if provider_errors else "No LLM provider available"
    raise RuntimeError(error_summary)


async def build_rag_context(
    db: AsyncSession, playstyle_id: int, user_vram_mb: int,
    game_version: str | None = None,
) -> str:
    """Build context string from database for LLM."""
    result = await db.execute(
        select(Mod, PlaystyleMod)
        .join(PlaystyleMod, Mod.id == PlaystyleMod.mod_id)
        .where(PlaystyleMod.playstyle_id == playstyle_id)
    )
    rows = result.all()

    context_lines = []
    for mod, pm in rows:
        if not is_version_compatible(mod.game_version_support, game_version):
            continue
        min_vram = TIER_MIN_VRAM.get(pm.hardware_tier_min or "low", 0)
        if user_vram_mb >= min_vram:
            impact = mod.performance_impact or "unknown"
            vram = f"{mod.vram_requirement_mb}MB VRAM" if mod.vram_requirement_mb else "N/A"
            ver = f" | Version: {mod.game_version_support}" if mod.game_version_support != "all" else ""
            context_lines.append(
                f"- ID:{mod.id} | {mod.name} by {mod.author} | "
                f"Impact: {impact} | VRAM: {vram} | "
                f"Priority: {pm.priority}{ver} | {mod.summary or ''}"
            )

    mod_ids = [mod.id for mod, _ in rows]
    if mod_ids:
        compat_result = await db.execute(
            select(CompatibilityRule).where(CompatibilityRule.mod_id.in_(mod_ids))
        )
        rules = compat_result.scalars().all()
        if rules:
            context_lines.append("\nCompatibility Rules:")
            for rule in rules:
                context_lines.append(
                    f"- Mod {rule.mod_id} {rule.rule_type} Mod {rule.related_mod_id}"
                    + (f" | Note: {rule.notes}" if rule.notes else "")
                )

    return "\n".join(context_lines) if context_lines else "No mod data available yet."
