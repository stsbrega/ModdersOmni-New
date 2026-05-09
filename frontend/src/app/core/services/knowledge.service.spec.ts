import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { KnowledgeService } from './knowledge.service';

/**
 * Realistic fixtures matching the actual production markdown format:
 * - Game files use `<!-- section: id -->` HTML-comment markers as section
 *   delimiters, with `<!-- phases: ... -->` and `<!-- universal: true -->`
 *   metadata comments inside each section body.
 * - The universal `compatibility_guidelines.md` file uses `<tag>...</tag>`
 *   XML blocks; phase scope comes from the SECTION_PHASE_MAP constant in
 *   the service (and resolver.py).
 */

const SKYRIM_FIXTURE = `<system_context>
game: skyrimse
extends: modding_common.md
</system_context>

# Skyrim SE/AE Modding Knowledge

This is the universal-principles preamble for Skyrim — appears in every
phase's resolved methodology block.

<!-- section: phase_two_only -->
<!-- phases: 2 -->

## Phase 2 only content

Body that should only inject for phase 2.

<!-- section: always_universal -->
<!-- universal: true -->

## Always universal

Body that should appear regardless of the requested phase.

<!-- section: version_scoped_demo -->
<!-- phases: 1 -->

Intro line for phase 1.

<!-- version_scope: AE -->
AE-only rule body.
<!-- /version_scope -->

Trailing line after the version_scope block.
`;

const FALLOUT4_FIXTURE = `# Fallout 4 stub

<!-- section: fo4_only -->
<!-- phases: 1 -->

FO4 phase 1 body.
`;

// Trimmed compatibility_guidelines.md — covers the SECTION_PHASE_MAP cases the
// tests assert on. Must use the same XML-tagged shape as the real file.
const COMPAT_FIXTURE = `<system_context>
scope: universal_modlist_compatibility
</system_context>

# Modlist Compatibility Guidelines

<patch_discovery_patterns>
PATCH-DISCOVERY-MARKER: should only inject for phases 11/12/13.
</patch_discovery_patterns>

<dependency_chain_rules>
DEPENDENCY-CHAIN-MARKER: should inject for ALL phases (empty phase set).
</dependency_chain_rules>

<scale_strategies>
SCALE-MARKER: never inject (phase set = {-1}).
</scale_strategies>

<quality_signals>
QUALITY-SIGNALS-MARKER: only phases 4..10.
</quality_signals>
`;

function flushAll(http: HttpTestingController, fixtures: {
  skyrim?: string;
  fallout4?: string;
  compat?: string;
}): void {
  http.expectOne('/knowledge/skyrim.md').flush(fixtures.skyrim ?? '');
  http.expectOne('/knowledge/fallout4.md').flush(fixtures.fallout4 ?? '');
  http
    .expectOne('/knowledge/compatibility_guidelines.md')
    .flush(fixtures.compat ?? '');
}

describe('KnowledgeService', () => {
  let svc: KnowledgeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(KnowledgeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('marks itself ready after all knowledge files load', async () => {
    const ready = svc.ready();
    flushAll(http, {
      skyrim: SKYRIM_FIXTURE,
      fallout4: FALLOUT4_FIXTURE,
      compat: COMPAT_FIXTURE,
    });
    await ready;
    expect(svc.isReady()).toBe(true);
  });

  it('returns the REFERENCE METHODOLOGY preamble line', async () => {
    const ready = svc.ready();
    flushAll(http, {
      skyrim: SKYRIM_FIXTURE,
      fallout4: FALLOUT4_FIXTURE,
      compat: COMPAT_FIXTURE,
    });
    await ready;

    const text = svc.getMethodologyContext('skyrimse', 1);
    expect(text.startsWith('\nREFERENCE METHODOLOGY (community best practices'))
      .toBe(true);
  });

  it('phase-tagged section is included for matching phase, excluded otherwise',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      const phase2 = svc.getMethodologyContext('skyrimse', 2);
      expect(phase2).toContain('Body that should only inject for phase 2');

      const phase5 = svc.getMethodologyContext('skyrimse', 5);
      expect(phase5).not.toContain('Body that should only inject for phase 2');
    });

  it('universal-tagged section appears for ANY phase', async () => {
    const ready = svc.ready();
    flushAll(http, {
      skyrim: SKYRIM_FIXTURE,
      fallout4: FALLOUT4_FIXTURE,
      compat: COMPAT_FIXTURE,
    });
    await ready;

    const phase1 = svc.getMethodologyContext('skyrimse', 1);
    const phase7 = svc.getMethodologyContext('skyrimse', 7);
    const phase13 = svc.getMethodologyContext('skyrimse', 13);

    expect(phase1).toContain('Body that should appear regardless');
    expect(phase7).toContain('Body that should appear regardless');
    expect(phase13).toContain('Body that should appear regardless');
  });

  it('XML-tagged universal section respects SECTION_PHASE_MAP ranges',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      // patch_discovery_patterns is mapped to {11, 12, 13} in resolver.py.
      const phase5 = svc.getMethodologyContext('skyrimse', 5);
      const phase11 = svc.getMethodologyContext('skyrimse', 11);
      const phase12 = svc.getMethodologyContext('skyrimse', 12);
      const phase13 = svc.getMethodologyContext('skyrimse', 13);

      expect(phase5).not.toContain('PATCH-DISCOVERY-MARKER');
      expect(phase11).toContain('PATCH-DISCOVERY-MARKER');
      expect(phase12).toContain('PATCH-DISCOVERY-MARKER');
      expect(phase13).toContain('PATCH-DISCOVERY-MARKER');
    });

  it('XML-tagged section with empty phase set is treated as universal',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      // dependency_chain_rules has phases = empty set (universal).
      const phase1 = svc.getMethodologyContext('skyrimse', 1);
      const phase13 = svc.getMethodologyContext('skyrimse', 13);

      expect(phase1).toContain('DEPENDENCY-CHAIN-MARKER');
      expect(phase13).toContain('DEPENDENCY-CHAIN-MARKER');
    });

  it('XML-tagged sections with sentinel phase {-1} are NEVER injected',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      for (const phase of [1, 2, 3, 5, 8, 11, 13]) {
        const text = svc.getMethodologyContext('skyrimse', phase);
        expect(text).not.toContain('SCALE-MARKER');
      }
    });

  it('quality_signals XML section only injects in phases 4..10', async () => {
    const ready = svc.ready();
    flushAll(http, {
      skyrim: SKYRIM_FIXTURE,
      fallout4: FALLOUT4_FIXTURE,
      compat: COMPAT_FIXTURE,
    });
    await ready;

    const phase3 = svc.getMethodologyContext('skyrimse', 3);
    const phase4 = svc.getMethodologyContext('skyrimse', 4);
    const phase10 = svc.getMethodologyContext('skyrimse', 10);
    const phase11 = svc.getMethodologyContext('skyrimse', 11);

    expect(phase3).not.toContain('QUALITY-SIGNALS-MARKER');
    expect(phase4).toContain('QUALITY-SIGNALS-MARKER');
    expect(phase10).toContain('QUALITY-SIGNALS-MARKER');
    expect(phase11).not.toContain('QUALITY-SIGNALS-MARKER');
  });

  it('drops version_scope:AE block when gameVersion=SE, keeps it when AE',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      const seText = svc.getMethodologyContext('skyrimse', 1, 'SE');
      const aeText = svc.getMethodologyContext('skyrimse', 1, 'AE');

      expect(seText).not.toContain('AE-only rule body');
      expect(aeText).toContain('AE-only rule body');

      // Surrounding content (outside the version_scope block) survives in BOTH.
      expect(seText).toContain('Intro line for phase 1');
      expect(aeText).toContain('Intro line for phase 1');
      expect(seText).toContain('Trailing line after the version_scope block');
      expect(aeText).toContain('Trailing line after the version_scope block');
    });

  it('strips version_scope markers but keeps body when gameVersion=undefined',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      const text = svc.getMethodologyContext('skyrimse', 1);
      expect(text).not.toContain('<!-- version_scope: AE -->');
      expect(text).not.toContain('<!-- /version_scope -->');
      // Body of the unscoped version is preserved (legacy behaviour).
      expect(text).toContain('AE-only rule body');
    });

  it('returns empty string for an unknown game slug', async () => {
    const ready = svc.ready();
    flushAll(http, {
      skyrim: SKYRIM_FIXTURE,
      fallout4: FALLOUT4_FIXTURE,
      compat: COMPAT_FIXTURE,
    });
    await ready;

    // Cast through unknown to bypass the typed enum on purpose — we're
    // exercising the runtime guard.
    const text = svc.getMethodologyContext(
      'morrowind' as unknown as 'skyrimse',
      1,
    );
    expect(text).toBe('');
  });

  it('throws when called before ready() resolves', () => {
    // Service is created in beforeEach but loadAll has not been awaited;
    // outstanding HTTP requests are still pending.
    expect(() => svc.getMethodologyContext('skyrimse', 1)).toThrowError(
      /not yet ready/,
    );
    // Drain the pending requests so afterEach's verify() passes.
    flushAll(http, {
      skyrim: SKYRIM_FIXTURE,
      fallout4: FALLOUT4_FIXTURE,
      compat: COMPAT_FIXTURE,
    });
  });

  it('does not leak <!-- section: --> or <!-- phases: --> metadata into output',
    async () => {
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      const text = svc.getMethodologyContext('skyrimse', 2);
      expect(text).not.toContain('<!-- section:');
      expect(text).not.toContain('<!-- phases:');
      expect(text).not.toContain('<!-- universal:');
    });

  it('produces a substantial methodology block for fallout4 phase 1',
    async () => {
      // Smoke test against the same fixture shape used in production. Confirms
      // the resolver actually fills the block (fixture is small but exercises
      // the full pipeline).
      const ready = svc.ready();
      flushAll(http, {
        skyrim: SKYRIM_FIXTURE,
        fallout4: FALLOUT4_FIXTURE,
        compat: COMPAT_FIXTURE,
      });
      await ready;

      const text = svc.getMethodologyContext('fallout4', 1);
      expect(text).toContain('FO4 phase 1 body');
      expect(text.length).toBeGreaterThan(80);
    });

  /**
   * REGRESSION PIN: production `skyrim.md` / `fallout4.md` currently use
   * `<tag>...</tag>` XML format with NO `<!-- section: id -->` markers, even
   * though `resolver.py` only parses the marker form. The Python resolver
   * therefore returns 0 game-sections and falls back to dumping the entire
   * file as `universal_principles` for every phase. This TS port reproduces
   * that exact behaviour. If/when the markdown is converted to use the
   * marker format (or the resolver is changed to parse <tag> blocks), this
   * test will need to flip — and the maintainer should update the
   * downstream prompts accordingly.
   */
  it('matches Python resolver against tag-only production-shape fixture',
    async () => {
      const PROD_SHAPE_SKYRIM = `<system_context>
game: skyrimse
</system_context>

# Skyrim Header

<version_management>
Body inside an XML tag (not a section marker).
</version_management>
`;
      const ready = svc.ready();
      flushAll(http, {
        skyrim: PROD_SHAPE_SKYRIM,
        fallout4: '',
        compat: '',
      });
      await ready;

      const phase1 = svc.getMethodologyContext('skyrimse', 1);
      const phase11 = svc.getMethodologyContext('skyrimse', 11);

      // No section parsing happens, but the tag body still ends up in the
      // universal_principles preamble (everything before the first
      // section marker becomes the preamble), so it appears in BOTH phases.
      expect(phase1).toContain('Body inside an XML tag');
      expect(phase11).toContain('Body inside an XML tag');
      // Phase 11 == phase 1 modulo the universal-compat-guidelines append
      // (which is empty here because the compat fixture is empty).
      expect(phase1).toEqual(phase11);
    });
});
