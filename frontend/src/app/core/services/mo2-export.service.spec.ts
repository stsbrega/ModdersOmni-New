import { TestBed } from '@angular/core/testing';
import { Modlist } from '../../shared/models/mod.model';
import { NexusService } from './nexus.service';
import { Mo2ExportService, buildMo2Manifest, gameKeyForDomain } from './mo2-export.service';

const modlist: Modlist = {
  id: 'ml-abc-123456',
  game_id: 1,
  game_domain: 'skyrimspecialedition',
  created_at: '2026-10-10T12:00:00Z',
  entries: [
    { nexus_mod_id: 30379, name: 'SKSE64', file_id: 111 },
    { nexus_mod_id: 266, name: 'USSEP' },
    { name: 'No Nexus id' },
    { nexus_mod_id: 999, name: 'USSEP Patch', is_patch: true, patches_mods: ['USSEP', 'SkyUI'] },
  ],
};

describe('buildMo2Manifest', () => {
  it('produces the schema the MO2 plugin expects', () => {
    const m = buildMo2Manifest(modlist);
    expect(m.version.startsWith('2.')).toBeTrue();
    expect(m.game).toBe('skyrim');
    expect(m.mods.length).toBe(3); // entry without a Nexus id is dropped
    expect(m.mods[0]).toEqual({ modId: 30379, fileId: 111, name: 'SKSE64', installOrder: 1 });
    expect(m.mods[1].fileId).toBeNull();
    expect(m.mods[2].notes).toBe('Patch for USSEP + SkyUI');
  });

  it('maps Nexus domains to plugin game keys', () => {
    expect(gameKeyForDomain('fallout4')).toBe('fallout4');
    expect(gameKeyForDomain('skyrimspecialedition')).toBe('skyrim');
  });
});

describe('Mo2ExportService.exportManifest', () => {
  it('resolves missing file ids from Nexus and counts the rest as unresolved', async () => {
    const nexus = jasmine.createSpyObj<NexusService>('NexusService', ['getModFiles']);
    nexus.getModFiles.and.callFake(async (_domain: string, modId: number) =>
      modId === 266 ? [{ fileId: 2660, name: 'main', primary: true }] : [],
    );
    TestBed.configureTestingModule({ providers: [{ provide: NexusService, useValue: nexus }] });
    const svc = TestBed.inject(Mo2ExportService);

    const { manifest, unresolved } = await svc.exportManifest(modlist);

    expect(nexus.getModFiles).toHaveBeenCalledTimes(2); // SKSE64 already had one
    expect(manifest.mods[1].fileId).toBe(2660);
    expect(manifest.mods[2].fileId).toBeNull();
    expect(unresolved).toBe(1);
  });
});
