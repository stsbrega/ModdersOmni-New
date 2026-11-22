// Bundled static data. esbuild inlines .md as text and .json as objects,
// so the same bundle runs on Node (stdio) and Cloudflare Workers.
import games from '../data/games.json';
import playstyles from '../data/playstyles.json';
import phasesSkyrim from '../data/build-phases.skyrim.json';
import phasesFallout4 from '../data/build-phases.fallout4.json';
import compatSkyrim from '../data/compatibility.skyrim.json';
import compatFallout4 from '../data/compatibility.fallout4.json';
import skyrimMd from '../data/skyrim.md';
import fallout4Md from '../data/fallout4.md';
import compatMd from '../data/compatibility_guidelines.md';
import commonMd from '../data/modding_common.md';
import { KnowledgeBase } from './knowledge.js';
import type { BuildPhase, CompatRule, GameInfo, GameSlug, Playstyle } from './types.js';

export const GAMES: GameInfo[] = (games as Array<Omit<GameInfo, 'versions'> & { versions?: string[] }>).map((g) => ({
  name: g.name,
  slug: g.slug as GameSlug,
  nexus_domain: g.nexus_domain,
  versions: g.versions ?? [],
}));

export const PLAYSTYLES = playstyles as Record<GameSlug, Playstyle[]>;

export const PHASES: Record<GameSlug, BuildPhase[]> = {
  skyrimse: phasesSkyrim as BuildPhase[],
  fallout4: phasesFallout4 as BuildPhase[],
};

function toRules(rows: unknown): CompatRule[] {
  return (rows as string[][]).map(([mod_a, mod_b, kind, note]) => ({ mod_a, mod_b, kind, note }));
}

export const COMPAT_RULES: Record<GameSlug, CompatRule[]> = {
  skyrimse: toRules(compatSkyrim),
  fallout4: toRules(compatFallout4),
};

export const KNOWLEDGE_FILES: Record<string, string> = {
  'skyrim.md': skyrimMd,
  'fallout4.md': fallout4Md,
  'compatibility_guidelines.md': compatMd,
  'modding_common.md': commonMd,
};

export const knowledge = new KnowledgeBase(KNOWLEDGE_FILES);

/** Accepts slug, Nexus domain, or a loose name ("skyrim", "fo4"). */
export function resolveGame(input: string): GameInfo | null {
  const s = input.trim().toLowerCase();
  const direct = GAMES.find((g) => g.slug === s || g.nexus_domain === s);
  if (direct) return direct;
  if (/skyrim|tes ?v|sse|\bae\b/.test(s)) return GAMES.find((g) => g.slug === 'skyrimse') ?? null;
  if (/fallout|fo4|\bf4\b/.test(s)) return GAMES.find((g) => g.slug === 'fallout4') ?? null;
  return null;
}

export function resolvePlaystyle(game: GameSlug, input: string | null | undefined): Playstyle | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  const list = PLAYSTYLES[game] ?? [];
  return list.find((p) => p.slug === s || p.name.toLowerCase() === s) ?? null;
}
