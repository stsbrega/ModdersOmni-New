import { TestBed } from '@angular/core/testing';
import { InstallGuideService } from './install-guide.service';
import { Game } from '../../shared/models/game.model';
import { Modlist } from '../../shared/models/mod.model';

/**
 * Test contract is the Python `install_guide.py` surface:
 *   - build_guide(modlist, game, entries) -> InstallGuide
 *   - guide_to_dict(guide), guide_to_markdown(guide, entries, game_domain)
 *
 * The plan's example tests assumed `buildMO2Payload` / `buildVortexPayload`
 * with flat `mods` arrays + `nexusModId`/`fileId`/`installOrder` fields.
 * Those don't exist in the Python; we test what does.
 */
describe('InstallGuideService', () => {
  let svc: InstallGuideService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(InstallGuideService);
  });

  const SKYRIM_GAME: Game = {
    id: 1,
    name: 'Skyrim Special Edition',
    slug: 'skyrimse',
    nexus_domain: 'skyrimspecialedition',
  };

  const FALLOUT_GAME: Game = {
    id: 2,
    name: 'Fallout 4',
    slug: 'fallout4',
    nexus_domain: 'fallout4',
  };

  const SKYRIM_AE_MODLIST: Modlist = {
    id: 'abcd1234-5678-90ab-cdef-1234567890ab',
    game_id: 1,
    game_version: 'AE',
    entries: [
      {
        nexus_mod_id: 17230,
        name: 'SKSE64',
        author: 'ianpatt',
        load_order: 1,
        is_patch: false,
      },
      {
        nexus_mod_id: 12604,
        name: 'SkyUI',
        author: 'SkyUI Team',
        load_order: 2,
        is_patch: false,
      },
      {
        nexus_mod_id: 9999,
        name: 'USSEP Patch',
        load_order: 3,
        is_patch: true,
        compatibility_notes: 'Loads after USSEP.',
      },
    ],
  };

  it('builds an InstallGuide with both MO2 and Vortex sections', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    expect(g.modlist_id).toBe(SKYRIM_AE_MODLIST.id);
    expect(g.game_name).toBe('Skyrim Special Edition');
    expect(g.game_slug).toBe('skyrimse');
    expect(g.mo2_section.id).toBe('mo2');
    expect(g.vortex_section.id).toBe('vortex');
    expect(g.mo2_section.steps.length).toBe(7);
    expect(g.vortex_section.steps.length).toBe(7);
  });

  it('counts mods vs. patches separately', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    // 2 non-patch entries, 1 patch entry.
    expect(g.mod_count).toBe(2);
    expect(g.patch_count).toBe(1);
  });

  it('renders a presentation game-version label from VERSION_LABELS', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    expect(g.game_version).toBe('Skyrim Anniversary Edition (1.6.1170+)');
  });

  it('selects the AE-specific SKSE build copy in step 2', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    const step2 = g.mo2_section.steps[1];
    expect(step2.title).toContain('SKSE64');
    expect(step2.body).toContain('AE 1.6.x build');
  });

  it('emits SE-specific version notes about USSEP/AE for AE modlists', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    expect(g.version_notes.length).toBeGreaterThan(0);
    expect(g.version_notes[0]).toContain('Anniversary Edition');
    expect(g.version_notes[0]).toContain('USSEP');
  });

  it('skyrim troubleshooting includes the FaceGen step; fallout4 does not', () => {
    const skyrim = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    expect(skyrim.troubleshooting.some((s) => s.title.includes('dark/grey faces'))).toBe(true);
    expect(skyrim.troubleshooting.some((s) => s.title.includes('downtown Boston'))).toBe(false);

    const f4ml: Modlist = {
      id: 'fffffff0-0000-0000-0000-000000000000',
      game_id: 2,
      game_version: 'Standard',
      entries: [],
    };
    const fallout = svc.buildGuide(f4ml, FALLOUT_GAME);
    expect(fallout.troubleshooting.some((s) => s.title.includes('downtown Boston'))).toBe(true);
    expect(fallout.troubleshooting.some((s) => s.title.includes('dark/grey faces'))).toBe(false);
  });

  it('records null version label when the modlist has no version recorded', () => {
    const noVer: Modlist = {
      id: 'no-version-modlist',
      game_id: 1,
      entries: [],
    };
    const g = svc.buildGuide(noVer, SKYRIM_GAME);
    expect(g.game_version).toBeNull();
    // Generic fallback note is emitted.
    expect(g.version_notes[0]).toContain('Game version was not recorded');
  });

  it('guideToDict produces a JSON-serializable plain object', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    const dict = svc.guideToDict(g);
    expect(typeof dict['modlist_id']).toBe('string');
    expect(Array.isArray(dict['version_notes'])).toBe(true);
    expect((dict['mo2_section'] as { steps: unknown[] }).steps.length).toBe(7);
    // Round-trip through JSON to confirm no Map/Set/circular structures.
    expect(() => JSON.parse(JSON.stringify(dict))).not.toThrow();
  });

  it('guideToMarkdown renders entries and Nexus URLs in install order', () => {
    const g = svc.buildGuide(SKYRIM_AE_MODLIST, SKYRIM_GAME);
    const md = svc.guideToMarkdown(g, SKYRIM_AE_MODLIST.entries, SKYRIM_GAME.nexus_domain);
    // Patch-flagged entry gets the PATCH: prefix.
    expect(md).toContain('PATCH: USSEP Patch');
    // Author surfaces.
    expect(md).toContain('by ianpatt');
    // Nexus URL with correct domain + mod id.
    expect(md).toContain('https://www.nexusmods.com/skyrimspecialedition/mods/17230');
    // Compatibility note line.
    expect(md).toContain('Loads after USSEP');
    // Header reflects the version label.
    expect(md).toContain('Anniversary Edition');
  });

  it('uses the Fallout 4 Standard SKSE/F4SE branch for FO4 Standard', () => {
    const f4ml: Modlist = {
      id: 'f4-modlist',
      game_id: 2,
      game_version: 'Standard',
      entries: [],
    };
    const g = svc.buildGuide(f4ml, FALLOUT_GAME);
    const step2 = g.mo2_section.steps[1];
    expect(step2.title).toContain('F4SE');
    expect(step2.body).toContain('pre-Next-Gen build');
    // Standard-specific note about downgrading is emitted.
    expect(g.version_notes.some((n) => n.includes('1.10.163'))).toBe(true);
  });
});
