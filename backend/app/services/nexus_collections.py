"""Nexus Collections publishing via GraphQL createCollection mutation.

**STATUS: BEST-GUESS IMPLEMENTATION.** Nexus's GraphQL introspection is
blocked on the public endpoint, so the exact `CollectionPayload` schema
has not been verified against a live server. Field names below are based
on documented shape and on patterns used by Vortex (Nexus's own client).

Once Nexus Support provides a working client_id and scope, introspect
against the authenticated endpoint and update this module with the
verified types. Mismatches will surface as GraphQL errors in the logs.
"""

import logging
import uuid as _uuid
from typing import Any

from app.models.modlist import Modlist, ModlistEntry
from app.services.nexus_client import NexusModsClient

logger = logging.getLogger(__name__)


# --- ASSUMED MUTATION (unverified — see module docstring) -------------------

_CREATE_COLLECTION_MUTATION = """
mutation CreateCollection($collectionData: CollectionPayload!, $uuid: String!) {
  createCollection(collectionData: $collectionData, uuid: $uuid) {
    success
    collection { id slug name }
    collectionId
    revision { id revisionNumber }
    revisionId
  }
}
"""


def _build_collection_payload(
    modlist: Modlist,
    entries: list[ModlistEntry],
    game_domain: str,
    game_id: int,
    title: str,
    description: str,
    listed: bool = False,
) -> dict[str, Any]:
    """Assemble the CollectionPayload dict.

    ASSUMPTIONS (verify once we have schema access):
    - gameDomain is a string on the payload
    - mods is a list of { modId, fileId, optional } entries
    - visibility is controlled by `listed: bool` (listed=False means unlisted)
    - description is markdown (Nexus historically supports BBCode; unconfirmed for Collections)
    """
    mod_entries = []
    for e in entries:
        if not e.nexus_mod_id:
            continue  # Skip non-Nexus entries
        mod_entry = {
            "modId": str(e.nexus_mod_id),
            "optional": False,
        }
        if e.file_id:
            mod_entry["fileId"] = str(e.file_id)
        mod_entries.append(mod_entry)

    return {
        "name": title,
        "summary": title[:200],
        "description": description,
        "gameId": str(game_id),
        "gameDomain": game_domain,
        "listed": listed,  # False → unlisted (link-only access)
        "mods": mod_entries,
    }


async def publish_modlist_as_collection(
    *,
    modlist: Modlist,
    entries: list[ModlistEntry],
    game_domain: str,
    game_id: int,
    access_token: str,
    title: str,
    description: str,
    listed: bool = False,
) -> dict[str, Any]:
    """Publish a modlist as an (unlisted by default) Nexus Collection.

    Returns the mutation result dict, e.g.:
        {
          "success": True,
          "collection": {"id": "...", "slug": "...", "name": "..."},
          "collectionId": 123,
          "revision": {"id": "...", "revisionNumber": 1},
          "revisionId": 456,
        }

    Raises NexusAPIError on GraphQL errors, httpx.HTTPStatusError on HTTP errors.
    """
    payload = _build_collection_payload(
        modlist=modlist,
        entries=entries,
        game_domain=game_domain,
        game_id=game_id,
        title=title,
        description=description,
        listed=listed,
    )
    # Idempotency key per the Nexus pattern — prevents duplicate collections on retry
    idempotency_uuid = str(_uuid.uuid4())

    client = NexusModsClient(access_token=access_token)
    result = await client._query(
        _CREATE_COLLECTION_MUTATION,
        {"collectionData": payload, "uuid": idempotency_uuid},
    )

    data = (result.get("data") or {}).get("createCollection") or {}
    logger.info(
        "Published collection: success=%s collectionId=%s revisionId=%s",
        data.get("success"), data.get("collectionId"), data.get("revisionId"),
    )
    return data
