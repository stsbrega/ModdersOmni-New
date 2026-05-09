# Plan 1 — Foundation + Pipeline Port + Behind-Flag UI Cutover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the FastAPI generation pipeline and supporting services to TypeScript Angular services, ship the knowledge base and DB-seeded data as static assets, and wire the existing generation UI to use the new client pipeline behind a `useClientPipeline` feature flag. After this plan, flipping the flag runs the entire generation flow client-side; flipping it off restores the existing backend SSE flow as a fallback.

**Architecture:** TypeScript Angular services mirror the Python `app/services/` layer one-for-one. Knowledge markdown files and seed data ship under `frontend/public/` and load via `fetch()` at app startup. LLM SDKs run direct in the browser (Anthropic with `anthropic-dangerous-direct-browser-access: true`, OpenAI with `dangerouslyAllowBrowser: true`, Gemini and Groq via REST, OpenRouter via OpenAI-compatible client, Ollama via direct fetch). A feature flag in localStorage determines whether the generation UI calls the client pipeline or the legacy backend SSE endpoint.

**Tech Stack:** Angular 19 (standalone components, signals), TypeScript 5.7, RxJS 7, `@anthropic-ai/sdk`, `openai`, `@google/genai`, native `fetch` for Groq/OpenRouter/Ollama, Jasmine + Karma for tests.

**Source spec:** [`docs/superpowers/specs/2026-05-09-static-bundle-refactor-design.md`](../specs/2026-05-09-static-bundle-refactor-design.md)

**Working repo:** `C:\Users\stsbr\Documents\ModdersOmni-New`. The OLD repo at `C:\Users\stsbr\Documents\ModdersOmni` is being archived and must not be touched.

---

## File Structure

### Created (new files)

**Static assets:**
- `frontend/public/knowledge/modding_common.md`
- `frontend/public/knowledge/skyrim.md`
- `frontend/public/knowledge/fallout4.md`
- `frontend/public/knowledge/compatibility_guidelines.md`
- `frontend/public/data/games.json`
- `frontend/public/data/build-phases.skyrim.json`
- `frontend/public/data/build-phases.fallout4.json`
- `frontend/public/data/playstyles.json`
- `frontend/public/data/compatibility-rules.json`

**Core services (Angular DI-injected):**
- `frontend/src/app/core/services/feature-flags.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/nexus.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/knowledge.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/spec-parser.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/install-guide.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/modlist-store.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/llm/registry.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/llm/dispatcher.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/llm/types.ts` (no test, types only)

**Generation namespace:**
- `frontend/src/app/core/services/generation/preset.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/prompts.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/session.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/errors.ts` (no test)
- `frontend/src/app/core/services/generation/sub-pass.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/tools.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/reviewer.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/pipeline.service.ts` (+ `.spec.ts`)
- `frontend/src/app/core/services/generation/types.ts` (no test, types only)

**Tooling (one-shot extraction scripts, deleted in Plan 3 along with backend):**
- `frontend/scripts/dump_seed_data.py` — Python script that prints seed records as JSON
- `frontend/scripts/extract-seed-data.ts` — Node wrapper that runs the Python script and writes JSON files

### Modified

- `frontend/angular.json` — verify `public/` is in assets glob
- `frontend/src/app/core/services/generation.service.ts` — feature-flag branch (Task 14)
- `frontend/package.json` — add LLM SDK dependencies

### Read-only references (existing source the engineer mirrors)

- `backend/app/services/nexus_client.py` (279 LOC)
- `backend/app/services/spec_parser.py` (401 LOC)
- `backend/app/services/install_guide.py` (428 LOC)
- `backend/app/services/generation/preset.py` (51 LOC)
- `backend/app/services/generation/prompts.py` (498 LOC)
- `backend/app/services/generation/session.py` (130 LOC)
- `backend/app/services/generation/exceptions.py` (31 LOC)
- `backend/app/services/generation/sub_pass.py` (46 LOC)
- `backend/app/services/generation/tools.py` (190 LOC)
- `backend/app/services/generation/handlers.py` (606 LOC)
- `backend/app/services/generation/reviewer.py` (539 LOC)
- `backend/app/services/generation/pipeline.py` (907 LOC)
- `backend/app/llm/registry.py` (285 LOC)
- `backend/app/llm/dispatcher.py` (206 LOC)
- `backend/app/llm/provider.py` (352 LOC)
- `backend/app/knowledge/resolver.py` (317 LOC)
- `backend/app/knowledge/*.md` — the 4 markdown files
- `backend/app/seeds/seed_data.py` — DB seed source

---

## Tasks

### Task 1: Feature flag service

**Files:**
- Create: `frontend/src/app/core/services/feature-flags.service.ts`
- Test: `frontend/src/app/core/services/feature-flags.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// feature-flags.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('useClientPipeline defaults to false when not set', () => {
    const svc = TestBed.inject(FeatureFlagsService);
    expect(svc.useClientPipeline()).toBe(false);
  });

  it('reads useClientPipeline from localStorage', () => {
    localStorage.setItem('feature.useClientPipeline', 'true');
    const svc = TestBed.inject(FeatureFlagsService);
    expect(svc.useClientPipeline()).toBe(true);
  });

  it('setUseClientPipeline persists to localStorage and updates signal', () => {
    const svc = TestBed.inject(FeatureFlagsService);
    svc.setUseClientPipeline(true);
    expect(localStorage.getItem('feature.useClientPipeline')).toBe('true');
    expect(svc.useClientPipeline()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx ng test --watch=false --include=**/feature-flags.service.spec.ts`
Expected: FAIL — "Cannot find module './feature-flags.service'"

- [ ] **Step 3: Implement the service**

```typescript
// feature-flags.service.ts
import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  readonly useClientPipeline: WritableSignal<boolean>;

  constructor() {
    const stored = localStorage.getItem('feature.useClientPipeline') === 'true';
    this.useClientPipeline = signal(stored);
  }

  setUseClientPipeline(value: boolean): void {
    localStorage.setItem('feature.useClientPipeline', String(value));
    this.useClientPipeline.set(value);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/feature-flags.service.spec.ts`
Expected: PASS (3 specs)

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/feature-flags.service.ts frontend/src/app/core/services/feature-flags.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): add useClientPipeline feature flag service"
```

---

### Task 2: Migrate knowledge files to public assets

**Files:**
- Create: `frontend/public/knowledge/modding_common.md` (copy of `backend/app/knowledge/modding_common.md`)
- Create: `frontend/public/knowledge/skyrim.md` (copy)
- Create: `frontend/public/knowledge/fallout4.md` (copy)
- Create: `frontend/public/knowledge/compatibility_guidelines.md` (copy)
- Verify: `frontend/angular.json` includes `public/` in assets

- [ ] **Step 1: Copy the four markdown files**

```bash
mkdir -p /c/Users/stsbr/Documents/ModdersOmni-New/frontend/public/knowledge
cp /c/Users/stsbr/Documents/ModdersOmni-New/backend/app/knowledge/modding_common.md /c/Users/stsbr/Documents/ModdersOmni-New/frontend/public/knowledge/
cp /c/Users/stsbr/Documents/ModdersOmni-New/backend/app/knowledge/skyrim.md /c/Users/stsbr/Documents/ModdersOmni-New/frontend/public/knowledge/
cp /c/Users/stsbr/Documents/ModdersOmni-New/backend/app/knowledge/fallout4.md /c/Users/stsbr/Documents/ModdersOmni-New/frontend/public/knowledge/
cp /c/Users/stsbr/Documents/ModdersOmni-New/backend/app/knowledge/compatibility_guidelines.md /c/Users/stsbr/Documents/ModdersOmni-New/frontend/public/knowledge/
```

- [ ] **Step 2: Verify Angular asset config**

Open `frontend/angular.json`. Find the `architect.build.options.assets` array. Confirm an entry like `{"glob": "**/*", "input": "public", "output": ""}` (or `"src/public"` depending on existing convention) covers the new `public/knowledge/` files. If missing, add it. Angular 19 default templates include `public/` automatically; this step is verification only.

- [ ] **Step 3: Smoke test the dev server serves the files**

```bash
cd /c/Users/stsbr/Documents/ModdersOmni-New/frontend && npm start &
# Wait ~10s for "Application bundle generation complete" in stdout
curl -sI http://localhost:4200/knowledge/skyrim.md | head -1
# Expected: HTTP/1.1 200 OK
kill %1
```

If the curl returns 404, the assets glob is misconfigured — fix `angular.json` and retry.

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/public/knowledge/
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(static): ship knowledge base as static assets under public/knowledge/"
```

---

### Task 3: Generate static data JSON from DB seeds

**Files:**
- Create: `frontend/scripts/dump_seed_data.py` — Python dump script (run via Python interpreter directly)
- Create: `frontend/scripts/extract-seed-data.ts` — Node wrapper using `execFileSync` (no shell interpolation)
- Create: `frontend/public/data/games.json`
- Create: `frontend/public/data/build-phases.skyrim.json`
- Create: `frontend/public/data/build-phases.fallout4.json`
- Create: `frontend/public/data/playstyles.json`
- Create: `frontend/public/data/compatibility-rules.json`

The DB seeds in `backend/app/seeds/seed_data.py` are the source of truth for games, build phases, playstyles, and default compatibility rules. We extract them once, write JSON, and ship as static assets. The extraction is one-shot — after this task, the JSON files are committed and the Python source is no longer authoritative for these tables.

- [ ] **Step 1: Read `backend/app/seeds/seed_data.py` and identify the seed records**

Required tables from the spec: `games`, `mod_build_phases` (per game), `playstyles`, `compatibility` (default rules). Read the Python file to understand the shape of each record and the exact symbol names (`GAMES`, `BUILD_PHASES`, `PLAYSTYLES`, `COMPATIBILITY_RULES`, or whatever they actually are). Note any `JSON` columns or relationships that need flattening.

- [ ] **Step 2: Write the Python dump script**

```python
# frontend/scripts/dump_seed_data.py
"""
One-shot seed extractor. Run via:
    python frontend/scripts/dump_seed_data.py

Prints JSON to stdout. The Node wrapper at extract-seed-data.ts captures
this output and writes the per-table JSON files under public/data/.
"""
import json
import os
import sys

# Make backend/ importable (repo root is two levels up from this file).
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'backend'))

from app.seeds import seed_data  # noqa: E402

# Adjust these symbol names to match what seed_data.py actually exports.
out = {
    'games': seed_data.GAMES,
    'build_phases_skyrim': seed_data.BUILD_PHASES.get('skyrim', []),
    'build_phases_fallout4': seed_data.BUILD_PHASES.get('fallout4', []),
    'playstyles': seed_data.PLAYSTYLES,
    'compatibility_rules': seed_data.COMPATIBILITY_RULES,
}

print(json.dumps(out, default=str))
```

If the actual symbol names in `seed_data.py` differ (e.g., `GAMES_SEED`, `BUILD_PHASE_DEFINITIONS`), edit the dump script's last block accordingly. Read the file first — do not assume.

- [ ] **Step 3: Write the Node wrapper using `execFileSync` (no shell interpolation)**

```typescript
// frontend/scripts/extract-seed-data.ts
// Run once with: npx tsx frontend/scripts/extract-seed-data.ts
//
// One-shot. Re-run only matters if backend/app/seeds/seed_data.py changes
// before the backend is deleted (Plan 3).

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PY_SCRIPT = join(HERE, 'dump_seed_data.py');
const OUT_DIR = join(HERE, '..', 'public', 'data');

mkdirSync(OUT_DIR, { recursive: true });

// execFileSync — args are passed as an array, no shell interpretation.
const stdout = execFileSync('python', [PY_SCRIPT], { encoding: 'utf-8' });
const data = JSON.parse(stdout);

const writes: Array<[string, unknown]> = [
  ['games.json', data.games],
  ['build-phases.skyrim.json', data.build_phases_skyrim],
  ['build-phases.fallout4.json', data.build_phases_fallout4],
  ['playstyles.json', data.playstyles],
  ['compatibility-rules.json', data.compatibility_rules],
];

for (const [filename, payload] of writes) {
  writeFileSync(join(OUT_DIR, filename), JSON.stringify(payload, null, 2));
  console.log('wrote', filename);
}
```

This uses `execFileSync('python', [PY_SCRIPT])` rather than `execSync('python ' + path)`. The args go through `execve(2)` directly — no shell, no interpolation, no command-injection surface even if the path contained spaces or special characters.

- [ ] **Step 4: Run the script**

```bash
cd /c/Users/stsbr/Documents/ModdersOmni-New
mkdir -p frontend/public/data
npx tsx frontend/scripts/extract-seed-data.ts
ls frontend/public/data/
# Expected output:
#   games.json
#   build-phases.skyrim.json
#   build-phases.fallout4.json
#   playstyles.json
#   compatibility-rules.json
```

If `tsx` is not available: `npm install --save-dev tsx` first.

- [ ] **Step 5: Spot-check the output**

Read each JSON file. Verify shapes:

- `games.json` is an array of `{id, name, slug, ...}` objects, at least Skyrim and Fallout 4.
- `build-phases.skyrim.json` is an array of phase objects ordered by `phase_index`. Required fields: `phaseIndex`, `name`, `displayName`, `maxMods`, `scaleWeight`. Field names may need camelCase normalization in the dump script if Python uses `snake_case` keys.
- `playstyles.json` is an array of `{id, name, description, ...}` objects.
- `compatibility-rules.json` is an array of rule objects.

If any shape looks wrong, fix the dump script and re-run. Do NOT hand-edit the JSON.

- [ ] **Step 6: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/scripts/dump_seed_data.py frontend/scripts/extract-seed-data.ts frontend/public/data/
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(static): ship games, build phases, playstyles, compat rules as JSON assets"
```

---

### Task 4: Port KnowledgeService

**Files:**
- Create: `frontend/src/app/core/services/knowledge.service.ts`
- Test: `frontend/src/app/core/services/knowledge.service.spec.ts`
- Reference: `backend/app/knowledge/resolver.py` (317 LOC)

The Python resolver parses the hybrid Markdown+XML format (`<section_name>` tags) at import time and exposes `resolve_for_phase(game, phase) -> str`. The TS port loads markdown files via `fetch()` once at app startup, parses sections into a `Map<string, string>`, and exposes the same method.

- [ ] **Step 1: Write the failing tests**

```typescript
// knowledge.service.spec.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx ng test --watch=false --include=**/knowledge.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service**

Read `backend/app/knowledge/resolver.py` first. The TS port mirrors:
- The XML-tag section parsing (regex `/<(\w+)>([\s\S]*?)<\/\1>/g`)
- The phase-to-sections mapping (a dict in Python; a `Record<string, string[]>` in TS)
- The `resolve_for_phase(game, phase)` method that concatenates `modding_common` sections + game-specific sections

```typescript
// knowledge.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type Game = 'skyrim' | 'fallout4';

const FILES = ['modding_common', 'skyrim', 'fallout4', 'compatibility_guidelines'] as const;

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly http = inject(HttpClient);
  private readonly sections = new Map<string, string>(); // sectionName -> content
  private readonly readyState = signal(false);
  private readyPromise: Promise<void>;

  // Map phase → list of section names to inject. Mirror the Python PHASE_SECTIONS dict.
  // Concrete entries are derived from the markdown's <section_name> tags.
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
```

The exact phase keys (`essentials`, `ui`, `textures`, …) and the section-name conventions (`phase_<phase>`, `<game>_<phase>`) MUST match what the Python resolver uses and what the actual markdown files contain. Read `backend/app/knowledge/resolver.py` and verify before implementing — adjust the maps if the Python uses different names.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/knowledge.service.spec.ts`
Expected: PASS (3 specs)

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/knowledge.service.ts frontend/src/app/core/services/knowledge.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): port KnowledgeService — phase-aware markdown resolver"
```

---

### Task 5: Port NexusService

**Files:**
- Create: `frontend/src/app/core/services/nexus.service.ts`
- Test: `frontend/src/app/core/services/nexus.service.spec.ts`
- Reference: `backend/app/services/nexus_client.py` (279 LOC)

GraphQL v2 unauthenticated reads: `searchMods(query, gameDomain)`, `getMod(modId, gameDomain)`. Mirror the queries from the Python file verbatim.

- [ ] **Step 1: Write the failing tests**

```typescript
// nexus.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NexusService } from './nexus.service';

const NEXUS_URL = 'https://api.nexusmods.com/v2/graphql';

describe('NexusService', () => {
  let svc: NexusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(NexusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searchMods POSTs to GraphQL endpoint with the search query', async () => {
    const promise = svc.searchMods('SkyUI', 'skyrimspecialedition');
    const req = http.expectOne(NEXUS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.query).toContain('searchMods');
    expect(req.request.body.variables.term).toBe('SkyUI');
    req.flush({ data: { search: { nodes: [{ modId: 12345, name: 'SkyUI' }] } } });
    const result = await promise;
    expect(result[0].name).toBe('SkyUI');
  });

  it('getMod returns typed mod details', async () => {
    const promise = svc.getMod(12345, 'skyrimspecialedition');
    const req = http.expectOne(NEXUS_URL);
    expect(req.request.body.variables.modId).toBe(12345);
    req.flush({
      data: {
        legacyMod: {
          modId: 12345,
          name: 'SkyUI',
          summary: 'UI overhaul',
          author: 'SkyUI Team',
          downloads: 5000000,
          endorsements: 200000,
          createdAt: '2012-01-01',
          updatedAt: '2017-01-01',
          fileSize: 1234567,
          version: '5.2',
          category: { name: 'User Interface' },
        },
      },
    });
    const mod = await promise;
    expect(mod.modId).toBe(12345);
    expect(mod.name).toBe('SkyUI');
  });

  it('throws on GraphQL errors response', async () => {
    const promise = svc.searchMods('x', 'skyrimspecialedition');
    const req = http.expectOne(NEXUS_URL);
    req.flush({ errors: [{ message: 'rate limited' }] });
    await expectAsync(promise).toBeRejectedWithError(/rate limited/);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd frontend && npx ng test --watch=false --include=**/nexus.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement the service**

Read `backend/app/services/nexus_client.py` first. Identify the exact GraphQL query strings used for search and getMod — copy them into the TS file verbatim.

```typescript
// nexus.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const NEXUS_URL = 'https://api.nexusmods.com/v2/graphql';

export interface NexusModSummary {
  modId: number;
  name: string;
  summary?: string;
  author?: string;
  downloads?: number;
}

export interface NexusModDetails extends NexusModSummary {
  endorsements?: number;
  createdAt?: string;
  updatedAt?: string;
  fileSize?: number;
  version?: string;
  category?: string;
}

const SEARCH_QUERY = /* mirror exactly from nexus_client.py SEARCH_QUERY */ `
query SearchMods($term: String!, $gameDomain: String!) {
  search(filter: { searchTerm: { value: $term }, gameDomain: { value: $gameDomain } }) {
    nodes { modId name summary author downloads }
  }
}
`;

const GET_MOD_QUERY = /* mirror exactly from nexus_client.py GET_MOD_QUERY */ `
query GetMod($modId: Int!, $gameDomain: String!) {
  legacyMod(id: $modId, gameDomain: $gameDomain) {
    modId name summary author downloads endorsements
    createdAt updatedAt fileSize version
    category { name }
  }
}
`;

@Injectable({ providedIn: 'root' })
export class NexusService {
  private readonly http = inject(HttpClient);

  async searchMods(term: string, gameDomain: string): Promise<NexusModSummary[]> {
    const body = { query: SEARCH_QUERY, variables: { term, gameDomain } };
    const res = await firstValueFrom(this.http.post<any>(NEXUS_URL, body));
    if (res.errors?.length) {
      throw new Error(`Nexus GraphQL: ${res.errors[0].message}`);
    }
    return (res.data?.search?.nodes ?? []) as NexusModSummary[];
  }

  async getMod(modId: number, gameDomain: string): Promise<NexusModDetails> {
    const body = { query: GET_MOD_QUERY, variables: { modId, gameDomain } };
    const res = await firstValueFrom(this.http.post<any>(NEXUS_URL, body));
    if (res.errors?.length) {
      throw new Error(`Nexus GraphQL: ${res.errors[0].message}`);
    }
    const m = res.data?.legacyMod;
    return { ...m, category: m?.category?.name } as NexusModDetails;
  }
}
```

The exact query strings in `SEARCH_QUERY` and `GET_MOD_QUERY` MUST be copied verbatim from the Python client. The placeholder above shows the shape — replace with the literal queries from `nexus_client.py`.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/nexus.service.spec.ts`
Expected: PASS (3 specs)

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/nexus.service.ts frontend/src/app/core/services/nexus.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): port NexusService — unauthenticated GraphQL v2 client"
```

---

### Task 6: Port LLM registry + dispatcher (6 providers)

**Files:**
- Create: `frontend/src/app/core/services/llm/types.ts`
- Create: `frontend/src/app/core/services/llm/registry.ts`
- Create: `frontend/src/app/core/services/llm/registry.spec.ts`
- Create: `frontend/src/app/core/services/llm/dispatcher.service.ts`
- Create: `frontend/src/app/core/services/llm/dispatcher.service.spec.ts`
- Modify: `frontend/package.json` — add `@anthropic-ai/sdk`, `openai`, `@google/genai`
- Reference: `backend/app/llm/registry.py` (285 LOC), `backend/app/llm/dispatcher.py` (206 LOC), `backend/app/llm/provider.py` (352 LOC)

This is the largest non-pipeline task. Six providers to support: anthropic, openai, gemini, groq, openrouter, ollama. The Python registry handled 14; we keep only the 6 listed in spec Decision 4.

- [ ] **Step 1: Install LLM SDK dependencies**

```bash
cd /c/Users/stsbr/Documents/ModdersOmni-New/frontend
npm install @anthropic-ai/sdk openai @google/genai
```

- [ ] **Step 2: Write the types file**

```typescript
// llm/types.ts
export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'openrouter' | 'ollama';

export interface LLMConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;        // not required for ollama (local)
  baseUrl?: string;       // ollama only — defaults to http://localhost:11434
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object;     // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: object;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;    // for role='tool'
  toolCalls?: ToolCall[]; // for role='assistant'
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_use' | 'length' | 'error';
  usage?: { inputTokens: number; outputTokens: number };
}
```

- [ ] **Step 3: Write the registry test**

```typescript
// llm/registry.spec.ts
import { PROVIDERS, defaultModelFor } from './registry';

describe('LLM registry', () => {
  it('exposes exactly the 6 supported providers', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(
      ['anthropic', 'gemini', 'groq', 'ollama', 'openai', 'openrouter'].sort(),
    );
  });

  it('every provider has a default model', () => {
    for (const id of Object.keys(PROVIDERS)) {
      expect(defaultModelFor(id as any)).toBeTruthy();
    }
  });

  it('anthropic default model is a Claude 4 family ID', () => {
    expect(defaultModelFor('anthropic')).toMatch(/claude-(opus|sonnet|haiku)-4/);
  });
});
```

- [ ] **Step 4: Implement the registry**

```typescript
// llm/registry.ts
import { ProviderId } from './types';

interface ProviderMeta {
  displayName: string;
  defaultModel: string;
  models: string[];
  apiKeyHint: string;
  apiKeyUrl?: string;
  requiresKey: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    displayName: 'Anthropic',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    apiKeyHint: 'sk-ant-...',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    requiresKey: true,
  },
  openai: {
    displayName: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
    apiKeyHint: 'sk-...',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true,
  },
  gemini: {
    displayName: 'Google Gemini',
    defaultModel: 'gemini-2.5-pro',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash'],
    apiKeyHint: 'AIza...',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    requiresKey: true,
  },
  groq: {
    displayName: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    apiKeyHint: 'gsk_...',
    apiKeyUrl: 'https://console.groq.com/keys',
    requiresKey: true,
  },
  openrouter: {
    displayName: 'OpenRouter',
    defaultModel: 'anthropic/claude-sonnet-4',
    models: [
      'anthropic/claude-opus-4',
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    apiKeyHint: 'sk-or-v1-...',
    apiKeyUrl: 'https://openrouter.ai/keys',
    requiresKey: true,
  },
  ollama: {
    displayName: 'Ollama (Local)',
    defaultModel: 'llama3.3',
    models: ['llama3.3', 'qwen2.5:32b', 'gemma3:27b', 'deepseek-r1'],
    apiKeyHint: '(no key required)',
    requiresKey: false,
  },
};

export function defaultModelFor(provider: ProviderId): string {
  return PROVIDERS[provider].defaultModel;
}
```

The exact model lists should be the latest available at the time of porting — verify against current provider documentation. The `claude-haiku-4-5-20251001` ID is the dated form. If a newer Sonnet/Opus has been released, prefer it.

- [ ] **Step 5: Run registry tests to verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/registry.spec.ts`
Expected: PASS (3 specs)

- [ ] **Step 6: Write the dispatcher test**

```typescript
// llm/dispatcher.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { LLMDispatcherService } from './dispatcher.service';
import { LLMConfig } from './types';

describe('LLMDispatcherService', () => {
  let svc: LLMDispatcherService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(LLMDispatcherService);
  });

  it('throws when an Anthropic config has no apiKey', async () => {
    const cfg: LLMConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    await expectAsync(
      svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
    ).toBeRejectedWithError(/api key required/i);
  });

  it('does not require a key for ollama', () => {
    const cfg: LLMConfig = { provider: 'ollama', model: 'llama3.3' };
    expect(() => svc.validateConfig(cfg)).not.toThrow();
  });

  it('throws on unsupported provider', async () => {
    const cfg = { provider: 'cohere' as any, model: 'command-r' };
    await expectAsync(
      svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
    ).toBeRejectedWithError(/unsupported provider/i);
  });
});
```

- [ ] **Step 7: Implement the dispatcher**

The dispatcher is a fan-out: it accepts an `LLMConfig` + `LLMRequest` and routes to a per-provider adapter that translates to the SDK's call shape and back. Given the size, the implementation is intentionally split: one method per provider.

```typescript
// llm/dispatcher.service.ts
import { Injectable } from '@angular/core';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { LLMConfig, LLMRequest, LLMResponse, ProviderId } from './types';
import { PROVIDERS } from './registry';

@Injectable({ providedIn: 'root' })
export class LLMDispatcherService {
  validateConfig(cfg: LLMConfig): void {
    const meta = PROVIDERS[cfg.provider];
    if (!meta) throw new Error(`Unsupported provider: ${cfg.provider}`);
    if (meta.requiresKey && !cfg.apiKey) {
      throw new Error(`${meta.displayName} API key required`);
    }
  }

  async complete(cfg: LLMConfig, req: LLMRequest): Promise<LLMResponse> {
    this.validateConfig(cfg);
    switch (cfg.provider) {
      case 'anthropic':   return this.callAnthropic(cfg, req);
      case 'openai':      return this.callOpenAICompatible(cfg, req, 'https://api.openai.com/v1');
      case 'gemini':      return this.callGemini(cfg, req);
      case 'groq':        return this.callOpenAICompatible(cfg, req, 'https://api.groq.com/openai/v1');
      case 'openrouter':  return this.callOpenAICompatible(cfg, req, 'https://openrouter.ai/api/v1');
      case 'ollama':      return this.callOllama(cfg, req);
      default:            throw new Error(`Unsupported provider: ${(cfg as any).provider}`);
    }
  }

  private async callAnthropic(cfg: LLMConfig, req: LLMRequest): Promise<LLMResponse> {
    const client = new Anthropic({
      apiKey: cfg.apiKey!,
      defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
    });
    // Translate LLMRequest → Anthropic Messages API request.
    // Mirror the Python provider.py shape: extract system message, map tool defs, etc.
    // ... (full mapping — see backend/app/llm/provider.py callAnthropic equivalent)
    throw new Error('TODO: complete anthropic mapping per provider.py reference');
  }

  private async callOpenAICompatible(
    cfg: LLMConfig, req: LLMRequest, baseURL: string,
  ): Promise<LLMResponse> {
    const client = new OpenAI({
      apiKey: cfg.apiKey!,
      baseURL,
      dangerouslyAllowBrowser: true,
    });
    // Translate per OpenAI Chat Completions API.
    throw new Error('TODO: complete openai-compatible mapping');
  }

  private async callGemini(cfg: LLMConfig, req: LLMRequest): Promise<LLMResponse> {
    const client = new GoogleGenAI({ apiKey: cfg.apiKey! });
    throw new Error('TODO: complete gemini mapping');
  }

  private async callOllama(cfg: LLMConfig, req: LLMRequest): Promise<LLMResponse> {
    const baseUrl = cfg.baseUrl ?? 'http://localhost:11434';
    // Ollama exposes a /api/chat endpoint with OpenAI-ish shape.
    throw new Error('TODO: complete ollama mapping');
  }
}
```

The four `TODO` provider methods need to be filled in before the dispatcher tests will pass any runtime call. The skeleton above intentionally leaves them as failing placeholders — the engineer fills each one by reading the Python `provider.py` and mirroring the request/response translation. Each provider is an independent commit:

1. Implement `callAnthropic`, run dispatcher tests, commit.
2. Implement `callOpenAICompatible`, run, commit.
3. Implement `callGemini`, run, commit.
4. Implement `callOllama`, run, commit.

For each provider, the test that exercises real translation logic looks like:

```typescript
// Example: anthropic-specific test (add to dispatcher.service.spec.ts)
it('callAnthropic translates LLMRequest to Anthropic Messages shape', async () => {
  // Mock Anthropic SDK client; verify the request body shape it receives
  // matches expected: system extracted, tools mapped to anthropic tool schema,
  // messages mapped role-by-role.
});
```

Tool-call translation (Anthropic uses `tool_use` blocks; OpenAI uses `tool_calls` array; Gemini uses `functionCall`) is the trickiest part. The Python provider abstracts these — port that abstraction.

- [ ] **Step 8: Run all dispatcher tests to verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/dispatcher.service.spec.ts`
Expected: PASS (initially 3 specs from validation; each provider impl adds more)

- [ ] **Step 9: Commit (after all four provider methods implemented)**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/llm/ frontend/package.json frontend/package-lock.json
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): port LLM dispatcher pruned to 6 browser-direct providers"
```

---

### Task 7: Port SpecParserService

**Files:**
- Create: `frontend/src/app/core/services/spec-parser.service.ts`
- Test: `frontend/src/app/core/services/spec-parser.service.spec.ts`
- Reference: `backend/app/services/spec_parser.py` (401 LOC)

Parses natural-language hardware descriptions ("RTX 4080, 32GB DDR5, 12GB VRAM") into a typed `HardwareSpec`. The Python version uses regex pattern matching plus a curated GPU/CPU lookup table. Mirror it.

- [ ] **Step 1: Write the failing tests**

```typescript
// spec-parser.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SpecParserService } from './spec-parser.service';

describe('SpecParserService', () => {
  let svc: SpecParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(SpecParserService);
  });

  it('parses a complete modern spec', () => {
    const result = svc.parse('RTX 4080 16GB, Ryzen 7 7800X3D, 32GB DDR5');
    expect(result.gpu).toBe('RTX 4080');
    expect(result.vramGb).toBe(16);
    expect(result.cpu).toContain('7800X3D');
    expect(result.ramGb).toBe(32);
  });

  it('infers VRAM from GPU lookup when not explicit', () => {
    const result = svc.parse('RTX 3080, 16GB RAM');
    expect(result.vramGb).toBe(10); // RTX 3080 default
  });

  it('returns nulls for missing fields', () => {
    const result = svc.parse('RTX 4080');
    expect(result.cpu).toBeNull();
    expect(result.ramGb).toBeNull();
  });

  it('handles GTX-era cards', () => {
    const result = svc.parse('GTX 1080 Ti');
    expect(result.vramGb).toBe(11);
  });
});
```

- [ ] **Step 2-5: Run tests to fail, implement, run to pass, commit**

Read `backend/app/services/spec_parser.py`. The implementation is mostly:

- A `GPU_VRAM_TABLE` dict mapping GPU names to default VRAM
- Regex patterns for "(\d+)\s*GB\s*RAM", "(\d+)\s*GB\s*VRAM", etc.
- A `parse(text: str) -> HardwareSpec` function

Port verbatim. Commit:

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/spec-parser.service.ts frontend/src/app/core/services/spec-parser.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): port SpecParserService — natural-language hardware spec parser"
```

---

### Task 8: Port InstallGuideService

**Files:**
- Create: `frontend/src/app/core/services/install-guide.service.ts`
- Test: `frontend/src/app/core/services/install-guide.service.spec.ts`
- Reference: `backend/app/services/install_guide.py` (428 LOC)

Builds the JSON payload + readme that MO2 and Vortex consume. Pure transformation: takes a `Modlist` + `Game`, returns `MO2Payload` and `VortexPayload`.

- [ ] **Step 1: Write the failing tests**

```typescript
// install-guide.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { InstallGuideService } from './install-guide.service';
import { Modlist } from '../../shared/models/mod.model'; // adjust import to actual model location

describe('InstallGuideService', () => {
  let svc: InstallGuideService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(InstallGuideService);
  });

  const SAMPLE_MODLIST: Modlist = {
    id: 'm1',
    name: 'Dark Fantasy Skyrim',
    game: 'skyrim',
    mods: [
      { modId: 12604, fileId: 9999, name: 'SkyUI', installOrder: 1, notes: '' },
      { modId: 17230, fileId: 8888, name: 'SKSE', installOrder: 0, notes: 'Install first' },
    ],
    createdAt: '2026-05-09T00:00:00Z',
  } as any;

  it('buildMO2Payload preserves install order ascending', () => {
    const p = svc.buildMO2Payload(SAMPLE_MODLIST);
    expect(p.mods[0].name).toBe('SKSE');
    expect(p.mods[1].name).toBe('SkyUI');
  });

  it('buildMO2Payload includes game and version metadata', () => {
    const p = svc.buildMO2Payload(SAMPLE_MODLIST);
    expect(p.game).toBe('skyrim');
    expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('buildVortexPayload uses Vortex-shaped fields', () => {
    const p = svc.buildVortexPayload(SAMPLE_MODLIST);
    expect(p.mods[0].nexusModId).toBe(17230);
    expect(p.mods[0].fileId).toBe(8888);
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

Mirror `install_guide.py`. Commit:

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/install-guide.service.ts frontend/src/app/core/services/install-guide.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): port InstallGuideService — MO2/Vortex payload builders"
```

---

### Task 9: Implement ModlistStore (new — localStorage)

**Files:**
- Create: `frontend/src/app/core/services/modlist-store.service.ts`
- Test: `frontend/src/app/core/services/modlist-store.service.spec.ts`

No Python source — this is new. Replaces the backend's `Modlist` SQLAlchemy CRUD with a localStorage-backed equivalent.

- [ ] **Step 1: Write the failing tests**

```typescript
// modlist-store.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { ModlistStore } from './modlist-store.service';

describe('ModlistStore', () => {
  let svc: ModlistStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ModlistStore);
  });

  it('list() returns empty array when none saved', () => {
    expect(svc.list()).toEqual([]);
  });

  it('save() then list() returns the saved modlist', () => {
    const ml = { id: 'a', name: 'Test', game: 'skyrim', mods: [], createdAt: '2026-05-09' } as any;
    svc.save(ml);
    expect(svc.list().length).toBe(1);
    expect(svc.list()[0].id).toBe('a');
  });

  it('get(id) returns the matching modlist', () => {
    const ml = { id: 'a', name: 'Test', game: 'skyrim', mods: [], createdAt: '2026-05-09' } as any;
    svc.save(ml);
    expect(svc.get('a')?.name).toBe('Test');
  });

  it('delete(id) removes the modlist', () => {
    const ml = { id: 'a', name: 'Test', game: 'skyrim', mods: [], createdAt: '2026-05-09' } as any;
    svc.save(ml);
    svc.delete('a');
    expect(svc.list()).toEqual([]);
  });

  it('save() with same id overwrites', () => {
    const ml1 = { id: 'a', name: 'V1', game: 'skyrim', mods: [], createdAt: '2026-05-09' } as any;
    const ml2 = { id: 'a', name: 'V2', game: 'skyrim', mods: [], createdAt: '2026-05-09' } as any;
    svc.save(ml1);
    svc.save(ml2);
    expect(svc.list().length).toBe(1);
    expect(svc.get('a')?.name).toBe('V2');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// modlist-store.service.ts
import { Injectable, signal } from '@angular/core';
import { Modlist } from '../../shared/models/mod.model';

const KEY_PREFIX = 'modlist.';
const INDEX_KEY = 'modlist.index';

@Injectable({ providedIn: 'root' })
export class ModlistStore {
  readonly version = signal(0); // bumps on every mutation; UI subscribes for reactive updates

  list(): Modlist[] {
    const ids = this.readIndex();
    return ids
      .map((id) => this.get(id))
      .filter((m): m is Modlist => m !== null);
  }

  get(id: string): Modlist | null {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  }

  save(ml: Modlist): void {
    localStorage.setItem(KEY_PREFIX + ml.id, JSON.stringify(ml));
    const ids = new Set(this.readIndex());
    ids.add(ml.id);
    localStorage.setItem(INDEX_KEY, JSON.stringify([...ids]));
    this.version.update((v) => v + 1);
  }

  delete(id: string): void {
    localStorage.removeItem(KEY_PREFIX + id);
    const ids = this.readIndex().filter((x) => x !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
    this.version.update((v) => v + 1);
  }

  private readIndex(): string[] {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }
}
```

- [ ] **Step 3: Run tests to verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/modlist-store.service.spec.ts`
Expected: PASS (5 specs)

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/modlist-store.service.ts frontend/src/app/core/services/modlist-store.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): add ModlistStore — localStorage-backed modlist CRUD"
```

---

### Task 10: Port generation primitives

**Files:**
- Create: `frontend/src/app/core/services/generation/types.ts`
- Create: `frontend/src/app/core/services/generation/preset.ts` (+ `.spec.ts`)
- Create: `frontend/src/app/core/services/generation/errors.ts`
- Create: `frontend/src/app/core/services/generation/session.ts` (+ `.spec.ts`)
- Create: `frontend/src/app/core/services/generation/sub-pass.ts` (+ `.spec.ts`)
- Create: `frontend/src/app/core/services/generation/prompts.ts` (+ `.spec.ts`)
- Reference: `backend/app/services/generation/{preset,exceptions,session,sub_pass,prompts}.py`

Each sub-task is a separate commit. Group them under one task header for cohesion.

- [ ] **Step 1: Define generation types**

```typescript
// generation/types.ts
import { LLMConfig } from '../llm/types';

export type Game = 'skyrim' | 'fallout4';

export interface BuildPhase {
  phaseIndex: number;
  name: string;             // e.g., "essentials", "ui", "textures"
  displayName: string;      // human-readable
  maxMods: number;
  scaleWeight: number;
  subPassGuidance?: string;
}

export interface ModEntry {
  modId: number;
  fileId?: number;
  name: string;
  installOrder: number;
  fileSizeBytes?: number;
  notes?: string;
  phaseName: string;
  source: 'nexus' | 'custom';
}

export type SizePreset = 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE' | 'ULTIMATE';

export interface GenerationSession {
  id: string;
  game: Game;
  preset: SizePreset;
  spec: string;              // freeform user playstyle prompt
  hardwareSpec: string;      // verbatim from setup
  llmConfig: LLMConfig;
  overseerConfig?: LLMConfig; // optional second model for review
  createdAt: string;
  currentPhaseIndex: number;
  mods: ModEntry[];
  events: GenerationEvent[];
  status: 'running' | 'paused' | 'completed' | 'failed';
}

export type GenerationEvent =
  | { type: 'phase_start'; phaseName: string; timestamp: string }
  | { type: 'phase_complete'; phaseName: string; modCount: number; timestamp: string }
  | { type: 'sub_pass_start'; phaseName: string; passNumber: number; totalPasses: number; timestamp: string }
  | { type: 'tool_call'; tool: string; args: object; timestamp: string }
  | { type: 'mod_added'; mod: ModEntry; timestamp: string }
  | { type: 'review_pass'; phaseName: string; verdict: 'approve' | 'reject'; feedback?: string; timestamp: string }
  | { type: 'paused'; reason: string; timestamp: string }
  | { type: 'completed'; timestamp: string }
  | { type: 'error'; message: string; timestamp: string };
```

- [ ] **Step 2: Port preset.ts**

```typescript
// generation/preset.ts
import { SizePreset } from './types';

export const PRESET_MULTIPLIERS: Record<SizePreset, number> = {
  SMALL: 0.5,
  MEDIUM: 1.0,
  LARGE: 2.0,
  MASSIVE: 4.0,
  ULTIMATE: 8.0,
};

export const PER_SUB_PASS_MAX = 25;

export function effectiveCap(baseMaxMods: number, scaleWeight: number, preset: SizePreset): number {
  return Math.ceil(baseMaxMods * scaleWeight * PRESET_MULTIPLIERS[preset]);
}
```

```typescript
// generation/preset.spec.ts
import { effectiveCap, PRESET_MULTIPLIERS, PER_SUB_PASS_MAX } from './preset';

describe('preset', () => {
  it('PRESET_MULTIPLIERS has 5 entries', () => {
    expect(Object.keys(PRESET_MULTIPLIERS).length).toBe(5);
  });

  it('effectiveCap multiplies base × weight × preset', () => {
    expect(effectiveCap(10, 1.5, 'MEDIUM')).toBe(15);
    expect(effectiveCap(10, 1.5, 'LARGE')).toBe(30);
  });

  it('PER_SUB_PASS_MAX = 25', () => {
    expect(PER_SUB_PASS_MAX).toBe(25);
  });
});
```

Verify these multiplier values match `backend/app/services/generation/preset.py` exactly. Adjust if different.

- [ ] **Step 3: Port errors.ts**

```typescript
// generation/errors.ts
import { GenerationSession } from './types';

export class PauseGeneration extends Error {
  constructor(
    public reason: string,
    public sessionSnapshot: GenerationSession,
  ) {
    super(`Generation paused: ${reason}`);
    this.name = 'PauseGeneration';
  }
}

export class GenerationFailed extends Error {
  constructor(message: string, public phase?: string) {
    super(message);
    this.name = 'GenerationFailed';
  }
}
```

- [ ] **Step 4: Port session.ts**

```typescript
// generation/session.ts
import { GenerationSession } from './types';

const SESSION_KEY_PREFIX = 'session.';

export function snapshotSession(session: GenerationSession): void {
  localStorage.setItem(SESSION_KEY_PREFIX + session.id, JSON.stringify(session));
}

export function loadSession(id: string): GenerationSession | null {
  const raw = localStorage.getItem(SESSION_KEY_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

export function listSessions(): GenerationSession[] {
  const out: GenerationSession[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SESSION_KEY_PREFIX)) {
      const raw = localStorage.getItem(key);
      if (raw) out.push(JSON.parse(raw));
    }
  }
  return out;
}

export function deleteSession(id: string): void {
  localStorage.removeItem(SESSION_KEY_PREFIX + id);
}

export function findResumableSessions(): GenerationSession[] {
  return listSessions().filter((s) => s.status === 'paused' || s.status === 'running');
}
```

```typescript
// generation/session.spec.ts
import { snapshotSession, loadSession, listSessions, deleteSession, findResumableSessions } from './session';
import { GenerationSession } from './types';

describe('session', () => {
  beforeEach(() => localStorage.clear());

  const make = (id: string, status: GenerationSession['status']): GenerationSession =>
    ({ id, status, mods: [], events: [], currentPhaseIndex: 0 } as any);

  it('snapshot + load roundtrips', () => {
    const s = make('a', 'running');
    snapshotSession(s);
    expect(loadSession('a')?.id).toBe('a');
  });

  it('listSessions returns all snapshotted sessions', () => {
    snapshotSession(make('a', 'running'));
    snapshotSession(make('b', 'completed'));
    expect(listSessions().length).toBe(2);
  });

  it('findResumableSessions filters to running/paused', () => {
    snapshotSession(make('a', 'running'));
    snapshotSession(make('b', 'completed'));
    snapshotSession(make('c', 'paused'));
    expect(findResumableSessions().map((s) => s.id).sort()).toEqual(['a', 'c']);
  });

  it('deleteSession removes', () => {
    snapshotSession(make('a', 'running'));
    deleteSession('a');
    expect(loadSession('a')).toBeNull();
  });
});
```

- [ ] **Step 5: Port sub-pass.ts**

```typescript
// generation/sub-pass.ts
import { PER_SUB_PASS_MAX } from './preset';

export interface SubPassPlan {
  passNumber: number;
  totalPasses: number;
  capForThisPass: number;
}

export function planSubPasses(effectiveCap: number): SubPassPlan[] {
  if (effectiveCap <= PER_SUB_PASS_MAX) {
    return [{ passNumber: 1, totalPasses: 1, capForThisPass: effectiveCap }];
  }
  const totalPasses = Math.ceil(effectiveCap / PER_SUB_PASS_MAX);
  const plans: SubPassPlan[] = [];
  let remaining = effectiveCap;
  for (let i = 1; i <= totalPasses; i++) {
    const cap = Math.min(PER_SUB_PASS_MAX, remaining);
    plans.push({ passNumber: i, totalPasses, capForThisPass: cap });
    remaining -= cap;
  }
  return plans;
}
```

```typescript
// generation/sub-pass.spec.ts
import { planSubPasses } from './sub-pass';

describe('planSubPasses', () => {
  it('cap <= 25 returns single pass', () => {
    expect(planSubPasses(20)).toEqual([
      { passNumber: 1, totalPasses: 1, capForThisPass: 20 },
    ]);
  });

  it('cap of 50 returns two passes of 25', () => {
    expect(planSubPasses(50)).toEqual([
      { passNumber: 1, totalPasses: 2, capForThisPass: 25 },
      { passNumber: 2, totalPasses: 2, capForThisPass: 25 },
    ]);
  });

  it('cap of 60 returns three passes (25, 25, 10)', () => {
    expect(planSubPasses(60)).toEqual([
      { passNumber: 1, totalPasses: 3, capForThisPass: 25 },
      { passNumber: 2, totalPasses: 3, capForThisPass: 25 },
      { passNumber: 3, totalPasses: 3, capForThisPass: 10 },
    ]);
  });
});
```

- [ ] **Step 6: Port prompts.ts**

This is the largest of the primitives (498 LOC). Mirror `backend/app/services/generation/prompts.py` verbatim. The functions to port:

- `build_system_prompt(game, hardware_spec, knowledge_text) -> str`
- `build_phase_prompt(phase, sub_pass_plan, modlist_so_far, user_spec) -> str`
- Any helpers (`build_finalize_prompt`, etc.)

```typescript
// generation/prompts.ts
import { Game, BuildPhase, ModEntry, SizePreset } from './types';
import { SubPassPlan } from './sub-pass';

export function buildSystemPrompt(args: {
  game: Game;
  hardwareSpec: string;
  knowledgeText: string;
  preset: SizePreset;
}): string {
  // Mirror prompts.py build_system_prompt — exact wording matters for output quality.
  // Read the Python source and translate string-by-string.
  return `...`;
}

export function buildPhasePrompt(args: {
  phase: BuildPhase;
  subPassPlan: SubPassPlan;
  modsAlreadyAdded: ModEntry[];
  userSpec: string;
}): string {
  // Mirror prompts.py build_phase_prompt.
  return `...`;
}
```

The exact prompt text is critical — small wording changes affect generation quality. Copy the Python f-strings verbatim, only changing Python interpolation syntax to TS template literals.

Tests for prompts.ts assert specific substrings appear (smoke-level, since full text comparison is brittle):

```typescript
// generation/prompts.spec.ts
import { buildSystemPrompt, buildPhasePrompt } from './prompts';

describe('prompts', () => {
  it('system prompt includes hardware spec and knowledge text', () => {
    const text = buildSystemPrompt({
      game: 'skyrim',
      hardwareSpec: 'RTX 4080 16GB',
      knowledgeText: 'Universal rules.',
      preset: 'MEDIUM',
    });
    expect(text).toContain('RTX 4080 16GB');
    expect(text).toContain('Universal rules');
  });

  it('phase prompt names the phase and target cap', () => {
    const text = buildPhasePrompt({
      phase: { phaseIndex: 0, name: 'essentials', displayName: 'Essentials', maxMods: 8, scaleWeight: 1.0 },
      subPassPlan: { passNumber: 1, totalPasses: 1, capForThisPass: 8 },
      modsAlreadyAdded: [],
      userSpec: 'dark fantasy',
    });
    expect(text.toLowerCase()).toContain('essentials');
    expect(text).toContain('8');
  });
});
```

- [ ] **Step 7: Run all generation primitive tests**

Run: `cd frontend && npx ng test --watch=false --include=**/generation/*.spec.ts`
Expected: PASS for preset, session, sub-pass, prompts (12+ specs total)

- [ ] **Step 8: Commit (one commit per file)**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/types.ts frontend/src/app/core/services/generation/preset.ts frontend/src/app/core/services/generation/preset.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port preset.ts + types"

git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/errors.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port pipeline error types"

git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/session.ts frontend/src/app/core/services/generation/session.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port session snapshot/load/list helpers"

git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/sub-pass.ts frontend/src/app/core/services/generation/sub-pass.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port sub-pass splitter"

git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/prompts.ts frontend/src/app/core/services/generation/prompts.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port system + phase prompt builders"
```

---

### Task 11: Port GenerationToolsService

**Files:**
- Create: `frontend/src/app/core/services/generation/tools.service.ts`
- Test: `frontend/src/app/core/services/generation/tools.service.spec.ts`
- Reference: `backend/app/services/generation/tools.py` (190 LOC) + `handlers.py` (606 LOC)

The Python split is `tools.py` (schemas) + `handlers.py` (execution). In TS, combine into one service that exposes both the JSON Schema definitions and the handler functions. Tools: `search_nexus`, `get_mod_details`, `add_to_modlist`, `finalize`.

- [ ] **Step 1: Write the failing tests**

```typescript
// generation/tools.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { GenerationToolsService } from './tools.service';
import { NexusService } from '../nexus.service';
import { GenerationSession, ModEntry } from './types';

describe('GenerationToolsService', () => {
  let svc: GenerationToolsService;
  let nexusSpy: jasmine.SpyObj<NexusService>;

  beforeEach(() => {
    nexusSpy = jasmine.createSpyObj('NexusService', ['searchMods', 'getMod']);
    TestBed.configureTestingModule({
      providers: [{ provide: NexusService, useValue: nexusSpy }],
    });
    svc = TestBed.inject(GenerationToolsService);
  });

  it('exposes 4 tool definitions', () => {
    const defs = svc.getToolDefinitions();
    expect(defs.map((d) => d.name).sort()).toEqual(
      ['add_to_modlist', 'finalize', 'get_mod_details', 'search_nexus'].sort(),
    );
  });

  it('search_nexus calls NexusService.searchMods with mapped game domain', async () => {
    nexusSpy.searchMods.and.resolveTo([{ modId: 1, name: 'Test' }]);
    const result = await svc.handle(
      { id: 't1', name: 'search_nexus', arguments: { query: 'SkyUI' } },
      { game: 'skyrim' } as any,
    );
    expect(nexusSpy.searchMods).toHaveBeenCalledWith('SkyUI', 'skyrimspecialedition');
    expect(JSON.parse(result).results[0].name).toBe('Test');
  });

  it('add_to_modlist appends to session.mods with monotonic install_order', async () => {
    const session: GenerationSession = {
      id: 's1', mods: [], events: [], currentPhaseIndex: 0,
    } as any;
    await svc.handle(
      { id: 't1', name: 'add_to_modlist', arguments: { mod_id: 12345, file_id: 9999, name: 'X', notes: '' } },
      session,
    );
    expect(session.mods.length).toBe(1);
    expect(session.mods[0].installOrder).toBe(0);

    await svc.handle(
      { id: 't2', name: 'add_to_modlist', arguments: { mod_id: 67890, file_id: 8888, name: 'Y', notes: '' } },
      session,
    );
    expect(session.mods[1].installOrder).toBe(1);
  });

  it('finalize returns terminal signal', async () => {
    const result = await svc.handle(
      { id: 't1', name: 'finalize', arguments: { reason: 'phase complete' } },
      { mods: [] } as any,
    );
    expect(JSON.parse(result).finalized).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// generation/tools.service.ts
import { Injectable, inject } from '@angular/core';
import { NexusService } from '../nexus.service';
import { ToolCall, ToolDefinition } from '../llm/types';
import { GenerationSession, ModEntry, Game } from './types';

const GAME_DOMAINS: Record<Game, string> = {
  skyrim: 'skyrimspecialedition',
  fallout4: 'fallout4',
};

@Injectable({ providedIn: 'root' })
export class GenerationToolsService {
  private readonly nexus = inject(NexusService);

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'search_nexus',
        description: 'Search Nexus Mods for mods matching a query.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      {
        name: 'get_mod_details',
        description: 'Fetch detailed metadata for a specific Nexus mod by mod_id.',
        parameters: {
          type: 'object',
          properties: { mod_id: { type: 'integer' } },
          required: ['mod_id'],
        },
      },
      {
        name: 'add_to_modlist',
        description: 'Add a mod to the current modlist with the given file_id.',
        parameters: {
          type: 'object',
          properties: {
            mod_id: { type: 'integer' },
            file_id: { type: 'integer' },
            name: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['mod_id', 'file_id', 'name'],
        },
      },
      {
        name: 'finalize',
        description: 'Signal that the current phase is complete. The pipeline advances on this call.',
        parameters: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    ];
  }

  async handle(call: ToolCall, session: GenerationSession): Promise<string> {
    const args = call.arguments as any;
    switch (call.name) {
      case 'search_nexus': {
        const results = await this.nexus.searchMods(args.query, GAME_DOMAINS[session.game]);
        return JSON.stringify({ results });
      }
      case 'get_mod_details': {
        const mod = await this.nexus.getMod(args.mod_id, GAME_DOMAINS[session.game]);
        return JSON.stringify({ mod });
      }
      case 'add_to_modlist': {
        const entry: ModEntry = {
          modId: args.mod_id,
          fileId: args.file_id,
          name: args.name,
          notes: args.notes ?? '',
          installOrder: session.mods.length,
          phaseName: this.currentPhaseName(session),
          source: 'nexus',
        };
        session.mods.push(entry);
        return JSON.stringify({ added: true, install_order: entry.installOrder });
      }
      case 'finalize': {
        return JSON.stringify({ finalized: true, reason: args.reason });
      }
      default:
        throw new Error(`Unknown tool: ${call.name}`);
    }
  }

  private currentPhaseName(session: GenerationSession): string {
    // The pipeline maintains current_phase_index; phases array lives elsewhere.
    // Return a reasonable placeholder; pipeline.service overrides via session state.
    return 'unknown';
  }
}
```

The `currentPhaseName` placeholder shows where the orchestrator (Task 13) will need to set the active phase name on the session. That's why session.currentPhaseIndex exists. The orchestrator updates session before calling tools — adjust the tools service to read from session.currentPhase if you decide to add that field.

- [ ] **Step 3: Run tests, verify pass, commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/tools.service.ts frontend/src/app/core/services/generation/tools.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port tool definitions + handlers (search_nexus, get_mod_details, add_to_modlist, finalize)"
```

---

### Task 12: Port ReviewerService

**Files:**
- Create: `frontend/src/app/core/services/generation/reviewer.service.ts`
- Test: `frontend/src/app/core/services/generation/reviewer.service.spec.ts`
- Reference: `backend/app/services/generation/reviewer.py` (539 LOC)

Runs an independent overseer pass after each phase. Takes the phase results + an `LLMConfig` (defaults to the same config used for generation; can be different per spec Decision 5). Returns approve/reject with feedback.

- [ ] **Step 1: Write the failing tests**

```typescript
// generation/reviewer.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReviewerService } from './reviewer.service';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { ModEntry, Game, BuildPhase } from './types';

describe('ReviewerService', () => {
  let svc: ReviewerService;
  let dispatchSpy: jasmine.SpyObj<LLMDispatcherService>;

  beforeEach(() => {
    dispatchSpy = jasmine.createSpyObj('LLMDispatcherService', ['complete']);
    TestBed.configureTestingModule({
      providers: [{ provide: LLMDispatcherService, useValue: dispatchSpy }],
    });
    svc = TestBed.inject(ReviewerService);
  });

  const PHASE: BuildPhase = { phaseIndex: 0, name: 'essentials', displayName: 'Essentials', maxMods: 8, scaleWeight: 1.0 };
  const MODS: ModEntry[] = [
    { modId: 1, name: 'SKSE', installOrder: 0, phaseName: 'essentials', source: 'nexus' },
    { modId: 2, name: 'SkyUI', installOrder: 1, phaseName: 'essentials', source: 'nexus' },
  ];

  it('approves when LLM response includes "VERDICT: APPROVE"', async () => {
    dispatchSpy.complete.and.resolveTo({
      content: 'These selections look solid. VERDICT: APPROVE',
      toolCalls: [], finishReason: 'stop',
    });
    const r = await svc.review('skyrim', PHASE, MODS, { provider: 'anthropic', model: 'm', apiKey: 'k' });
    expect(r.verdict).toBe('approve');
  });

  it('rejects when LLM response includes "VERDICT: REJECT"', async () => {
    dispatchSpy.complete.and.resolveTo({
      content: 'Too many script-heavy mods. VERDICT: REJECT — drop SkyUI for now.',
      toolCalls: [], finishReason: 'stop',
    });
    const r = await svc.review('skyrim', PHASE, MODS, { provider: 'anthropic', model: 'm', apiKey: 'k' });
    expect(r.verdict).toBe('reject');
    expect(r.feedback).toContain('Too many script-heavy');
  });

  it('treats malformed verdict as reject (fail-closed)', async () => {
    dispatchSpy.complete.and.resolveTo({
      content: 'I am not sure.',
      toolCalls: [], finishReason: 'stop',
    });
    const r = await svc.review('skyrim', PHASE, MODS, { provider: 'anthropic', model: 'm', apiKey: 'k' });
    expect(r.verdict).toBe('reject');
  });
});
```

- [ ] **Step 2: Implement**

Read `backend/app/services/generation/reviewer.py` to mirror the prompt and parsing logic.

```typescript
// generation/reviewer.service.ts
import { Injectable, inject } from '@angular/core';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { LLMConfig } from '../llm/types';
import { BuildPhase, Game, ModEntry } from './types';

export interface ReviewResult {
  verdict: 'approve' | 'reject';
  feedback?: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewerService {
  private readonly dispatcher = inject(LLMDispatcherService);

  async review(
    game: Game,
    phase: BuildPhase,
    mods: ModEntry[],
    overseerConfig: LLMConfig,
  ): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(game, phase, mods);
    const response = await this.dispatcher.complete(overseerConfig, {
      messages: [
        { role: 'system', content: 'You are an independent quality reviewer for modlist phase output.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });
    return this.parseVerdict(response.content);
  }

  private buildReviewPrompt(game: Game, phase: BuildPhase, mods: ModEntry[]): string {
    // Mirror reviewer.py build_review_prompt — exact wording matters for parser reliability.
    const modList = mods.map((m, i) => `${i + 1}. ${m.name} (modId=${m.modId})`).join('\n');
    return `
Phase: ${phase.displayName}
Game: ${game}
Cap: ${phase.maxMods} mods

Selections:
${modList}

Evaluate the above for stability, theme fit, conflicts, and performance.
Conclude with exactly one of:
  VERDICT: APPROVE
  VERDICT: REJECT — <one-line reason>
`.trim();
  }

  private parseVerdict(content: string): ReviewResult {
    const m = content.match(/VERDICT:\s*(APPROVE|REJECT)(?:\s*[—-]\s*(.+))?/i);
    if (!m) return { verdict: 'reject', feedback: 'Verdict marker not found in reviewer output.' };
    const verdict = m[1].toUpperCase() === 'APPROVE' ? 'approve' : 'reject';
    const feedback = verdict === 'reject' ? (m[2]?.trim() ?? content) : undefined;
    return { verdict, feedback };
  }
}
```

The exact review prompt should be ported from `reviewer.py`'s `build_review_prompt()` function — copy verbatim. The placeholder above is the shape.

- [ ] **Step 3: Run, verify pass, commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/reviewer.service.ts frontend/src/app/core/services/generation/reviewer.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port ReviewerService — overseer pass"
```

---

### Task 13: Port GenerationPipelineService (orchestrator)

**Files:**
- Create: `frontend/src/app/core/services/generation/pipeline.service.ts`
- Test: `frontend/src/app/core/services/generation/pipeline.service.spec.ts`
- Reference: `backend/app/services/generation/pipeline.py` (907 LOC) + `handlers.py` (606 LOC)

The orchestrator. Loads phases, runs each phase through the tool-calling loop, splits into sub-passes when needed, runs the reviewer after each phase, retries on reject, snapshots session at every event. Emits an RxJS observable of `GenerationEvent`s for the UI.

This is the largest single port. Break implementation into sub-tasks.

- [ ] **Step 1: Write the test scaffolding (key behaviors)**

```typescript
// generation/pipeline.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GenerationPipelineService } from './pipeline.service';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { GenerationToolsService } from './tools.service';
import { ReviewerService } from './reviewer.service';
import { KnowledgeService } from '../knowledge.service';

describe('GenerationPipelineService', () => {
  let svc: GenerationPipelineService;
  let dispatchSpy: jasmine.SpyObj<LLMDispatcherService>;
  let reviewerSpy: jasmine.SpyObj<ReviewerService>;
  let toolsSpy: jasmine.SpyObj<GenerationToolsService>;
  let knowledgeSpy: jasmine.SpyObj<KnowledgeService>;
  let http: HttpTestingController;

  beforeEach(() => {
    dispatchSpy = jasmine.createSpyObj('LLMDispatcherService', ['complete']);
    reviewerSpy = jasmine.createSpyObj('ReviewerService', ['review']);
    toolsSpy = jasmine.createSpyObj('GenerationToolsService', ['handle', 'getToolDefinitions']);
    knowledgeSpy = jasmine.createSpyObj('KnowledgeService', ['ready', 'isReady', 'resolveForPhase']);
    knowledgeSpy.ready.and.resolveTo();
    knowledgeSpy.isReady.and.returnValue(true);
    knowledgeSpy.resolveForPhase.and.returnValue('knowledge text');
    toolsSpy.getToolDefinitions.and.returnValue([]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LLMDispatcherService, useValue: dispatchSpy },
        { provide: ReviewerService, useValue: reviewerSpy },
        { provide: GenerationToolsService, useValue: toolsSpy },
        { provide: KnowledgeService, useValue: knowledgeSpy },
      ],
    });
    svc = TestBed.inject(GenerationPipelineService);
    http = TestBed.inject(HttpTestingController);
  });

  it('emits phase_start → tool_call → mod_added → phase_complete for a single-phase run', async () => {
    // Mock build-phases response: one phase
    // Mock LLM: returns add_to_modlist tool call, then finalize
    // Mock reviewer: approve
    // Assert event sequence
    // (skeleton — full implementation follows)
  });

  it('splits into sub-passes when effective cap > 25', async () => {
    // Mock phase with maxMods=30, scaleWeight=1.0, MEDIUM preset → effectiveCap=30 → 2 sub-passes
    // Assert two sub_pass_start events
  });

  it('retries phase on reviewer reject (up to 2 retries by default)', async () => {
    // Mock reviewer: reject, reject, approve
    // Assert phase runs 3 times total
  });

  it('snapshots session to localStorage on every event', async () => {
    // Run pipeline, verify localStorage["session.<id>"] is updated after each event
  });
});
```

- [ ] **Step 2: Implement the orchestrator (skeleton)**

```typescript
// generation/pipeline.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { LLMConfig } from '../llm/types';
import { KnowledgeService } from '../knowledge.service';
import { GenerationToolsService } from './tools.service';
import { ReviewerService } from './reviewer.service';
import {
  Game, SizePreset, BuildPhase, ModEntry,
  GenerationSession, GenerationEvent,
} from './types';
import { effectiveCap } from './preset';
import { planSubPasses, SubPassPlan } from './sub-pass';
import { snapshotSession, loadSession } from './session';
import { buildSystemPrompt, buildPhasePrompt } from './prompts';
import { PauseGeneration, GenerationFailed } from './errors';

const REVIEW_RETRIES = 2;
const TOOL_LOOP_MAX_TURNS = 30;

export interface StartArgs {
  game: Game;
  preset: SizePreset;
  spec: string;
  hardwareSpec: string;
  llmConfig: LLMConfig;
  overseerConfig?: LLMConfig;
}

@Injectable({ providedIn: 'root' })
export class GenerationPipelineService {
  private readonly http = inject(HttpClient);
  private readonly dispatcher = inject(LLMDispatcherService);
  private readonly knowledge = inject(KnowledgeService);
  private readonly tools = inject(GenerationToolsService);
  private readonly reviewer = inject(ReviewerService);

  private events$ = new Subject<GenerationEvent>();
  events(): Observable<GenerationEvent> {
    return this.events$.asObservable();
  }

  async start(args: StartArgs): Promise<GenerationSession> {
    await this.knowledge.ready();
    const phases = await this.loadPhases(args.game);
    const session = this.newSession(args);
    snapshotSession(session);
    try {
      await this.runAllPhases(session, phases);
      session.status = 'completed';
      this.emit({ type: 'completed', timestamp: now() }, session);
    } catch (err) {
      if (err instanceof PauseGeneration) {
        session.status = 'paused';
        this.emit({ type: 'paused', reason: err.reason, timestamp: now() }, session);
      } else {
        session.status = 'failed';
        this.emit({ type: 'error', message: String(err), timestamp: now() }, session);
        throw err;
      }
    }
    snapshotSession(session);
    return session;
  }

  async resume(sessionId: string): Promise<GenerationSession> {
    const session = loadSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const phases = await this.loadPhases(session.game);
    await this.runAllPhases(session, phases);
    session.status = 'completed';
    snapshotSession(session);
    return session;
  }

  private async runAllPhases(session: GenerationSession, phases: BuildPhase[]): Promise<void> {
    for (let i = session.currentPhaseIndex; i < phases.length; i++) {
      session.currentPhaseIndex = i;
      const phase = phases[i];
      this.emit({ type: 'phase_start', phaseName: phase.name, timestamp: now() }, session);
      await this.runPhaseWithReview(session, phase);
      this.emit({
        type: 'phase_complete',
        phaseName: phase.name,
        modCount: session.mods.filter((m) => m.phaseName === phase.name).length,
        timestamp: now(),
      }, session);
    }
  }

  private async runPhaseWithReview(session: GenerationSession, phase: BuildPhase): Promise<void> {
    let attempts = 0;
    while (attempts <= REVIEW_RETRIES) {
      const cap = effectiveCap(phase.maxMods, phase.scaleWeight, session.preset);
      const passes = planSubPasses(cap);
      const phaseModsBefore = [...session.mods];
      try {
        for (const pass of passes) {
          this.emit({ type: 'sub_pass_start', phaseName: phase.name, passNumber: pass.passNumber, totalPasses: pass.totalPasses, timestamp: now() }, session);
          await this.runToolLoop(session, phase, pass);
        }
      } catch (err) {
        if (err instanceof GenerationFailed) throw err;
        throw err;
      }

      const phaseMods = session.mods.filter((m) => m.phaseName === phase.name);
      const review = await this.reviewer.review(
        session.game,
        phase,
        phaseMods,
        session.overseerConfig ?? session.llmConfig,
      );
      this.emit({ type: 'review_pass', phaseName: phase.name, verdict: review.verdict, feedback: review.feedback, timestamp: now() }, session);
      if (review.verdict === 'approve') return;

      // Reject — restore session.mods to pre-phase state, retry
      session.mods = phaseModsBefore;
      attempts++;
    }
    throw new GenerationFailed(`Phase ${phase.name} rejected after ${REVIEW_RETRIES} retries`, phase.name);
  }

  private async runToolLoop(session: GenerationSession, phase: BuildPhase, pass: SubPassPlan): Promise<void> {
    const knowledgeText = this.knowledge.resolveForPhase(session.game, phase.name);
    const systemPrompt = buildSystemPrompt({
      game: session.game,
      hardwareSpec: session.hardwareSpec,
      knowledgeText,
      preset: session.preset,
    });
    const phasePrompt = buildPhasePrompt({
      phase,
      subPassPlan: pass,
      modsAlreadyAdded: session.mods,
      userSpec: session.spec,
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: phasePrompt },
    ];
    const tools = this.tools.getToolDefinitions();

    for (let turn = 0; turn < TOOL_LOOP_MAX_TURNS; turn++) {
      const response = await this.dispatcher.complete(session.llmConfig, { messages, tools });
      if (response.toolCalls.length === 0) {
        // No tool calls but no finalize — prompt the LLM to finalize.
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: 'Call finalize() to end this phase.' });
        continue;
      }
      messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });
      let finalized = false;
      for (const call of response.toolCalls) {
        this.emit({ type: 'tool_call', tool: call.name, args: call.arguments, timestamp: now() }, session);
        const result = await this.tools.handle(call, session);
        if (call.name === 'add_to_modlist') {
          const lastMod = session.mods[session.mods.length - 1];
          this.emit({ type: 'mod_added', mod: lastMod, timestamp: now() }, session);
        }
        if (call.name === 'finalize') {
          finalized = true;
        }
        messages.push({ role: 'tool', toolCallId: call.id, content: result });
      }
      if (finalized) return;
    }
    throw new GenerationFailed(`Tool loop exceeded ${TOOL_LOOP_MAX_TURNS} turns in phase ${phase.name}`, phase.name);
  }

  private async loadPhases(game: Game): Promise<BuildPhase[]> {
    const url = `/data/build-phases.${game}.json`;
    return await firstValueFrom(this.http.get<BuildPhase[]>(url));
  }

  private newSession(args: StartArgs): GenerationSession {
    return {
      id: crypto.randomUUID(),
      game: args.game,
      preset: args.preset,
      spec: args.spec,
      hardwareSpec: args.hardwareSpec,
      llmConfig: args.llmConfig,
      overseerConfig: args.overseerConfig,
      createdAt: now(),
      currentPhaseIndex: 0,
      mods: [],
      events: [],
      status: 'running',
    };
  }

  private emit(event: GenerationEvent, session: GenerationSession): void {
    session.events.push(event);
    snapshotSession(session);
    this.events$.next(event);
  }
}

function now(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 3: Run pipeline tests**

Run: `cd frontend && npx ng test --watch=false --include=**/pipeline.service.spec.ts`
Expected: PASS for the four behavior tests above. The tests need their full mock setups completed — this is the longest sub-step.

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation/pipeline.service.ts frontend/src/app/core/services/generation/pipeline.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(generation): port pipeline orchestrator with sub-passes, reviewer retries, session snapshots"
```

---

### Task 14: Wire generation UI behind feature flag

**Files:**
- Modify: `frontend/src/app/core/services/generation.service.ts` — add feature-flag branch
- Test: `frontend/src/app/core/services/generation.service.spec.ts` — verify flag routing
- Reference (after change): the existing `generation.service.ts` calls the backend SSE endpoint via `ApiService`. Keep that path intact; add a new branch that calls `GenerationPipelineService` and adapts its observable to the existing UI's expected event shape.

- [ ] **Step 1: Read the existing generation.service.ts**

Read `frontend/src/app/core/services/generation.service.ts`. Note its public method signatures (probably `start(args)`, `events$`, `pause()`, `resume()`) and the event shape the UI components subscribe to. The pipeline-service `GenerationEvent` type may have a different shape — adapt at this seam.

- [ ] **Step 2: Write the failing test**

```typescript
// generation.service.spec.ts (new test added to existing suite)
import { GenerationService } from './generation.service';
import { FeatureFlagsService } from './feature-flags.service';
import { GenerationPipelineService } from './generation/pipeline.service';
// ...

describe('GenerationService feature-flag routing', () => {
  it('uses backend SSE when useClientPipeline = false', async () => {
    // mock FeatureFlagsService to return false
    // call GenerationService.start(...)
    // assert ApiService.post was called, GenerationPipelineService.start was NOT called
  });

  it('uses client pipeline when useClientPipeline = true', async () => {
    // mock FeatureFlagsService to return true
    // call GenerationService.start(...)
    // assert GenerationPipelineService.start was called, ApiService.post was NOT
  });
});
```

- [ ] **Step 3: Implement the flag branch in generation.service.ts**

Add at the top of the existing `start(...)` method:

```typescript
async start(args: StartArgs): Promise<GenerationSession> {
  if (this.featureFlags.useClientPipeline()) {
    return this.startClientPipeline(args);
  }
  return this.startBackendSSE(args);
}

private async startClientPipeline(args: StartArgs): Promise<GenerationSession> {
  // Subscribe to pipeline events, adapt to existing UI shape, push to subject
  this.pipeline.events().subscribe((evt) => this.uiEvents$.next(this.adaptEvent(evt)));
  return await this.pipeline.start(args);
}

private async startBackendSSE(args: StartArgs): Promise<GenerationSession> {
  // ... existing implementation untouched
}

private adaptEvent(evt: GenerationEvent): UIEvent {
  // Map between pipeline's GenerationEvent and the existing UI event shape.
  // If they're identical, this is a no-op pass-through.
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd frontend && npx ng test --watch=false --include=**/generation.service.spec.ts`
Expected: PASS for both flag branches

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New add frontend/src/app/core/services/generation.service.ts frontend/src/app/core/services/generation.service.spec.ts
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "feat(core): route generation through client pipeline when useClientPipeline flag is on"
```

---

### Task 15: E2E smoke test

**Files:** none new — this task is verification.

- [ ] **Step 1: Run the dev server**

```bash
cd /c/Users/stsbr/Documents/ModdersOmni-New/frontend && npm start
```

Wait for "Application bundle generation complete" and `localhost:4200` ready.

- [ ] **Step 2: Enable the feature flag in the browser**

Open http://localhost:4200, open browser devtools console, run:

```javascript
localStorage.setItem('feature.useClientPipeline', 'true');
location.reload();
```

- [ ] **Step 3: Configure an LLM key**

Navigate to Settings → enter a real API key for one provider (recommend Anthropic for stability). Save.

- [ ] **Step 4: Run a SMALL Skyrim generation**

- Setup wizard → fill in hardware spec
- Generation page → game = Skyrim, preset = SMALL, spec = "vanilla-plus quality of life"
- Click Start
- Observe:
  - Phase events stream in
  - Mods are added during phases
  - Reviewer events appear after each phase
  - localStorage['session.<id>'] is updated as it goes

- [ ] **Step 5: Export to MO2**

- Click Export for MO2 on the completed modlist
- Verify the downloaded JSON has shape `{game: 'skyrim', mods: [...], version: '...'}`
- Open the JSON in a text editor; confirm install_order is monotonic, mod IDs are real

- [ ] **Step 6: Repeat for Fallout 4**

Same flow with game = Fallout 4. Confirm phase progression, mod additions, reviewer.

- [ ] **Step 7: File any bugs encountered**

Bugs found in this smoke test go to GitHub Issues on `stsbrega/ModdersOmni-New` with label `plan-1-smoke`. Do not block plan completion on bug discovery — file and proceed; bugs become tasks in Plan 2 or Plan 3.

- [ ] **Step 8: Final commit (if anything was tweaked during smoke)**

```bash
git -C /c/Users/stsbr/Documents/ModdersOmni-New status
# If any tweaks were made:
git -C /c/Users/stsbr/Documents/ModdersOmni-New add -A
git -C /c/Users/stsbr/Documents/ModdersOmni-New commit -m "chore(plan-1): smoke-test fixes"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Tasks 1–15 cover spec migration plan steps 1–6 (Knowledge & static data, Nexus client port, LLM dispatcher port, Generation pipeline port, Wire generation UI to client pipeline) and step 6 (Modlist store). Steps 7–9 (frontend redesign), 10 (strip auth), 11 (MO2 plugin rework), 12 (CF Pages deploy), 13 (backend deletion), 14 (docs), 15 (final E2E), 16 (release) are deferred to Plans 2 and 3.
- **Placeholder scan:** the prompt and dispatcher tasks contain explicit "mirror exactly from <python file>" callouts where literal text matters too much to retype here. These are intentional pointers, not TODO placeholders — the engineer reads the source file and copies verbatim.
- **Type consistency:** `LLMConfig`, `GenerationSession`, `BuildPhase`, `ModEntry`, `GenerationEvent`, `SubPassPlan` are defined in shared `types.ts` files and reused unchanged. Method names are consistent: `complete`, `review`, `handle`, `start`, `resume`, `events()`.
- **Security note:** the seed-extraction script (Task 3) uses `execFileSync('python', [scriptPath])` with array args — no shell interpolation, no command-injection surface.
