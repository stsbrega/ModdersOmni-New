import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.game import Game
from app.models.mod import Mod
from app.models.modlist import Modlist, ModlistEntry, ModlistKnowledgeFlag
from app.models.playstyle import Playstyle
from app.models.playstyle_mod import PlaystyleMod
from app.models.user import User
from app.schemas.modlist import (
    ExportModEntry, ModEntry, ModlistExportResponse,
    ModlistGenerateRequest, ModlistResponse, SizeSummary, UserKnowledgeFlag,
)
from app.models.user_nexus_token import UserNexusToken
from app.services.generation import (
    TIER_MIN_VRAM,
    generate_modlist as run_generation, GenerationResult, is_version_compatible,
)
from app.services.install_guide import build_guide, guide_to_dict, guide_to_markdown
from app.services.nexus_client import NexusAPIError
from app.services.nexus_collections import publish_modlist_as_collection
from app.api.deps import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter()


def _entry_to_schema(entry: ModlistEntry) -> ModEntry:
    """Convert a DB ModlistEntry to the API schema, using denormalized fields."""
    return ModEntry(
        mod_id=entry.mod_id,
        nexus_mod_id=entry.nexus_mod_id,
        name=entry.name or "Unknown",
        author=entry.author,
        summary=entry.summary,
        reason=entry.reason,
        load_order=entry.load_order,
        is_patch=entry.is_patch,
        patches_mods=entry.patches_mods,
        compatibility_notes=entry.compatibility_notes,
    )


def _flag_to_schema(flag: ModlistKnowledgeFlag) -> UserKnowledgeFlag:
    return UserKnowledgeFlag(
        mod_a=flag.mod_a_name,
        mod_b=flag.mod_b_name,
        issue=flag.issue,
        severity=flag.severity,
    )


async def save_modlist_to_db(
    db: AsyncSession,
    request: ModlistGenerateRequest,
    result: GenerationResult,
    user_id: uuid.UUID | None = None,
    debug_log: list[dict] | None = None,
) -> Modlist:
    """Save a generation result to the database.

    Creates the Modlist, ModlistEntry rows, and ModlistKnowledgeFlag rows.
    Returns the saved Modlist with its generated UUID.

    This helper is used by both the legacy synchronous endpoint and the
    new background-task generation flow.
    """
    modlist = Modlist(
        game_id=request.game_id,
        game_version=request.game_version,
        playstyle_id=request.playstyle_id,
        custom_description=request.custom_description,
        requested_mods=request.requested_mods or None,
        gpu_model=request.gpu,
        cpu_model=request.cpu,
        ram_gb=request.ram_gb,
        vram_mb=request.vram_mb,
        llm_provider=result.llm_provider,
        user_id=user_id,
        debug_log=debug_log,
    )
    db.add(modlist)
    await db.flush()

    for i, mod_data in enumerate(result.entries):
        entry = ModlistEntry(
            modlist_id=modlist.id,
            nexus_mod_id=mod_data.get("nexus_mod_id"),
            file_id=mod_data.get("file_id"),
            file_size_bytes=mod_data.get("file_size_bytes"),
            mod_id=mod_data.get("mod_id"),
            name=mod_data.get("name", "Unknown"),
            author=mod_data.get("author"),
            summary=mod_data.get("summary"),
            reason=mod_data.get("reason"),
            load_order=mod_data.get("load_order", i + 1),
            enabled=True,
            download_status="pending",
            is_patch=mod_data.get("is_patch", False),
            patches_mods=mod_data.get("patches_mods"),
        )
        db.add(entry)

    for flag_data in result.knowledge_flags:
        flag = ModlistKnowledgeFlag(
            modlist_id=modlist.id,
            mod_a_name=flag_data["mod_a"],
            mod_b_name=flag_data["mod_b"],
            issue=flag_data["issue"],
            severity=flag_data.get("severity", "warning"),
        )
        db.add(flag)

    await db.commit()
    return modlist


@router.post("/generate", response_model=ModlistResponse)
async def generate_modlist(
    request: ModlistGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Legacy synchronous generation endpoint (backward compatible)."""
    game = await db.get(Game, request.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    playstyle = None
    if request.playstyle_id:
        playstyle = await db.get(Playstyle, request.playstyle_id)
        if not playstyle:
            raise HTTPException(status_code=404, detail="Playstyle not found")

    result: GenerationResult | None = None
    generation_error: str | None = None
    try:
        result = await run_generation(
            db,
            request,
        )
    except Exception as e:
        generation_error = str(e)
        logger.error(f"LLM generation failed ({type(e).__name__}): {e}")

    use_fallback = result is None or not result.entries
    user_id = current_user.id if current_user else None

    if not use_fallback:
        modlist = await save_modlist_to_db(db, request, result, user_id)
        entry_result = await db.execute(
            select(ModlistEntry)
            .where(ModlistEntry.modlist_id == modlist.id)
            .order_by(ModlistEntry.load_order)
        )
        entries_schema = [_entry_to_schema(e) for e in entry_result.scalars().all()]
        knowledge_flags_schema = [
            UserKnowledgeFlag(
                mod_a=f["mod_a"], mod_b=f["mod_b"],
                issue=f["issue"], severity=f.get("severity", "warning"),
            )
            for f in result.knowledge_flags
        ]
    else:
        fallback_mods = await _fallback_modlist(
            db, request.playstyle_id, request.vram_mb, request.game_version
        )
        modlist = Modlist(
            game_id=request.game_id,
            game_version=request.game_version,
            playstyle_id=request.playstyle_id,
            gpu_model=request.gpu,
            cpu_model=request.cpu,
            ram_gb=request.ram_gb,
            vram_mb=request.vram_mb,
            llm_provider="fallback",
            user_id=user_id,
        )
        db.add(modlist)
        await db.flush()

        entries_schema = []
        for i, mod_data in enumerate(fallback_mods):
            entry = ModlistEntry(
                modlist_id=modlist.id,
                mod_id=mod_data.get("mod_id"),
                name=mod_data.get("name", "Unknown"),
                author=mod_data.get("author"),
                summary=mod_data.get("summary"),
                reason=mod_data.get("reason"),
                load_order=mod_data.get("load_order", i + 1),
                enabled=True,
                download_status="pending",
            )
            db.add(entry)
            entries_schema.append(_entry_to_schema(entry))

        await db.commit()
        knowledge_flags_schema = []

    return ModlistResponse(
        id=modlist.id,
        game_id=request.game_id,
        game_version=request.game_version,
        game_domain=game.nexus_domain if game else None,
        playstyle_id=request.playstyle_id,
        entries=entries_schema,
        llm_provider=modlist.llm_provider,
        user_knowledge_flags=knowledge_flags_schema,
        used_fallback=use_fallback,
        generation_error=generation_error,
    )


async def _fallback_modlist(
    db: AsyncSession, playstyle_id: int | None, user_vram_mb: int | None,
    game_version: str | None = None,
) -> list[dict]:
    """Fallback: return curated mods from DB when LLM is unavailable."""
    if not playstyle_id:
        return []

    vram = user_vram_mb or 6144

    result = await db.execute(
        select(Mod, PlaystyleMod)
        .join(PlaystyleMod, Mod.id == PlaystyleMod.mod_id)
        .where(PlaystyleMod.playstyle_id == playstyle_id)
        .order_by(PlaystyleMod.priority.desc())
    )

    mods = []
    for i, (mod, pm) in enumerate(result.all()):
        if not is_version_compatible(mod.game_version_support, game_version):
            continue
        min_vram = TIER_MIN_VRAM.get(pm.hardware_tier_min or "low", 0)
        if vram >= min_vram:
            mods.append({
                "mod_id": mod.id,
                "name": mod.name,
                "author": mod.author,
                "summary": mod.summary,
                "reason": f"Curated mod (priority: {pm.priority})",
                "load_order": i + 1,
            })

    return mods


@router.get("/mine", response_model=list[ModlistResponse])
async def get_my_modlists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all modlists for the current user."""
    result = await db.execute(
        select(Modlist)
        .where(Modlist.user_id == current_user.id)
        .order_by(Modlist.created_at.desc())
    )
    modlists = result.scalars().all()

    # Pre-fetch game domains for all unique game_ids
    game_ids = {ml.game_id for ml in modlists}
    game_map: dict[int, Game | None] = {}
    for gid in game_ids:
        game_map[gid] = await db.get(Game, gid)

    responses = []
    for ml in modlists:
        entry_result = await db.execute(
            select(ModlistEntry)
            .where(ModlistEntry.modlist_id == ml.id)
            .order_by(ModlistEntry.load_order)
        )
        entries = [_entry_to_schema(e) for e in entry_result.scalars().all()]

        flag_result = await db.execute(
            select(ModlistKnowledgeFlag)
            .where(ModlistKnowledgeFlag.modlist_id == ml.id)
        )
        flags = [_flag_to_schema(f) for f in flag_result.scalars().all()]

        game = game_map.get(ml.game_id)
        responses.append(
            ModlistResponse(
                id=ml.id,
                game_id=ml.game_id,
                game_version=ml.game_version,
                game_domain=game.nexus_domain if game else None,
                playstyle_id=ml.playstyle_id,
                entries=entries,
                llm_provider=ml.llm_provider,
                user_knowledge_flags=flags,
                has_debug_log=ml.debug_log is not None,
            )
        )

    return responses


@router.delete("/{modlist_id}", status_code=204)
async def delete_modlist(
    modlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a modlist owned by the current user."""
    try:
        ml_uuid = uuid.UUID(modlist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid modlist ID")

    modlist = await db.get(Modlist, ml_uuid)
    if not modlist:
        raise HTTPException(status_code=404, detail="Modlist not found")

    if modlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your modlist")

    await db.execute(
        delete(ModlistKnowledgeFlag).where(ModlistKnowledgeFlag.modlist_id == ml_uuid)
    )
    await db.execute(
        delete(ModlistEntry).where(ModlistEntry.modlist_id == ml_uuid)
    )
    await db.delete(modlist)
    await db.commit()


@router.get("/{modlist_id}/export", response_model=ModlistExportResponse)
async def export_modlist(
    modlist_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export modlist for MO2 plugin.

    file_ids are resolved during generation and stored on each ModlistEntry,
    so this endpoint makes zero Nexus API calls.
    """
    try:
        ml_uuid = uuid.UUID(modlist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid modlist ID")

    modlist = await db.get(Modlist, ml_uuid)
    if not modlist:
        raise HTTPException(status_code=404, detail="Modlist not found")

    game = await db.get(Game, modlist.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    entry_result = await db.execute(
        select(ModlistEntry)
        .where(ModlistEntry.modlist_id == ml_uuid)
        .order_by(ModlistEntry.load_order)
    )
    db_entries = entry_result.scalars().all()

    entries = [
        ExportModEntry(
            nexus_mod_id=e.nexus_mod_id,
            file_id=e.file_id,
            name=e.name or "Unknown",
            author=e.author,
            load_order=e.load_order,
            is_patch=e.is_patch,
            patches_mods=e.patches_mods,
        )
        for e in db_entries
    ]

    return ModlistExportResponse(
        id=modlist.id,
        game_domain=game.nexus_domain,
        game_name=game.name,
        mod_count=len(entries),
        entries=entries,
    )


class PublishCollectionRequest(BaseModel):
    title: str
    description: str = ""
    listed: bool = False


@router.post("/{modlist_id}/publish-to-nexus")
async def publish_modlist_to_nexus(
    modlist_id: str,
    data: PublishCollectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Publish this modlist as an unlisted Nexus Collection under the user's
    account, using their stored OAuth token.

    Requires the user to have connected their Nexus account via
    /api/nexus/oauth/authorize first.
    """
    try:
        ml_uuid = uuid.UUID(modlist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid modlist ID")

    modlist = await db.get(Modlist, ml_uuid)
    if not modlist:
        raise HTTPException(status_code=404, detail="Modlist not found")
    if modlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your modlist")

    token = await db.get(UserNexusToken, current_user.id)
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Connect your Nexus account first (Settings → Nexus Mods Connection).",
        )

    game = await db.get(Game, modlist.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    entry_result = await db.execute(
        select(ModlistEntry)
        .where(ModlistEntry.modlist_id == ml_uuid)
        .order_by(ModlistEntry.load_order)
    )
    entries = list(entry_result.scalars().all())

    try:
        result = await publish_modlist_as_collection(
            modlist=modlist,
            entries=entries,
            game_domain=game.nexus_domain,
            game_id=game.id,
            access_token=token.access_token,
            title=data.title,
            description=data.description,
            listed=data.listed,
        )
    except NexusAPIError as e:
        logger.warning("Nexus rejected createCollection: %s", e)
        raise HTTPException(status_code=502, detail=f"Nexus API error: {e}")
    except httpx.HTTPStatusError as e:
        logger.warning("HTTP error publishing collection: %s", e)
        raise HTTPException(status_code=502, detail="Nexus API unavailable")

    if not result.get("success"):
        raise HTTPException(status_code=502, detail="Collection creation returned failure")

    collection = result.get("collection") or {}
    slug = collection.get("slug")
    return {
        "success": True,
        "collection_id": result.get("collectionId"),
        "revision_id": result.get("revisionId"),
        "slug": slug,
        "url": (
            f"https://www.nexusmods.com/{game.nexus_domain}/collections/{slug}"
            if slug else None
        ),
    }


@router.get("/{modlist_id}/log")
async def download_modlist_log(
    modlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the debug log for a completed modlist."""
    try:
        ml_uuid = uuid.UUID(modlist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid modlist ID")

    modlist = await db.get(Modlist, ml_uuid)
    if not modlist:
        raise HTTPException(status_code=404, detail="Modlist not found")

    if modlist.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your modlist")

    if not modlist.debug_log:
        raise HTTPException(status_code=404, detail="No debug log available")

    return JSONResponse(
        content={"modlist_id": modlist_id, "events": modlist.debug_log},
        headers={
            "Content-Disposition": f'attachment; filename="generation-{modlist_id[:8]}.json"',
        },
    )


_ALLOWED_GUIDE_VERSIONS = {"SE", "AE", "Standard", "Next-Gen"}


async def _load_modlist_for_guide(
    modlist_id: str, db: AsyncSession
) -> tuple[Modlist, Game, list[ModlistEntry]]:
    """Shared loader for the guide endpoints. Raises HTTPException on failure."""
    try:
        ml_uuid = uuid.UUID(modlist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid modlist ID")

    modlist = await db.get(Modlist, ml_uuid)
    if not modlist:
        raise HTTPException(status_code=404, detail="Modlist not found")

    game = await db.get(Game, modlist.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    entry_result = await db.execute(
        select(ModlistEntry)
        .where(ModlistEntry.modlist_id == ml_uuid)
        .order_by(ModlistEntry.load_order)
    )
    entries = list(entry_result.scalars().all())
    return modlist, game, entries


@router.get("/{modlist_id}/guide")
async def get_modlist_guide(
    modlist_id: str,
    version: str | None = Query(None, max_length=30),
    db: AsyncSession = Depends(get_db),
):
    """Return a structured install guide (JSON) for a generated modlist.

    The guide includes MO2 and Vortex install workflows, version-specific
    warnings, and troubleshooting tips. Pass ?version=SE|AE|Standard|Next-Gen
    to override the stored version (useful for modlists created before the
    game_version column existed).
    """
    modlist, game, entries = await _load_modlist_for_guide(modlist_id, db)

    if version is not None:
        if version not in _ALLOWED_GUIDE_VERSIONS:
            raise HTTPException(status_code=400, detail="Invalid version")
        # Override without persisting — the override only affects this response
        modlist.game_version = version  # type: ignore[assignment]

    guide = build_guide(modlist, game, entries)
    return guide_to_dict(guide)


@router.get("/{modlist_id}/guide.md")
async def download_modlist_guide_markdown(
    modlist_id: str,
    version: str | None = Query(None, max_length=30),
    db: AsyncSession = Depends(get_db),
):
    """Download the install guide as a Markdown file (includes full modlist)."""
    modlist, game, entries = await _load_modlist_for_guide(modlist_id, db)

    if version is not None:
        if version not in _ALLOWED_GUIDE_VERSIONS:
            raise HTTPException(status_code=400, detail="Invalid version")
        modlist.game_version = version  # type: ignore[assignment]

    guide = build_guide(modlist, game, entries)
    markdown = guide_to_markdown(guide, entries, game.nexus_domain)

    # Short slug in filename, safe for all OS/filesystem variants
    filename = f"moddersomni-guide-{modlist_id[:8]}.md"
    from fastapi.responses import Response
    return Response(
        content=markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{modlist_id}", response_model=ModlistResponse)
async def get_modlist(modlist_id: str, db: AsyncSession = Depends(get_db)):
    """Get a previously generated modlist by ID."""
    try:
        ml_uuid = uuid.UUID(modlist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid modlist ID")

    modlist = await db.get(Modlist, ml_uuid)
    if not modlist:
        raise HTTPException(status_code=404, detail="Modlist not found")

    game = await db.get(Game, modlist.game_id)

    # Load entries — use denormalized fields directly
    entry_result = await db.execute(
        select(ModlistEntry)
        .where(ModlistEntry.modlist_id == ml_uuid)
        .order_by(ModlistEntry.load_order)
    )
    entries = [_entry_to_schema(e) for e in entry_result.scalars().all()]

    # Load knowledge flags
    flag_result = await db.execute(
        select(ModlistKnowledgeFlag)
        .where(ModlistKnowledgeFlag.modlist_id == ml_uuid)
    )
    flags = [_flag_to_schema(f) for f in flag_result.scalars().all()]

    return ModlistResponse(
        id=modlist.id,
        game_id=modlist.game_id,
        game_version=modlist.game_version,
        game_domain=game.nexus_domain if game else None,
        playstyle_id=modlist.playstyle_id,
        entries=entries,
        llm_provider=modlist.llm_provider,
        user_knowledge_flags=flags,
        used_fallback=modlist.llm_provider == "fallback",
        has_debug_log=modlist.debug_log is not None,
    )


# ──────────────────────────────────────────────
# Size summary (disk-space forecasting)
# ──────────────────────────────────────────────

# Heuristic: installed size runs ~2.5x the compressed Nexus download
# (7-zip/BA2 archives expand, and ModOrganizer keeps the originals).
INSTALLED_MULTIPLIER = 2.5
TIGHT_THRESHOLD = 0.80       # installed / free > 80% -> tight
INSUFFICIENT_THRESHOLD = 1.00  # > 100% -> insufficient


def _parse_largest_free_drive(storage_drives: str | None) -> int | None:
    """Parse a storage_drives string and return the largest free space in bytes.

    Input shape (see app/schemas/specs.py): "C: 180GB free / 931GB, D: 450GB free / 1863GB".
    Returns None if the string is empty or has no parseable free-space token.
    """
    import re
    if not storage_drives:
        return None
    matches = re.findall(r"(\d+)\s*GB\s*free", storage_drives, re.IGNORECASE)
    if not matches:
        return None
    largest_gb = max(int(m) for m in matches)
    return largest_gb * 1024 ** 3


@router.get("/{modlist_id}/size-summary", response_model=SizeSummary)
async def get_size_summary(
    modlist_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SizeSummary:
    """Return download + installed-size forecasting for a modlist."""
    result = await db.execute(
        select(Modlist)
        .where(
            Modlist.id == modlist_id,
            Modlist.user_id == current_user.id,
        )
        .options(selectinload(Modlist.entries))
    )
    modlist = result.scalar_one_or_none()
    if modlist is None:
        raise HTTPException(status_code=404, detail="Modlist not found")

    sized = [e for e in modlist.entries if e.file_size_bytes is not None]
    unsized = [e for e in modlist.entries if e.file_size_bytes is None]
    download_bytes = sum(e.file_size_bytes for e in sized)
    installed_estimate_bytes = int(download_bytes * INSTALLED_MULTIPLIER)

    # storage_drives lives on User (not UserSettings) in this schema.
    largest_free = _parse_largest_free_drive(current_user.storage_drives)

    if largest_free is None:
        fit_status = "unknown"
    elif installed_estimate_bytes > largest_free * INSUFFICIENT_THRESHOLD:
        fit_status = "insufficient"
    elif installed_estimate_bytes > largest_free * TIGHT_THRESHOLD:
        fit_status = "tight"
    else:
        fit_status = "comfortable"

    return SizeSummary(
        download_bytes=download_bytes,
        installed_estimate_bytes=installed_estimate_bytes,
        sized_count=len(sized),
        unsized_count=len(unsized),
        total_count=len(modlist.entries),
        largest_drive_free_bytes=largest_free,
        fit_status=fit_status,
    )
