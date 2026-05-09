"""Tool handler builders for the generation pipeline.

Builds closures that the LLM tool-calling loop invokes when the model
calls search_nexus, add_to_modlist, etc.
"""

import asyncio
import json
import logging
from typing import Callable

from app.services.nexus_client import NexusAPIError

from .exceptions import NexusExhaustedError
from .session import GenerationSession, strip_html

logger = logging.getLogger(__name__)


def _coerce_int(value: object) -> int | None:
    """Coerce a value that may be int, numeric str, or None to int|None.

    Nexus v2 GraphQL returns ``sizeInBytes`` as a string (int64 convention),
    and LLM tool-call JSON may send ``mod_id`` as a string. We normalize both
    at the boundary so downstream sums and DB inserts stay int-typed.
    """
    if value is None or value == "":
        return None
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


async def _resolve_primary_file(
    session: GenerationSession, mod_id: int,
) -> tuple[int | None, int | None]:
    """Fetch a mod's primary file_id + sizeInBytes.

    Returns (file_id, size_bytes). Either/both may be None on API
    failure or missing fields — absence is fine downstream.
    """
    try:
        files = await session.nexus.get_mod_files(session.game_domain, mod_id)
        if not files:
            return None, None
        primary = next((f for f in files if f.get("primary")), files[0])
        return _coerce_int(primary.get("fileId")), _coerce_int(primary.get("sizeInBytes"))
    except Exception as e:
        logger.warning("primary file resolution failed for mod %s: %s", mod_id, e)
        return None, None


def emit(callback: Callable[[dict], None] | None, event_type: str, data: dict, debug_data: dict | None = None) -> None:
    """Emit an event if a callback is provided.

    If debug_data is given it is attached as ``_debug`` so that
    GenerationManager.emit() can split it into the debug log while
    keeping the SSE stream lean.
    """
    if callback:
        event = {"type": event_type, **data}
        if debug_data:
            event["_debug"] = debug_data
        callback(event)


async def retry_nexus(
    coro_fn: Callable,
    max_retries: int = 3,
    event_callback: Callable[[dict], None] | None = None,
) -> object:
    """Retry a Nexus API call with exponential backoff.

    Handles rate limits (429) and server errors (5xx) by retrying.
    NexusAPIError (GraphQL errors) are NOT retried — they indicate
    query/auth problems, not transient failures.
    If all retries fail, raises NexusExhaustedError so the LLM can
    try a different search or skip the mod.
    """
    import httpx

    for attempt in range(max_retries):
        try:
            return await coro_fn()
        except NexusAPIError:
            raise
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 429:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt * 5  # 5s, 10s, 20s
                    emit(event_callback, "retrying", {
                        "reason": "nexus_rate_limit",
                        "wait_seconds": wait,
                        "attempt": attempt + 1,
                        "max_attempts": max_retries,
                    })
                    await asyncio.sleep(wait)
                    continue
            elif status >= 500:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt * 3  # 3s, 6s, 12s
                    emit(event_callback, "retrying", {
                        "reason": "nexus_server_error",
                        "wait_seconds": wait,
                        "attempt": attempt + 1,
                        "max_attempts": max_retries,
                    })
                    await asyncio.sleep(wait)
                    continue
            raise
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt * 3
                emit(event_callback, "retrying", {
                    "reason": "nexus_timeout" if isinstance(e, httpx.TimeoutException) else "nexus_connection",
                    "wait_seconds": wait,
                    "attempt": attempt + 1,
                    "max_attempts": max_retries,
                })
                await asyncio.sleep(wait)
                continue
            raise

    raise NexusExhaustedError("All Nexus retries failed")


def build_phase1_handlers(
    session: GenerationSession,
    event_callback: Callable[[dict], None] | None = None,
) -> dict:
    """Build tool handler functions for discovery phases (search + add mods)."""

    async def search_nexus(query: str, sort_by: str = "endorsements") -> str:
        normalized = query.strip().lower()
        if normalized in session.searched_queries:
            emit(event_callback, "searching", {"query": query})
            emit(event_callback, "search_results", {
                "count": 0,
                "sample_names": [],
            }, debug_data={"all_names": [], "skipped": "duplicate_query"})
            return json.dumps({
                "results": [],
                "count": 0,
                "note": f"You already searched for '{query}' — try different keywords.",
            })
        session.searched_queries.add(normalized)

        emit(event_callback, "searching", {"query": query})
        try:
            results = await retry_nexus(
                lambda: session.nexus.search_mods(session.game_domain, query, sort_by=sort_by),
                event_callback=event_callback,
            )
        except Exception as e:
            logger.warning(f"Nexus search failed after retries: {e}")
            return json.dumps({"error": "Search temporarily unavailable. Try a different query."})

        mods = []
        for m in results[:15]:
            author = m.get("author", "Unknown")
            mod_id = m["modId"]
            session.author_cache[mod_id] = author
            # Change 6: Soft-cache summary from search results
            summary = (m.get("summary") or "")[:200]
            if mod_id not in session.description_cache:
                session.description_cache[mod_id] = summary
            mods.append({
                "mod_id": mod_id,
                "name": m["name"],
                "author": author,
                "summary": summary,
                "endorsements": m.get("endorsements", 0),
                "category": m.get("modCategory", {}).get("name", ""),
                "updated": m.get("updatedAt", ""),
            })
        all_names = [m["name"] for m in mods]
        logger.debug("Search '%s' returned %d results: %s", query, len(mods), all_names)
        emit(event_callback, "search_results", {
            "count": len(mods),
            "sample_names": all_names[:5],
        }, debug_data={"all_names": all_names})
        return json.dumps({"results": mods, "count": len(mods)})

    async def get_mod_details(mod_id: int) -> str:
        emit(event_callback, "reading_mod", {"mod_id": mod_id})

        # Change 1: Return cached result if we already fetched full details
        cached_desc = session.description_cache.get(mod_id)
        if cached_desc and len(cached_desc) > 200:
            # Full description is cached (not just a search summary)
            author = session.author_cache.get(mod_id, "Unknown")
            result = {
                "mod_id": mod_id,
                "description": cached_desc[:3000],
                "author": author,
                "note": "Retrieved from cache (previously fetched this session)",
            }
            if mod_id in session.reverse_deps_cache:
                result["mods_requiring_this"] = session.reverse_deps_cache[mod_id]
            return json.dumps(result)

        try:
            details = await retry_nexus(
                lambda: session.nexus.get_mod_details(session.game_domain, mod_id),
                event_callback=event_callback,
            )
        except Exception as e:
            logger.warning(f"Nexus get_mod_details failed after retries: {e}")
            return json.dumps({"error": f"Could not fetch mod {mod_id}. Try another mod."})

        if not details:
            return json.dumps({"error": f"Mod {mod_id} not found"})
        desc_html = details.get("description") or ""
        desc_text = strip_html(desc_html)
        session.description_cache[mod_id] = desc_text
        author = details.get("author", "Unknown")
        session.author_cache[mod_id] = author

        # Extract structured requirements (if available from the API)
        requirements = []
        reverse_deps = []
        reverse_deps_count = 0
        mod_reqs = details.get("modRequirements")
        if mod_reqs:
            nexus_reqs = (mod_reqs.get("nexusRequirements") or {}).get("nodes") or []
            for req in nexus_reqs:
                requirements.append({
                    "mod_id": req.get("modId"),
                    "name": req.get("modName", ""),
                    "notes": req.get("notes") or "",
                })
            reverse_data = mod_reqs.get("modsRequiringThisMod") or {}
            reverse_deps_count = reverse_data.get("totalCount", 0)
            for rd in (reverse_data.get("nodes") or [])[:20]:
                reverse_deps.append({
                    "mod_id": rd.get("modId"),
                    "name": rd.get("modName", ""),
                    "notes": rd.get("notes") or "",
                })
            # Cache reverse deps for Phase 2 patch finding
            session.reverse_deps_cache[mod_id] = reverse_deps

        result = {
            "mod_id": details["modId"],
            "name": details["name"],
            "author": author,
            "summary": details.get("summary", ""),
            "description": desc_text,
            "endorsements": details.get("endorsements", 0),
            "category": details.get("modCategory", {}).get("name", ""),
        }
        if requirements:
            result["requirements"] = requirements
        if reverse_deps:
            result["mods_requiring_this"] = reverse_deps
            result["mods_requiring_this_total"] = reverse_deps_count
        return json.dumps(result)

    async def add_to_modlist(
        mod_id: int, name: str, reason: str,
        author: str = "", summary: str = "", estimated_size_mb: int = 0,
        # Accepted for backwards compatibility with old tool schemas in flight —
        # always overwritten by the session counter below. Don't rely on it.
        load_order: int | None = None,
    ) -> str:
        # Normalize types — LLM tool-call JSON occasionally sends numeric
        # fields as strings, which later blows up on int-typed DB columns.
        coerced_id = _coerce_int(mod_id)
        if coerced_id is None:
            return json.dumps({
                "status": "error",
                "message": f"mod_id must be an integer (got {mod_id!r}). Try again with a numeric id.",
            })
        mod_id = coerced_id

        # Reject duplicates: the LLM occasionally re-adds the same mod within
        # a phase. For Nexus-backed mods (id > 0) dedupe on nexus_mod_id; for
        # manual-download placeholders (id = 0, e.g. F4SE/SKSE) dedupe on name.
        if mod_id > 0:
            already = any(e.get("nexus_mod_id") == mod_id for e in session.modlist)
        else:
            already = any(
                e.get("nexus_mod_id") == 0 and e.get("name") == name
                for e in session.modlist
            )
        if already:
            emit(event_callback, "duplicate_rejected", {
                "mod_id": mod_id,
                "name": name,
            })
            return json.dumps({
                "status": "duplicate",
                "message": (
                    f"'{name}' (id={mod_id}) is already in the modlist. "
                    "Do not add it again — move on to the next mod."
                ),
                "current_count": len(session.modlist),
            })

        resolved_author = author or session.author_cache.get(mod_id, "")
        file_id, file_size_bytes = await _resolve_primary_file(session, mod_id)
        # Session-assigned monotonic order — LLM-supplied load_order is ignored
        # because collisions were routine when the model chose the number.
        assigned_load_order = session.next_load_order
        session.next_load_order += 1
        entry = {
            "nexus_mod_id": mod_id,
            "file_id": file_id,
            "file_size_bytes": file_size_bytes,
            "name": name,
            "author": resolved_author,
            "summary": summary,
            "reason": reason,
            "load_order": assigned_load_order,
            "estimated_size_mb": estimated_size_mb,
            "is_patch": False,
            # Stamped so sub-pass loop can surface an "already added in this
            # phase" summary across separate LLM turns.
            "phase_id": session.current_phase_id,
        }
        session.modlist.append(entry)
        logger.debug("Mod added: %s (id=%d, order=%d, size=%dMB) — %s",
                      name, mod_id, assigned_load_order, estimated_size_mb, reason)
        emit(event_callback, "mod_added", {
            "mod_id": mod_id,
            "name": name,
            "reason": reason,
            "load_order": assigned_load_order,
        })
        total_bytes = sum(
            (e.get("file_size_bytes") or 0) for e in session.modlist
        )
        emit(event_callback, "size_update", {
            "total_bytes": total_bytes,
            "mod_count": len(session.modlist),
        })
        return json.dumps({
            "status": "added",
            "name": name,
            "current_count": len(session.modlist),
        })

    async def finalize() -> str:
        session.finalized = True
        return json.dumps({
            "status": "finalized",
            "total_mods": len(session.modlist),
        })

    return {
        "search_nexus": search_nexus,
        "get_mod_details": get_mod_details,
        "add_to_modlist": add_to_modlist,
        "finalize": finalize,
    }


def build_phase2_handlers(
    session: GenerationSession,
    event_callback: Callable[[dict], None] | None = None,
) -> dict:
    """Build tool handler functions for the compatibility patches phase."""

    checked_descriptions: set[int] = set()

    async def get_mod_description(mod_id: int) -> str:
        if mod_id in checked_descriptions:
            desc = session.description_cache.get(mod_id, "")
            return json.dumps({
                "mod_id": mod_id,
                "note": "You already reviewed this mod's description earlier. Move on to other mods.",
                "description_preview": desc[:200] if desc else "(no description)",
            })
        checked_descriptions.add(mod_id)
        emit(event_callback, "reading_mod", {"mod_id": mod_id})
        if mod_id in session.description_cache:
            return json.dumps({"mod_id": mod_id, "description": session.description_cache[mod_id]})
        try:
            details = await retry_nexus(
                lambda: session.nexus.get_mod_details(session.game_domain, mod_id),
                event_callback=event_callback,
            )
        except Exception as e:
            logger.warning(f"Nexus get_mod_details failed after retries: {e}")
            return json.dumps({"error": f"Could not fetch mod {mod_id}"})

        if not details:
            return json.dumps({"error": f"Mod {mod_id} not found"})
        desc_text = strip_html(details.get("description") or "")
        session.description_cache[mod_id] = desc_text
        return json.dumps({"mod_id": mod_id, "description": desc_text})

    checked_reverse_deps: set[int] = set()

    async def get_reverse_deps(mod_id: int) -> str:
        """Get mods that require this mod — patches are often listed here."""
        if mod_id in checked_reverse_deps:
            cached = session.reverse_deps_cache.get(mod_id, [])
            return json.dumps({
                "mod_id": mod_id,
                "note": "You already checked this mod's reverse deps. Move on.",
                "count": len(cached),
            })
        checked_reverse_deps.add(mod_id)
        # Check session cache first (populated during Phase 1 get_mod_details calls)
        if mod_id in session.reverse_deps_cache:
            return json.dumps({
                "mod_id": mod_id,
                "mods_requiring_this": session.reverse_deps_cache[mod_id],
                "source": "cached_from_earlier_phase",
            })
        # Fall back to fresh API call
        emit(event_callback, "reading_mod", {"mod_id": mod_id})
        try:
            details = await retry_nexus(
                lambda: session.nexus.get_mod_details(session.game_domain, mod_id),
                event_callback=event_callback,
            )
        except Exception as e:
            logger.warning(f"Nexus get_mod_details for reverse deps failed: {e}")
            return json.dumps({"error": f"Could not fetch mod {mod_id}"})
        if not details:
            return json.dumps({"error": f"Mod {mod_id} not found"})

        mod_reqs = details.get("modRequirements") or {}
        reverse_data = mod_reqs.get("modsRequiringThisMod") or {}
        nodes = []
        for rd in (reverse_data.get("nodes") or []):
            nodes.append({
                "mod_id": rd.get("modId"),
                "name": rd.get("modName", ""),
                "notes": rd.get("notes") or "",
            })
        session.reverse_deps_cache[mod_id] = nodes
        return json.dumps({
            "mod_id": mod_id,
            "mods_requiring_this": nodes,
            "total_count": reverse_data.get("totalCount", 0),
        })

    async def search_patches(query: str) -> str:
        normalized = query.strip().lower()
        if normalized in session.searched_queries:
            emit(event_callback, "searching", {"query": query})
            emit(event_callback, "search_results", {
                "count": 0,
                "sample_names": [],
            }, debug_data={"all_names": [], "skipped": "duplicate_query"})
            return json.dumps({
                "results": [],
                "count": 0,
                "note": f"You already searched for '{query}' — try different keywords.",
            })
        session.searched_queries.add(normalized)

        emit(event_callback, "searching", {"query": query})
        all_results: dict[int, dict] = {}  # mod_id → result, dedupes

        # Strategy 1: Original query
        try:
            results = await retry_nexus(
                lambda: session.nexus.search_mods(session.game_domain, query, sort_by="endorsements"),
                event_callback=event_callback,
            )
            for m in results[:10]:
                all_results[m["modId"]] = m
        except Exception as e:
            logger.warning(f"Nexus search_patches failed after retries: {e}")

        # Strategy 2: Try without apostrophes (e.g. "JK's" → "JKs")
        if len(all_results) < 3 and "'" in query:
            alt_query = query.replace("'", "")
            try:
                results = await retry_nexus(
                    lambda: session.nexus.search_mods(session.game_domain, alt_query, sort_by="endorsements"),
                    event_callback=event_callback,
                )
                for m in results[:10]:
                    all_results.setdefault(m["modId"], m)
            except Exception:
                pass

        # Strategy 3: Try "[first mod name] Patch Hub"
        if len(all_results) < 3:
            first_mod = query.split(" patch")[0].split(" compatibility")[0].strip()
            if first_mod and first_mod.lower() != query.lower():
                hub_query = f"{first_mod} Patch Hub"
                try:
                    results = await retry_nexus(
                        lambda: session.nexus.search_mods(session.game_domain, hub_query, sort_by="endorsements"),
                        event_callback=event_callback,
                    )
                    for m in results[:10]:
                        all_results.setdefault(m["modId"], m)
                except Exception:
                    pass

        # Format combined results
        patches = []
        for m in list(all_results.values())[:10]:
            author = m.get("author", "Unknown")
            mod_id = m["modId"]
            session.author_cache[mod_id] = author
            patches.append({
                "mod_id": mod_id,
                "name": m["name"],
                "author": author,
                "summary": (m.get("summary") or "")[:200],
                "endorsements": m.get("endorsements", 0),
            })
        all_patch_names = [p["name"] for p in patches]
        logger.debug("Patch search '%s' returned %d results: %s", query, len(patches), all_patch_names)
        emit(event_callback, "search_results", {
            "count": len(patches),
            "sample_names": all_patch_names[:5],
        }, debug_data={"all_names": all_patch_names})
        return json.dumps({"results": patches, "count": len(patches)})

    async def add_patch(
        mod_id: int, name: str, patches_mods: list[str], reason: str,
        author: str = "",
        # Accepted for backwards compatibility with old tool schemas in flight —
        # always overwritten by the session counter below. Don't rely on it.
        load_order: int | None = None,
    ) -> str:
        coerced_id = _coerce_int(mod_id)
        if coerced_id is None:
            return json.dumps({
                "status": "error",
                "message": f"mod_id must be an integer (got {mod_id!r}).",
            })
        mod_id = coerced_id

        # A patch already on the modlist or in the patches list is a dupe.
        combined = session.modlist + session.patches
        if mod_id > 0 and any(e.get("nexus_mod_id") == mod_id for e in combined):
            emit(event_callback, "duplicate_rejected", {
                "mod_id": mod_id,
                "name": name,
            })
            return json.dumps({
                "status": "duplicate",
                "message": f"Patch '{name}' (id={mod_id}) is already in the list.",
            })

        resolved_author = author or session.author_cache.get(mod_id, "")
        file_id, file_size_bytes = await _resolve_primary_file(session, mod_id)
        assigned_load_order = session.next_load_order
        session.next_load_order += 1
        entry = {
            "nexus_mod_id": mod_id,
            "file_id": file_id,
            "file_size_bytes": file_size_bytes,
            "name": name,
            "author": resolved_author,
            "reason": reason,
            "load_order": assigned_load_order,
            "is_patch": True,
            "patches_mods": patches_mods,
        }
        session.patches.append(entry)
        logger.debug("Patch added: %s (id=%d, order=%d) patches %s — %s",
                      name, mod_id, assigned_load_order, patches_mods, reason)
        emit(event_callback, "patch_added", {
            "mod_id": mod_id,
            "name": name,
            "patches_mods": patches_mods,
        })
        return json.dumps({"status": "patch_added", "name": name})

    async def flag_user_knowledge(
        mod_a: str, mod_b: str, issue: str, severity: str = "warning",
    ) -> str:
        flag = {
            "mod_a": mod_a,
            "mod_b": mod_b,
            "issue": issue,
            "severity": severity,
        }
        session.knowledge_flags.append(flag)
        emit(event_callback, "knowledge_flag", {
            "mod_a": mod_a,
            "mod_b": mod_b,
            "issue": issue,
            "severity": severity,
        })
        return json.dumps({"status": "flagged", "mod_a": mod_a, "mod_b": mod_b})

    async def finalize_review() -> str:
        session.finalized = True
        return json.dumps({
            "status": "review_complete",
            "patches_added": len(session.patches),
            "flags_raised": len(session.knowledge_flags),
        })

    return {
        "get_mod_description": get_mod_description,
        "get_reverse_deps": get_reverse_deps,
        "search_patches": search_patches,
        "add_patch": add_patch,
        "flag_user_knowledge": flag_user_knowledge,
        "finalize_review": finalize_review,
    }
