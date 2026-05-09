import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { KnowledgeService } from './knowledge.service';

const SAMPLE_COMMON = `
<modding_common>
Universal rules.
</modding_common>

<phase_essentials>
Phase 1: install SKSE first.
</phase_essentials>

<phase_textures>
Watch VRAM budget.
</phase_textures>
`;

const SAMPLE_SKYRIM = `
<skyrim_essentials>
Address Library required.
</skyrim_essentials>

<skyrim_textures>
8K textures forbidden on 8GB VRAM.
</skyrim_textures>
`;

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

  it('loads markdown files on init', async () => {
    const ready = svc.ready();
    http.expectOne('/knowledge/modding_common.md').flush(SAMPLE_COMMON);
    http.expectOne('/knowledge/skyrim.md').flush(SAMPLE_SKYRIM);
    http.expectOne('/knowledge/fallout4.md').flush('');
    http.expectOne('/knowledge/compatibility_guidelines.md').flush('');
    await ready;
    expect(svc.isReady()).toBe(true);
  });

  it('resolveForPhase("skyrim", "essentials") includes both common and game sections', async () => {
    const ready = svc.ready();
    http.expectOne('/knowledge/modding_common.md').flush(SAMPLE_COMMON);
    http.expectOne('/knowledge/skyrim.md').flush(SAMPLE_SKYRIM);
    http.expectOne('/knowledge/fallout4.md').flush('');
    http.expectOne('/knowledge/compatibility_guidelines.md').flush('');
    await ready;

    const text = svc.resolveForPhase('skyrim', 'essentials');
    expect(text).toContain('Universal rules');
    expect(text).toContain('Phase 1: install SKSE');
    expect(text).toContain('Address Library required');
  });

  it('resolveForPhase scopes per-phase sections only', async () => {
    const ready = svc.ready();
    http.expectOne('/knowledge/modding_common.md').flush(SAMPLE_COMMON);
    http.expectOne('/knowledge/skyrim.md').flush(SAMPLE_SKYRIM);
    http.expectOne('/knowledge/fallout4.md').flush('');
    http.expectOne('/knowledge/compatibility_guidelines.md').flush('');
    await ready;

    const text = svc.resolveForPhase('skyrim', 'textures');
    expect(text).toContain('Watch VRAM budget');
    expect(text).toContain('8K textures forbidden');
    expect(text).not.toContain('install SKSE'); // essentials section excluded
  });
});
