import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)


# Process-wide cap on in-flight Nexus GraphQL requests. A module-level
# semaphore is required (rather than per-instance) because the pipeline
# instantiates a fresh NexusModsClient per generation — without a shared
# ceiling, N concurrent generations × 10 fan-out would hammer the API.
_NEXUS_CONCURRENCY = int(os.getenv("NEXUS_CONCURRENCY", "8"))
_nexus_semaphore = asyncio.Semaphore(_NEXUS_CONCURRENCY)


class NexusAPIError(Exception):
    """Raised when the Nexus GraphQL API returns errors in the response body."""

    def __init__(self, errors: list[dict]):
        self.errors = errors
        messages = "; ".join(e.get("message", "Unknown error") for e in errors)
        super().__init__(f"Nexus GraphQL errors: {messages}")


class NexusModsClient:
    """Client for the Nexus Mods v2 GraphQL API."""

    BASE_URL = "https://api.nexusmods.com/v2/graphql"

    # Map friendly sort names to GraphQL sort variable objects
    _SORT_MAP = {
        "endorsements": [{"endorsements": {"direction": "DESC"}}],
        "updated": [{"updatedAt": {"direction": "DESC"}}],
        "name": [{"name": {"direction": "ASC"}}],
    }

    # In-memory cache: game_domain -> game_id (only 2 games supported)
    _game_id_cache: dict[str, int] = {}

    def __init__(self, access_token: str | None = None):
        """Create a Nexus GraphQL client.

        access_token: Optional OAuth2 access token. Reads (search, mod details,
        mod files) work unauthenticated; writes (createCollection) require a token.
        Concurrency is enforced by the module-level `_nexus_semaphore`.
        """
        self._access_token = access_token

    APPLICATION_NAME = "ModdersOmni"
    APPLICATION_VERSION = "1.0.0"

    def _headers(self) -> dict:
        headers = {
            "Content-Type": "application/json",
            "Application-Name": self.APPLICATION_NAME,
            "Application-Version": self.APPLICATION_VERSION,
        }
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        return headers

    async def _query(self, query: str, variables: dict | None = None) -> dict:
        """Execute a GraphQL query and return the parsed response.

        Raises NexusAPIError if the response contains GraphQL-level errors.
        Raises httpx.HTTPStatusError for HTTP-level errors.
        """
        async with _nexus_semaphore:
            async with httpx.AsyncClient() as client:
                payload = {"query": query, "variables": variables or {}}
                response = await client.post(
                    self.BASE_URL,
                    headers=self._headers(),
                    json=payload,
                    timeout=30.0,
                )
                response.raise_for_status()
                result = response.json()

                # Check for GraphQL-level errors
                if result.get("errors"):
                    logger.error(
                        "Nexus GraphQL errors: %s | query: %s | variables: %s",
                        result["errors"],
                        query.strip()[:200],
                        variables,
                    )
                    raise NexusAPIError(result["errors"])

                # Warn if data is None (unexpected for a successful query)
                if result.get("data") is None:
                    logger.warning(
                        "Nexus returned null data without errors | query: %s | variables: %s",
                        query.strip()[:200],
                        variables,
                    )

                return result

    # Verified working query — uses typed variables ($filter: ModsFilter)
    # instead of interpolating scalar variables into inline filter objects.
    # Confirmed against live API: this format returns results.
    _SEARCH_QUERY = """
    query SearchMods($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
        mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
            nodes {
                modId
                name
                summary
                author
                version
                endorsements
                modCategory { name }
                updatedAt
            }
            totalCount
        }
    }
    """

    async def search_mods(
        self,
        game_domain: str,
        search_term: str,
        sort_by: str = "endorsements",
        offset: int = 0,
    ) -> list[dict]:
        """Search for mods by name on Nexus Mods.

        Uses the v2 GraphQL API with the correct variable-based filter format.
        Key details verified against the live API:
        - Filter must be passed as a $filter: ModsFilter variable (not inline)
        - Each filter field is an array of {value, op} objects
        - WILDCARD operator does partial matching automatically (do NOT wrap in *)
        - Sort must be a list of sort objects
        - Field is 'endorsements' not 'endorsements'

        Args:
            game_domain: Nexus game domain slug (e.g. "skyrimspecialedition")
            search_term: Search query (do NOT wrap in asterisks)
            sort_by: Sort order — "endorsements" (default), "updated", or "name"
            offset: Pagination offset
        """
        sort_var = self._SORT_MAP.get(sort_by, self._SORT_MAP["endorsements"])

        variables = {
            "filter": {
                "gameDomainName": [{"value": game_domain, "op": "EQUALS"}],
                "name": [{"value": search_term, "op": "WILDCARD"}],
            },
            "sort": sort_var,
            "offset": offset,
            "count": 20,
        }

        result = await self._query(self._SEARCH_QUERY, variables)
        data = result.get("data") or {}
        mods_data = data.get("mods") or {}
        nodes = mods_data.get("nodes") or []
        total = mods_data.get("totalCount", 0)

        if not nodes:
            logger.info(
                "Nexus search returned 0 results: game=%s query=%r sort=%s",
                game_domain, search_term, sort_by,
            )
        else:
            logger.debug(
                "Nexus search: game=%s query=%r → %d results (total: %d)",
                game_domain, search_term, len(nodes), total,
            )

        return nodes

    async def get_game_id(self, game_domain: str) -> int:
        """Resolve a game domain slug to its numeric game ID.

        Results are cached in-memory — only 2 games are supported so this
        is at most 2 queries over the lifetime of the process.
        """
        if game_domain in self._game_id_cache:
            return self._game_id_cache[game_domain]

        query = """
        query GetGameId($domain: String!) {
            game(domainName: $domain) { id }
        }
        """
        result = await self._query(query, {"domain": game_domain})
        game_id = int((result.get("data") or {}).get("game", {}).get("id", 0))
        if game_id:
            self._game_id_cache[game_domain] = game_id
        return game_id

    async def get_mod_details(self, game_domain: str, mod_id: int) -> dict | None:
        """Get full mod details including description HTML and structured requirements.

        Uses the mod(gameId, modId) query which exposes modRequirements —
        structured dependency data not available via the gameDomainName variant.
        """
        game_id = await self.get_game_id(game_domain)
        if not game_id:
            logger.warning("Could not resolve game_id for domain %s", game_domain)
            return None

        query = """
        query GetModDetails($gameId: ID!, $modId: ID!) {
            mod(gameId: $gameId, modId: $modId) {
                modId
                name
                summary
                description
                author
                version
                endorsements
                modCategory { name }
                createdAt
                updatedAt
                modRequirements {
                    nexusRequirements(offset: 0, count: 20) {
                        nodes {
                            modId
                            modName
                            notes
                            url
                        }
                        totalCount
                    }
                    modsRequiringThisMod(offset: 0, count: 10) {
                        nodes {
                            modId
                            modName
                            notes
                        }
                        totalCount
                    }
                }
            }
        }
        """
        result = await self._query(query, {
            "gameId": str(game_id),
            "modId": str(mod_id),
        })
        data = result.get("data") or {}
        return data.get("mod")

    async def get_mod_files(self, game_domain: str, mod_id: int) -> list[dict]:
        """Get available files for a mod.

        The v2 GraphQL modFiles field takes gameId (numeric) and modId directly
        and returns a flat list (not a paginated connection).
        """
        game_id = await self.get_game_id(game_domain)
        if not game_id:
            logger.warning("Could not resolve game_id for domain %s", game_domain)
            return []

        query = """
        query GetModFiles($gameId: ID!, $modId: ID!) {
            modFiles(gameId: $gameId, modId: $modId) {
                fileId
                name
                version
                sizeInBytes
                primary
            }
        }
        """
        result = await self._query(query, {
            "gameId": str(game_id),
            "modId": str(mod_id),
        })
        data = result.get("data") or {}
        files = data.get("modFiles")
        return files if isinstance(files, list) else []

