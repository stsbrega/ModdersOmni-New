/**
 * Nexus Mods v2 GraphQL client (fetch-based, runs on Node and Workers).
 *
 * Reads are unauthenticated per Nexus's public-facing app policy — never add
 * a personal API key or Authorization header here.
 */

const NEXUS_URL = 'https://api.nexusmods.com/v2/graphql';
const APPLICATION_NAME = 'ModdersOmni';
const APPLICATION_VERSION = '3.0.0';

const SORT_MAP: Record<string, Array<Record<string, { direction: 'ASC' | 'DESC' }>>> = {
  endorsements: [{ endorsements: { direction: 'DESC' } }],
  downloads: [{ downloads: { direction: 'DESC' } }],
  updated: [{ updatedAt: { direction: 'DESC' } }],
  name: [{ name: { direction: 'ASC' } }],
};
export type NexusSort = 'endorsements' | 'downloads' | 'updated' | 'name';

const SEARCH_QUERY = `
query SearchMods($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
  mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    nodes { modId name summary author version endorsements downloads fileSize
            modCategory { name } updatedAt thumbnailUrl }
    totalCount
  }
}`;

const GAME_ID_QUERY = `query GetGameId($domain: String!) { game(domainName: $domain) { id } }`;

const MOD_DETAILS_QUERY = `
query GetModDetails($gameId: ID!, $modId: ID!) {
  mod(gameId: $gameId, modId: $modId) {
    modId name summary description author version endorsements downloads
    modCategory { name } createdAt updatedAt pictureUrl thumbnailUrl
    modRequirements {
      nexusRequirements(offset: 0, count: 20) { nodes { modId modName notes url } totalCount }
      modsRequiringThisMod(offset: 0, count: 20) { nodes { modId modName notes } totalCount }
    }
  }
}`;

const MOD_FILES_QUERY = `
query GetModFiles($gameId: ID!, $modId: ID!) {
  modFiles(gameId: $gameId, modId: $modId) { fileId name version sizeInBytes primary category }
}`;

export interface NexusModSummary {
  modId: number;
  name: string;
  summary?: string | null;
  author?: string | null;
  version?: string | null;
  endorsements?: number | null;
  downloads?: number | null;
  /** KB, as reported by Nexus. */
  fileSize?: number | null;
  modCategory?: { name: string } | null;
  updatedAt?: string | null;
  thumbnailUrl?: string | null;
}

export interface NexusRequirementNode {
  modId: number | string;
  modName?: string | null;
  notes?: string | null;
  url?: string | null;
}

export interface NexusModDetails extends NexusModSummary {
  description?: string | null;
  createdAt?: string | null;
  pictureUrl?: string | null;
  modRequirements?: {
    nexusRequirements?: { nodes: NexusRequirementNode[]; totalCount: number };
    modsRequiringThisMod?: { nodes: NexusRequirementNode[]; totalCount: number };
  } | null;
}

export interface NexusModFile {
  fileId: number;
  name: string;
  version?: string | null;
  sizeInBytes?: number | string | null;
  primary: boolean | number;
  category?: string | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class NexusClient {
  private readonly gameIdCache = new Map<string, number>();
  private readonly cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
    private readonly cacheTtlMs = 10 * 60 * 1000,
  ) {}

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
    const key = JSON.stringify([query.length, variables]);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.value as T;

    const res = await this.fetchImpl(NEXUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Application-Name': APPLICATION_NAME,
        'Application-Version': APPLICATION_VERSION,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Nexus HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T | null; errors?: Array<{ message?: string }> };
    if (json.errors?.length) {
      throw new Error(`Nexus GraphQL errors: ${json.errors.map((e) => e.message ?? 'Unknown error').join('; ')}`);
    }
    const value = json.data ?? null;
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Name search. WILDCARD matches partial titles — don't wrap in asterisks. */
  async searchMods(gameDomain: string, term: string, sortBy: NexusSort = 'endorsements', offset = 0, count = 20) {
    const data = await this.query<{ mods: { nodes: NexusModSummary[]; totalCount: number } | null }>(SEARCH_QUERY, {
      filter: {
        gameDomainName: [{ value: gameDomain, op: 'EQUALS' }],
        name: [{ value: term, op: 'WILDCARD' }],
      },
      sort: SORT_MAP[sortBy] ?? SORT_MAP.endorsements,
      offset,
      count,
    });
    return { nodes: data?.mods?.nodes ?? [], total: data?.mods?.totalCount ?? 0 };
  }

  async getGameId(gameDomain: string): Promise<number> {
    const cached = this.gameIdCache.get(gameDomain);
    if (cached) return cached;
    const data = await this.query<{ game: { id: string | number } | null }>(GAME_ID_QUERY, { domain: gameDomain });
    const id = data?.game?.id != null ? Number.parseInt(String(data.game.id), 10) : 0;
    if (id) this.gameIdCache.set(gameDomain, id);
    return id || 0;
  }

  async getMod(gameDomain: string, modId: number): Promise<NexusModDetails | null> {
    const gameId = await this.getGameId(gameDomain);
    if (!gameId) return null;
    const data = await this.query<{ mod: NexusModDetails | null }>(MOD_DETAILS_QUERY, {
      gameId: String(gameId),
      modId: String(modId),
    });
    return data?.mod ?? null;
  }

  async getModFiles(gameDomain: string, modId: number): Promise<NexusModFile[]> {
    const gameId = await this.getGameId(gameDomain);
    if (!gameId) return [];
    const data = await this.query<{ modFiles: NexusModFile[] | null }>(MOD_FILES_QUERY, {
      gameId: String(gameId),
      modId: String(modId),
    });
    return Array.isArray(data?.modFiles) ? data!.modFiles! : [];
  }

  /** Primary (or MAIN, or first) file id + size. Never throws. */
  async resolvePrimaryFile(gameDomain: string, modId: number): Promise<{ fileId: number | null; sizeBytes: number | null }> {
    try {
      const files = await this.getModFiles(gameDomain, modId);
      if (!files.length) return { fileId: null, sizeBytes: null };
      const pick =
        files.find((f) => Boolean(f.primary)) ??
        files.find((f) => (f.category ?? '').toUpperCase() === 'MAIN') ??
        files[0];
      const fileId = Number(pick.fileId);
      const size = pick.sizeInBytes != null ? Number(pick.sizeInBytes) : NaN;
      return {
        fileId: Number.isFinite(fileId) && fileId > 0 ? fileId : null,
        sizeBytes: Number.isFinite(size) ? size : null,
      };
    } catch {
      return { fileId: null, sizeBytes: null };
    }
  }
}

/** Nexus description HTML/BBCode → readable plain text. */
export function stripHtml(html: string, maxLength = 5000): string {
  if (!html || !html.trim()) return '';
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\[\/?[a-z]+(=[^\]]*)?\]/gi, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  text = text.replace(/[ \t]{2,}/g, ' ').trim();
  if (text.length > maxLength) text = text.slice(0, maxLength) + '\n\n... [truncated]';
  return text;
}

export function nexusModUrl(gameDomain: string, modId: number): string {
  return `https://www.nexusmods.com/${gameDomain}/mods/${modId}`;
}
