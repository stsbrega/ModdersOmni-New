import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { NexusService } from './nexus.service';

/**
 * Faithfully mirrors backend/app/services/nexus_client.py.
 *
 * Key facts (verified against the Python ground truth):
 * - Endpoint: https://api.nexusmods.com/v2/graphql
 * - Search uses `mods(filter: $filter, sort: $sort, ...)` NOT `search(...)`.
 * - Filter is a typed ModsFilter variable with `gameDomainName` + `name` arrays
 *   of {value, op} objects — the WILDCARD op does partial matching natively.
 * - `getMod` requires resolving the numeric gameId FIRST (separate query),
 *   then calling `mod(gameId, modId)`. That means two HTTP requests on cold
 *   cache; one on warm cache.
 * - Headers: Application-Name + Application-Version (no Authorization for
 *   unauthenticated reads).
 * - GraphQL-level errors (response.errors[]) raise an Error with message
 *   format `Nexus GraphQL errors: msg1; msg2` — matches Python's NexusAPIError.
 */
const NEXUS_URL = 'https://api.nexusmods.com/v2/graphql';

/**
 * Drain enough microtasks to let an awaiting `firstValueFrom(http.post(...))`
 * resolve and the subsequent `await this.query(...)` step queue + fire its
 * next HTTP request. Empirically, the HttpClient → rxjs → async/await chain
 * needs several ticks; 8 is overkill but cheap.
 */
async function drainMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('NexusService', () => {
  let svc: NexusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(NexusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ---------------------------------------------------------------------------
  // searchMods
  // ---------------------------------------------------------------------------
  it('searchMods POSTs the typed-variable mods() query with WILDCARD filter', async () => {
    const promise = svc.searchMods('skyrimspecialedition', 'SkyUI');
    const req = http.expectOne(NEXUS_URL);

    expect(req.request.method).toBe('POST');
    // Query string must use the `mods(filter: $filter, ...)` form — not `search(...)`.
    expect(req.request.body.query).toContain('mods(filter: $filter');
    expect(req.request.body.query).toContain('totalCount');

    // Filter shape mirrors Python's variables exactly.
    const vars = req.request.body.variables;
    expect(vars.filter.gameDomainName).toEqual([
      { value: 'skyrimspecialedition', op: 'EQUALS' },
    ]);
    expect(vars.filter.name).toEqual([{ value: 'SkyUI', op: 'WILDCARD' }]);
    expect(vars.sort).toEqual([{ endorsements: { direction: 'DESC' } }]);
    expect(vars.offset).toBe(0);
    expect(vars.count).toBe(20);

    // Application-Name / Application-Version headers from Python _headers().
    expect(req.request.headers.get('Application-Name')).toBe('ModdersOmni');
    expect(req.request.headers.get('Application-Version')).toBe('1.0.0');

    req.flush({
      data: {
        mods: {
          nodes: [
            {
              modId: 12345,
              name: 'SkyUI',
              summary: 'UI overhaul',
              author: 'SkyUI Team',
              version: '5.2',
              endorsements: 200000,
              modCategory: { name: 'User Interface' },
              updatedAt: '2017-01-01T00:00:00Z',
            },
          ],
          totalCount: 1,
        },
      },
    });

    const result = await promise;
    expect(result.length).toBe(1);
    expect(result[0].modId).toBe(12345);
    expect(result[0].name).toBe('SkyUI');
  });

  it('searchMods supports updated/name sort_by aliases', async () => {
    const promise = svc.searchMods('skyrimspecialedition', 'mod', 'updated');
    const req = http.expectOne(NEXUS_URL);
    expect(req.request.body.variables.sort).toEqual([
      { updatedAt: { direction: 'DESC' } },
    ]);
    req.flush({ data: { mods: { nodes: [], totalCount: 0 } } });
    await promise;
  });

  it('searchMods returns [] when data.mods is null', async () => {
    const promise = svc.searchMods('skyrimspecialedition', 'nope');
    const req = http.expectOne(NEXUS_URL);
    req.flush({ data: { mods: null } });
    expect(await promise).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // getMod — two HTTP calls on cold cache
  //
  // The test must `await` a microtask between the first flush() and the
  // second expectOne(): flushing a request resolves the awaiting Promise
  // microtask-asynchronously, so the chained second http.post() hasn't been
  // issued yet at the moment the test thread continues.
  // ---------------------------------------------------------------------------
  it('getMod resolves gameId first, then calls mod(gameId, modId)', async () => {
    const promise = svc.getMod('skyrimspecialedition', 12345);

    // First request: game(domainName) → numeric ID. Nexus returns ID! as string.
    const gameReq = http.expectOne(NEXUS_URL);
    expect(gameReq.request.body.query).toContain('game(domainName: $domain)');
    expect(gameReq.request.body.variables).toEqual({
      domain: 'skyrimspecialedition',
    });
    gameReq.flush({ data: { game: { id: '1704' } } });
    await drainMicrotasks(); // let the awaiting query() resolve & fire next request

    // Second request: mod(gameId, modId) — both passed as strings (ID! scalar).
    const modReq = http.expectOne(NEXUS_URL);
    expect(modReq.request.body.query).toContain('mod(gameId: $gameId, modId: $modId)');
    expect(modReq.request.body.query).toContain('modRequirements');
    expect(modReq.request.body.variables).toEqual({
      gameId: '1704',
      modId: '12345',
    });
    modReq.flush({
      data: {
        mod: {
          modId: 12345,
          name: 'SkyUI',
          summary: 'UI overhaul',
          description: '<p>desc</p>',
          author: 'SkyUI Team',
          version: '5.2',
          endorsements: 200000,
          modCategory: { name: 'User Interface' },
          createdAt: '2012-01-01T00:00:00Z',
          updatedAt: '2017-01-01T00:00:00Z',
          modRequirements: {
            nexusRequirements: { nodes: [], totalCount: 0 },
            modsRequiringThisMod: { nodes: [], totalCount: 0 },
          },
        },
      },
    });

    const mod = await promise;
    expect(mod).not.toBeNull();
    expect(mod!.modId).toBe(12345);
    expect(mod!.name).toBe('SkyUI');
  });

  it('getMod uses cached gameId on subsequent calls (1 HTTP request)', async () => {
    // Prime cache with an initial getMod call.
    const first = svc.getMod('skyrimspecialedition', 1);
    http.expectOne(NEXUS_URL).flush({ data: { game: { id: '1704' } } });
    await drainMicrotasks();
    http.expectOne(NEXUS_URL).flush({ data: { mod: { modId: 1, name: 'A' } } });
    await first;

    // Second call should skip the game() lookup — only ONE request fires.
    // Even cached, the awaited getGameId resolution costs a microtask hop
    // before the chained http.post() is scheduled.
    const promise = svc.getMod('skyrimspecialedition', 2);
    await drainMicrotasks();
    const modReq = http.expectOne(NEXUS_URL);
    expect(modReq.request.body.query).toContain('mod(gameId: $gameId, modId: $modId)');
    modReq.flush({ data: { mod: { modId: 2, name: 'B' } } });

    http.expectNone(NEXUS_URL);
    const mod = await promise;
    expect(mod!.modId).toBe(2);
  });

  it('getMod returns null when gameId cannot be resolved', async () => {
    const promise = svc.getMod('not-a-real-game', 12345);
    const gameReq = http.expectOne(NEXUS_URL);
    gameReq.flush({ data: { game: null } });
    // No second request should fire when gameId resolution fails.
    http.expectNone(NEXUS_URL);
    expect(await promise).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // getModFiles — needed by handlers.py to resolve primary file_id
  // ---------------------------------------------------------------------------
  it('getModFiles resolves gameId then queries modFiles(gameId, modId)', async () => {
    const promise = svc.getModFiles('fallout4', 999);

    const gameReq = http.expectOne(NEXUS_URL);
    expect(gameReq.request.body.query).toContain('game(domainName: $domain)');
    gameReq.flush({ data: { game: { id: '1151' } } });
    await drainMicrotasks();

    const filesReq = http.expectOne(NEXUS_URL);
    expect(filesReq.request.body.query).toContain('modFiles(gameId: $gameId, modId: $modId)');
    expect(filesReq.request.body.variables).toEqual({
      gameId: '1151',
      modId: '999',
    });
    filesReq.flush({
      data: {
        modFiles: [
          {
            fileId: 5001,
            name: 'main.7z',
            version: '1.0',
            sizeInBytes: 1234567,
            primary: true,
          },
        ],
      },
    });

    const files = await promise;
    expect(files.length).toBe(1);
    expect(files[0].fileId).toBe(5001);
    expect(files[0].primary).toBe(true);
  });

  it('getModFiles returns [] when modFiles is not a list', async () => {
    const promise = svc.getModFiles('fallout4', 999);
    http.expectOne(NEXUS_URL).flush({ data: { game: { id: '1151' } } });
    await drainMicrotasks();
    http.expectOne(NEXUS_URL).flush({ data: { modFiles: null } });
    expect(await promise).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // GraphQL-level errors
  // ---------------------------------------------------------------------------
  it('throws on GraphQL errors response (matches NexusAPIError message format)', async () => {
    const promise = svc.searchMods('skyrimspecialedition', 'x');
    const req = http.expectOne(NEXUS_URL);
    req.flush({ errors: [{ message: 'rate limited' }] });
    await expectAsync(promise).toBeRejectedWithError(/rate limited/);
  });

  it('joins multiple GraphQL error messages with "; "', async () => {
    const promise = svc.searchMods('skyrimspecialedition', 'x');
    const req = http.expectOne(NEXUS_URL);
    req.flush({
      errors: [{ message: 'first error' }, { message: 'second error' }],
    });
    await expectAsync(promise).toBeRejectedWithError(/first error; second error/);
  });
});
