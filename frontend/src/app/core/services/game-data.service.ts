import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Game, Playstyle } from '../../shared/models/game.model';

/**
 * GameDataService — replaces the deleted ApiService game/playstyle endpoints
 * with static JSON loaded from `frontend/public/data/`.
 *
 * Why a service (vs. a const): the JSON is fetched lazily from the public
 * folder so we don't bundle it into the main chunk; HTTP cached after first
 * load. Synthetic numeric `id` fields are assigned client-side because the
 * backend's serial-from-Postgres ids no longer exist — components that key
 * off `Game.id` / `Playstyle.id` (e.g. the wizard) keep working unchanged.
 *
 * The id derivation matches the deterministic order of the JSON files:
 *   games.json[0]     → id 1   (Skyrim Special Edition)
 *   games.json[1]     → id 2   (Fallout 4)
 *   playstyles.skyrimse[i] → id 100 + i
 *   playstyles.fallout4[i] → id 200 + i
 *
 * In-memory caches mean only ONE fetch per file, per tab.
 */

interface GamesPayload {
  name: string;
  slug: string;
  nexus_domain: string;
  image_url?: string | null;
  versions?: string[];
}

interface PlaystylePayload {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

@Injectable({ providedIn: 'root' })
export class GameDataService {
  private readonly http = inject(HttpClient);

  private gamesCache: Game[] | null = null;
  private playstylesCache = new Map<number, Playstyle[]>();

  /** Returns the list of supported games with synthetic 1-based IDs. */
  async getGames(): Promise<Game[]> {
    if (this.gamesCache) return this.gamesCache;
    const raw = await firstValueFrom(this.http.get<GamesPayload[]>('/data/games.json'));
    this.gamesCache = (raw ?? []).map((g, idx) => ({
      id: idx + 1,
      name: g.name,
      slug: g.slug,
      nexus_domain: g.nexus_domain,
      image_url: g.image_url ?? undefined,
      versions: g.versions,
    }));
    return this.gamesCache;
  }

  /** Returns playstyles for a game by synthetic id (matches getGames()). */
  async getPlaystyles(gameId: number): Promise<Playstyle[]> {
    const cached = this.playstylesCache.get(gameId);
    if (cached) return cached;

    const games = await this.getGames();
    const game = games.find((g) => g.id === gameId);
    if (!game) return [];

    const all = await firstValueFrom(
      this.http.get<Record<string, PlaystylePayload[]>>('/data/playstyles.json'),
    );
    const list = all?.[game.slug] ?? [];
    // ID base: skyrimse=100, fallout4=200, etc — derived from the game id
    // so we never collide across games and the dispatcher can reverse-look-up.
    const idBase = gameId * 100;
    const playstyles: Playstyle[] = list.map((p, idx) => ({
      id: idBase + idx,
      game_id: gameId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      icon: p.icon,
    }));
    this.playstylesCache.set(gameId, playstyles);
    return playstyles;
  }
}
