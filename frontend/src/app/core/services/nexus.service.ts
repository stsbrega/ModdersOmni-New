import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Nexus Mods v2 GraphQL client — TS port of backend/app/services/nexus_client.py.
 *
 * "Why" notes (under the hood):
 * - Reads (search, mod details, mod files) are unauthenticated per Nexus's
 *   public-facing app policy. No personal API key, no Authorization header.
 * - The Python client uses a process-wide asyncio.Semaphore(8) to cap fan-out.
 *   We don't replicate that here — the browser already enforces ~6 connections
 *   per origin, and the pipeline runs one phase at a time per user.
 * - `getMod` / `getModFiles` need a numeric gameId, but callers pass a domain
 *   slug ("skyrimspecialedition"). We resolve slug → id once per process and
 *   cache it (only 2 games are supported, so ≤2 lookups for the lifetime of
 *   the tab).
 */

const NEXUS_URL = 'https://api.nexusmods.com/v2/graphql';
const APPLICATION_NAME = 'ModdersOmni';
const APPLICATION_VERSION = '1.0.0';

// Map friendly sort names to GraphQL sort variable objects (mirrors _SORT_MAP).
const SORT_MAP: Record<string, Array<Record<string, { direction: 'ASC' | 'DESC' }>>> = {
  endorsements: [{ endorsements: { direction: 'DESC' } }],
  updated: [{ updatedAt: { direction: 'DESC' } }],
  name: [{ name: { direction: 'ASC' } }],
};

// Verified working query — uses typed variables ($filter: ModsFilter) instead
// of interpolating scalar variables into inline filter objects. Confirmed
// against live API: this format returns results.
const SEARCH_QUERY = `
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
    `;

const GAME_ID_QUERY = `
        query GetGameId($domain: String!) {
            game(domainName: $domain) { id }
        }
        `;

const MOD_DETAILS_QUERY = `
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
        `;

const MOD_FILES_QUERY = `
        query GetModFiles($gameId: ID!, $modId: ID!) {
            modFiles(gameId: $gameId, modId: $modId) {
                fileId
                name
                version
                sizeInBytes
                primary
            }
        }
        `;

// ---------------------------------------------------------------------------
// Response shape interfaces — match the GraphQL field names exactly.
// ---------------------------------------------------------------------------

export interface NexusModSummary {
  modId: number;
  name: string;
  summary?: string | null;
  author?: string | null;
  version?: string | null;
  endorsements?: number | null;
  modCategory?: { name: string } | null;
  updatedAt?: string | null;
}

export interface NexusModRequirementNode {
  modId: number;
  modName?: string | null;
  notes?: string | null;
  url?: string | null;
}

export interface NexusModRequirements {
  nexusRequirements?: {
    nodes: NexusModRequirementNode[];
    totalCount: number;
  };
  modsRequiringThisMod?: {
    nodes: NexusModRequirementNode[];
    totalCount: number;
  };
}

export interface NexusModDetails extends NexusModSummary {
  description?: string | null;
  createdAt?: string | null;
  modRequirements?: NexusModRequirements | null;
}

export interface NexusModFile {
  fileId: number;
  name: string;
  version?: string | null;
  sizeInBytes?: number | null;
  primary: boolean;
}

interface GraphQLError {
  message?: string;
  [key: string]: unknown;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: GraphQLError[];
}

@Injectable({ providedIn: 'root' })
export class NexusService {
  private readonly http = inject(HttpClient);

  // In-memory cache: game_domain -> game_id. Mirrors Python's class-level
  // `_game_id_cache` — only 2 games supported, so this is at most 2 entries
  // for the lifetime of the SPA.
  private readonly gameIdCache = new Map<string, number>();

  /**
   * Execute a GraphQL query and return the parsed response.
   * Throws Error with the same `Nexus GraphQL errors: msg1; msg2` format as
   * Python's NexusAPIError when the response contains GraphQL-level errors.
   */
  private async query<T>(query: string, variables: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Application-Name': APPLICATION_NAME,
      'Application-Version': APPLICATION_VERSION,
    });
    const body = { query, variables };
    const result = await firstValueFrom(
      this.http.post<GraphQLResponse<T>>(NEXUS_URL, body, { headers }),
    );

    if (result?.errors && result.errors.length > 0) {
      const messages = result.errors
        .map((e) => e.message ?? 'Unknown error')
        .join('; ');
      // Match Python's NexusAPIError message verbatim so log scraping stays
      // consistent across the stack.
      throw new Error(`Nexus GraphQL errors: ${messages}`);
    }

    return result ?? {};
  }

  /**
   * Search for mods by name on Nexus Mods.
   *
   * Mirrors `nexus_client.search_mods`. Key details verified against the
   * live API:
   * - Filter must be passed as a $filter: ModsFilter variable (not inline).
   * - Each filter field is an array of {value, op} objects.
   * - WILDCARD operator does partial matching automatically — do NOT wrap
   *   the search term in asterisks.
   * - Sort must be a list of sort objects.
   *
   * @param gameDomain Nexus game domain slug (e.g. "skyrimspecialedition")
   * @param searchTerm Search query (do NOT wrap in asterisks)
   * @param sortBy `endorsements` (default), `updated`, or `name`
   * @param offset Pagination offset
   */
  async searchMods(
    gameDomain: string,
    searchTerm: string,
    sortBy: 'endorsements' | 'updated' | 'name' = 'endorsements',
    offset = 0,
  ): Promise<NexusModSummary[]> {
    const sortVar = SORT_MAP[sortBy] ?? SORT_MAP['endorsements'];

    const variables = {
      filter: {
        gameDomainName: [{ value: gameDomain, op: 'EQUALS' }],
        name: [{ value: searchTerm, op: 'WILDCARD' }],
      },
      sort: sortVar,
      offset,
      count: 20,
    };

    const result = await this.query<{
      mods: { nodes: NexusModSummary[]; totalCount: number } | null;
    }>(SEARCH_QUERY, variables);

    const modsData = result.data?.mods;
    return modsData?.nodes ?? [];
  }

  /**
   * Resolve a game domain slug to its numeric game ID.
   * Cached in-memory — only 2 games supported, so at most 2 queries per tab.
   *
   * Returns 0 if the domain cannot be resolved (caller should treat that
   * as an error and bail out, just like the Python client does).
   */
  async getGameId(gameDomain: string): Promise<number> {
    const cached = this.gameIdCache.get(gameDomain);
    if (cached !== undefined) {
      return cached;
    }

    const result = await this.query<{ game: { id: string | number } | null }>(
      GAME_ID_QUERY,
      { domain: gameDomain },
    );
    const rawId = result.data?.game?.id;
    // Nexus returns ID! as a string. Coerce to int (mirrors Python's `int(...)`).
    const gameId = rawId != null ? Number.parseInt(String(rawId), 10) : 0;
    if (gameId) {
      this.gameIdCache.set(gameDomain, gameId);
    }
    return gameId || 0;
  }

  /**
   * Get full mod details including description HTML and structured requirements.
   *
   * Uses the `mod(gameId, modId)` query which exposes `modRequirements` —
   * structured dependency data not available via the gameDomainName variant.
   *
   * Note: this issues TWO HTTP requests on the first call per game domain
   * (game ID resolution + mod fetch). Subsequent calls only issue one.
   */
  async getMod(gameDomain: string, modId: number): Promise<NexusModDetails | null> {
    const gameId = await this.getGameId(gameDomain);
    if (!gameId) {
      return null;
    }

    const result = await this.query<{ mod: NexusModDetails | null }>(
      MOD_DETAILS_QUERY,
      {
        // Both passed as strings — GraphQL ID! scalar is string-typed in the
        // wire format even though the server understands it as numeric.
        gameId: String(gameId),
        modId: String(modId),
      },
    );
    return result.data?.mod ?? null;
  }

  /**
   * Get available files for a mod.
   *
   * The v2 GraphQL `modFiles` field takes gameId (numeric) and modId directly
   * and returns a flat list (not a paginated connection).
   *
   * Used by the modlist generation pipeline to resolve a mod's primary file_id
   * before adding it to the modlist (see backend handlers.py).
   */
  async getModFiles(gameDomain: string, modId: number): Promise<NexusModFile[]> {
    const gameId = await this.getGameId(gameDomain);
    if (!gameId) {
      return [];
    }

    const result = await this.query<{ modFiles: NexusModFile[] | null }>(
      MOD_FILES_QUERY,
      {
        gameId: String(gameId),
        modId: String(modId),
      },
    );
    const files = result.data?.modFiles;
    return Array.isArray(files) ? files : [];
  }
}
