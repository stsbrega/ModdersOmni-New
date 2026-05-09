import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type Game = 'skyrim' | 'fallout4';

const FILES = ['modding_common', 'skyrim', 'fallout4', 'compatibility_guidelines'] as const;

/**
 * KnowledgeService — TS port of `backend/app/knowledge/resolver.py`.
 *
 * Loads phase-aware methodology markdown at app startup and exposes
 * `resolveForPhase(game, phase)` which concatenates the universal
 * `modding_common` sections with the game-specific sections relevant to
 * the requested phase.
 *
 * The maps below mirror the placeholder Python `PHASE_SECTIONS` dict.
 * NOTE: the actual section names in the bundled markdown files use a
 * different convention (phase-numbered tags like `phase_1_essentials`
 * and content-themed tags like `animation_framework`). A follow-up
 * task is required to either translate phase keys to numeric IDs and
 * align the maps to the real tag names, or to change the resolveForPhase
 * signature to accept a phase number like the Python resolver does.
 */
@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly http = inject(HttpClient);
  private readonly sections = new Map<string, string>(); // sectionName -> content
  private readonly readyState = signal(false);
  private readyPromise: Promise<void>;

  // Map phase to section names from modding_common.md.
  private readonly phaseSectionsCommon: Record<string, string[]> = {
    essentials: ['modding_common', 'phase_essentials'],
    ui: ['modding_common', 'phase_ui'],
    textures: ['modding_common', 'phase_textures'],
    gameplay: ['modding_common', 'phase_gameplay'],
    combat: ['modding_common', 'phase_combat'],
    environment: ['modding_common', 'phase_environment'],
    quests: ['modding_common', 'phase_quests'],
    audio: ['modding_common', 'phase_audio'],
    creatures: ['modding_common', 'phase_creatures'],
    compatibility_patches: ['modding_common', 'phase_compatibility_patches'],
  };

  // Map phase to section names from <game>.md.
  private readonly phaseSectionsByGame: Record<Game, Record<string, string[]>> = {
    skyrim: {
      essentials: ['skyrim_essentials'],
      ui: ['skyrim_ui'],
      textures: ['skyrim_textures'],
      gameplay: ['skyrim_gameplay'],
      combat: ['skyrim_combat'],
      environment: ['skyrim_environment'],
      quests: ['skyrim_quests'],
      audio: ['skyrim_audio'],
      creatures: ['skyrim_creatures'],
      compatibility_patches: ['skyrim_compatibility_patches'],
    },
    fallout4: {
      essentials: ['fallout4_essentials'],
      ui: ['fallout4_ui'],
      textures: ['fallout4_textures'],
      gameplay: ['fallout4_gameplay'],
      combat: ['fallout4_combat'],
      environment: ['fallout4_environment'],
      quests: ['fallout4_quests'],
      audio: ['fallout4_audio'],
      creatures: ['fallout4_creatures'],
      compatibility_patches: ['fallout4_compatibility_patches'],
    },
  };

  constructor() {
    this.readyPromise = this.loadAll();
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  isReady(): boolean {
    return this.readyState();
  }

  resolveForPhase(game: Game, phase: string): string {
    if (!this.readyState()) {
      throw new Error('KnowledgeService not yet ready — await ready() first');
    }
    const commonNames = this.phaseSectionsCommon[phase] ?? ['modding_common'];
    const gameNames = this.phaseSectionsByGame[game]?.[phase] ?? [];
    const parts: string[] = [];
    for (const name of [...commonNames, ...gameNames]) {
      const content = this.sections.get(name);
      if (content) parts.push(content);
    }
    return parts.join('\n\n');
  }

  private async loadAll(): Promise<void> {
    const responses = await Promise.all(
      FILES.map((f) =>
        firstValueFrom(this.http.get(`/knowledge/${f}.md`, { responseType: 'text' })),
      ),
    );
    for (const text of responses) {
      this.parseSections(text);
    }
    this.readyState.set(true);
  }

  private parseSections(markdown: string): void {
    const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      const [, name, content] = m;
      this.sections.set(name, content.trim());
    }
  }
}
