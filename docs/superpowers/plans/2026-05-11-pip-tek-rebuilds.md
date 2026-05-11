# ModdersOmni v3 — Pip-Tek Rebuilds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the two layout-heavy routes (`/` Landing and `/generate/:id` Generation runtime) on top of the Pip-Tek foundation that landed in PR #1. Landing gets a new Pip-Tek hero centered on a live-feeling `terminal-log` animation, trimmed from 5 sections to 3, with exactly one primary CTA. Generation runtime becomes a two-column terminal-log + live-modlist layout with the new `phase-counter` at the top; the v2 stack-build accordion animation is removed; pause/resume/cancel behavior is preserved unchanged.

**Architecture:** Both rebuilds reuse the primitives Plan 1 added: `UiTerminalLogComponent`, `UiPhaseCounterComponent`, `BrandMarkComponent`, plus the existing `UiButtonComponent` / `UiCardComponent` / `UiBadgeComponent`. The Generation runtime is decomposed from a 1,784-line single-file component into a thin orchestrator plus four focused sub-components (`generation-header`, `generation-log`, `generation-modlist`, `generation-controls`). The orchestrator owns the `GenerationService` subscription and routing concerns; each sub-component takes signal inputs and renders one slice of the runtime. The Landing rebuild stays in a single file — it's not stateful enough to justify decomposition — but the file drops from ~1,165 lines to a target of ~600.

**Tech Stack:** Angular 19 (standalone components, signals, `@for`/`@if`/`@defer`), `@angular/cdk`, OKLCH custom properties from `theme.css`, Inter + JetBrains Mono, Lucide icons, Karma + Jasmine for unit tests, Playwright for the existing smoke test (no new e2e tests in this plan — the smoke gate continues to assert tokens resolve, which is sufficient).

**Spec reference:** `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md` (commit `d0734ab`). This plan implements the **Rebuild** rows of Decision 6 — Landing and `/generate/:id`. Reskin rows for the 7 other routes go to Plan 3; the 404 rebuild + audit pass goes to Plan 4.

**Prerequisite:** Plan 1's foundation PR (`feat/pip-tek-foundation`, commit `c5a1bab`) must be merged to `main` first. This plan branches from `main` post-merge. If you're executing before that merge, branch from `feat/pip-tek-foundation` instead and rebase onto `main` once it lands.

---

## File Structure

### Created files

| File | Responsibility |
|---|---|
| `frontend/src/app/features/generation/components/generation-header.component.ts` | Top bar of the runtime: brand mark + game label + provider badge + `ui-phase-counter`. Reads `GenerationService` signals via inputs. |
| `frontend/src/app/features/generation/components/generation-header.component.spec.ts` | Unit specs for the header. |
| `frontend/src/app/features/generation/components/generation-log.component.ts` | Left column of the runtime — wraps `UiTerminalLogComponent`. Transforms `GenerationEvent[]` from the service into `TerminalLogEntry[]` and feeds it in. Auto-scrolls to bottom on new entries. |
| `frontend/src/app/features/generation/components/generation-log.component.spec.ts` | Unit specs for the log + the event-to-entry transformer. |
| `frontend/src/app/features/generation/components/generation-modlist.component.ts` | Right column of the runtime — list of mods being added live, rendered as cards. Receives the mod list signal as input. |
| `frontend/src/app/features/generation/components/generation-modlist.component.spec.ts` | Unit specs. |
| `frontend/src/app/features/generation/components/generation-controls.component.ts` | Floating control bar — pause / resume / cancel / download-log buttons. Emits events; doesn't touch the service directly. |
| `frontend/src/app/features/generation/components/generation-controls.component.spec.ts` | Unit specs. |
| `frontend/src/app/features/generation/util/event-to-log-entry.ts` | Pure function `eventToLogEntry(event: GenerationEvent): TerminalLogEntry`. Maps each event type from `core/services/generation/types.ts` to a log line with the correct level. Unit-tested separately. |
| `frontend/src/app/features/generation/util/event-to-log-entry.spec.ts` | Spec for the mapper — covers every event type listed in the existing `EVENT_ICONS` map at `generation.component.ts:78-99`. |

### Modified files

| File | Change |
|---|---|
| `frontend/src/app/features/landing/landing.component.ts` | Full rebuild. New Pip-Tek hero with a synthetic `UiTerminalLogComponent` animation as the centerpiece (replaces the v2 mock-dashboard preview). Sections trimmed from `hero + how-it-works + features + social-proof + cta` to `hero + how-it-works + cta`. Footer compressed to single line. Exactly one primary CTA on the page (`/setup`); secondary "See How It Works" anchor link allowed because it's not a CTA-styled button, just an anchor. |
| `frontend/src/app/features/generation/generation.component.ts` | Reduced from 1,784 lines to a thin orchestrator (target ~250 lines). Imports and composes the four new sub-components. Removes the inline `EVENT_ICONS` map, the inline `TimelineItem` interface, the inline phase-bar/timeline templates, the inline nexus-bg decorative elements, and ~895 lines of inline styles. Keeps: route param subscription, `GenerationService` orchestration, pause/resume/cancel handlers, download-log handler, redirect-on-complete navigation. |
| `frontend/src/app/core/motion/animations.ts` | Remove the `stackBuild` trigger (only consumed by the v2 generation timeline accordion). Keep `fadeUp` and `staggerChildren` — they're still used elsewhere. |
| `CHANGELOG.md` | Auto-generated by git-cliff on push to main. Do not edit manually. |

### Deleted files

None. This plan replaces content within existing files and adds new sub-components.

---

## Tasks

### Task 1: Pre-flight — branch from main (or foundation), confirm primitives import correctly

**Files:** none (verification only)

- [ ] **Step 1: Create the branch**

If Plan 1's PR is merged to main:
```bash
git checkout main && git pull
git checkout -b feat/pip-tek-rebuilds
```

If not, branch from the foundation branch and plan to rebase later:
```bash
git checkout feat/pip-tek-foundation
git checkout -b feat/pip-tek-rebuilds
```

- [ ] **Step 2: Verify the new primitives are reachable**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

Then write a throwaway smoke import:

```bash
cat > /tmp/import-check.ts <<'EOF'
import {
  UiTerminalLogComponent,
  UiPhaseCounterComponent,
  UiKbdComponent,
  UiButtonComponent,
  UiCardComponent,
  UiBadgeComponent,
  type TerminalLogEntry,
  type TerminalLogLevel,
} from './src/app/shared/components/ui';
EOF
cd frontend && npx tsc --noEmit --skipLibCheck --moduleResolution=bundler --module=esnext --target=es2022 /tmp/import-check.ts
rm /tmp/import-check.ts
```

Expected: zero errors. (If the script fails because of project tsconfig conflicts, just run `grep -l UiTerminalLogComponent frontend/src/app/shared/components/ui/index.ts` — it should match. The point is to confirm the barrel exposes the three new primitives.)

- [ ] **Step 3: Confirm the existing smoke test still passes against the new branch**

```bash
cd frontend && npm start &
# wait for "Local: http://localhost:4200/" line, then:
npm run test:e2e
```

Expected: 1 pass. Stop the dev server after.

- [ ] **Step 4: Commit a marker if you want one** (optional — many teams skip empty branch-start commits)

```bash
git commit --allow-empty -m "chore: open feat/pip-tek-rebuilds branch for Plan 2"
```

Skip if your team doesn't want the empty commit in history.

---

### Task 2: Build `eventToLogEntry()` — the pure transformer (TDD)

**Files:**
- Create: `frontend/src/app/features/generation/util/event-to-log-entry.ts`
- Create: `frontend/src/app/features/generation/util/event-to-log-entry.spec.ts`

- [ ] **Step 1: Read the existing event taxonomy**

```bash
cat frontend/src/app/shared/models/generation.model.ts
```

Note the `GenerationEvent` union type and the `type` discriminator. Also read `frontend/src/app/features/generation/generation.component.ts:78-99` (the `EVENT_ICONS` map) — those are the event types in active use today. Your transformer must handle each of them.

- [ ] **Step 2: Write the failing spec**

Create `frontend/src/app/features/generation/util/event-to-log-entry.spec.ts`:

```ts
import { eventToLogEntry } from './event-to-log-entry';
import type { GenerationEvent } from '../../../shared/models/generation.model';
import type { TerminalLogEntry } from '../../../shared/components/ui';

describe('eventToLogEntry', () => {
  it('maps phase_start to an info entry with the phase name and number', () => {
    const event = {
      type: 'phase_start',
      phase: 'Essentials',
      number: 1,
      total_phases: 13,
    } as unknown as GenerationEvent;
    const entry = eventToLogEntry(event);
    expect(entry.level).toBe('info');
    expect(entry.text).toContain('Essentials');
    expect(entry.text).toContain('1/13');
  });

  it('maps mod_added to an ok entry containing the mod name', () => {
    const event = {
      type: 'mod_added',
      mod: { name: 'Skyrim Unbound', mod_id: 27744 },
    } as unknown as GenerationEvent;
    const entry = eventToLogEntry(event);
    expect(entry.level).toBe('ok');
    expect(entry.text).toContain('Skyrim Unbound');
  });

  it('maps patch_added to an ok entry', () => {
    const event = { type: 'patch_added', patch: { name: 'USSEP Patch' } } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('ok');
  });

  it('maps knowledge_flag to a warn entry', () => {
    const event = { type: 'knowledge_flag', message: 'deprecated mod' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('warn');
  });

  it('maps provider_error to an err entry', () => {
    const event = { type: 'provider_error', provider: 'anthropic', message: '429 rate limit' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('err');
  });

  it('maps error (top-level) to an err entry', () => {
    const event = { type: 'error', message: 'pipeline aborted' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('err');
  });

  it('maps complete to an ok entry', () => {
    const event = { type: 'complete' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('ok');
  });

  it('maps paused/resumed to warn/info entries respectively', () => {
    expect(eventToLogEntry({ type: 'paused' } as any).level).toBe('warn');
    expect(eventToLogEntry({ type: 'resumed' } as any).level).toBe('info');
  });

  it('falls back to info with the event type as text for unknown events', () => {
    const event = { type: 'unrecognized_event_type_for_test' } as unknown as GenerationEvent;
    const entry = eventToLogEntry(event);
    expect(entry.level).toBe('info');
    expect(entry.text.toLowerCase()).toContain('unrecognized_event_type_for_test');
  });
});
```

- [ ] **Step 3: Run the spec — expect FAIL**

```bash
cd frontend && npx ng test --include='**/event-to-log-entry.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: all 9 tests fail (module not found).

- [ ] **Step 4: Implement the transformer**

Create `frontend/src/app/features/generation/util/event-to-log-entry.ts`:

```ts
import type { GenerationEvent } from '../../../shared/models/generation.model';
import type { TerminalLogEntry, TerminalLogLevel } from '../../../shared/components/ui';

/**
 * Pure mapper from a pipeline GenerationEvent to a TerminalLogEntry the
 * UiTerminalLogComponent can render. Keep this exhaustive: every event type
 * the pipeline emits (see core/services/generation/types.ts and the v2
 * EVENT_ICONS map at generation.component.ts:78) should have a deliberate
 * mapping. Unknown event types fall through to a default "info" entry that
 * surfaces the raw event.type so we can spot taxonomy drift in logs.
 */
export function eventToLogEntry(event: GenerationEvent): TerminalLogEntry {
  const e = event as any;
  switch (e.type as string) {
    case 'providers_ready':
      return { level: 'info', text: `providers ready — ${e.count ?? '?'} mods available` };
    case 'phase_start':
      return { level: 'info', text: `phase ${e.number ?? '?'}/${e.total_phases ?? '?'} — ${e.phase ?? 'unknown'}` };
    case 'searching':
      return { level: 'info', text: `searching nexus: ${e.query ?? '...'}` };
    case 'search_results':
      return { level: 'info', text: `${e.count ?? 0} results` };
    case 'reading_mod':
      return { level: 'info', text: `reading: ${e.mod_name ?? e.mod_id ?? '...'}` };
    case 'mod_added':
      return { level: 'ok', text: `added: ${e.mod?.name ?? e.name ?? 'mod'}` };
    case 'patch_added':
      return { level: 'ok', text: `patch added: ${e.patch?.name ?? e.name ?? 'patch'}` };
    case 'knowledge_flag':
      return { level: 'warn', text: e.message ?? 'knowledge flag' };
    case 'thinking':
      return { level: 'info', text: e.message ?? 'thinking...' };
    case 'phase_complete':
      return { level: 'ok', text: `phase complete: ${e.phase ?? ''} (${e.mod_count ?? 0} mods)` };
    case 'retrying':
      return { level: 'warn', text: e.message ?? 'retrying...' };
    case 'provider_error':
      return { level: 'err', text: `provider ${e.provider ?? '?'}: ${e.message ?? 'error'}` };
    case 'provider_switch':
      return { level: 'info', text: `switched provider: ${e.from ?? '?'} → ${e.to ?? '?'}` };
    case 'paused':
      return { level: 'warn', text: e.reason ?? 'paused' };
    case 'resumed':
      return { level: 'info', text: 'resumed' };
    case 'complete':
      return { level: 'ok', text: 'generation complete' };
    case 'error':
      return { level: 'err', text: e.message ?? 'pipeline error' };
    case 'sweep_start':
      return { level: 'info', text: 'final sweep started' };
    case 'missing_requested_mod':
      return { level: 'warn', text: `mod not found: ${e.mod_name ?? '?'}` };
    case 'sweep_complete':
      return { level: 'info', text: 'final sweep complete' };
    default:
      return { level: 'info', text: `[${e.type}]` };
  }
}
```

- [ ] **Step 5: Run the spec — expect PASS**

```bash
cd frontend && npx ng test --include='**/event-to-log-entry.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: 9 passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/generation/util/
git commit -m "feat(generation): add eventToLogEntry transformer

Maps pipeline events to TerminalLogEntry format for the new Pip-Tek
runtime log. Exhaustive over the v2 EVENT_ICONS taxonomy; unknown event
types fall through to a default info entry surfacing the raw type so
taxonomy drift is visible at runtime."
```

---

### Task 3: Build `generation-log.component.ts` (TDD)

**Files:**
- Create: `frontend/src/app/features/generation/components/generation-log.component.ts`
- Create: `frontend/src/app/features/generation/components/generation-log.component.spec.ts`

This component wraps `UiTerminalLogComponent`, transforms `GenerationEvent[]` to `TerminalLogEntry[]` via the transformer from Task 2, and auto-scrolls to the latest entry as new events arrive.

- [ ] **Step 1: Write the failing spec**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationLogComponent } from './generation-log.component';
import type { GenerationEvent } from '../../../shared/models/generation.model';

describe('GenerationLogComponent', () => {
  let fixture: ComponentFixture<GenerationLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationLogComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationLogComponent);
  });

  it('renders one terminal-log line per event', () => {
    const events: GenerationEvent[] = [
      { type: 'phase_start', phase: 'Essentials', number: 1, total_phases: 13 } as any,
      { type: 'searching', query: 'unofficial patch' } as any,
      { type: 'mod_added', mod: { name: 'USSEP' } } as any,
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines.length).toBe(3);
  });

  it('renders the latest event at the bottom', () => {
    const events: GenerationEvent[] = [
      { type: 'phase_start', phase: 'Essentials', number: 1, total_phases: 13 } as any,
      { type: 'mod_added', mod: { name: 'USSEP' } } as any,
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines[lines.length - 1].textContent).toContain('USSEP');
  });

  it('renders the empty state when events is empty', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines.length).toBe(0);
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('waiting');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npx ng test --include='**/generation-log.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiTerminalLogComponent, type TerminalLogEntry } from '../../../shared/components/ui';
import type { GenerationEvent } from '../../../shared/models/generation.model';
import { eventToLogEntry } from '../util/event-to-log-entry';

@Component({
  selector: 'app-generation-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiTerminalLogComponent],
  template: `
    @if (entries().length === 0) {
      <div class="generation-log__empty">
        <span class="generation-log__empty-text">waiting for pipeline...</span>
      </div>
    } @else {
      <ui-terminal-log [entries]="entries()"></ui-terminal-log>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    :host ui-terminal-log {
      display: block;
      height: 100%;
      max-height: 100%;
      overflow-y: auto;
    }
    .generation-log__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 200px;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
    }
    .generation-log__empty-text {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      color: var(--color-text-dim);
    }
  `],
})
export class GenerationLogComponent {
  events = input.required<GenerationEvent[]>();

  entries = computed<TerminalLogEntry[]>(() =>
    this.events().map((e) => eventToLogEntry(e)),
  );
}
```

- [ ] **Step 4: Run — expect PASS (3/3)**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/generation/components/generation-log.component.ts \
        frontend/src/app/features/generation/components/generation-log.component.spec.ts
git commit -m "feat(generation): add GenerationLogComponent

Wraps UiTerminalLogComponent and transforms GenerationEvent[] into
TerminalLogEntry[] via the Task 2 transformer. Empty state shows a
'waiting for pipeline...' placeholder so the layout slot is never blank."
```

---

### Task 4: Build `generation-header.component.ts` (TDD)

**Files:**
- Create: `frontend/src/app/features/generation/components/generation-header.component.ts`
- Create: `frontend/src/app/features/generation/components/generation-header.component.spec.ts`

Header row at the top of the runtime: brand mark + game label + provider badge + `ui-phase-counter`.

- [ ] **Step 1: Write the failing spec**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationHeaderComponent } from './generation-header.component';

describe('GenerationHeaderComponent', () => {
  let fixture: ComponentFixture<GenerationHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationHeaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationHeaderComponent);
  });

  it('renders the game label', () => {
    fixture.componentRef.setInput('game', 'skyrim');
    fixture.componentRef.setInput('provider', 'anthropic');
    fixture.componentRef.setInput('currentPhase', 3);
    fixture.componentRef.setInput('totalPhases', 13);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('skyrim');
  });

  it('renders the phase counter with current and total values', () => {
    fixture.componentRef.setInput('game', 'fallout4');
    fixture.componentRef.setInput('provider', 'openai');
    fixture.componentRef.setInput('currentPhase', 5);
    fixture.componentRef.setInput('totalPhases', 10);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.phase-counter__label');
    expect(label.textContent).toContain('PHASE 05/10');
  });

  it('renders provider as a mono badge', () => {
    fixture.componentRef.setInput('game', 'skyrim');
    fixture.componentRef.setInput('provider', 'groq');
    fixture.componentRef.setInput('currentPhase', 1);
    fixture.componentRef.setInput('totalPhases', 13);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('ui-badge, .ui-badge, [class*="badge"]');
    expect(badge?.textContent).toContain('groq');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiPhaseCounterComponent, UiBadgeComponent } from '../../../shared/components/ui';
import { BrandMarkComponent } from '../../../shared/components/brand-mark/brand-mark.component';

const GAME_LABELS: Record<string, string> = {
  skyrim: 'Skyrim Special Edition',
  fallout4: 'Fallout 4',
};

@Component({
  selector: 'app-generation-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPhaseCounterComponent, UiBadgeComponent, BrandMarkComponent],
  template: `
    <header class="generation-header">
      <div class="generation-header__brand">
        <app-brand-mark size="sm" [showText]="true"></app-brand-mark>
      </div>
      <div class="generation-header__middle">
        <span class="generation-header__game">{{ gameLabel() }}</span>
        <ui-badge variant="default">{{ provider() }}</ui-badge>
      </div>
      <div class="generation-header__counter">
        <ui-phase-counter [current]="currentPhase()" [total]="totalPhases()"></ui-phase-counter>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .generation-header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg);
    }
    .generation-header__middle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .generation-header__game {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--color-text);
    }
    .generation-header__counter {
      min-width: 220px;
    }
    @media (max-width: 768px) {
      .generation-header {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }
      .generation-header__counter { min-width: 0; }
    }
  `],
})
export class GenerationHeaderComponent {
  game = input.required<string>();
  provider = input.required<string>();
  currentPhase = input.required<number>();
  totalPhases = input.required<number>();

  gameLabel = () => GAME_LABELS[this.game()] ?? this.game();
}
```

Note: the `gameLabel = () => …` arrow assigns at construction time. Using a method instead of a `computed()` is fine here because both inputs are required signals — Angular will re-render when they change. If your linter prefers `computed`, you can swap it.

- [ ] **Step 4: Run — expect PASS (3/3)**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/generation/components/generation-header.component.ts \
        frontend/src/app/features/generation/components/generation-header.component.spec.ts
git commit -m "feat(generation): add GenerationHeaderComponent

Top row of the v3 runtime: brand mark + game label + provider badge +
phase counter. All inputs required; renders responsively below 768px."
```

---

### Task 5: Build `generation-modlist.component.ts` (TDD)

**Files:**
- Create: `frontend/src/app/features/generation/components/generation-modlist.component.ts`
- Create: `frontend/src/app/features/generation/components/generation-modlist.component.spec.ts`

Right column of the runtime: list of mods being added live. Each mod renders as a `ui-card` with the mod name, an optional patches sub-count, and the file size. The list grows as new `mod_added` events arrive in the parent.

- [ ] **Step 1: Read the mod shape**

```bash
cat frontend/src/app/shared/models/mod.model.ts
```

Note the `Mod` interface: probably has `name`, `mod_id`, `file_id`, `file_size`, optional patches. Use the existing field names; don't invent new ones.

- [ ] **Step 2: Write the failing spec**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationModlistComponent } from './generation-modlist.component';

describe('GenerationModlistComponent', () => {
  let fixture: ComponentFixture<GenerationModlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationModlistComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationModlistComponent);
  });

  it('renders one card per mod', () => {
    fixture.componentRef.setInput('mods', [
      { mod_id: 1, name: 'USSEP', file_size: 12_000_000 },
      { mod_id: 2, name: 'SkyUI', file_size: 4_500_000 },
    ]);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.gen-modlist__card');
    expect(cards.length).toBe(2);
  });

  it('renders empty state when mods is empty', () => {
    fixture.componentRef.setInput('mods', []);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.gen-modlist__card');
    expect(cards.length).toBe(0);
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('no mods');
  });

  it('shows the mod name and a formatted file size', () => {
    fixture.componentRef.setInput('mods', [
      { mod_id: 1, name: 'A Quality World Map', file_size: 1_572_864 }, // 1.5 MB
    ]);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.gen-modlist__card');
    expect(card.textContent).toContain('A Quality World Map');
    expect(card.textContent).toMatch(/1\.5\s*MB/i);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement**

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiCardComponent } from '../../../shared/components/ui';

// Loose mod shape — accepts whatever GenerationService.modsAdded() emits.
// Matches the public fields used by the v2 timeline so the parent doesn't
// need to map. Tight typing is owned by mod.model.ts.
export interface ModlistItem {
  mod_id: number;
  name: string;
  file_size?: number;
  patches?: number;
}

@Component({
  selector: 'app-generation-modlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiCardComponent],
  template: `
    @if (mods().length === 0) {
      <div class="gen-modlist__empty">
        <span class="gen-modlist__empty-text">no mods added yet</span>
      </div>
    } @else {
      <ul class="gen-modlist__list">
        @for (mod of mods(); track mod.mod_id) {
          <li class="gen-modlist__card">
            <span class="gen-modlist__name">{{ mod.name }}</span>
            <span class="gen-modlist__meta">
              {{ formatSize(mod.file_size) }}
              @if (mod.patches) {
                <span class="gen-modlist__patches">+ {{ mod.patches }} patches</span>
              }
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .gen-modlist__empty {
      display: flex; align-items: center; justify-content: center;
      height: 100%; min-height: 200px;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-1);
    }
    .gen-modlist__empty-text {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      color: var(--color-text-dim);
    }
    .gen-modlist__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .gen-modlist__card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.625rem 0.875rem;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .gen-modlist__name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text);
    }
    .gen-modlist__meta {
      display: inline-flex;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .gen-modlist__patches {
      color: var(--color-accent);
    }
  `],
})
export class GenerationModlistComponent {
  mods = input.required<ModlistItem[]>();

  formatSize(bytes: number | undefined): string {
    if (!bytes || bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  }
}
```

- [ ] **Step 5: Run — expect PASS (3/3)**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/generation/components/generation-modlist.component.ts \
        frontend/src/app/features/generation/components/generation-modlist.component.spec.ts
git commit -m "feat(generation): add GenerationModlistComponent

Right column of the v3 runtime. Renders the live-growing modlist as
hairline cards with mono-formatted file sizes. Empty state shows a
'no mods added yet' placeholder."
```

---

### Task 6: Build `generation-controls.component.ts` (TDD)

**Files:**
- Create: `frontend/src/app/features/generation/components/generation-controls.component.ts`
- Create: `frontend/src/app/features/generation/components/generation-controls.component.spec.ts`

Pause / resume / cancel / download-log control bar. The component is event-emitting only — the parent owns the side effects.

- [ ] **Step 1: Write the failing spec**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationControlsComponent } from './generation-controls.component';

describe('GenerationControlsComponent', () => {
  let fixture: ComponentFixture<GenerationControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationControlsComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationControlsComponent);
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
  });

  it('shows Pause when running, Resume when paused', () => {
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pause');

    fixture.componentRef.setInput('status', 'paused');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Resume');
  });

  it('emits paused when Pause clicked while running', () => {
    let emitted = false;
    fixture.componentInstance.paused.subscribe(() => (emitted = true));
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
    const pauseBtn = fixture.nativeElement.querySelector('[data-action="pause"]');
    pauseBtn.click();
    expect(emitted).toBe(true);
  });

  it('emits resumed when Resume clicked while paused', () => {
    let emitted = false;
    fixture.componentInstance.resumed.subscribe(() => (emitted = true));
    fixture.componentRef.setInput('status', 'paused');
    fixture.detectChanges();
    const resumeBtn = fixture.nativeElement.querySelector('[data-action="resume"]');
    resumeBtn.click();
    expect(emitted).toBe(true);
  });

  it('emits cancelled when Cancel clicked', () => {
    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));
    const cancelBtn = fixture.nativeElement.querySelector('[data-action="cancel"]');
    cancelBtn.click();
    expect(emitted).toBe(true);
  });

  it('emits downloadLog when download clicked', () => {
    let emitted = false;
    fixture.componentInstance.downloadLog.subscribe(() => (emitted = true));
    const dlBtn = fixture.nativeElement.querySelector('[data-action="download-log"]');
    dlBtn.click();
    expect(emitted).toBe(true);
  });

  it('hides pause/resume when status is complete or error', () => {
    fixture.componentRef.setInput('status', 'complete');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-action="pause"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-action="resume"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import { ChangeDetectionStrategy, Component, EventEmitter, Output, input } from '@angular/core';
import { UiButtonComponent } from '../../../shared/components/ui';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider, Pause, Play, X, Download } from 'lucide-angular';

export type GenerationStatus = 'running' | 'paused' | 'complete' | 'error' | 'idle';

@Component({
  selector: 'app-generation-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Pause, Play, X, Download }),
    },
  ],
  template: `
    <div class="gen-controls">
      @if (status() === 'running') {
        <button ui-button variant="secondary" size="sm" data-action="pause" (click)="paused.emit()">
          <lucide-icon name="pause" [size]="14" [strokeWidth]="2"></lucide-icon>
          Pause
        </button>
      } @else if (status() === 'paused') {
        <button ui-button variant="primary" size="sm" data-action="resume" (click)="resumed.emit()">
          <lucide-icon name="play" [size]="14" [strokeWidth]="2"></lucide-icon>
          Resume
        </button>
      }
      <button ui-button variant="ghost" size="sm" data-action="cancel" (click)="cancelled.emit()">
        <lucide-icon name="x" [size]="14" [strokeWidth]="2"></lucide-icon>
        Cancel
      </button>
      <button ui-button variant="ghost" size="sm" data-action="download-log" (click)="downloadLog.emit()">
        <lucide-icon name="download" [size]="14" [strokeWidth]="2"></lucide-icon>
        Log
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .gen-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `],
})
export class GenerationControlsComponent {
  status = input.required<GenerationStatus>();

  @Output() paused = new EventEmitter<void>();
  @Output() resumed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() downloadLog = new EventEmitter<void>();
}
```

- [ ] **Step 4: Run — expect PASS (6/6)**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/generation/components/generation-controls.component.ts \
        frontend/src/app/features/generation/components/generation-controls.component.spec.ts
git commit -m "feat(generation): add GenerationControlsComponent

Event-emitting control bar — pause/resume/cancel/download-log buttons.
No side effects; the parent owns the GenerationService interaction.
Pause/resume are mutually exclusive based on status input."
```

---

### Task 7: Rebuild `generation.component.ts` to orchestrate the four sub-components

**Files:**
- Modify: `frontend/src/app/features/generation/generation.component.ts` (1,784 → ~250 lines)
- Modify: `frontend/src/app/core/motion/animations.ts` (remove `stackBuild`)

This is the heaviest step. Read the existing component carefully and preserve every piece of orchestration logic, then strip the inline template/styles down to a composition of the four sub-components.

- [ ] **Step 1: Identify what to preserve**

Read `frontend/src/app/features/generation/generation.component.ts`. Make a written checklist of all behaviors that must survive the rebuild:
- Route param subscription (`/generate/:id`).
- `GenerationService` injection and signal consumption.
- `downloadLog()` handler — keep verbatim.
- `pauseGeneration()` / `resumeGeneration()` / `cancelGeneration()` handlers — keep verbatim.
- Redirect on complete: when `gen.status() === 'complete'` and `gen.modlistId()` is set, navigate to `/modlist/<id>`.
- "Generation Not Found" banner shown when `generationNotFound()` returns true.
- Empty-free-tier guard (line 1638-ish): `ready?.count === 0 && ready?.free_tier === true && this.gen.modsAdded().length === 0`. (May or may not still be reachable post-v2 auth removal — verify.)
- Pause-form workflow (line 1619+): when paused, the user can swap providers/keys; on resume the new values flow into the service.

Note any logic you're tempted to delete — if it's not obviously dead, **keep it**.

- [ ] **Step 2: Replace the template**

The new template is roughly:

```html
<div class="generation-page">
  @if (generationNotFound()) {
    <div class="not-found-banner">
      <h2>Generation Not Found</h2>
      <p>This generation may have expired or doesn't exist. Start a new one from the setup wizard.</p>
      <a ui-button variant="primary" size="md" routerLink="/setup">Start New Modlist</a>
    </div>
  } @else {
    <app-generation-header
      [game]="gen.game() ?? 'skyrim'"
      [provider]="gen.activeProvider() ?? '—'"
      [currentPhase]="gen.currentPhase()?.number ?? 0"
      [totalPhases]="gen.totalPhases() ?? 13"
    ></app-generation-header>

    <main class="gen-grid">
      <section class="gen-grid__log">
        <app-generation-log [events]="gen.events()"></app-generation-log>
      </section>
      <aside class="gen-grid__modlist">
        <app-generation-modlist [mods]="gen.modsAdded()"></app-generation-modlist>
      </aside>
    </main>

    <footer class="gen-controls-bar">
      <app-generation-controls
        [status]="gen.status() ?? 'idle'"
        (paused)="onPause()"
        (resumed)="onResume()"
        (cancelled)="onCancel()"
        (downloadLog)="downloadLog()"
      ></app-generation-controls>
    </footer>

    <!-- Paused-state provider swap form (preserve verbatim from v2 lines ~470-560) -->
    @if (gen.status() === 'paused' && gen.pauseInfo()) {
      <!-- … the existing pause form UI here, untouched … -->
    }
  }
</div>
```

The exact signal accessors depend on what `GenerationService` actually exposes — match what you read in Step 1. If the service doesn't expose a `game()` signal, route through `gen.session()?.game` or whatever does exist.

- [ ] **Step 3: Replace the styles**

```css
:host { display: block; }
.generation-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  color: var(--color-text);
}
.not-found-banner {
  text-align: center;
  padding: 6rem 2rem;
}
.gen-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1px;
  background: var(--color-border);
  min-height: 0;
}
.gen-grid__log,
.gen-grid__modlist {
  background: var(--color-bg);
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  min-height: 0;
}
.gen-grid__modlist {
  background: var(--color-surface-1);
}
.gen-controls-bar {
  border-top: 1px solid var(--color-border);
  padding: 0.75rem 1.5rem;
  background: var(--color-bg);
  position: sticky;
  bottom: 0;
}
@media (max-width: 900px) {
  .gen-grid { grid-template-columns: 1fr; }
  .gen-grid__modlist { order: -1; max-height: 240px; }
}
```

Drop all v2 styles (the `~895` lines from line 598-1493) — the new layout is intentionally lean.

- [ ] **Step 4: Update imports**

The class header changes from:

```ts
imports: [
  RouterLink,
  FormsModule,
  LucideAngularModule,
  UiButtonComponent,
  UiInputComponent,
  UiBadgeComponent,
  UiCardComponent,
],
```

to:

```ts
imports: [
  RouterLink,
  FormsModule,
  UiButtonComponent,
  UiInputComponent,  // only if the pause-form needs it
  GenerationHeaderComponent,
  GenerationLogComponent,
  GenerationModlistComponent,
  GenerationControlsComponent,
],
```

Drop the Lucide icons import block — the sub-components own their own icons.

- [ ] **Step 5: Drop the inline `EVENT_ICONS` map and `TimelineItem` interface**

Lines 78-100 and 62-69 in the v2 file. Both are obsolete — `eventToLogEntry()` replaces them.

- [ ] **Step 6: Remove the v2 `stackBuild` animation**

In `frontend/src/app/core/motion/animations.ts`, find and delete the `stackBuild` export. Then remove the import + `animations: [fadeUp, stackBuild]` reference from the new `generation.component.ts`. Keep `fadeUp` if you use it on the not-found banner.

```bash
grep -rIn "stackBuild" frontend/src
```

Expected: zero hits after the deletion. (If there are other consumers, leave the trigger but verify those callers — there shouldn't be any.)

- [ ] **Step 7: Run all unit specs**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: all pass (including the four new sub-component specs from Tasks 3-6).

- [ ] **Step 8: Run production build + smoke test**

```bash
cd frontend && npx ng build --configuration=production
npx http-server dist/frontend/browser -p 4200 -s &
sleep 3
npm run test:e2e
kill %1
```

Expected: build succeeds, smoke test passes.

- [ ] **Step 9: Manual sanity check (if you have a way)**

Launch the dev server and trigger a generation run (Setup → choose Skyrim → minimal preset → kick off). Watch:
- Phase counter advances.
- Log scrolls with `>` / `[ok]` / `[warn]` prefixes.
- Modlist on the right grows as `mod_added` events arrive.
- Pause/resume buttons swap correctly.
- Cancel returns to dashboard or setup (preserve whatever the v2 behavior was).

This step is informational; if you can't trigger a real run, skip it — the unit + smoke gates are the contract.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/features/generation/generation.component.ts \
        frontend/src/app/core/motion/animations.ts
git commit -m "feat(generation): rebuild runtime as orchestrator + 4 sub-components

Drops the 1,784-line single-file v2 component. New shape:
- GenerationHeader (brand + game + provider + phase counter)
- GenerationLog (terminal log of pipeline events)
- GenerationModlist (live cards on the right)
- GenerationControls (pause/resume/cancel/download-log)

Orchestrator keeps GenerationService subscription, route handling,
pause-form, redirect-on-complete. Drops the stackBuild animation and
the inline EVENT_ICONS / TimelineItem definitions."
```

---

### Task 8: Rebuild `landing.component.ts`

**Files:**
- Modify: `frontend/src/app/features/landing/landing.component.ts` (~1,165 → ~600 lines)

The landing rebuild stays in a single component file but loses ~50% of its bulk.

- [ ] **Step 1: Read the current file**

```bash
wc -l frontend/src/app/features/landing/landing.component.ts
```

Plan what survives:
- Navbar (keep — minor reskin)
- Hero section (rebuild — Pip-Tek terminal-log centerpiece)
- Mock-dashboard preview (DROP entirely; lines ~140-205 in the v2 file)
- "How It Works" section (KEEP, simplify — drop the IntersectionObserver and inline the steps; consider Angular's `@defer (on viewport)` for the reveal)
- "Features" section (DROP)
- "Social Proof" bar (DROP)
- CTA section (KEEP)
- Footer (KEEP, compress)

- [ ] **Step 2: Build the new hero**

The hero centerpiece is a scripted `UiTerminalLogComponent` cycling through a canned sequence — gives the page a "this is what the tool actually does" feel without running a real pipeline.

```ts
// inside LandingComponent class
private static readonly DEMO_SCRIPT: TerminalLogEntry[] = [
  { level: 'info', text: 'phase 1/13 — essentials' },
  { level: 'info', text: 'searching nexus: unofficial patches' },
  { level: 'ok',   text: 'added: Unofficial Skyrim Special Edition Patch' },
  { level: 'ok',   text: 'added: SkyUI' },
  { level: 'info', text: 'phase 2/13 — UI improvements' },
  { level: 'ok',   text: 'added: A Quality World Map' },
  { level: 'ok',   text: 'added: SmoothCam' },
  { level: 'warn', text: 'deferred: mod conflicts with SkyUI patch' },
  { level: 'ok',   text: 'patch added: USSEP × SkyUI compatibility patch' },
  { level: 'info', text: 'phase 3/13 — gameplay overhaul' },
  { level: 'ok',   text: 'added: SkyRem - Marriage Mod' },
  { level: 'ok',   text: 'added: Wildcat Combat' },
  { level: 'info', text: 'phase complete — 47 mods · 0 conflicts' },
];

heroEntries = signal<TerminalLogEntry[]>([]);

ngAfterViewInit(): void {
  // existing IntersectionObserver setup …
  // plus: start the hero animation
  this.startHeroDemo();
}

private startHeroDemo(): void {
  const script = LandingComponent.DEMO_SCRIPT;
  let i = 0;
  const tick = () => {
    this.heroEntries.set(script.slice(0, i + 1));
    i = (i + 1) % (script.length + 4);  // pause at the end before restarting
    if (i <= script.length) {
      this.heroDemoTimer = window.setTimeout(tick, 700 + Math.random() * 400);
    } else {
      this.heroDemoTimer = window.setTimeout(() => {
        i = 0;
        this.heroEntries.set([]);
        tick();
      }, 2500);
    }
  };
  tick();
}

private heroDemoTimer: number | undefined;

ngOnDestroy(): void {
  // existing cleanup …
  if (this.heroDemoTimer) clearTimeout(this.heroDemoTimer);
}
```

In the hero template, replace the mock-dashboard preview with:

```html
<div class="hero-preview">
  <div class="preview-window">
    <div class="preview-titlebar">
      <div class="preview-dots"><span></span><span></span><span></span></div>
      <span class="preview-title font-mono">moddersomni — generation log</span>
    </div>
    <div class="preview-body">
      <ui-terminal-log [entries]="heroEntries()"></ui-terminal-log>
    </div>
  </div>
</div>
```

Style the preview body with `min-height: 320px; max-height: 380px; padding: 1rem;`. Keep the macOS-style window chrome — it's a nice frame for the log.

- [ ] **Step 3: Simplify "How It Works"**

Replace the `stepsVisible` signal + IntersectionObserver pattern with Angular's `@defer (on viewport)`:

```html
<section class="section" id="how-it-works">
  <div class="section-container">
    <div class="section-header">
      <span class="section-label">How It Works</span>
      <h2 class="section-title">Three steps to your ideal mod setup</h2>
    </div>
    @defer (on viewport) {
      <div class="steps">
        <div class="step"> ... existing step 1 markup ... </div>
        <div class="step-divider"><lucide-icon name="arrow-right" [size]="24"></lucide-icon></div>
        <div class="step"> ... existing step 2 markup ... </div>
        <div class="step-divider"><lucide-icon name="arrow-right" [size]="24"></lucide-icon></div>
        <div class="step"> ... existing step 3 markup ... </div>
      </div>
    } @placeholder {
      <div class="steps-placeholder" style="min-height: 200px;"></div>
    }
  </div>
</section>
```

Delete:
- the `stepsVisible` and `featuresVisible` signals,
- the `IntersectionObserver` setup in `ngAfterViewInit`,
- the `staggerChildren` animation import (`@staggerChildren` was applied to the steps wrapper),
- the entire "Features" section (lines ~252-285 in v2),
- the entire "Social Proof" bar section (lines ~288-300 in v2),
- the `modlistsGenerated` and `gamesSupported` signals (no longer rendered).

- [ ] **Step 4: Enforce the single-CTA rule**

Hero gets exactly one primary CTA: `<a ui-button variant="primary" size="lg" routerLink="/setup">Build my modlist <lucide-icon name="arrow-right" …></lucide-icon></a>`.

The "See How It Works" anchor link survives (it's a within-page anchor, not a CTA-styled button — render it as a small `secondary` ghost or just an `<a class="hero-anchor">`). The CTA section at the bottom of the page keeps its single button.

Audit the new file for `ui-button variant="primary"` — count should be exactly 2 (hero + bottom CTA section).

- [ ] **Step 5: Compress the footer**

Replace the existing 3-link footer with:

```html
<footer class="footer">
  <div class="footer-container">
    <app-brand-mark size="sm" [showText]="true"></app-brand-mark>
    <p class="footer-copy">© 2026 ModdersOmni · Open source under GPL-3.0</p>
  </div>
</footer>
```

Drop the "Dashboard / New Build / Settings" link list — those routes are reachable via the navbar.

- [ ] **Step 6: Wire `UiTerminalLogComponent` into the imports**

Add to the `imports` array on the component:

```ts
import { UiTerminalLogComponent, type TerminalLogEntry } from '../../shared/components/ui';
import { BrandMarkComponent } from '../../shared/components/brand-mark/brand-mark.component';
```

…and remove anything no longer used (the `staggerChildren` import, lucide icons that disappeared with the dropped sections).

- [ ] **Step 7: Run all unit specs**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: all pass. There's no landing spec today; this commit doesn't add one (the rebuild is layout-only and visually verified).

- [ ] **Step 8: Build + smoke test**

```bash
cd frontend && npx ng build --configuration=production
npx http-server dist/frontend/browser -p 4200 -s &
sleep 3
npm run test:e2e
kill %1
```

Expected: build succeeds. Smoke test passes (the test only asserts tokens resolve; the landing rebuild keeps the dark theme so it still passes).

- [ ] **Step 9: Manual visual check**

Start the dev server, open `/` in a browser. Confirm:
- Hero renders with the terminal-log cycling through the demo script.
- Exactly one primary "Build my modlist" CTA in the hero.
- "How It Works" section shows three steps.
- Features + Social Proof sections are gone.
- CTA section + footer present.
- No console errors.

If you can't open a browser, fall back to a Playwright snapshot check (out of scope for this task — defer).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/features/landing/landing.component.ts
git commit -m "feat(landing): rebuild for Pip-Tek

Hero centerpiece is a scripted UiTerminalLogComponent cycling through a
canned pipeline run — replaces the v2 mock-dashboard preview. Sections
trimmed from hero+how-it-works+features+social-proof+cta to
hero+how-it-works+cta. Footer compressed to brand-mark + copyright.
Exactly one primary CTA on the page. IntersectionObserver replaced with
Angular's @defer (on viewport)."
```

---

### Task 9: Final verification + open PR #2

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: every spec passes. Compare the count to PR #1's baseline (was 204) — the new specs (event-to-log-entry, generation-log, generation-header, generation-modlist, generation-controls) add ~25-30 more. Expected total: ~230+.

- [ ] **Step 2: Production build + smoke test**

```bash
cd frontend && npx ng build --configuration=production
npx http-server dist/frontend/browser -p 4200 -s &
sleep 3
npm run test:e2e
kill %1
```

Both must pass.

- [ ] **Step 3: Sanity-grep for v2 leftovers**

```bash
grep -rIn "stackBuild\|EVENT_ICONS\|TimelineItem\|mock-dashboard\|previewCards\|stepsVisible\|featuresVisible\|modlistsGenerated" frontend/src
```

Expected: zero matches outside the deletions in this branch's diff.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/pip-tek-rebuilds
gh pr create --title "feat(design): Pip-Tek rebuilds — landing + generation runtime" --body "$(cat <<'EOF'
## Summary

Rebuilds the two layout-heavy routes on top of the Pip-Tek foundation that landed in PR #1.

### Landing (`/`)
- New hero centerpiece: scripted UiTerminalLogComponent cycling through a canned pipeline run, replacing the v2 mock-dashboard preview.
- Sections trimmed from 5 to 3: `hero + how-it-works + cta`.
- Single primary CTA on the page (`Build my modlist` → `/setup`).
- Footer compressed.
- IntersectionObserver replaced with Angular's `@defer (on viewport)`.

### Generation runtime (`/generate/:id`)
- Decomposed from a 1,784-line single-file component into a thin orchestrator (~250 lines) + four sub-components: GenerationHeader, GenerationLog, GenerationModlist, GenerationControls.
- New two-column layout: terminal log on the left, live modlist on the right, phase counter at the top, control bar at the bottom.
- v2 stackBuild accordion animation removed.
- Pause/resume/cancel/download-log behavior preserved unchanged.
- Pipeline integration unchanged — same GenerationService signals, same pipeline.

### Tests
- 5 new spec files: eventToLogEntry (9 tests), GenerationLog (3), GenerationHeader (3), GenerationModlist (3), GenerationControls (6).
- Existing Karma + Playwright smoke gates still pass.

Implements the **Rebuild** rows of `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md` Decision 6.

## Test plan

- [x] All Karma unit specs pass
- [x] Playwright smoke test passes against the production build
- [x] No v2 leftovers in source (stackBuild, EVENT_ICONS, etc.)
- [ ] Manual: trigger a generation run and confirm the new runtime renders correctly
- [ ] Code review

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Notes for the executor

- **Don't change `GenerationService`.** This plan is a view rebuild only. Any logic that has to move out of the v2 `generation.component.ts` should land in a sub-component (Tasks 3-6) or stay in the orchestrator (Task 7). The service interface is stable.
- **Pause-form preservation.** The v2 component has a fairly elaborate paused-state form where the user can swap providers/keys before resuming. Keep it intact in the orchestrator template — Task 7 Step 2's sketch only shows a placeholder. Copy the actual markup from v2 lines roughly 470-560 (the exact range may differ in your checkout).
- **Free-tier guard.** If the v2 free-tier empty-quota guard is unreachable after the auth removal (it likely is), delete the dead code as part of Task 7. But don't delete anything you're unsure about — `git blame` + a quick search for the `free_tier` field in `GenerationService` will tell you.
- **Mod size formatting.** `formatGB()` in v2 formats running totals; `formatSize()` in the new `GenerationModlistComponent` formats per-mod sizes. Keep both — different display contexts.
- **No version bump.** Per the spec's Decision 8, the bump to 2.1.0 happens in Plan 4's last PR.
- **Branch strategy.** This plan branches from `main` after Plan 1's PR merges. If Plan 1 is still open when execution starts, branch from `feat/pip-tek-foundation` instead and rebase onto `main` post-merge.
