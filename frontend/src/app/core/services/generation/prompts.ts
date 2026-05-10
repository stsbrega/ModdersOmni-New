/**
 * Prompt builders for the generation pipeline.
 *
 * Faithful TS port of `backend/app/services/generation/prompts.py`.
 * Prompt strings are copied VERBATIM from the Python f-strings — only
 * Python interpolation syntax has been translated to TS template
 * literals. Do NOT paraphrase, "improve" wording, or relayout headings.
 * The pipeline (Task 13) feeds these strings to the LLM and output
 * quality is sensitive to small wording changes.
 *
 * Design differences from Python:
 *   - `methodology_context` is provided by `KnowledgeService` in TS.
 *     Python prompts import + call `get_methodology_context()` inline;
 *     here the caller (the pipeline) resolves it via the service and
 *     passes the resulting string in as `methodologyText`. This keeps
 *     this module pure, easy to test without TestBed, and decouples
 *     prompt assembly from the async knowledge load.
 *   - `classify_error()` takes an `LLMProvider` in Python and pulls
 *     the model name off it. Here it takes the model name directly
 *     (`classifyError(modelName, error)`).
 *   - The plan's sketch invented `build_system_prompt()` — Python has
 *     no such function. Skipped.
 *
 * Plan 1 Task 10. Source of truth: prompts.py.
 */

import type {
  BuildPhase,
  Game,
  Playstyle,
  GenerationSessionSnapshot,
  HardwareSpecs,
  SessionModEntry,
} from './types';

// ─────────────────────────────────────────────────────────────────────
// Internal helpers (mirror prompts.py underscore-prefixed helpers)
// ─────────────────────────────────────────────────────────────────────

/**
 * Build the user preferences context block for system prompts.
 * Mirrors `_build_user_preferences_context` in prompts.py.
 */
function buildUserPreferencesContext(
  playstyle: Playstyle | null | undefined,
  customDescription: string | null | undefined,
  requestedMods: string[],
  isPlaystyleDriven: boolean,
): string {
  const parts: string[] = [];

  if (playstyle) {
    if (isPlaystyleDriven) {
      parts.push(
        `PLAYSTYLE FOCUS: ${playstyle.name}\n` +
          `The user wants a ${playstyle.name} experience. Your mod choices in this phase should\n` +
          `directly support this playstyle. Prioritize mods that enhance the ${playstyle.name} feel.`,
      );
    } else {
      parts.push(
        `PLAYSTYLE: ${playstyle.name} (for context — this phase is not heavily playstyle-driven,\n` +
          `but keep the overall experience in mind).`,
      );
    }
  }

  if (customDescription) {
    parts.push(
      `USER'S VISION:\n` +
        `The user described their ideal experience: "${customDescription}"\n` +
        `Use this to guide your mod selections — prioritize mods that match this vision.`,
    );
  }

  if (requestedMods.length > 0) {
    const modList = requestedMods.map((m) => `  - ${m}`).join('\n');
    parts.push(
      `REQUESTED MODS (USER EXPLICITLY ASKED FOR THESE):\n` +
        `${modList}\n` +
        `If any of these fit this phase's theme, search for and add them NOW.\n` +
        `Do NOT defer them to a later phase — there is no guarantee a later phase\n` +
        `will come around to them. A dedicated sweep pass runs at the end to pick up\n` +
        `anything missed, but it costs an extra LLM turn, so prefer to add each\n` +
        `requested mod in the first phase where it fits.`,
    );
  }

  if (parts.length === 0) {
    parts.push(
      'No specific playstyle selected — build a well-rounded, balanced modlist.',
    );
  }

  return parts.join('\n\n');
}

/**
 * Get a short label describing the user's desired experience for user
 * messages. Mirrors `_get_experience_label` in prompts.py.
 */
function getExperienceLabel(
  playstyle: Playstyle | null | undefined,
  customDescription: string | null | undefined,
): string {
  if (playstyle && customDescription) {
    return `${playstyle.name} (${customDescription.slice(0, 80)})`;
  }
  if (playstyle) return playstyle.name;
  if (customDescription) return customDescription.slice(0, 100);
  return 'custom';
}

// Sub-pass hints for phases with high max_mods caps. Mirrors `_SUB_PASS_HINTS`
// in prompts.py — keep keys (phase names) and bodies in sync verbatim.
const SUB_PASS_HINTS: Record<string, string> = {
  'Foundation Textures & Meshes':
    'SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n' +
    'Work through these subcategories in order, searching 2-3 times per subcategory:\n' +
    '  1. Base meshes & mesh fixes (SMIM, mesh improvements)\n' +
    '  2. Architecture textures (cities, castles, forts, ruins)\n' +
    '  3. Landscape textures (mountains, terrain, roads)\n' +
    '  4. Dungeon textures (caves, mines, Nordic ruins, Dwemer)\n' +
    '  5. Clutter & objects (furniture, food, books, candles)\n' +
    '  6. Flora textures (trees, grass, plants, flowers)\n' +
    '  7. Water textures (rivers, lakes, waterfalls)\n' +
    '  8. Creature & animal retextures\n' +
    '  9. Weapon & armor retextures\n' +
    '  10. Effects & particles (fire, magic, smoke)\n' +
    "Pick the BEST mod per subcategory — don't add two full replacers for the same surface.\n\n",
  'Foundation Textures':
    'SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n' +
    'Work through these subcategories in order:\n' +
    '  1. Comprehensive landscape/architecture overhauls (Vivid Fallout, FlaconOil — pick ONE)\n' +
    '  2. Per-material textures (concrete, metal, wood, asphalt)\n' +
    '  3. Clutter & interior objects\n' +
    '  4. Weapon retextures (per-weapon packs)\n' +
    '  5. Armor & clothing retextures\n' +
    '  6. Creature retextures\n' +
    '  7. Effects & particles\n' +
    'Pick ONE base pack, then layer specific replacers on top.\n\n',
  'Gameplay & Playstyle':
    'SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n' +
    'Work through these gameplay domains, picking mods that match the playstyle:\n' +
    '  1. Primary overhaul (combat, perks, or magic — ONE per cluster)\n' +
    '  2. Economy & loot distribution\n' +
    '  3. Crafting & smithing\n' +
    '  4. AI & NPC behavior\n' +
    '  5. Immersion (needs, camping, religion, consequences)\n' +
    '  6. Items & equipment (new weapons, armor with distribution)\n' +
    '  7. Character appearance (body, NPC replacers)\n' +
    'Remember: ONE primary overhaul per system. Small tweaks can stack.\n\n',
  Gameplay:
    'SUB-PASS STRATEGY (this phase has a high mod budget — search systematically):\n' +
    'Work through these gameplay domains, picking mods that match the playstyle:\n' +
    '  1. Primary combat overhaul (ONE only — Arbitration, True Damage, etc.)\n' +
    '  2. Survival/needs mods (ONE comprehensive — NICER, Horizon, etc.)\n' +
    '  3. Loot & economy rebalance\n' +
    '  4. Crafting improvements\n' +
    '  5. Enemy/spawn modifications\n' +
    '  6. Settlement improvements (if applicable)\n' +
    '  7. Small targeted tweaks\n' +
    'Remember: ONE primary overhaul per system. Small tweaks can stack.\n\n',
};

/** Mirrors `_build_sub_pass_hint(phase)` in prompts.py. */
function buildSubPassHint(phase: BuildPhase): string {
  if (phase.max_mods < 15) return '';
  return SUB_PASS_HINTS[phase.name] ?? '';
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface BuildPhasePromptArgs {
  phase: BuildPhase;
  game: Game;
  playstyle: Playstyle | null;
  gameVersion: string | null;
  versionNotes: string;
  hardwareContext: string;
  /**
   * The session snapshot — `session.modlist` is read for the "earlier
   * phases" mods-so-far block.
   */
  session: GenerationSessionSnapshot;
  totalPhases: number;
  /**
   * REFERENCE METHODOLOGY block produced by
   * `KnowledgeService.getMethodologyContext(game.slug, phase.phase_number, gameVersion)`.
   * In Python this is fetched inline; in TS the caller threads it in.
   */
  methodologyText: string;
  customDescription?: string | null;
  requestedMods?: string[];
  /**
   * Effective per-sub-pass cap. Defaults to `phase.max_mods` to keep
   * legacy callers working (matches Python's default).
   */
  cap?: number;
  /** Mods picked earlier in the SAME phase by previous sub-passes. */
  alreadyAdded?: SessionModEntry[];
  subPassGuidance?: string | null;
  /** 0-based sub-pass index. Default 0. */
  subPassIndex?: number;
  /** Total sub-passes in this phase. Default 1 (single pass). */
  subPassTotal?: number;
}

/**
 * Build a focused system prompt for a single build phase.
 *
 * Mirrors `build_phase_prompt` in prompts.py. Strings are copied verbatim;
 * only Python f-string interpolation has been retranslated as TS template
 * literals.
 */
export function buildPhasePrompt(args: BuildPhasePromptArgs): string {
  const {
    phase,
    game,
    playstyle,
    gameVersion,
    versionNotes,
    hardwareContext,
    session,
    totalPhases,
    methodologyText,
    customDescription = null,
    requestedMods = [],
    cap,
    alreadyAdded = [],
    subPassGuidance = null,
    subPassIndex = 0,
    subPassTotal = 1,
  } = args;

  const effectiveCap = cap ?? phase.max_mods;
  const alreadyAddedIds = new Set<number>();
  for (const m of alreadyAdded) {
    if (m.nexus_mod_id !== undefined) alreadyAddedIds.add(m.nexus_mod_id);
  }

  const priorPhaseMods = session.modlist.filter(
    (m) => !(m.nexus_mod_id !== undefined && alreadyAddedIds.has(m.nexus_mod_id)),
  );

  let modsSoFar = '';
  if (priorPhaseMods.length > 0) {
    modsSoFar =
      '\n\nMODS ALREADY IN YOUR MODLIST (from earlier phases — do NOT re-add these):\n';
    modsSoFar += priorPhaseMods
      .map((m, i) => `  ${i + 1}. ${m.name} (Nexus ID: ${m.nexus_mod_id})`)
      .join('\n');
  }

  let alreadyThisPhase = '';
  if (alreadyAdded.length > 0) {
    alreadyThisPhase =
      '\n\nMODS ALREADY ADDED EARLIER IN THIS PHASE ' +
      '(do NOT re-add; pick different mods):\n';
    alreadyThisPhase += alreadyAdded
      .map(
        (m) =>
          `  - ${m.name} by ${m.author || 'Unknown'} ` +
          `(Nexus ID: ${m.nexus_mod_id})`,
      )
      .join('\n');
  }

  let subPassHeader = '';
  if (subPassTotal > 1) {
    subPassHeader =
      `\n── SUB-PASS ${subPassIndex + 1}/${subPassTotal} ──\n` +
      'This phase is split into multiple sub-passes to keep context focused. ' +
      'Add DIFFERENT mods than previous sub-passes (see list below).\n';
  }

  let guidanceLine = '';
  if (subPassGuidance) {
    guidanceLine = `\nFOCUS FOR THIS BATCH: ${subPassGuidance}\n`;
  }

  const preferencesContext = buildUserPreferencesContext(
    playstyle,
    customDescription,
    requestedMods,
    phase.is_playstyle_driven,
  );

  const exampleModsBlock = phase.example_mods
    ? `EXAMPLE MODS (for reference — verify these exist and are current before adding):\n${phase.example_mods}`
    : '';

  return `You are an expert ${game.name} mod curator working on Phase ${phase.phase_number}/${totalPhases}: "${phase.name}".

GAME: ${game.name} (${gameVersion || 'Unknown'} edition)
${versionNotes}

${hardwareContext}

${preferencesContext}
${methodologyText}

── PHASE ${phase.phase_number}: ${phase.name} ──
${phase.description}
${subPassHeader}${guidanceLine}
SEARCH GUIDANCE:
${phase.search_guidance}

RULES FOR THIS PHASE:
${phase.rules}

${exampleModsBlock}
${modsSoFar}${alreadyThisPhase}

${buildSubPassHint(phase)}INSTRUCTIONS:
1. Search using SHORT, SPECIFIC mod names (1-4 words). The search API matches against mod
   TITLES only, not descriptions. Do NOT prefix searches with the game name.
   GOOD: "Buffout 4", "FallUI", "True Storms", "damage overhaul", "texture pack"
   BAD:  "Fallout 4 texture overhaul", "visual overhaul environment", "Fallout 4 NPC bug fix"
   If a search returns 0 results, try SHORTER or DIFFERENT keywords — do NOT repeat the same query.
2. Use get_mod_details to read about a mod BEFORE adding it. Check:
   - Compatibility with ${gameVersion || "the user's"} game version
   - Performance impact relative to the user's hardware
   - Whether it actually fits this phase's purpose
3. BEFORE adding any mod, check if another mod already in the modlist covers the same system
   (e.g., two weather overhauls, two combat overhauls, two full texture packs). If a mod from
   the same mutually exclusive cluster is already present, do NOT add the new one — pick the
   better fit and skip the other.
4. Add up to ${effectiveCap} mods in this sub-pass (fewer is fine if quality is high).
5. Do NOT pass load_order — the system assigns it automatically based on add order.
6. Call finalize() when you are done with this sub-pass.
7. Keep your thinking concise. Do NOT write phase summaries listing every mod added —
   the system already tracks this. Focus reasoning on mod selection decisions only.`;
}

export interface BuildSweepPromptArgs {
  missingMods: string[];
  game: Game;
  gameVersion: string | null;
  session: GenerationSessionSnapshot;
}

/**
 * System prompt for the post-phase sweep that adds any requested mods the
 * per-phase loops didn't pick up. Mirrors `build_sweep_prompt` in prompts.py.
 */
export function buildSweepPrompt(args: BuildSweepPromptArgs): string {
  const { missingMods, game, gameVersion, session } = args;
  const missingList = missingMods.map((m) => `  - ${m}`).join('\n');
  const modlistSummary =
    session.modlist.map((m) => `  - ${m.name}`).join('\n') ||
    '  (modlist is empty)';
  return `You are running a SWEEP PASS for a ${game.name} (${gameVersion || 'any'}) modlist.

The user explicitly requested these mods, and the per-phase build loop did NOT add them:
${missingList}

Your ONLY job is to find and add these specific mods. Do not explore categories, do not
search for alternatives, do not add patches, and do not add anything the user didn't ask
for. If a requested mod simply doesn't exist on Nexus under any reasonable spelling, skip
it — the system will surface it to the user as "not found."

PROCESS FOR EACH MISSING MOD:
1. Call search_nexus with the exact user-provided name (no game prefix, no category tags).
2. If results look correct, call get_mod_details on the top hit to confirm it's the right mod
   (right author, right description — not a fan patch or sequel).
3. Call add_to_modlist with the mod's ID. The system assigns load_order automatically —
   do NOT pass load_order.
4. Move on to the next missing mod.
5. Call finalize() when you're done (all requested mods either added or skipped).

CURRENT MODLIST (do NOT re-add anything below):
${modlistSummary}
`;
}

export interface BuildPatchPhasePromptArgs {
  phase: BuildPhase;
  game: Game;
  gameVersion: string | null;
  session: GenerationSessionSnapshot;
  totalPhases: number;
  /** Same parameter as `buildPhasePrompt` — caller-supplied. */
  methodologyText: string;
}

/**
 * System prompt for the final compatibility patches phase. Mirrors
 * `build_patch_phase_prompt` in prompts.py.
 */
export function buildPatchPhasePrompt(args: BuildPatchPhasePromptArgs): string {
  const { phase, game, gameVersion, session, totalPhases, methodologyText } = args;
  const modlistSummary = session.modlist
    .map(
      (m, i) =>
        `  ${i + 1}. ${m.name} (Nexus ID: ${m.nexus_mod_id}) — ${m.reason ?? ''}`,
    )
    .join('\n');

  return `You are reviewing a ${game.name} (${gameVersion || 'Unknown'} edition) modlist for compatibility.

This is Phase ${phase.phase_number}/${totalPhases}: "${phase.name}".
${methodologyText}

THE MODLIST TO REVIEW:
${modlistSummary}

${phase.search_guidance}

RULES:
${phase.rules}

PROCESS:
1. For key mods that edit the same game systems, use get_mod_description to check if
   the mod page mentions patches, compatibility notes, or known conflicts.
2. Use get_reverse_deps on major mods (unofficial patches, weather overhauls, large
   content mods) — patches are often listed under "Mods requiring this file" on Nexus.
   Look for entries whose names contain "patch", "compatibility", or reference another
   mod in the list.
3. Only use search_patches as a last resort if a mod description explicitly mentions
   a patch by name that you need to find. Do NOT blindly search "mod A mod B patch" —
   the Nexus name search rarely matches patch naming conventions.
4. If you find a patch, use add_patch. The system assigns load_order automatically —
   because patches are added last in this final phase, they will naturally load after
   the mods they patch. Do NOT pass load_order.
5. If a patch is NEEDED but doesn't exist, use flag_user_knowledge to alert the user.

IMPORTANT:
- Not every mod pair needs a patch. Only flag genuine conflicts.
- Framework mods (SKSE, Address Library, etc.) don't need patches with each other.
- Focus on mods that edit the same game systems.
- Call finalize_review when done.`;
}

export interface BuildPhaseUserMsgArgs {
  phase: BuildPhase;
  playstyle: Playstyle | null;
  game: Game;
  gameVersion: string | null;
  customDescription?: string | null;
  requestedMods?: string[];
}

/**
 * Build the user message that kicks off a phase. Mirrors
 * `build_phase_user_msg` in prompts.py.
 */
export function buildPhaseUserMsg(args: BuildPhaseUserMsgArgs): string {
  const {
    phase,
    playstyle,
    game,
    gameVersion,
    customDescription = null,
    requestedMods = [],
  } = args;
  const experience = getExperienceLabel(playstyle, customDescription);

  let msg: string;
  if (phase.is_playstyle_driven) {
    msg =
      `Build the ${phase.name} section of a ${experience} modlist for ` +
      `${game.name} (${gameVersion || 'any version'}). ` +
      `Focus on mods that enhance the ${experience} experience.`;
  } else {
    msg =
      `Build the ${phase.name} section of a modlist for ` +
      `${game.name} (${gameVersion || 'any version'}).`;
  }

  if (requestedMods.length > 0) {
    msg +=
      `\n\nReminder: the user specifically requested these mods: ` +
      `${requestedMods.join(', ')}. ` +
      `If any belong in this phase, search for and include them.`;
  }

  return msg;
}

export interface BuildHardwareContextArgs {
  /**
   * `HardwareSpecs` from `shared/models/specs.model.ts` — same fields the
   * Python `ModlistGenerateRequest` carries (gpu, vram_mb, cpu, ram_gb).
   */
  specs: HardwareSpecs;
  /** Maps to `request.available_storage_gb`; defaults to 50 when omitted. */
  availableStorageGb?: number | null;
  /** Hardware tier label (e.g. 'low', 'mid', 'high'). */
  tier: string;
  vramBudget: number;
  storageBudgetGb: number;
}

/**
 * Build the hardware context block for system prompts. Mirrors
 * `build_hardware_context` in prompts.py.
 *
 * Python takes a `ModlistGenerateRequest` + `tier_info` dict; the TS port
 * takes flatter inputs since the frontend already has `HardwareSpecs` and
 * a flat tier label.
 */
export function buildHardwareContext(args: BuildHardwareContextArgs): string {
  const { specs, availableStorageGb, tier, vramBudget, storageBudgetGb } = args;
  const gpu = specs.gpu || 'Unknown';
  const vram = specs.vram_mb ?? 6144;
  const cpu = specs.cpu || 'Unknown';
  const ram = specs.ram_gb ?? 'Unknown';
  const disk = availableStorageGb ?? 50;
  return `USER HARDWARE:
- GPU: ${gpu} (${vram}MB VRAM)
- CPU: ${cpu}
- RAM: ${ram}GB
- Available disk space: ${disk}GB (budget: ${storageBudgetGb}GB)
- VRAM budget: ${vramBudget}MB
- Hardware tier: ${tier}`;
}

/**
 * Classify an exception into `[errorType, friendlyMessage]`. Mirrors
 * `classify_error(llm, e)` in prompts.py — same heuristic order and
 * return tuple.
 *
 * Python uses `LLMProvider.get_model_name()` to label the message; here
 * we take the model name directly to keep this pure.
 */
export function classifyError(
  modelName: string,
  e: Error,
): [string, string] {
  const errorMsg = e.message ?? '';
  const lower = errorMsg.toLowerCase();

  if (lower.includes('rate') || errorMsg.includes('429')) {
    return ['rate_limit', `${modelName}: Rate limited — too many requests`];
  }
  if (
    lower.includes('auth') ||
    errorMsg.includes('401') ||
    (lower.includes('invalid') && lower.includes('key'))
  ) {
    return ['auth_error', `${modelName}: Invalid API key`];
  }
  if (
    lower.includes('quota') ||
    lower.includes('insufficient') ||
    lower.includes('billing')
  ) {
    return ['token_limit', `${modelName}: Quota exceeded or billing issue`];
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return ['timeout', `${modelName}: Request timed out`];
  }
  if (lower.includes('connect') || lower.includes('network')) {
    return ['connection', `${modelName}: Connection failed`];
  }
  if (
    lower.includes('token') &&
    (lower.includes('limit') || lower.includes('max'))
  ) {
    return ['token_limit', `${modelName}: Token limit exceeded`];
  }

  // Python uses `type(e).__name__`. JS exposes the constructor name on
  // `e.constructor.name` (or `e.name` for native errors). Prefer
  // constructor.name to match Python's behavior for custom subclasses.
  const errorTypeName = (e.constructor && e.constructor.name) || e.name || 'Error';
  return ['unknown', `${modelName}: ${errorTypeName} — ${errorMsg.slice(0, 120)}`];
}

// ─────────────────────────────────────────────────────────────────────
// Legacy two-phase prompts (used when no DB phases exist)
// ─────────────────────────────────────────────────────────────────────
//
// Kept as raw template strings with `{name}` placeholders, matching Python's
// `.format()`-style usage. The pipeline (Task 13) substitutes these with
// `formatLegacyPrompt(template, values)` (or equivalent simple replacer)
// when invoking the legacy code path.

export const LEGACY_DISCOVERY_PROMPT = `You are an expert video game mod curator for {game_name} ({game_version} edition).

USER HARDWARE:
- GPU: {gpu} ({vram_mb}MB VRAM)
- CPU: {cpu}
- RAM: {ram_gb}GB
- Available disk space: {available_storage_gb}GB (budget: {storage_budget_gb}GB)
- VRAM budget: {vram_budget}MB

{experience_context}

{version_notes}

YOUR TASK: Build a high-quality modlist by searching Nexus Mods. Follow these rules:

1. Search for mods using varied, specific terms — don't use one generic search.
   Good: "texture overhaul", "combat mechanics", "weather effects", "UI improvements"
   Bad: "best mods", "popular mods"

2. DON'T just pick the most popular mods. Use both "endorsements" and "updated" sort orders.
   Newer mods with fewer endorsements can be excellent — evaluate them on merit.

3. Use get_mod_details to read about a mod BEFORE adding it. Check for:
   - Compatibility with the user's game version
   - Performance impact relative to the user's hardware
   - Whether it actually fits the requested playstyle

4. Stay within the storage budget ({storage_budget_gb}GB) and VRAM budget ({vram_budget}MB).
   Estimate sizes: texture packs 1-4GB, gameplay mods <100MB, overhauls 500MB-2GB.

5. Do NOT pass load_order — the system assigns it automatically based on add order.
   Add framework mods (SKSE, USSEP, etc.) first, then overhauls, then tweaks last, and
   the ordering falls out naturally.

6. Call finalize() when you're satisfied with the list. Aim for 15-30 mods depending on the playstyle.`;

export const LEGACY_PATCH_REVIEW_PROMPT = `You are reviewing a modlist for {game_name} ({game_version} edition) for compatibility issues.

THE MODLIST:
{modlist_summary}

YOUR TASK: Check each mod for compatibility patches needed with other mods in this list.

PROCESS (follow this order for each potential conflict):
1. FIRST: Use get_mod_description to check if the mod page mentions patches or compatibility.
   Mod authors often list required patches or link to them directly.
2. SECOND: If the description doesn't mention a patch, use search_patches to search Nexus.
   Search with terms like "ModA ModB patch" or "ModA compatibility".
3. If you find a patch mod, use add_patch. The system assigns load_order automatically —
   because patches are added last in this review pass, they will naturally load after
   the mods they patch. Do NOT pass load_order.
4. If a patch is NEEDED but doesn't exist, use flag_user_knowledge to alert the user.
   This is important for future AI patch generation.

IMPORTANT:
- Not every mod pair needs a patch. Only flag genuine conflicts.
- Common framework mods (SKSE, Address Library, etc.) don't need patches with each other.
- Focus on mods that edit the same game systems (e.g., two combat mods, or a texture mod + ENB).
- Call finalize_review when done.`;
