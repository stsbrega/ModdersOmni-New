import type { GameSlug, GameVersion } from './types.js';

const GAME_FILES: Record<GameSlug, string> = {
  skyrimse: 'skyrim.md',
  fallout4: 'fallout4.md',
};

// Universal files loaded for all games (order matters — first = highest priority).
// Mirrors Python's `_UNIVERSAL_FILES`. NOTE: `modding_common.md` is intentionally
// NOT in this list — the Python resolver does not inject it. The file ships in
// public/knowledge/ for reference but is currently orphaned at the prompt layer.
const UNIVERSAL_FILES: readonly string[] = ['compatibility_guidelines.md'];

interface MethodologySection {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly phases: ReadonlySet<number>;
  readonly isUniversal: boolean;
}

interface GameMethodology {
  readonly universalPrinciples: string;
  readonly sections: readonly MethodologySection[];
}

interface UniversalSection {
  readonly tag: string;
  readonly content: string;
  readonly phases: ReadonlySet<number>; // empty = all phases
}

/**
 * Phase ranges for each XML-tagged section in `compatibility_guidelines.md`.
 * Ported verbatim from `_SECTION_PHASE_MAP` in resolver.py — keep ranges and
 * the `{-1}` sentinel (never-injected) in sync with the Python source.
 */
const SECTION_PHASE_MAP: Record<string, ReadonlySet<number>> = {
  // content + patches (phases 5..13 inclusive)
  mod_type_compatibility_matrix: new Set(rangeInclusive(5, 13)),
  // all content + patches (phases 4..13 inclusive)
  pre_selection_conflict_check: new Set(rangeInclusive(4, 13)),
  // empty = universal (all phases)
  dependency_chain_rules: new Set<number>(),
  conflict_detection_heuristics: new Set(rangeInclusive(5, 13)),
  // patch/late phases only
  patch_discovery_patterns: new Set([11, 12, 13]),
  // content phases (4..10 inclusive)
  quality_signals: new Set(rangeInclusive(4, 10)),
  // engine phases + patches
  cross_game_differences: new Set([1, 2, 3, 11]),
  generation_quality_rules: new Set<number>(),
  // System-config guidance, never inject:
  scale_strategies: new Set([-1]),
  phase_cap_guidelines: new Set([-1]),
};

function rangeInclusive(start: number, endInclusive: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= endInclusive; i++) out.push(i);
  return out;
}

// Matches `<!-- section: id -->` markers (used as a SPLIT delimiter).
const SECTION_MARKER_RE = /<!--\s*section:\s*(\w+)\s*-->/g;
// Matches `<!-- phases: 1, 3, 10 -->`.
const PHASES_RE = /<!--\s*phases:\s*([\d\s,]+)\s*-->/;
// Matches `<!-- universal: true -->` / `<!-- universal: false -->`.
const UNIVERSAL_RE = /<!--\s*universal:\s*(true|false)\s*-->/i;
// Matches `<!-- version_scope: AE -->...<!-- /version_scope -->`. Multi-version
// values may be comma-separated (e.g. `version_scope: AE,Next-Gen`).
const VERSION_SCOPE_RE =
  /<!--\s*version_scope:\s*([\w\-,\s]+?)\s*-->([\s\S]*?)<!--\s*\/version_scope\s*-->/g;
// Matches any `<!-- ... -->` HTML comment EXCEPT version_scope open/close markers.
// Used to scrub metadata comments while preserving version_scope for later filtering.
// JS regex doesn't support negative lookbehind reliably across browsers, so we
// instead explicitly exclude version_scope tokens in the alternation.
function stripMetadataComments(text: string): string {
  return text.replace(/<!--([\s\S]*?)-->/g, (full, inner: string) => {
    const trimmed = inner.trim();
    // Preserve version_scope markers (open and close) for later filtering.
    if (/^\/?\s*version_scope(\s*:\s*[\w\-,\s]+)?\s*$/.test(trimmed)) {
      return full;
    }
    return '';
  });
}

function parsePhases(phasesStr: string): ReadonlySet<number> {
  const out = new Set<number>();
  for (const part of phasesStr.split(',')) {
    const t = part.trim();
    if (/^\d+$/.test(t)) out.add(parseInt(t, 10));
  }
  return out;
}

function parseMethodologyFile(text: string): GameMethodology {
  // Reset regex lastIndex (g-flag regexes are stateful per-instance)
  SECTION_MARKER_RE.lastIndex = 0;

  // Split on `<!-- section: id -->` markers. We replicate Python's
  // `re.split(pattern_with_one_capture_group, text)` which returns
  // [pre, id1, body1, id2, body2, ...].
  const splits: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SECTION_MARKER_RE.exec(text)) !== null) {
    splits.push(text.substring(lastIndex, match.index));
    splits.push(match[1]);
    lastIndex = match.index + match[0].length;
  }
  splits.push(text.substring(lastIndex));

  // splits[0] = content before first section marker (universal principles)
  // splits[1] = first id, splits[2] = first body, splits[3] = second id, ...
  let universalPrinciples = (splits[0] ?? '').trim();
  // Strip metadata comments while preserving version_scope markers.
  universalPrinciples = stripMetadataComments(universalPrinciples).trim();
  // Remove the top-level heading (e.g. "# Skyrim SE/AE Modding Methodology")
  const principleLines = universalPrinciples.split('\n');
  if (principleLines.length > 0 && principleLines[0].startsWith('# ')) {
    principleLines.shift();
  }
  universalPrinciples = principleLines.join('\n').trim();

  const sections: MethodologySection[] = [];
  for (let i = 1; i + 1 < splits.length; i += 2) {
    const sectionId = splits[i];
    const sectionContent = splits[i + 1];

    const phasesMatch = PHASES_RE.exec(sectionContent);
    const universalMatch = UNIVERSAL_RE.exec(sectionContent);

    const phases = phasesMatch ? parsePhases(phasesMatch[1]) : new Set<number>();
    const isUniversal = universalMatch
      ? universalMatch[1].toLowerCase() === 'true'
      : false;

    // Clean content: remove metadata comments, preserving version_scope markers.
    const cleanContent = stripMetadataComments(sectionContent).trim();

    // Extract title from first heading (if present); otherwise fall back to id.
    let title = sectionId;
    const titleMatch = /^#\s+(.+)/.exec(cleanContent);
    if (titleMatch) title = titleMatch[1].trim();

    sections.push({
      id: sectionId,
      title,
      content: cleanContent,
      phases,
      isUniversal,
    });
  }

  return { universalPrinciples, sections };
}

function parseUniversalFile(filename: string, text: string): UniversalSection[] {
  // Strip <system_context>...</system_context> metadata first.
  const stripped = text.replace(
    /<system_context>[\s\S]*?<\/system_context>/g,
    '',
  );
  const out: UniversalSection[] = [];
  // `<tag>(body)</tag>` — same back-reference pattern as Python's `<(\w+)>(.*?)</\1>`.
  const tagRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(stripped)) !== null) {
    const tag = m[1];
    const content = m[2].trim();
    const phases =
      SECTION_PHASE_MAP[tag] ?? (new Set<number>() as ReadonlySet<number>);
    out.push({ tag, content, phases });
  }
  return out;
}

function applyVersionScope(text: string, gameVersion: GameVersion | null): string {
  if (gameVersion === null) {
    // Drop ONLY the open/close marker comments, keep the body.
    return text.replace(/<!--\s*\/?version_scope(?::[^>]*)?\s*-->/g, '');
  }
  return text.replace(VERSION_SCOPE_RE, (_full, scopesStr: string, body: string) => {
    const scopes = new Set(
      scopesStr
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    );
    return scopes.has(gameVersion) ? body : '';
  });
}


/**
 * Knowledge base — pure port of the old KnowledgeService. Files are bundled
 * as strings at build time (see data.ts), so there is no async loading.
 */
export class KnowledgeBase {
  private readonly methodologies = new Map<GameSlug, GameMethodology>();
  private readonly universalSections: UniversalSection[] = [];

  constructor(files: Record<string, string>) {
    for (const [slug, filename] of Object.entries(GAME_FILES) as [GameSlug, string][]) {
      const text = files[filename];
      if (text) this.methodologies.set(slug, parseMethodologyFile(text));
    }
    for (const filename of UNIVERSAL_FILES) {
      const text = files[filename];
      if (text) this.universalSections.push(...parseUniversalFile(filename, text));
    }
  }

  /** Phase-scoped methodology block (same output as the web app's prompts). */
  getMethodologyContext(gameSlug: GameSlug, phaseNumber: number, gameVersion?: GameVersion | null): string {
    const methodology = this.methodologies.get(gameSlug);
    if (!methodology) return '';
    const relevant = methodology.sections.filter((s) => s.isUniversal || s.phases.has(phaseNumber));
    const parts: string[] = [methodology.universalPrinciples];
    for (const s of relevant) parts.push(s.content);
    const universal = this.universalSections
      .filter((s) => s.phases.size === 0 || s.phases.has(phaseNumber))
      .map((s) => s.content)
      .join('\n\n');
    if (universal) parts.push(universal);
    const block = applyVersionScope(parts.join('\n\n'), gameVersion ?? null);
    return (
      'REFERENCE METHODOLOGY (community best practices — ' +
      'use this knowledge when selecting and evaluating mods):\n' +
      block
    );
  }

  /** Section ids + titles for a game, for the knowledge lookup tool. */
  listTopics(gameSlug: GameSlug): Array<{ id: string; title: string; phases: number[] }> {
    const m = this.methodologies.get(gameSlug);
    if (!m) return [];
    return m.sections.map((s) => ({ id: s.id, title: s.title, phases: [...s.phases].sort((a, b) => a - b) }));
  }

  /** Full text of one section (game file section id or universal tag). */
  getTopic(gameSlug: GameSlug, topicId: string, gameVersion?: GameVersion | null): string | null {
    const m = this.methodologies.get(gameSlug);
    const sec = m?.sections.find((s) => s.id === topicId);
    if (sec) return applyVersionScope(sec.content, gameVersion ?? null);
    const uni = this.universalSections.find((s) => s.tag === topicId);
    return uni ? uni.content : null;
  }

  listUniversalTopics(): string[] {
    return this.universalSections.map((s) => s.tag);
  }
}
