/**
 * Tests for prompts.ts. Source of truth:
 *   `backend/app/services/generation/prompts.py`
 *
 * Smoke-level: assert that key substrings, headings, and field substitutions
 * survive the port. Full-text equality would be brittle. The pipeline (Task 13)
 * passes these strings to the LLM, so any wording drift between Python and TS
 * must produce a test failure here, not a quality regression in production.
 */

import {
  buildPhasePrompt,
  buildSweepPrompt,
  buildPatchPhasePrompt,
  buildPhaseUserMsg,
  buildHardwareContext,
  classifyError,
  LEGACY_DISCOVERY_PROMPT,
  LEGACY_PATCH_REVIEW_PROMPT,
} from './prompts';
import type {
  BuildPhase,
  Game,
  Playstyle,
  GenerationSessionSnapshot,
  HardwareSpecs,
} from './types';

const game: Game = {
  id: 1,
  name: 'Skyrim Special Edition',
  slug: 'skyrimse',
  nexus_domain: 'skyrimspecialedition',
};

const playstyle: Playstyle = {
  id: 1,
  game_id: 1,
  name: 'Vampire Lord',
  slug: 'vampire',
};

const phase: BuildPhase = {
  phase_number: 4,
  name: 'Foundation Textures & Meshes',
  description: 'Base texture overhauls.',
  search_guidance: 'Search for texture overhauls.',
  rules: 'Match resolution to VRAM.',
  example_mods: 'SMIM, Cathedral Landscapes',
  is_playstyle_driven: false,
  max_mods: 40,
  scale_weight: 3,
};

function makeSession(modlistOverride: GenerationSessionSnapshot['modlist'] = []): GenerationSessionSnapshot {
  return {
    game_domain: 'skyrimspecialedition',
    modlist: modlistOverride,
    patches: [],
    knowledge_flags: [],
    review_flags: [],
    description_cache: {},
    author_cache: {},
    reverse_deps_cache: {},
    searched_queries: [],
    fetched_mod_ids: [],
    completed_phases: [],
    preset: 'medium',
    next_load_order: 1,
    requested_mods: [],
  };
}

describe('buildPhasePrompt', () => {
  it('substitutes phase number, total phases, and phase name into the heading', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: 'Note: SE',
      hardwareContext: 'GPU: RTX 4080',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).toContain(
      'You are an expert Skyrim Special Edition mod curator working on Phase 4/13: "Foundation Textures & Meshes"',
    );
    expect(text).toContain('GAME: Skyrim Special Edition (SE edition)');
  });

  it('embeds hardware context, version notes, and methodology block', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'AE',
      versionNotes: 'NOTE: targeting AE',
      hardwareContext: 'GPU: 4090',
      session: makeSession(),
      totalPhases: 10,
      methodologyText: '\nREFERENCE METHODOLOGY ...',
    });
    expect(text).toContain('GPU: 4090');
    expect(text).toContain('NOTE: targeting AE');
    expect(text).toContain('REFERENCE METHODOLOGY');
  });

  it('falls back to (Unknown edition) when gameVersion is null', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: null,
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 10,
      methodologyText: '',
    });
    expect(text).toContain('(Unknown edition)');
  });

  it('uses cap parameter when provided (overrides phase.max_mods)', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
      cap: 7,
    });
    expect(text).toContain('Add up to 7 mods in this sub-pass');
  });

  it('renders sub-pass header when sub_pass_total > 1', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
      cap: 25,
      subPassIndex: 1,
      subPassTotal: 4,
    });
    expect(text).toContain('SUB-PASS 2/4');
    expect(text).toContain('split into multiple sub-passes');
  });

  it('omits the "── SUB-PASS N/M ──" header when only one sub-pass', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    // The SUB-PASS HEADER (with N/M) must be absent. The "SUB-PASS STRATEGY"
    // hint block keyed off phase name may still appear and is fine.
    expect(text).not.toContain('── SUB-PASS');
    expect(text).not.toMatch(/SUB-PASS \d+\/\d+/);
  });

  it('lists requested mods in the user-preferences block', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
      requestedMods: ['SkyUI', 'Address Library'],
    });
    expect(text).toContain('REQUESTED MODS (USER EXPLICITLY ASKED FOR THESE):');
    expect(text).toContain('  - SkyUI');
    expect(text).toContain('  - Address Library');
    expect(text).toContain('A dedicated sweep pass runs at the end');
  });

  it('renders custom_description block when provided', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
      customDescription: 'A grimdark immersive playthrough',
    });
    expect(text).toContain("USER'S VISION:");
    expect(text).toContain('A grimdark immersive playthrough');
  });

  it('renders playstyle FOCUS block when phase is_playstyle_driven', () => {
    const drivenPhase: BuildPhase = { ...phase, is_playstyle_driven: true };
    const text = buildPhasePrompt({
      phase: drivenPhase,
      game,
      playstyle,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).toContain('PLAYSTYLE FOCUS: Vampire Lord');
    expect(text).toContain('directly support this playstyle');
  });

  it('renders playstyle context (not focus) when phase is NOT playstyle-driven', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).toContain('PLAYSTYLE: Vampire Lord (for context');
    expect(text).not.toContain('PLAYSTYLE FOCUS');
  });

  it('falls back to "well-rounded, balanced modlist" when no preferences supplied', () => {
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).toContain('No specific playstyle selected');
  });

  it('lists prior-phase mods (from session.modlist) under "MODS ALREADY IN YOUR MODLIST"', () => {
    const session = makeSession([
      { nexus_mod_id: 100, name: 'SKSE' },
      { nexus_mod_id: 200, name: 'SkyUI' },
    ]);
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session,
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).toContain('MODS ALREADY IN YOUR MODLIST');
    expect(text).toContain('1. SKSE (Nexus ID: 100)');
    expect(text).toContain('2. SkyUI (Nexus ID: 200)');
  });

  it('lists already_added under "MODS ALREADY ADDED EARLIER IN THIS PHASE" and excludes them from prior list', () => {
    const session = makeSession([
      { nexus_mod_id: 100, name: 'SKSE' },
      { nexus_mod_id: 999, name: 'Same-Phase Mod', author: 'Bob' },
    ]);
    const text = buildPhasePrompt({
      phase,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session,
      totalPhases: 13,
      methodologyText: '',
      alreadyAdded: [{ nexus_mod_id: 999, name: 'Same-Phase Mod', author: 'Bob' }],
    });
    expect(text).toContain('MODS ALREADY ADDED EARLIER IN THIS PHASE');
    expect(text).toContain('Same-Phase Mod by Bob (Nexus ID: 999)');
    // Same-Phase Mod must NOT appear in the earlier-phases list:
    expect(text).not.toContain('1. Same-Phase Mod');
  });

  it('appends the sub-pass strategy hint when phase has high max_mods + matching name', () => {
    const text = buildPhasePrompt({
      phase, // "Foundation Textures & Meshes", max_mods 40
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).toContain('SUB-PASS STRATEGY');
    expect(text).toContain('1. Base meshes & mesh fixes');
  });

  it('omits the sub-pass strategy hint when max_mods < 15', () => {
    const lowMods: BuildPhase = { ...phase, max_mods: 10 };
    const text = buildPhasePrompt({
      phase: lowMods,
      game,
      playstyle: null,
      gameVersion: 'SE',
      versionNotes: '',
      hardwareContext: '',
      session: makeSession(),
      totalPhases: 13,
      methodologyText: '',
    });
    expect(text).not.toContain('SUB-PASS STRATEGY');
  });
});

describe('buildSweepPrompt', () => {
  it('lists missing mods and current modlist summary', () => {
    const session = makeSession([{ nexus_mod_id: 100, name: 'SKSE' }]);
    const text = buildSweepPrompt({
      missingMods: ['SkyUI', 'Address Library'],
      game,
      gameVersion: 'AE',
      session,
    });
    expect(text).toContain('You are running a SWEEP PASS');
    expect(text).toContain('Skyrim Special Edition (AE)');
    expect(text).toContain('  - SkyUI');
    expect(text).toContain('  - Address Library');
    expect(text).toContain('  - SKSE');
  });

  it('shows "(modlist is empty)" when session.modlist is empty', () => {
    const text = buildSweepPrompt({
      missingMods: ['SkyUI'],
      game,
      gameVersion: null,
      session: makeSession(),
    });
    expect(text).toContain('(modlist is empty)');
    expect(text).toContain('any');
  });
});

describe('buildPatchPhasePrompt', () => {
  it('numbered modlist with reasons + methodology + finalize_review hint', () => {
    const session = makeSession([
      { nexus_mod_id: 100, name: 'SKSE', reason: 'Required framework' },
      { nexus_mod_id: 200, name: 'SkyUI', reason: 'UI baseline' },
    ]);
    const patchPhase: BuildPhase = {
      ...phase,
      phase_number: 13,
      name: 'Compatibility Patches',
      search_guidance: 'Look for patches.',
      rules: 'Only flag genuine conflicts.',
    };
    const text = buildPatchPhasePrompt({
      phase: patchPhase,
      game,
      gameVersion: 'SE',
      session,
      totalPhases: 13,
      methodologyText: '\nREFERENCE METHODOLOGY: ...',
    });
    expect(text).toContain('Phase 13/13: "Compatibility Patches"');
    expect(text).toContain('  1. SKSE (Nexus ID: 100) — Required framework');
    expect(text).toContain('  2. SkyUI (Nexus ID: 200) — UI baseline');
    expect(text).toContain('REFERENCE METHODOLOGY');
    expect(text).toContain('Call finalize_review when done.');
  });
});

describe('buildPhaseUserMsg', () => {
  it('playstyle-driven phase mentions experience focus', () => {
    const drivenPhase: BuildPhase = { ...phase, is_playstyle_driven: true };
    const msg = buildPhaseUserMsg({
      phase: drivenPhase,
      playstyle,
      game,
      gameVersion: 'SE',
    });
    expect(msg).toContain('Build the Foundation Textures & Meshes section of a Vampire Lord modlist');
    expect(msg).toContain('Skyrim Special Edition (SE)');
  });

  it('non-playstyle-driven phase omits experience qualifier', () => {
    const msg = buildPhaseUserMsg({
      phase,
      playstyle: null,
      game,
      gameVersion: 'AE',
    });
    expect(msg).toContain('Build the Foundation Textures & Meshes section of a modlist');
    expect(msg).toContain('Skyrim Special Edition (AE)');
  });

  it('appends requested-mods reminder when provided', () => {
    const msg = buildPhaseUserMsg({
      phase,
      playstyle: null,
      game,
      gameVersion: null,
      requestedMods: ['SkyUI', 'SKSE'],
    });
    expect(msg).toContain('Reminder: the user specifically requested these mods: SkyUI, SKSE');
    expect(msg).toContain('any version');
  });
});

describe('buildHardwareContext', () => {
  it('renders all hardware fields with sensible fallbacks', () => {
    const specs: HardwareSpecs = {
      gpu: 'RTX 4080',
      vram_mb: 16384,
      cpu: 'i9-13900K',
      ram_gb: 32,
    };
    const block = buildHardwareContext({
      specs,
      availableStorageGb: 200,
      tier: 'high',
      vramBudget: 14000,
      storageBudgetGb: 150,
    });
    expect(block).toContain('USER HARDWARE:');
    expect(block).toContain('GPU: RTX 4080 (16384MB VRAM)');
    expect(block).toContain('CPU: i9-13900K');
    expect(block).toContain('RAM: 32GB');
    expect(block).toContain('Available disk space: 200GB (budget: 150GB)');
    expect(block).toContain('VRAM budget: 14000MB');
    expect(block).toContain('Hardware tier: high');
  });

  it('uses Unknown / 6144 / 50 fallbacks when fields missing', () => {
    const block = buildHardwareContext({
      specs: {},
      availableStorageGb: undefined,
      tier: 'low',
      vramBudget: 4000,
      storageBudgetGb: 50,
    });
    expect(block).toContain('GPU: Unknown (6144MB VRAM)');
    expect(block).toContain('CPU: Unknown');
    expect(block).toContain('RAM: UnknownGB');
    expect(block).toContain('Available disk space: 50GB');
  });
});

describe('classifyError', () => {
  it('matches "rate" or "429" → rate_limit', () => {
    expect(classifyError('Gemini', new Error('Rate limit hit'))).toEqual([
      'rate_limit',
      'Gemini: Rate limited — too many requests',
    ]);
    expect(classifyError('Gemini', new Error('HTTP 429 Too Many'))).toEqual([
      'rate_limit',
      'Gemini: Rate limited — too many requests',
    ]);
  });

  it('matches auth failures → auth_error', () => {
    const [type, msg] = classifyError('OpenAI', new Error('401 unauthorized'));
    expect(type).toBe('auth_error');
    expect(msg).toContain('Invalid API key');
  });

  it('matches quota / billing → token_limit', () => {
    expect(classifyError('Anthropic', new Error('quota exceeded'))[0]).toBe('token_limit');
  });

  it('matches timeout → timeout', () => {
    expect(classifyError('Groq', new Error('Request timed out'))[0]).toBe('timeout');
  });

  it('matches connect/network → connection', () => {
    expect(classifyError('Ollama', new Error('Network unreachable'))[0]).toBe('connection');
  });

  it('falls through to "unknown" with truncated message', () => {
    const [type, msg] = classifyError('TestModel', new Error('Some weird thing'));
    expect(type).toBe('unknown');
    expect(msg).toContain('TestModel:');
    expect(msg).toContain('Error');
    expect(msg).toContain('Some weird thing');
  });
});

describe('LEGACY_*_PROMPT', () => {
  it('LEGACY_DISCOVERY_PROMPT contains the named placeholders', () => {
    expect(LEGACY_DISCOVERY_PROMPT).toContain('{game_name}');
    expect(LEGACY_DISCOVERY_PROMPT).toContain('{game_version}');
    expect(LEGACY_DISCOVERY_PROMPT).toContain('{vram_mb}');
    expect(LEGACY_DISCOVERY_PROMPT).toContain('{storage_budget_gb}');
  });

  it('LEGACY_PATCH_REVIEW_PROMPT contains the named placeholders', () => {
    expect(LEGACY_PATCH_REVIEW_PROMPT).toContain('{game_name}');
    expect(LEGACY_PATCH_REVIEW_PROMPT).toContain('{modlist_summary}');
  });
});
