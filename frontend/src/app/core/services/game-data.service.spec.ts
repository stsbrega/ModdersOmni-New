import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameDataService } from './game-data.service';

describe('GameDataService', () => {
  let svc: GameDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(GameDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const games = [
    { name: 'Skyrim SE', slug: 'skyrimse', nexus_domain: 'skyrimspecialedition', image_url: null },
    { name: 'Fallout 4', slug: 'fallout4', nexus_domain: 'fallout4', versions: ['1.10'] },
  ];

  it('assigns 1-based ids and fetches games once', async () => {
    const p = svc.getGames();
    http.expectOne('/data/games.json').flush(games);
    const result = await p;
    expect(result.map((g) => g.id)).toEqual([1, 2]);
    expect(result[0].image_url).toBeUndefined();
    expect(result[1].versions).toEqual(['1.10']);
    expect(await svc.getGames()).toBe(result);
  });

  it('derives playstyle ids from the game id and caches them', async () => {
    const p = svc.getPlaystyles(2);
    await Promise.resolve();
    http.expectOne('/data/games.json').flush(games);
    await new Promise((r) => setTimeout(r));
    http.expectOne('/data/playstyles.json').flush({
      skyrimse: [{ name: 'A', slug: 'a' }],
      fallout4: [
        { name: 'B', slug: 'b' },
        { name: 'C', slug: 'c' },
      ],
    });
    const result = await p;
    expect(result.map((x) => x.id)).toEqual([200, 201]);
    expect(result.every((x) => x.game_id === 2)).toBeTrue();
    expect(await svc.getPlaystyles(2)).toBe(result);
  });

  it('returns [] for an unknown game id', async () => {
    const p = svc.getPlaystyles(99);
    await Promise.resolve();
    http.expectOne('/data/games.json').flush(games);
    expect(await p).toEqual([]);
  });
});
