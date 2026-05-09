"""Generation API: Start, stream (SSE), poll status, and resume modlist generation.

POST /api/generation/start      — Start a new generation (background task)
GET  /api/generation/{id}/events — SSE stream (replay + live events)
GET  /api/generation/{id}/status — Quick polling endpoint
POST /api/generation/{id}/resume — Resume a paused generation
"""

import asyncio
import json
import logging
import time
import uuid as _uuid
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.api.modlist import save_modlist_to_db
from app.database import async_session, get_db
from app.models.game import Game
from app.models.modlist import Modlist
from app.models.user import User
from app.schemas.modlist import ModlistGenerateRequest
from app.services.auth import decode_access_token
from app.services.email.generation_complete import send_generation_complete_email
from app.services.generation_manager import GenerationManager
from app.services.generation import (
    GenerationSession,
    PauseGeneration,
    generate_modlist,
)
from app.services.nexus_client import NexusModsClient

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class GenerationStartResponse(BaseModel):
    generation_id: str


class GenerationStatusResponse(BaseModel):
    status: str  # running | complete | error | paused
    generation_id: str
    modlist_id: str | None = None
    event_count: int = 0
    paused_at_phase: int | None = None
    pause_reason: str | None = None
    # Derived for dashboard polling (Task 18) — last phase_start event + wall clock
    phase_index: int | None = None
    total_phases: int | None = None
    elapsed_seconds: int | None = None


class ResumeResponse(BaseModel):
    status: str  # "resumed"


# ──────────────────────────────────────────────
# Background generation task
# ──────────────────────────────────────────────

async def _run_generation_task(
    generation_id: str,
    request: ModlistGenerateRequest,
    user_id: str | None = None,
    resume_from_phase: int | None = None,
    resume_session: GenerationSession | None = None,
) -> None:
    """Background task that runs the full generation pipeline.

    Creates its own DB session (not request-scoped) because this runs
    after the HTTP handler returns.
    """
    manager = GenerationManager.get_instance()
    emitter = manager.make_emitter(generation_id)

    # Pre-loaded once per task; used by the completion-email dispatcher at both
    # terminal states. Declared here so the `except Exception` branch can still
    # see them after the `async with async_session()` block closes.
    user: User | None = None
    game: Game | None = None

    try:
        async with async_session() as db:
            if user_id:
                user_res = await db.execute(
                    select(User)
                    .where(User.id == _uuid.UUID(user_id))
                    .options(selectinload(User.settings))
                )
                user = user_res.scalar_one_or_none()
            game = await db.get(Game, request.game_id)

            result = await generate_modlist(
                db=db,
                request=request,
                event_callback=emitter,
                resume_from_phase=resume_from_phase,
                resume_session=resume_session,
            )

            # Save modlist to DB (include debug log for later download)
            uid = _uuid.UUID(user_id) if user_id else None
            state = manager.get_state(generation_id)
            debug_log = state.debug_log if state else None
            modlist = await save_modlist_to_db(db, request, result, uid, debug_log)
            modlist_id = str(modlist.id)

            manager.set_complete(generation_id, modlist_id)
            logger.info(
                f"Generation {generation_id} complete → modlist {modlist_id} "
                f"({len(result.entries)} entries)"
            )

            # Reload modlist with entries eagerly loaded so the email body can
            # count mods / sum sizes without lazy-loading on a detached row.
            # Modlist has no `game` relationship, so we attach the already-loaded
            # Game row as a runtime attribute rather than add a mapping nothing
            # else needs.
            reloaded = await db.execute(
                select(Modlist)
                .where(Modlist.id == modlist.id)
                .options(selectinload(Modlist.entries))
            )
            modlist = reloaded.scalar_one()
            modlist.game = game

            if user is not None:
                try:
                    await send_generation_complete_email(
                        user=user,
                        modlist=modlist,
                        outcome="success",
                    )
                except Exception as email_exc:
                    logger.warning(
                        f"Completion email dispatch failed: {email_exc}"
                    )

    except PauseGeneration as e:
        logger.warning(
            f"Generation {generation_id} paused at phase {e.phase_number}: {e.reason}"
        )
        # The exception carries the session snapshot from the generator
        session_snapshot = e.session_snapshot
        request_snapshot = request.model_dump(mode="json")

        manager.set_paused(
            generation_id=generation_id,
            phase_number=e.phase_number,
            phase_name=e.phase_name,
            reason=e.reason,
            session_snapshot=session_snapshot,
            request_snapshot=request_snapshot,
            mods_so_far=len(session_snapshot.get("modlist", [])),
        )

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)[:200]}"
        logger.error(f"Generation {generation_id} failed: {error_msg}")
        manager.set_error(generation_id, error_msg)

        # Failure email — no saved modlist to reference (save_modlist_to_db
        # runs only on success), so pass a shim carrying just the game for
        # the subject line. Dispatcher's failure template doesn't reference
        # mod_count or total_gb, so empty entries is fine.
        if user is not None and game is not None:
            try:
                shim = SimpleNamespace(id=None, game=game, entries=[])
                await send_generation_complete_email(
                    user=user,
                    modlist=shim,
                    outcome="failure",
                    error_message=error_msg,
                )
            except Exception as email_exc:
                logger.warning(f"Failure email dispatch failed: {email_exc}")


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/start", response_model=GenerationStartResponse)
async def start_generation(
    request: ModlistGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a modlist generation as a background task.

    Returns immediately with a generation_id. Use /events for SSE streaming
    or /status for polling.
    """
    if request.preset.requires_byok and not request.llm_credentials:
        raise HTTPException(
            status_code=402,
            detail=(
                "This modlist size requires your own LLM API key. "
                "Add one in Settings > AI Providers to unlock Large, Massive, "
                "or Ultimate presets."
            ),
        )

    manager = GenerationManager.get_instance()
    generation_id = manager.create_generation(
        user_id=str(current_user.id),
        request_snapshot=request.model_dump(mode="json"),
    )

    # Launch the background task
    asyncio.create_task(
        _run_generation_task(
            generation_id=generation_id,
            request=request,
            user_id=str(current_user.id),
        )
    )

    return GenerationStartResponse(generation_id=generation_id)


def _scrub_request_snapshot(snapshot: dict | None) -> dict | None:
    """Return a copy of a request snapshot safe to expose in a debug log.

    Strips per-provider API keys from ``llm_credentials`` so the download can
    be shared for debugging without leaking secrets.
    """
    if not snapshot:
        return snapshot
    scrubbed = dict(snapshot)
    creds = scrubbed.get("llm_credentials")
    if isinstance(creds, list):
        scrubbed["llm_credentials"] = [
            {k: v for k, v in (c or {}).items() if k != "api_key"}
            | ({"api_key": "[redacted]"} if (c or {}).get("api_key") else {})
            for c in creds
        ]
    return scrubbed


@router.get("/{generation_id}/log")
async def download_generation_log(
    generation_id: str,
    current_user: User = Depends(get_current_user),
):
    """Download the full debug log for a generation as a JSON file.

    Contains untruncated thinking text and all search result names —
    data that is stripped from SSE events to keep the stream lean.
    Also includes the original request (preset, requested_mods,
    hardware, playstyle) with LLM API keys redacted — required for
    reproducing bug reports.
    """
    manager = GenerationManager.get_instance()
    state = manager.get_state(generation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Generation not found")

    if state.user_id and state.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your generation")

    return JSONResponse(
        content={
            "generation_id": generation_id,
            "status": state.status,
            "request": _scrub_request_snapshot(state.request_snapshot),
            "events": state.debug_log,
        },
        headers={
            "Content-Disposition": f'attachment; filename="generation-{generation_id[:8]}.json"',
        },
    )


async def _get_user_from_token(token: str, db: AsyncSession) -> User | None:
    """Validate a JWT token and return the User. Used for SSE auth."""
    payload = decode_access_token(token)
    if not payload:
        return None
    try:
        user_id = _uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.get("/{generation_id}/events")
async def stream_events(
    generation_id: str,
    token: str = Query(..., description="JWT access token (EventSource can't set headers)"),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint that replays stored events then streams live events.

    The EventSource API on the frontend natively handles reconnection.
    On reconnect, all past events are replayed (they're stored in memory).

    Note: Uses query param `token` for auth because the browser's EventSource
    API does not support custom headers.
    """
    # Validate token manually (EventSource can't use Authorization header)
    current_user = await _get_user_from_token(token, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    manager = GenerationManager.get_instance()
    state = manager.get_state(generation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Generation not found")

    # Verify ownership
    if state.user_id and state.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your generation")

    async def event_generator():
        """Yields SSE-formatted events."""
        # Phase 1: Replay all stored events
        for event in state.events:
            yield f"data: {json.dumps(event)}\n\n"

        # If already terminal, stop
        if state.status in ("complete", "error"):
            return

        # Phase 2: Subscribe to live events
        queue = await manager.subscribe(generation_id)
        if not queue:
            return

        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(event)}\n\n"

                    # Terminal events — close the stream
                    if event.get("type") in ("complete", "error"):
                        return
                except asyncio.TimeoutError:
                    # Send keepalive comment to prevent proxy/browser timeout
                    yield ": keepalive\n\n"

                    # Check if generation ended while we were waiting
                    current_state = manager.get_state(generation_id)
                    if current_state and current_state.status in ("complete", "error", "paused"):
                        # Drain any remaining events in queue
                        while not queue.empty():
                            event = queue.get_nowait()
                            yield f"data: {json.dumps(event)}\n\n"
                        return

        finally:
            manager.unsubscribe(generation_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/{generation_id}/status", response_model=GenerationStatusResponse)
async def get_status(
    generation_id: str,
    current_user: User = Depends(get_current_user),
):
    """Quick polling endpoint for generation status."""
    manager = GenerationManager.get_instance()
    state = manager.get_state(generation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Generation not found")

    if state.user_id and state.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your generation")

    # Derive phase_index / total_phases from the most recent phase_start event
    phase_index: int | None = None
    total_phases: int | None = None
    for evt in reversed(state.events):
        if evt.get("type") == "phase_start":
            phase_index = evt.get("number")
            total_phases = evt.get("total_phases")
            break

    elapsed_seconds = int(time.time() - state.created_at)

    return GenerationStatusResponse(
        status=state.status,
        generation_id=generation_id,
        modlist_id=state.modlist_id,
        event_count=len(state.events),
        paused_at_phase=state.paused_at_phase,
        pause_reason=state.pause_reason,
        phase_index=phase_index,
        total_phases=total_phases,
        elapsed_seconds=elapsed_seconds,
    )


@router.post("/{generation_id}/resume", response_model=ResumeResponse)
async def resume_generation(
    generation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused generation from where it left off.

    Reconstructs the GenerationSession from the saved snapshot and
    launches a new background task starting from the paused phase.
    """
    manager = GenerationManager.get_instance()
    state = manager.get_state(generation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Generation not found")

    if state.user_id and state.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your generation")

    if state.status != "paused":
        raise HTTPException(
            status_code=400,
            detail=f"Generation is {state.status}, not paused",
        )

    if not state.session_snapshot or not state.request_snapshot:
        raise HTTPException(
            status_code=400,
            detail="No snapshot available for resume",
        )

    # Reconstruct request and session
    request = ModlistGenerateRequest(**state.request_snapshot)
    nexus = NexusModsClient()
    session = GenerationSession.from_snapshot(state.session_snapshot, nexus)

    phase_number = state.paused_at_phase or 1

    # Mark as resumed
    phase_name = state.pause_reason or "Unknown"
    manager.set_resumed(generation_id, phase_name=phase_name, phase_number=phase_number)

    # Launch new background task
    asyncio.create_task(
        _run_generation_task(
            generation_id=generation_id,
            request=request,
            user_id=str(current_user.id),
            resume_from_phase=phase_number,
            resume_session=session,
        )
    )

    return ResumeResponse(status="resumed")
