# Plan 2 — Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task produces **exactly one commit**.

**Goal:** Adopt a centralized design system for the Angular 19 SPA — OKLCH design tokens via Tailwind 4 `@theme`, spartan-ng for interactive primitives, lucide-angular for icons, Instrument Serif + DM Sans + JetBrains Mono typography, sharp-edged tactile surfaces (no glassmorphism), centralized motion. Migrate features one at a time so the app never breaks.

**Architecture:** Foundation first (tokens, fonts, primitive layer). Then feature-by-feature migration where each feature's components stop reimplementing buttons/cards/forms and start composing the shared primitives. Final polish pass strips glassmorphism, sharpens surface treatment, and reworks the generation page motion.

**Tech Stack:** Angular 19 (standalone components, signals), Tailwind CSS 4 (`@theme` block + OKLCH), `@spartan-ng/ui-*` (shadcn-quality primitives built on Angular CDK), `lucide-angular` (single-source iconography), Google Fonts for Instrument Serif + DM Sans + JetBrains Mono, Jasmine + Karma + ChromeHeadless for tests.

**Source spec:** [`docs/superpowers/specs/2026-05-09-static-bundle-refactor-design.md`](../specs/2026-05-09-static-bundle-refactor-design.md) — Decisions 8 and 9.

**Working repo:** `C:\Users\stsbr\Documents\ModdersOmni-New`. Tip after Plan 1: `8a6ef75`. CI green.

**Per-commit CI rule:** Each task produces **one commit**. After each push, the parent agent waits for the CI workflow to report `success` before dispatching the next task. The subagent does NOT push.

---

## File Structure

### Created (new files)

**Design tokens (one file owns all colors/spacing/radii):**
- `frontend/src/styles/tokens.scss` — Tailwind 4 `@theme` block with OKLCH palette, font stack assignments, radius/shadow/easing tokens.

**Shared UI primitives (under `frontend/src/app/shared/components/ui/`):**
- `button.component.ts` — `<ui-button variant="primary|secondary|ghost|destructive" size="sm|md|lg">`
- `card.component.ts` — `<ui-card>` with header/body/footer projection slots
- `dialog.component.ts` — `<ui-dialog>` modal wrapper, exit on Esc + backdrop click
- `sheet.component.ts` — `<ui-sheet side="right|left|bottom">` slide-over panel
- `input.component.ts` — `<ui-input>` styled text/email/password/number input
- `textarea.component.ts` — `<ui-textarea>` styled multi-line input
- `select.component.ts` — `<ui-select>` styled dropdown (uses Angular CDK overlay)
- `badge.component.ts` — `<ui-badge variant="default|info|success|warning|danger">`
- `separator.component.ts` — `<ui-separator orientation="horizontal|vertical">`
- `label.component.ts` — `<ui-label for=...>` form label
- `index.ts` — barrel export for the above

**Motion system:**
- `frontend/src/app/core/motion/easing.ts` — named cubic-bezier constants
- `frontend/src/app/core/motion/animations.ts` — Angular animation triggers (fade-up, stagger, stack-build, etc.)

### Modified

**Foundation:**
- `frontend/src/styles.scss` — import `tokens.scss`; remove obsolete CSS variables that are now tokens
- `frontend/src/index.html` — Google Fonts URL: drop Playfair, add Instrument Serif + JetBrains Mono (DM Sans stays)
- `frontend/src/tailwind.css` — verify Tailwind 4 directives + `@theme` integration
- `frontend/package.json` — add `@spartan-ng/ui-button-helm`, `@spartan-ng/ui-button-brain`, `@spartan-ng/ui-card-helm`, etc., plus `lucide-angular`. (Spartan-ng splits each component into `helm` (presentation) and `brain` (behavior) packages.)

**Feature components — per-feature migration:**
- `frontend/src/app/features/landing/**` — landing page hero/cta/features
- `frontend/src/app/features/setup/**` — setup wizard 4 steps + playstyle-select
- `frontend/src/app/features/settings/**` — settings page
- `frontend/src/app/features/generation/**` — generation page + timeline
- `frontend/src/app/features/modlist/**` — modlist detail/list
- `frontend/src/app/features/dashboard/**` — dashboard cards + modal
- `frontend/src/app/features/compatibility/**` — compatibility checker
- `frontend/src/app/features/support/**`, `methodology/**`, `browse/**`, `downloads/**` — smaller pages

**Surface polish:**
- `frontend/src/app/shared/components/header/header.component.ts` — drop glassmorphism (backdrop blur + radial gradients), replace with sharp solid background + hairline border

**Motion:**
- `frontend/src/app/features/generation/timeline/*` — replace fade-in with vertical "stack-building" motion

### Read-only references

- `frontend/src/styles.scss` (current state — has the existing CSS custom properties + dark/gold palette)
- `frontend/src/index.html` (current Google Fonts URLs)
- `frontend/angular.json` (verify build config supports Tailwind 4 + `@theme`)
- `https://www.spartan.ng/components` (component docs the engineer will reference)
- `https://lucide.dev/icons/` (icon catalog)

---

## Per-task verification (every task uses this)

After every code change, the subagent runs:

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

**Both must pass.** Test count must remain at the baseline established by Plan 1 (191 at handoff; may grow as primitives add their own specs). Production build must succeed (warnings allowed, errors not).

After commit, the parent agent runs:
```bash
gh run list --repo stsbrega/ModdersOmni-New --limit 1
# Wait via until-loop for status=completed
# Verify conclusion=success
```

If CI fails, the parent agent dispatches a fix subagent before continuing.

---

## Tasks

### Task 1: OKLCH design tokens via Tailwind 4 `@theme`

**Goal:** Define the v2 color palette, font stacks, radii, shadows, and easings as CSS-first design tokens. The existing scattered CSS custom properties in `styles.scss` get replaced by a single source of truth in a new `tokens.scss`.

**Files:**
- Create: `frontend/src/styles/tokens.scss`
- Modify: `frontend/src/styles.scss` (import `tokens.scss`, remove obsolete `:root` custom properties that are now tokens)

**Design notes:**
- Color space: OKLCH for all colors. Tailwind 4 supports OKLCH natively in `@theme`.
- Palette per spec Decision 9:
  - Background base: `oklch(0.16 0.015 260)` (deep near-black, NOT pure `#000`)
  - Surface 1: `oklch(0.20 0.015 260)`
  - Surface 2: `oklch(0.24 0.015 260)`
  - Border: `oklch(0.30 0.015 260)`
  - Text primary: `oklch(0.94 0.01 260)`
  - Text muted: `oklch(0.70 0.01 260)`
  - Accent (warm amber, parchment/forge feel): `oklch(0.78 0.18 75)`
  - Accent muted: `oklch(0.50 0.10 75)`
  - Secondary (cool blue): `oklch(0.72 0.09 230)`
  - Success: `oklch(0.78 0.15 145)`
  - Warning: `oklch(0.85 0.16 95)`
  - Danger: `oklch(0.65 0.22 25)`
- Font stacks:
  - `--font-sans: 'DM Sans', system-ui, sans-serif` (kept from current)
  - `--font-display: 'Instrument Serif', Georgia, serif` (replaces Playfair in spec)
  - `--font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace`
- Radii: `--radius-sm: 4px` (sharper than current 6px), `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-xl: 16px`. Sharper edges per "tactile brutalism with restraint".
- Shadows: keep layered system but reduce blur radius (less glow, more definition). `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (kept), `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` (added for snap motion).

- [ ] **Step 1: Write `tokens.scss`**

```scss
// frontend/src/styles/tokens.scss
//
// Single source of truth for v2 design tokens. Imported by styles.scss.
// Tailwind 4 picks up the @theme block and exposes utilities like
// `bg-bg`, `text-accent`, `border-border`, `font-display`, etc.
//
// Color space: OKLCH everywhere. Use oklch() values (perceptually uniform
// lightness; predictable contrast). DO NOT mix HEX/RGB into the palette —
// they break the L-value math when generating hover/active states.

@theme {
  /* ── Backgrounds & surfaces ── */
  --color-bg:        oklch(0.16 0.015 260);
  --color-surface-1: oklch(0.20 0.015 260);
  --color-surface-2: oklch(0.24 0.015 260);
  --color-border:    oklch(0.30 0.015 260);

  /* ── Text ── */
  --color-text:       oklch(0.94 0.01 260);
  --color-text-muted: oklch(0.70 0.01 260);
  --color-text-dim:   oklch(0.55 0.01 260);

  /* ── Accents ── */
  --color-accent:        oklch(0.78 0.18 75);   /* warm amber */
  --color-accent-muted:  oklch(0.50 0.10 75);
  --color-secondary:     oklch(0.72 0.09 230);  /* cool blue */
  --color-secondary-muted: oklch(0.50 0.06 230);

  /* ── Status ── */
  --color-success: oklch(0.78 0.15 145);
  --color-warning: oklch(0.85 0.16 95);
  --color-danger:  oklch(0.65 0.22 25);

  /* ── Typography ── */
  --font-sans:    'DM Sans', system-ui, -apple-system, sans-serif;
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-mono:    'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;

  /* ── Radii (sharper than v1's 6/10/14/18 — tactile, not soft) ── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* ── Shadows (less blur, more definition) ── */
  --shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.40);
  --shadow-md: 0 2px 4px -1px oklch(0 0 0 / 0.45), 0 4px 8px -2px oklch(0 0 0 / 0.30);
  --shadow-lg: 0 4px 8px -2px oklch(0 0 0 / 0.50), 0 8px 16px -4px oklch(0 0 0 / 0.35);

  /* ── Easings ── */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Backwards-compat shims — let pre-migration components keep their
   --color-* variable references during the per-feature migration, then
   delete this block in the polish pass (Task 13). */
:root {
  --color-bg-base: var(--color-bg);
  --color-bg-elevated: var(--color-surface-1);
  --color-text-primary: var(--color-text);
  --color-accent-gold: var(--color-accent);
  --color-accent-blue: var(--color-secondary);
}
```

- [ ] **Step 2: Update `styles.scss` to import `tokens.scss`**

Modify `frontend/src/styles.scss`:
- Add `@use 'styles/tokens.scss';` at the top (or `@import 'styles/tokens.scss';` if SCSS module mode isn't configured).
- Remove or comment out the existing `:root { --color-* ... }` block — those are now in `tokens.scss`.
- Keep the global keyframes, body styles, and reset rules unchanged.

The result: `tokens.scss` owns all design tokens; `styles.scss` owns the global reset, body, animations, layout helpers.

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng build --configuration=production 2>&1 | tail -10
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
```

Expected: production build success (any "initial bundle exceeded budget" warning is pre-existing). Tests pass at baseline (191).

If a TS error appears mentioning `--color-*` references, the backwards-compat `:root { ... }` shim in `tokens.scss` should resolve it.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/styles/tokens.scss frontend/src/styles.scss
git commit -m "feat(design): add OKLCH design tokens via Tailwind 4 @theme" -m "" -m "Plan 2 Task 1. Single source of truth at frontend/src/styles/tokens.scss." -m "Palette uses OKLCH for perceptually-uniform lightness math. Backwards-" -m "compat :root shims keep existing components working through migration." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Swap fonts (Playfair → Instrument Serif; add JetBrains Mono)

**Goal:** Update Google Fonts URL in `index.html`. Verify font loads. Don't change any component yet — Task 1's `tokens.scss` already declared `--font-display` and `--font-mono`; this task wires up the actual font files.

**Files:**
- Modify: `frontend/src/index.html`

- [ ] **Step 1: Read current `index.html`**

Find the existing Google Fonts `<link>` tags. Note the exact `family=` query parameter format.

- [ ] **Step 2: Replace the Google Fonts URL**

Replace the existing fonts link with one that loads:
- `DM Sans` weights 300, 400, 500, 600, 700 (kept)
- `Instrument Serif` weight 400, italic 400 (replaces Playfair)
- `JetBrains Mono` weights 400, 500, 700 (added)

```html
<!-- frontend/src/index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

**Important:** use simple weight syntax (`wght@300;400;500;600;700`), NOT variable font axis syntax. Per CLAUDE.md, the variable syntax causes 400 errors during Angular font inlining.

- [ ] **Step 3: Verify build + smoke check**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng build --configuration=production 2>&1 | tail -10
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
```

Build must succeed. Tests pass at baseline.

Optional manual: `npm start`, open `http://localhost:4200`, view source → confirm the new Google Fonts URL is in `<head>`. Headings will still use the old Playfair-family font until per-feature migration replaces those rules — that's expected.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/index.html
git commit -m "feat(design): swap Playfair for Instrument Serif, add JetBrains Mono" -m "" -m "Plan 2 Task 2. Loads three fonts via Google Fonts: DM Sans (kept, body)," -m "Instrument Serif (display, replaces Playfair — sharper, less wedding-" -m "invitation), JetBrains Mono (mod IDs, file IDs, load order, version" -m "strings). Token wiring done in Task 1. Per-feature components still" -m "reference the old fonts until migrated; that's expected." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Install @angular/cdk + lucide-angular

**Goal:** Add the headless behavior layer (`@angular/cdk` — overlays, focus traps, a11y, portal, dialog/bottom-sheet modules) + lucide-angular for icons. No spartan-ng — Task 3's first attempt found that:

1. Half of spartan-ng's `*-brain` packages (button, dialog, sheet, separator) are 404 on npm under that naming.
2. Current `@spartan-ng/ui-core` peer-requires Tailwind 3, but the project is on Tailwind 4 (and Task 1's `tokens.scss` uses Tailwind-4-only `@theme` syntax).
3. The migrated structure (`@spartan-ng/brain` + `@spartan-ng/cli`) requires Angular 20; project is on Angular 19.

CDK is the same headless layer spartan-ng uses internally, just unwrapped — we own the styled layer (Task 4) directly on Tailwind 4 + our OKLCH tokens. This is what shadcn does in React (Radix + Tailwind); we do it with CDK + Tailwind.

**Files:**
- Modify: `frontend/package.json` (deps), `frontend/package-lock.json` (lockfile)

- [ ] **Step 1: Install**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npm install @angular/cdk lucide-angular
```

`@angular/cdk` version should auto-pick the one matching Angular 19. If the exact version doesn't exist for `^19`, pin it: `npm install @angular/cdk@^19.0.0 lucide-angular`.

- [ ] **Step 2: Verify build**

```bash
npx ng build --configuration=production 2>&1 | tail -10
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
```

Build must succeed (just adding deps, no usage yet). Tests pass at baseline.

If build fails with "Cannot find module" for a spartan-ng package, double-check the install list — some packages may have been renamed in a recent release.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(design): install @angular/cdk + lucide-angular" -m "" -m "Plan 2 Task 3 (revised). CDK is the headless behavior layer (overlays," -m "focus traps, a11y, portals); Task 4 builds styled wrappers on top with" -m "Tailwind 4 + our OKLCH tokens. Same pattern as shadcn (Radix + Tailwind)." -m "" -m "Originally planned spartan-ng — found unworkable: half of *-brain" -m "packages 404, current core requires Tailwind 3 (we're on 4), new variant" -m "requires Angular 20 (we're on 19). CDK avoids all three." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Build shared UI primitive layer

**Goal:** Create thin Angular wrappers under `frontend/src/app/shared/components/ui/` that compose `@angular/cdk` headless directives with our Tailwind 4 OKLCH tokens. Features import these wrappers; they don't import CDK directly. Single barrel re-exports them.

**Why a wrapper layer:** CDK provides the behavior (overlay positioning, focus management, keyboard interaction) but no styling. We own the visual layer using Tailwind 4 utility classes that resolve to our `--color-*` tokens. Same pattern as shadcn-in-React — Radix gives behavior, Tailwind gives style — adapted for Angular CDK.

**Files:**
- Create: `frontend/src/app/shared/components/ui/button.component.ts`
- Create: `frontend/src/app/shared/components/ui/card.component.ts`
- Create: `frontend/src/app/shared/components/ui/dialog.component.ts`
- Create: `frontend/src/app/shared/components/ui/sheet.component.ts`
- Create: `frontend/src/app/shared/components/ui/input.component.ts`
- Create: `frontend/src/app/shared/components/ui/textarea.component.ts`
- Create: `frontend/src/app/shared/components/ui/select.component.ts`
- Create: `frontend/src/app/shared/components/ui/badge.component.ts`
- Create: `frontend/src/app/shared/components/ui/separator.component.ts`
- Create: `frontend/src/app/shared/components/ui/label.component.ts`
- Create: `frontend/src/app/shared/components/ui/index.ts` (barrel)
- Create: `frontend/src/app/shared/components/ui/button.component.spec.ts` (smoke test for the layer)

- [ ] **Step 1: Implement button + smoke test (sets the pattern for the rest)**

A button doesn't need CDK behavior — native `<button>` element handles keyboard/focus/disabled. The wrapper is pure Tailwind classes via host bindings.

```typescript
// frontend/src/app/shared/components/ui/button.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:     'bg-accent text-bg hover:bg-accent/90 focus-visible:ring-accent',
  secondary:   'bg-surface-2 text-text border border-border hover:bg-surface-1 focus-visible:ring-secondary',
  ghost:       'bg-transparent text-text hover:bg-surface-2 focus-visible:ring-secondary',
  destructive: 'bg-danger text-text hover:bg-danger/90 focus-visible:ring-danger',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-sm',
  md: 'h-10 px-4 text-base rounded-md',
  lg: 'h-12 px-6 text-lg rounded-md',
};

@Component({
  selector: 'button[ui-button]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content/>`,
  host: {
    '[class]': '"inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 " + variantClasses() + " " + sizeClasses()',
    '[attr.type]': 'type',
    '[attr.disabled]': 'disabled || null',
  },
})
export class UiButtonComponent {
  @Input() variant: Variant = 'primary';
  @Input() size: Size = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;

  variantClasses() { return VARIANT_CLASSES[this.variant]; }
  sizeClasses() { return SIZE_CLASSES[this.size]; }
}
```

Usage in templates: `<button ui-button variant="primary">Save</button>` — attaches to a real `<button>` element so native semantics (form submit, focus, screen reader) work without extra wiring.

```typescript
// frontend/src/app/shared/components/ui/button.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiButtonComponent } from './button.component';

describe('UiButtonComponent', () => {
  let fixture: ComponentFixture<UiButtonComponent>;
  let component: UiButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiButtonComponent] }).compileComponents();
    fixture = TestBed.createComponent(UiButtonComponent);
    component = fixture.componentInstance;
  });

  it('defaults to variant=primary, size=md, type=button', () => {
    fixture.detectChanges();
    expect(component.variant).toBe('primary');
    expect(component.size).toBe('md');
    expect(component.type).toBe('button');
  });

  it('applies primary classes when variant=primary', () => {
    component.variant = 'primary';
    fixture.detectChanges();
    const cls = (fixture.nativeElement as HTMLElement).className;
    expect(cls).toContain('bg-accent');
  });

  it('applies destructive classes when variant=destructive', () => {
    component.variant = 'destructive';
    fixture.detectChanges();
    const cls = (fixture.nativeElement as HTMLElement).className;
    expect(cls).toContain('bg-danger');
  });

  it('reflects size to height class', () => {
    component.size = 'sm';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).className).toContain('h-8');
    component.size = 'lg';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).className).toContain('h-12');
  });
});
```

- [ ] **Step 2: Implement remaining primitives**

For static-styled primitives (card, badge, separator, input, textarea, label) — same pattern as button: a single component with host bindings that apply Tailwind utility classes resolving to our `--color-*` tokens. No CDK needed for these.

For interactive primitives that need overlay/focus management (dialog, sheet, select), use CDK:

- **Dialog:** import `Dialog` from `@angular/cdk/dialog`. Inject in a service or directly in the wrapper. The wrapper exposes an `open()` method that calls `dialog.open(template)`.
- **Sheet:** use CDK Overlay's `Overlay` + `OverlayConfig` with positioning anchored to the right/left/bottom edge. CDK provides `OverlayPositionBuilder` for this.
- **Select:** use CDK Overlay + a flexible position strategy anchored to the trigger button. CDK's `ListKeyManager` handles keyboard nav (up/down arrows, Enter to select).

Example dialog wrapper:

```typescript
// frontend/src/app/shared/components/ui/dialog.component.ts (example)
import { Component, ChangeDetectionStrategy, inject, TemplateRef } from '@angular/core';
import { Dialog, DialogConfig } from '@angular/cdk/dialog';

@Component({
  selector: 'ui-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content/>`,
  host: {
    'class': 'block bg-surface-1 border border-border rounded-md shadow-lg p-6 max-w-md',
  },
})
export class UiDialogComponent {
  private readonly dialog = inject(Dialog);

  open(template: TemplateRef<unknown>, config?: DialogConfig) {
    return this.dialog.open(template, {
      hasBackdrop: true,
      backdropClass: 'bg-bg/80',
      panelClass: 'block bg-surface-1 border border-border rounded-md shadow-lg p-6 max-w-md',
      ...config,
    });
  }
}
```

Don't write a `.spec.ts` for each primitive — the button spec validates the pattern. Add specs for ones with non-trivial behavior (dialog open/close lifecycle, sheet side prop) but only if straightforward.

If a CDK API has subtleties, refer to `https://material.angular.io/cdk/categories` (CDK's docs are under the Material Angular site).

- [ ] **Step 3: Write the barrel**

```typescript
// frontend/src/app/shared/components/ui/index.ts
export { UiButtonComponent } from './button.component';
export { UiCardComponent } from './card.component';
export { UiDialogComponent } from './dialog.component';
export { UiSheetComponent } from './sheet.component';
export { UiInputComponent } from './input.component';
export { UiTextareaComponent } from './textarea.component';
export { UiSelectComponent } from './select.component';
export { UiBadgeComponent } from './badge.component';
export { UiSeparatorComponent } from './separator.component';
export { UiLabelComponent } from './label.component';
```

Features import via: `import { UiButtonComponent, UiCardComponent } from '../../shared/components/ui';`

- [ ] **Step 4: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

All previous specs still pass + the 4 new button specs added (195 total). Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/shared/components/ui/
git commit -m "feat(design): add shared UI primitive layer over spartan-ng" -m "" -m "Plan 2 Task 4. Thin wrappers under shared/components/ui/ that compose" -m "spartan-ng helm/brain components with our OKLCH token system. Features" -m "import these wrappers (UiButtonComponent, UiCardComponent, etc.) via" -m "the barrel — they don't import spartan-ng directly. Per-feature" -m "migrations (Tasks 5-12) replace inline buttons/cards/forms with these." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Migrate landing feature

**Goal:** Replace the landing page's hand-rolled buttons/cards with `UiButtonComponent`/`UiCardComponent`. Apply the new typography (Instrument Serif headlines, DM Sans body). Keep the page's structure and copy unchanged.

**Files:**
- Modify: every component under `frontend/src/app/features/landing/**` that has inline `<button>`/`<a class="btn-*">`/custom card markup

- [ ] **Step 1: Audit the feature**

Read every file under `frontend/src/app/features/landing/`. List:
- Each component, its current template
- Where buttons appear (replace with `<ui-button>`)
- Where card-like surfaces appear (replace with `<ui-card>`)
- Where headlines use `font-display` / serif styles (verify they pick up Instrument Serif via `--font-display`)
- Any inline SVG icons (replace with `<lucide-angular [img]="..." />` or specific lucide imports)

- [ ] **Step 2: Migrate components**

For each component:
1. Add `UiButtonComponent`, `UiCardComponent` (and any others used) to the standalone component's `imports` array.
2. Replace `<button class="...">` with `<ui-button variant="primary|secondary|...">`. Move text content into the projection slot.
3. Replace card markup with `<ui-card>...</ui-card>` (use header/body/footer projection if your card supports it).
4. Replace inline SVG icons with `<i-lucide name="..." />` (lucide-angular's selector may differ — check the install docs).
5. Strip per-component scoped styles that are now redundant (typography, button styles, card styles). Keep layout-specific styles.

- [ ] **Step 3: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

Tests pass. Build succeeds.

Manual visual check: `npm start`, navigate to `http://localhost:4200/`, screenshot. Headlines should now render in Instrument Serif. Buttons should look consistent with the new accent (warm amber). Card edges should be sharper.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/features/landing/
git commit -m "feat(design): migrate landing to shared UI primitives" -m "" -m "Plan 2 Task 5. Replaces hand-rolled buttons and card markup with" -m "UiButtonComponent / UiCardComponent. Typography now uses Instrument" -m "Serif (display) + DM Sans (body) via design tokens. Inline SVG icons" -m "replaced with lucide-angular." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Migrate setup wizard feature

**Goal:** Same pattern as Task 5, applied to `features/setup/`. Setup is the multi-step wizard (Game → Version → Hardware → Customize → playstyle-select). It has more form inputs than landing, so it'll heavily use `UiInputComponent`, `UiTextareaComponent`, `UiSelectComponent`, `UiLabelComponent`.

**Files:**
- Modify: every component under `frontend/src/app/features/setup/**`

- [ ] **Step 1: Audit and migrate** (same pattern as Task 5, expanded for forms)

For each setup-step component:
- Replace step-card containers with `<ui-card>`
- Replace step navigation buttons (Back, Next, Continue) with `<ui-button variant="primary|secondary">`
- Replace `<input>` with `<ui-input>` and add `<ui-label>` for accessibility
- Replace `<textarea>` (the spec / playstyle prompt) with `<ui-textarea>`
- Replace any `<select>` with `<ui-select>`
- Replace inline SVGs with lucide icons (the wizard step indicators may use checkmarks — `<i-lucide name="check" />`)
- Use `font-mono` class on hardware spec parsing previews (the parsed CPU/GPU/VRAM display reads more naturally in mono)

- [ ] **Step 2: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

Tests pass. Build succeeds.

Manual visual check: walk through the wizard at `localhost:4200/setup`. All four steps should render with the new primitives. Form inputs should style consistently.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/features/setup/
git commit -m "feat(design): migrate setup wizard to shared UI primitives" -m "" -m "Plan 2 Task 6. Each wizard step now uses UiCard / UiInput / UiTextarea /" -m "UiSelect / UiLabel / UiButton. Hardware parse preview uses font-mono for" -m "the parsed CPU/GPU/VRAM display. Lucide icons replace inline check-mark" -m "SVGs in the step indicator." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Migrate settings feature

**Goal:** Apply the same pattern to `features/settings/`. Settings has the LLM API keys form, hardware preferences, notifications toggle. Lots of input + label + button.

**Files:**
- Modify: every component under `frontend/src/app/features/settings/**`

- [ ] **Step 1: Audit and migrate** (same pattern; LLM-key inputs are password-typed — `<ui-input type="password">`)

- [ ] **Step 2: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/features/settings/
git commit -m "feat(design): migrate settings to shared UI primitives" -m "" -m "Plan 2 Task 7. LLM API key inputs use ui-input type=password. Provider" -m "list rendered in ui-card with ui-badge for connected status. Save button" -m "is ui-button variant=primary." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Migrate generation feature

**Goal:** Apply pattern to `features/generation/**`. This is the biggest feature — playstyle-select (large component), generation timeline, phase progress, mod-added cards. Heavy use of monospace for mod IDs and phase numbers.

**Files:**
- Modify: every component under `frontend/src/app/features/generation/**` (especially `playstyle-select/`, `timeline/`, anything rendering mods)

- [ ] **Step 1: Audit and migrate**

Specific guidance for this feature:
- The "Generate" button is a primary CTA — `<ui-button variant="primary" size="lg">`.
- The Pause / Resume / Cancel controls are `<ui-button variant="secondary|ghost|destructive">`.
- Mod cards (one per added mod in the timeline) use `<ui-card>` with the mod's name in serif/sans and the mod ID + file ID in `font-mono`.
- Phase status badges use `<ui-badge variant="info|success|warning">`.
- The pause-form (when a phase fails / rate-limited) uses `<ui-input>` for the new key entry, `<ui-button>` for retry.
- Delete confirmation modals use `<ui-dialog>`.

- [ ] **Step 2: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/features/generation/
git commit -m "feat(design): migrate generation feature to shared UI primitives" -m "" -m "Plan 2 Task 8. Playstyle-select, timeline, mod-added cards, phase" -m "badges, pause/resume controls, delete-confirm dialog all use the" -m "shared primitives. Mod IDs and file IDs render in font-mono. The" -m "actual stack-building animation comes in Task 14; this task ports the" -m "static structure." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Migrate modlist feature

**Goal:** Apply pattern to `features/modlist/**`. Modlist detail page, list of mods, export buttons.

**Files:**
- Modify: every component under `frontend/src/app/features/modlist/**`

- [ ] **Step 1: Audit and migrate**

- Mod entries in `font-mono` for IDs/file_ids; mod names in `font-sans`.
- Export buttons: `<ui-button variant="primary">Export for MO2</ui-button>`, etc.
- Filter inputs use `<ui-input>`.
- Sort dropdowns use `<ui-select>`.

- [ ] **Step 2: Verify + commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10

cd ..
git add frontend/src/app/features/modlist/
git commit -m "feat(design): migrate modlist feature to shared UI primitives" -m "" -m "Plan 2 Task 9. Modlist detail/list pages now use ui-card per mod entry," -m "ui-button for export actions, ui-input for filters, ui-select for sort." -m "Mod ID and file_id render in font-mono." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Migrate dashboard feature

**Goal:** Apply pattern to `features/dashboard/**`. Dashboard cards, stats display, quick-action buttons, modlist preview cards.

**Files:**
- Modify: every component under `frontend/src/app/features/dashboard/**`

- [ ] **Step 1: Audit and migrate**

- Stat cards use `<ui-card>` with display headline (Instrument Serif) and the stat number (could be in mono if it's a count of mods/file size).
- Quick-action CTAs are `<ui-button>`.
- Modlist preview cards use `<ui-card>` with "Last edited" timestamp in `text-muted` + mono if helpful.
- Delete-confirmation uses `<ui-dialog>`.
- Replace stagger / fadeUp Angular animations with the centralized motion (Task 14 will move the registry; for now they can stay inline if needed).

- [ ] **Step 2: Verify + commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10

cd ..
git add frontend/src/app/features/dashboard/
git commit -m "feat(design): migrate dashboard to shared UI primitives" -m "" -m "Plan 2 Task 10. Stat cards, quick-action buttons, modlist preview" -m "cards, and delete-confirmation dialog all use the shared primitives." -m "Stagger/fadeUp animations remain inline for now; centralized in Task 14." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Migrate compatibility feature

**Goal:** Apply pattern to `features/compatibility/**`. Compatibility checker UI: input mod IDs, see results, conflict warnings.

**Files:**
- Modify: every component under `frontend/src/app/features/compatibility/**`

- [ ] **Step 1: Audit and migrate**

- Mod ID input uses `<ui-input type="number">` or text + parse.
- Results displayed as a list of `<ui-card>` with conflict severity as `<ui-badge variant="warning|danger|success">`.
- Each rule explanation in body text; mod IDs in `font-mono`.

- [ ] **Step 2: Verify + commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10

cd ..
git add frontend/src/app/features/compatibility/
git commit -m "feat(design): migrate compatibility feature to shared UI primitives" -m "" -m "Plan 2 Task 11. Mod ID input, result cards with severity badges," -m "and rule explanations all use the shared primitives. Mod IDs render" -m "in font-mono." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Migrate small features (support, methodology, browse, downloads)

**Goal:** Bundle the four smallest features into one task. Each is mostly static content with a few buttons/cards. Combined commit so they don't churn the history.

**Files:**
- Modify: every component under `frontend/src/app/features/support/`, `methodology/`, `browse/`, `downloads/`

- [ ] **Step 1: Audit and migrate** all four

Each one: replace inline buttons/cards with shared primitives, swap inline SVGs for lucide, ensure typography uses the new tokens. Don't restructure layouts.

- [ ] **Step 2: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/features/support/ frontend/src/app/features/methodology/ frontend/src/app/features/browse/ frontend/src/app/features/downloads/
git commit -m "feat(design): migrate support, methodology, browse, downloads to UI primitives" -m "" -m "Plan 2 Task 12. Four smallest features bundled into one commit. Each" -m "swaps inline buttons/cards/SVGs for shared primitives + lucide icons." -m "Layout structure unchanged." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Strip glassmorphism, sharpen surfaces, drop backwards-compat shims

**Goal:** Polish pass. Remove the dated glassmorphism (16px backdrop-blur on header), replace with sharp tactile surfaces. Delete the backwards-compat `:root { --color-bg-base ... }` shims from `tokens.scss` (Task 1) — every feature is migrated by now, so the shims aren't needed.

**Files:**
- Modify: `frontend/src/app/shared/components/header/header.component.ts`
- Modify: `frontend/src/styles/tokens.scss` (remove the `:root { --color-bg-base ... }` backwards-compat block)
- Modify: `frontend/src/styles.scss` (remove any remaining global glassmorphism rules)

- [ ] **Step 1: Migrate header**

Read `header.component.ts`. Find the `backdrop-filter: blur(16px)`, radial gradients, and any glassy `background: rgba(...)` rules. Replace with:
- `background: var(--color-bg)` (solid)
- `border-bottom: 1px solid var(--color-border)` (hairline)
- Keep the sticky positioning, height, nav layout

The `box-shadow` can be `var(--shadow-sm)` for subtle separation without blur.

- [ ] **Step 2: Drop shims from tokens.scss**

Delete the `:root { --color-bg-base ... --color-accent-blue: var(--color-secondary); }` block from `frontend/src/styles/tokens.scss`. If any feature still references one of the old variable names, the build will fail — fix those references in this same task.

- [ ] **Step 3: Audit `styles.scss` for global glass rules**

Search for `backdrop-filter`, `filter: blur`, `rgba(0,0,0,0.5)`-style overlays in `frontend/src/styles.scss`. Remove or simplify.

- [ ] **Step 4: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

If TypeScript or SCSS errors appear about missing `--color-*` references, that's a feature that wasn't fully migrated in Tasks 5-12. Fix the references inline (replace with the new token name).

Manual visual check: `npm start`, navigate around. Header should feel solid (no blur). Surfaces should have crisp edges.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/styles/tokens.scss frontend/src/styles.scss frontend/src/app/shared/components/header/
git commit -m "feat(design): strip glassmorphism, drop backwards-compat token shims" -m "" -m "Plan 2 Task 13. Header now uses solid background + hairline border" -m "instead of 16px backdrop-blur (peaked 2024, now reads dated). Removes" -m "the :root token shims kept during migration. Any remaining global" -m "glassmorphism rules in styles.scss also removed." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Centralize motion + generation page "stack-building" animation

**Goal:** Move the scattered Angular animation triggers and CSS keyframes into a single `core/motion/` directory. Implement the spec's "stack-building" motion for the generation page — when a new mod is added during a phase, it slides up from below into its install-order position rather than fading in.

**Files:**
- Create: `frontend/src/app/core/motion/easing.ts`
- Create: `frontend/src/app/core/motion/animations.ts`
- Modify: `frontend/src/app/features/generation/timeline/**` (or wherever mod-added rendering lives) — switch fade-in to stack-build
- Modify: `frontend/src/app/features/dashboard/**` — switch staggered fadeUp to use the centralized triggers
- Optionally modify: any other component using inline animation triggers

- [ ] **Step 1: Implement easing tokens**

```typescript
// frontend/src/app/core/motion/easing.ts
//
// Named easing constants. Mirror the CSS variables in tokens.scss so
// Angular animations + CSS transitions stay in sync.
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
export const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export const DUR_FAST = '120ms';
export const DUR_BASE = '220ms';
export const DUR_SLOW = '420ms';
```

- [ ] **Step 2: Implement animation triggers**

```typescript
// frontend/src/app/core/motion/animations.ts
import {
  trigger, transition, style, animate, query, stagger,
} from '@angular/animations';
import { EASE_OUT, EASE_SPRING, DUR_BASE, DUR_FAST, DUR_SLOW } from './easing';

/** Fade and slide up — for cards entering a list. */
export const fadeUp = trigger('fadeUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px)' }),
    animate(`${DUR_BASE} ${EASE_OUT}`, style({ opacity: 1, transform: 'none' })),
  ]),
]);

/** Stagger child enter animations across a list. */
export const staggerChildren = trigger('staggerChildren', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(8px)' }),
      stagger(40, animate(`${DUR_BASE} ${EASE_OUT}`, style({ opacity: 1, transform: 'none' }))),
    ], { optional: true }),
  ]),
]);

/**
 * Stack-build: an entering item slides up from the bottom edge into its
 * final position with a slight overshoot. Used on the generation timeline
 * when a new mod is added — visually reads as "stacking onto a load order."
 */
export const stackBuild = trigger('stackBuild', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(24px) scale(0.96)' }),
    animate(
      `${DUR_SLOW} ${EASE_SPRING}`,
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
]);

/** Quick fade for things that need to disappear cleanly. */
export const fadeOut = trigger('fadeOut', [
  transition(':leave', [
    animate(`${DUR_FAST} ${EASE_OUT}`, style({ opacity: 0 })),
  ]),
]);
```

- [ ] **Step 3: Adopt in generation timeline**

Find the component that renders `mod_added` events as cards (likely under `features/generation/timeline/` or similar). On its `@Component` decorator:
- Add `animations: [stackBuild]`
- On the mod-card element in the template: add `@stackBuild` (no value needed — the trigger fires on `:enter`)

Remove any prior fade-in trigger that was inline.

- [ ] **Step 4: Adopt in dashboard**

Find the dashboard cards that currently have inline `@fadeUp` / `@staggerCards`. Replace with the centralized `fadeUp` / `staggerChildren` triggers from `core/motion/animations.ts`. Delete the inline definitions.

- [ ] **Step 5: Verify**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New/frontend
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5
npx ng build --configuration=production 2>&1 | tail -10
```

Tests pass. Build succeeds.

Manual visual check: trigger a generation (or simulate via dev console — push a fake `mod_added` event into `service.events()`); confirm the new mod card slides up with the spring overshoot rather than fading in. On the dashboard, modlist cards should still stagger-fade-up on first load.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/stsbr/Documents/ModdersOmni-New
git add frontend/src/app/core/motion/ frontend/src/app/features/generation/ frontend/src/app/features/dashboard/
git commit -m "feat(design): centralize motion system + stack-build animation on generation timeline" -m "" -m "Plan 2 Task 14. New core/motion/{easing,animations}.ts owns easing" -m "constants and Angular animation triggers (fadeUp, staggerChildren," -m "stackBuild, fadeOut). Generation timeline now uses stackBuild on" -m "mod-added cards — slides up with spring overshoot, reads as 'load order" -m "being assembled' instead of generic fade-in. Dashboard adopts the" -m "centralized fadeUp/staggerChildren and drops its inline trigger defs." -m "" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Plan Self-Review Notes

- **Spec coverage:**
  - Decision 8 (stay on Angular, adopt spartan-ng): Tasks 3, 4, 5–12.
  - Decision 9.a (component foundation: spartan-ng + shared/components/ui/): Tasks 3, 4.
  - Decision 9.b (OKLCH palette via Tailwind 4 @theme): Task 1.
  - Decision 9.c (typography swap: Instrument Serif + DM Sans + JetBrains Mono): Task 2 (loads), Tasks 5–12 (apply per-feature).
  - Decision 9.d (lucide-angular replaces inline SVGs): Task 3 (install), Tasks 5–12 (apply).
  - Decision 9.e (sharp tactile surfaces, drop glassmorphism): Task 13.
  - Decision 9.f (centralized motion + generation stack-building): Task 14.

- **Placeholder scan:** No "TBD"/"TODO" markers. Code blocks are concrete. The phrase "if a particular spartan-ng helm package has API quirks" in Task 4 is a real instruction (consult docs), not a placeholder.

- **Type consistency:** `UiButtonComponent`, `UiCardComponent`, `UiDialogComponent`, etc. follow the same naming convention. The `Variant` and `Size` types in Task 4 are local to button.component.ts; other primitives define their own variant types as needed (no shared `Variant` type required).

- **Per-commit CI rule:** Every task ends with exactly one commit. The verification step before commit ensures local tests + build pass; the parent agent then pushes and waits for CI green before dispatching the next task.

- **Test count baseline:** Plan 1 ended at 191 specs. Task 4 adds 4 button specs → 195. Other tasks may add ad-hoc specs as needed but mostly don't grow the suite (visual changes don't require new logic tests).

- **Order dependency:** Tasks 1–4 are foundation and must run in order (each depends on the prior). Tasks 5–12 are feature migrations and can run in any order, but doing them in the listed order minimizes user-facing churn (small surfaces first to validate the primitive layer, then larger ones). Tasks 13 and 14 are polish and depend on 5–12 being complete (Task 13's shim removal would fail if features still reference old variable names).
