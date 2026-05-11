# ModdersOmni v3 — Pip-Tek Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Tailwind 4 `@theme` token plumbing, replace the v2 palette/typography/logo with the Pip-Tek system (amber on warm near-black + Inter/JetBrains Mono + Ω brand mark), reskin every shared UI primitive, add three new primitives (`TerminalLog`, `PhaseCounter`, `Kbd`), and ship a Playwright smoke test that catches future token regressions. Existing route layouts and behavior are not changed in this plan — they simply *look right* once it lands.

**Architecture:** Move `@theme {…}` into a CSS file imported by `tailwind.css` (not by SCSS) so the Tailwind preprocessor sees the directive and emits `:root` custom properties at build time. Delete `frontend/src/styles/tokens.scss`. Reskin existing `@angular/cdk`-backed primitives in place. New primitives are standalone Angular components following the patterns in `frontend/src/app/shared/components/ui/`. Replace `BrandLogoComponent` (PNG-based) with `BrandMarkComponent` (inline SVG). All token consumers continue using `var(--color-*)` unchanged — they were always correct; only the token *declaration* was wired wrong.

**Tech Stack:** Angular 19 (standalone components, signals), Tailwind 4 (`@theme` directive), `@angular/cdk`, OKLCH color space, Inter + JetBrains Mono via Google Fonts, `@playwright/test` (new dev dependency), `sharp` (new dev dependency, one-time favicon generation), Karma + Jasmine (existing unit tests).

**Spec reference:** `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md` (commit `d0734ab`). This plan implements Decisions 1-5 and 7 of that spec. Decisions 6 (per-route Rebuild/Reskin work) and 8 step 9 (CI gating) are deferred to Plans 2-4.

---

## File Structure

### Created files

| File | Responsibility |
|---|---|
| `frontend/src/styles/theme.css` | Tailwind 4 `@theme { … }` block — palette, type, radii, shadows. Single source of truth for design tokens. |
| `frontend/src/app/shared/components/brand-mark/brand-mark.component.ts` | Ω SVG monogram + wordmark lockup, replaces `BrandLogoComponent`. |
| `frontend/src/app/shared/components/brand-mark/brand-mark.component.spec.ts` | Unit tests for `BrandMarkComponent`. |
| `frontend/src/app/shared/components/ui/terminal-log.component.ts` | Scrolling monospaced log primitive with `[ok]`/`[warn]`/`[err]` prefix coloring. Used by landing + generation runtime (in Plan 2). |
| `frontend/src/app/shared/components/ui/terminal-log.component.spec.ts` | Unit tests for `TerminalLog`. |
| `frontend/src/app/shared/components/ui/phase-counter.component.ts` | `PHASE 03/13` counter + progress bar primitive. |
| `frontend/src/app/shared/components/ui/phase-counter.component.spec.ts` | Unit tests for `PhaseCounter`. |
| `frontend/src/app/shared/components/ui/kbd.component.ts` | `<kbd>` mono pill primitive for keyboard shortcuts. |
| `frontend/src/app/shared/components/ui/kbd.component.spec.ts` | Unit tests for `Kbd`. |
| `frontend/scripts/generate-favicon.mjs` | One-time Node script (uses `sharp`) that rasterizes the Ω SVG to `favicon.png` (32×32) and `favicon-192.png`. |
| `frontend/e2e/smoke.spec.ts` | Playwright smoke test — asserts design tokens resolve at runtime. |
| `frontend/playwright.config.ts` | Playwright project config. |

### Modified files

| File | Change |
|---|---|
| `frontend/src/tailwind.css` | Add `@import "./styles/theme.css";` after the Tailwind import. |
| `frontend/src/styles.scss` | Remove `@use 'styles/tokens.scss';`. Inline the `:root` layout helpers (`--max-width`, `--header-height`, `--grain-url`) that previously lived in `tokens.scss`. Update body `font-family` to `var(--font-sans)` (now Inter). |
| `frontend/src/index.html` | Swap Google Fonts: drop DM Sans + Instrument Serif, add Inter; JetBrains Mono stays. |
| `frontend/src/app/shared/components/ui/button.component.ts` | Reskin: amber primary, square corners (radius-md), border-color hover (no translateY). |
| `frontend/src/app/shared/components/ui/card.component.ts` | Reskin: 1px hairline border on surface-1; hover border → accent-soft; no shadow. |
| `frontend/src/app/shared/components/ui/input.component.ts` | Reskin + add `mono` boolean input that toggles `font-family: var(--font-mono)` on the inner control. |
| `frontend/src/app/shared/components/ui/textarea.component.ts` | Same reskin as input; mirror the `mono` input. |
| `frontend/src/app/shared/components/ui/select.component.ts` | Fix existing TS error (preventing barrel import per `landing.component.ts:23-25`). Reskin to match input styling. |
| `frontend/src/app/shared/components/ui/dialog.component.ts` | Fix existing TS error. Reskin: `oklch(0 0 0 / 0.6)` overlay, surface-1 modal, hairline border. |
| `frontend/src/app/shared/components/ui/sheet.component.ts` | Reskin to surface-1 + hairline border. |
| `frontend/src/app/shared/components/ui/badge.component.ts` | Reskin to new token set; preserve variant API. |
| `frontend/src/app/shared/components/ui/separator.component.ts` | Reskin to `--color-border`. |
| `frontend/src/app/shared/components/ui/label.component.ts` | Reskin to `--color-text-muted`. |
| `frontend/src/app/shared/components/ui/index.ts` | Export new primitives: `UiTerminalLogComponent`, `UiPhaseCounterComponent`, `UiKbdComponent`. |
| `frontend/src/app/features/landing/landing.component.ts` | Replace `BrandLogoComponent` import + `<app-brand-logo>` template usages with `BrandMarkComponent` + `<app-brand-mark>`. (Two usages at lines 60 and 318 of the v2 file.) |
| `frontend/src/app/shared/components/header/header.component.ts` | Same `BrandLogo` → `BrandMark` swap. |
| `frontend/public/favicon.png` | Regenerated from new Ω SVG via the sharp script. |
| `frontend/package.json` | Add `@playwright/test` and `sharp` as `devDependencies`. Add `"test:e2e": "playwright test"` script. |
| `.github/workflows/ci.yml` | Add CI step that installs Playwright browsers and runs `npm run test:e2e` against the production build. |
| `CLAUDE.md` | Update the "Fonts" line under "Non-Obvious Gotchas → Frontend" to document the mono usage rule. |

### Deleted files

| File | Reason |
|---|---|
| `frontend/src/styles/tokens.scss` | Replaced by `frontend/src/styles/theme.css`. |
| `frontend/src/app/shared/components/brand-logo/brand-logo.component.ts` | Replaced by `BrandMarkComponent`. |
| `frontend/public/logo-mark.png` | Replaced by inline SVG inside `BrandMarkComponent`. |

---

## Tasks

### Task 1: Pre-flight — create branch, install dev dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Create a working branch**

```bash
git checkout -b feat/pip-tek-foundation
```

- [ ] **Step 2: Install Playwright and sharp**

```bash
cd frontend && npm install --save-dev @playwright/test sharp
```

Expected: `package.json` shows new devDependencies for `@playwright/test` and `sharp`. `package-lock.json` updates.

- [ ] **Step 3: Install Playwright browsers (one-time)**

```bash
npx playwright install --with-deps chromium
```

Expected: Chromium downloaded to the Playwright cache. No project-file changes.

- [ ] **Step 4: Add the e2e script to package.json**

In `frontend/package.json`, in the `scripts` block, add `"test:e2e"` between `"test"` and the closing `}`:

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve --proxy-config proxy.conf.json",
  "build": "node generate-env.js && ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test",
  "test:e2e": "playwright test"
},
```

- [ ] **Step 5: Commit infra**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install @playwright/test and sharp as devDependencies"
```

---

### Task 2: Write the Playwright smoke test (TDD red)

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/smoke.spec.ts`
- Modify: `.gitignore` (root) — add Playwright output dirs

- [ ] **Step 1: Create `frontend/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

- [ ] **Step 2: Create `frontend/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('design tokens resolve at runtime', async ({ page }) => {
  await page.goto('/');

  // The body background must resolve to a real dark color — not the UA
  // default of transparent (which falls back to white).
  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor,
  );
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(bgColor).not.toBe('rgb(255, 255, 255)');

  // A probe element using var(--color-accent) for color must NOT compute to
  // rgb(0, 0, 0) — that's the initial value when the custom property is
  // undefined.
  const accentResolved = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-accent)';
    document.body.appendChild(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  });
  expect(accentResolved).not.toBe('rgb(0, 0, 0)');
});
```

- [ ] **Step 3: Ignore Playwright output dirs**

In the root `.gitignore`, add under the existing `# Node / Angular` block:

```
# Playwright
frontend/playwright-report/
frontend/test-results/
```

- [ ] **Step 4: Start the dev server in one terminal**

```bash
cd frontend && npm start
```

Wait for `Local: http://localhost:4200/` line.

- [ ] **Step 5: Run the smoke test in another terminal — verify it FAILS**

```bash
cd frontend && npm run test:e2e -- --reporter=list
```

Expected: 1 test, 1 failure. Output contains a failure on `expect(accentResolved).not.toBe('rgb(0, 0, 0)')` because `--color-accent` is currently undefined. This is the TDD-red gate confirming the regression exists.

- [ ] **Step 6: Commit the failing test**

```bash
git add frontend/playwright.config.ts frontend/e2e/smoke.spec.ts .gitignore
git commit -m "test: add Playwright smoke test for design token resolution

Currently failing — captures the v2.0.0 regression where @theme tokens
never reach :root because they live in a SCSS-compiled file. The next
commit unblocks them."
```

Stop the dev server (`Ctrl-C` in its terminal).

---

### Task 3: Fix the @theme plumbing — create theme.css with new tokens (TDD green)

**Files:**
- Create: `frontend/src/styles/theme.css`
- Modify: `frontend/src/tailwind.css`
- Modify: `frontend/src/styles.scss`
- Delete: `frontend/src/styles/tokens.scss`

- [ ] **Step 1: Create `frontend/src/styles/theme.css`**

```css
/*
 * frontend/src/styles/theme.css
 *
 * Tailwind 4 @theme block. Single source of truth for design tokens.
 * Imported by tailwind.css so the Tailwind preprocessor sees the directive
 * and emits the values as :root custom properties at build time.
 *
 * Color space: OKLCH everywhere — perceptually uniform lightness keeps
 * hover/active state math predictable.
 */

@theme {
  /* ── Backgrounds & surfaces — warm-tinted dark ── */
  --color-bg:        oklch(0.14 0.012 80);
  --color-surface-1: oklch(0.18 0.014 80);
  --color-surface-2: oklch(0.22 0.016 80);
  --color-border:    oklch(0.28 0.018 80);
  --color-border-strong: oklch(0.38 0.020 80);

  /* ── Text ── */
  --color-text:       oklch(0.94 0.012 80);
  --color-text-muted: oklch(0.70 0.012 80);
  --color-text-dim:   oklch(0.50 0.010 80);

  /* ── Accent — Pip-Boy amber ── */
  --color-accent:        oklch(0.82 0.16 75);
  --color-accent-soft:   oklch(0.55 0.12 75);
  --color-accent-dim:    oklch(0.32 0.06 75);

  /* ── Secondary — cool slate, used sparingly ── */
  --color-secondary: oklch(0.75 0.08 240);

  /* ── Status ── */
  --color-success: oklch(0.78 0.14 145);
  --color-warning: oklch(0.82 0.15 95);
  --color-danger:  oklch(0.68 0.20 25);

  /* ── Typography ── */
  --font-sans:    'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
  --font-display: 'Inter', system-ui, -apple-system, sans-serif;

  /* ── Radii — sharper than v2 ── */
  --radius-sm: 3px;
  --radius-md: 5px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* ── Shadows — minimal; we use border-glow more than drop shadow ── */
  --shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.50);
  --shadow-md: 0 2px 6px -1px oklch(0 0 0 / 0.55);
  --shadow-glow: 0 0 18px color-mix(in oklch, var(--color-accent) 18%, transparent);

  /* ── Easings ── */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

- [ ] **Step 2: Wire `tailwind.css` to import `theme.css`**

Replace the entire contents of `frontend/src/tailwind.css` with:

```css
@import "tailwindcss";
@import "./styles/theme.css";
```

- [ ] **Step 3: Update `frontend/src/styles.scss`**

Replace lines 1-6 (the header comment + `@use 'styles/tokens.scss';`) with inlined layout helpers. The new top of the file:

```scss
/* ===== Design System — v3 Pip-Tek tokens =====
 *
 * Design tokens live in styles/theme.css (a Tailwind 4 @theme block).
 * This file owns the global reset, body styles, keyframes, and accessibility
 * helpers. Layout helpers below are plain CSS custom properties that don't
 * belong inside @theme.
 */

:root {
  --max-width: 1200px;
  --header-height: 64px;

  /* Subtle grain texture overlay (used by body::after) */
  --grain-url: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ===== Global Resets ===== */
```

(Leave the rest of `styles.scss` from `*, *::before, *::after { … }` onwards unchanged in this step.)

- [ ] **Step 4: Delete the old tokens file**

```bash
git rm frontend/src/styles/tokens.scss
```

- [ ] **Step 5: Start the dev server and re-run the smoke test**

In one terminal:
```bash
cd frontend && npm start
```

In another, once the server is up:
```bash
cd frontend && npm run test:e2e
```

Expected: 1 test, 1 passed. The TDD-green gate confirming `--color-accent` now resolves and the body background is no longer transparent.

- [ ] **Step 6: Manual visual smoke check**

Open `http://localhost:4200/` in a browser. The page should now render dark with amber accents (the hero "Built by AI" text reappears because the gradient resolves). The mock-dashboard preview and the rest of the v2 layout are still present — only colors and fonts have changed in this commit (typography swap is the next task).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/theme.css frontend/src/tailwind.css frontend/src/styles.scss
git commit -m "feat(design): move @theme into Tailwind-processed CSS, switch to Pip-Tek palette

Root cause of v2.0.0 regression: @theme block lived in a SCSS file consumed
via @use, so the SCSS pipeline emitted it as raw at-rule and Tailwind never
saw it. Moving the block into theme.css (imported by tailwind.css) makes
the Tailwind preprocessor responsible, which emits :root custom properties
as intended.

Palette is now single-accent Pip-Boy amber on warm-tinted near-black, per
the v3 spec.

Smoke test (frontend/e2e/smoke.spec.ts) now passes."
```

Stop the dev server.

---

### Task 4: Swap Google Fonts and update body styles

**Files:**
- Modify: `frontend/src/index.html`
- Modify: `frontend/src/styles.scss`

- [ ] **Step 1: Update `frontend/src/index.html`**

Replace the existing `<link href="https://fonts.googleapis.com/css2?..."` line with:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

(Removes DM Sans and Instrument Serif; keeps JetBrains Mono. Inter is the new default sans.)

- [ ] **Step 2: Verify the body font tokens already point at Inter via theme.css**

`frontend/src/styles/theme.css` line for `--font-sans` already reads `'Inter', system-ui, …` from Task 3 step 1. The `body` selector in `styles.scss` already reads `font-family: var(--font-sans);` — no change needed there. This step is a verification, not an edit. Confirm by reading `styles.scss` around the `body { … }` block.

- [ ] **Step 3: Restart the dev server and confirm Inter is loading**

```bash
cd frontend && npm start
```

Open `http://localhost:4200/` and inspect any text element in DevTools. Computed `font-family` should resolve to `Inter, system-ui, …`. No 400 errors from Google Fonts in the Network tab.

- [ ] **Step 4: Re-run the smoke test**

```bash
cd frontend && npm run test:e2e
```

Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.html
git commit -m "feat(design): swap fonts to Inter + JetBrains Mono, drop DM Sans + Instrument Serif

Pip-Tek typography per v3 spec: Inter for body and headings; JetBrains Mono
reserved for technical strings (paths, IDs, log output, phase counters,
wordmark)."
```

Stop the dev server.

---

### Task 5: Codify the mono usage rule in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Locate the existing fonts line**

In `CLAUDE.md`, under `## Non-Obvious Gotchas → ### Frontend`, find the line that documents the current fonts. It currently reads:

```
- **Fonts**: DM Sans (body) + Playfair Display (headings).
```

(The line may read "DM Sans + Instrument Serif" if the v2 README/CLAUDE update lagged the actual change — match the line that actually exists in the file.)

- [ ] **Step 2: Replace the fonts line with the v3 typography rule**

Replace it with these two lines:

```
- **Fonts**: Inter (body + headings) + JetBrains Mono (technical strings only).
- **Mono usage rule (codified)**: `JetBrains Mono` is reserved for content that is *technically* monospaced — code, file paths, mod/version IDs, log output, keyboard shortcuts, phase counters (e.g. `PHASE 03/13`), and the brand wordmark in lockup. Body copy and headings stay in Inter regardless of how "techy" the surrounding section feels. This keeps mono meaningful — when it appears, the reader knows the content is literal/copyable.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: codify mono usage rule for the v3 Pip-Tek typography"
```

---

### Task 6: Build the BrandMarkComponent (Ω SVG + wordmark)

**Files:**
- Create: `frontend/src/app/shared/components/brand-mark/brand-mark.component.ts`
- Create: `frontend/src/app/shared/components/brand-mark/brand-mark.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/shared/components/brand-mark/brand-mark.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandMarkComponent } from './brand-mark.component';

describe('BrandMarkComponent', () => {
  let component: BrandMarkComponent;
  let fixture: ComponentFixture<BrandMarkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandMarkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandMarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the Ω SVG mark', () => {
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders the wordmark when showText is true (default)', () => {
    const text = fixture.nativeElement.querySelector('.brand-mark__text');
    expect(text).toBeTruthy();
    expect(text.textContent).toContain('Modders');
    expect(text.textContent).toContain('Omni');
  });

  it('hides the wordmark when showText is false', () => {
    fixture.componentRef.setInput('showText', false);
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.brand-mark__text');
    expect(text).toBeFalsy();
  });

  it('responds to size input', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    const host = fixture.nativeElement;
    // size=lg → 48px icon per the size table
    expect(getComputedStyle(host).getPropertyValue('--brand-mark-icon-size').trim()).toBe('48px');
  });
});
```

- [ ] **Step 2: Run the test — verify it FAILS**

```bash
cd frontend && npx ng test --include='**/brand-mark.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: All four specs fail with "Cannot find name 'BrandMarkComponent'" or "Could not resolve …/brand-mark.component".

- [ ] **Step 3: Create `frontend/src/app/shared/components/brand-mark/brand-mark.component.ts`**

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl';

const BRAND_MARK_SIZES: Record<BrandMarkSize, { icon: string; gap: string; text: string }> = {
  sm: { icon: '32px', gap: '0.625rem', text: '1.125rem' },
  md: { icon: '40px', gap: '0.75rem',  text: '1.25rem'  },
  lg: { icon: '48px', gap: '0.875rem', text: '1.5rem'   },
  xl: { icon: '56px', gap: '1rem',     text: '1.75rem'  },
};

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--brand-mark-icon-size]': 'iconSize()',
    '[style.--brand-mark-gap]':       'gapSize()',
    '[style.--brand-mark-text-size]': 'textSize()',
  },
  template: `
    <span class="brand-mark" [class.brand-mark--icon-only]="!showText()">
      <span class="brand-mark__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 20 L9 20 L9 16 C6 14 5 11 5 9 C5 5 8 3 12 3 C16 3 19 5 19 9 C19 11 18 14 15 16 L15 20 L19 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="square"
            stroke-linejoin="miter"
          />
        </svg>
      </span>
      @if (showText()) {
        <span class="brand-mark__text">Modders<span class="brand-mark__text-accent">Omni</span></span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      color: var(--color-accent);
      line-height: 1;
    }
    .brand-mark {
      display: inline-flex;
      align-items: center;
      gap: var(--brand-mark-gap);
      min-width: 0;
    }
    .brand-mark--icon-only { gap: 0; }
    .brand-mark__glyph {
      width: var(--brand-mark-icon-size);
      height: var(--brand-mark-icon-size);
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .brand-mark__glyph svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .brand-mark__text {
      white-space: nowrap;
      font-size: var(--brand-mark-text-size);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1;
      color: var(--color-text);
    }
    .brand-mark__text-accent { color: var(--color-accent); }
  `],
})
export class BrandMarkComponent {
  size = input<BrandMarkSize>('md');
  showText = input<boolean>(true);

  iconSize = computed(() => BRAND_MARK_SIZES[this.size()].icon);
  gapSize  = computed(() => BRAND_MARK_SIZES[this.size()].gap);
  textSize = computed(() => BRAND_MARK_SIZES[this.size()].text);
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

```bash
cd frontend && npx ng test --include='**/brand-mark.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: 4 specs pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/brand-mark/
git commit -m "feat(design): add BrandMarkComponent — Ω SVG monogram + wordmark

Inline SVG so the mark recolors via currentColor and var(--color-accent)
without re-exporting assets. API matches BrandLogoComponent so the swap in
consumers is mechanical."
```

---

### Task 7: Replace BrandLogoComponent usages, then delete the old component

**Files:**
- Modify: `frontend/src/app/features/landing/landing.component.ts`
- Modify: `frontend/src/app/shared/components/header/header.component.ts`
- Delete: `frontend/src/app/shared/components/brand-logo/brand-logo.component.ts`

- [ ] **Step 1: Update `landing.component.ts` import**

In `frontend/src/app/features/landing/landing.component.ts`:

- Line 20: replace
  ```ts
  import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
  ```
  with
  ```ts
  import { BrandMarkComponent } from '../../shared/components/brand-mark/brand-mark.component';
  ```

- Line 32: in the `imports` array, replace `BrandLogoComponent` with `BrandMarkComponent`.

- Line 60 and line 318 (or wherever `<app-brand-logo>` appears): replace both occurrences with `<app-brand-mark></app-brand-mark>`.

- [ ] **Step 2: Update `header.component.ts` analogously**

In `frontend/src/app/shared/components/header/header.component.ts`:

- Replace the `BrandLogoComponent` import with `BrandMarkComponent` from `../brand-mark/brand-mark.component`.
- Replace `BrandLogoComponent` in the `imports` array with `BrandMarkComponent`.
- Replace every `<app-brand-logo …>` in the template with `<app-brand-mark …>` (preserve any `size` or `showText` bindings).

- [ ] **Step 3: Verify no remaining `BrandLogo` references**

```bash
grep -rIn "brand-logo\|BrandLogoComponent" frontend/src --include="*.ts"
```

Expected: only matches inside `frontend/src/app/shared/components/brand-logo/brand-logo.component.ts` (the file we're about to delete). If any feature file still references it, fix it before continuing.

- [ ] **Step 4: Delete `BrandLogoComponent`**

```bash
git rm -r frontend/src/app/shared/components/brand-logo/
```

- [ ] **Step 5: Build the app to ensure nothing broke**

```bash
cd frontend && npx ng build --configuration=development
```

Expected: build succeeds. Any unresolved-symbol errors mean a `BrandLogo` import was missed — search again.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(design): swap BrandLogoComponent for BrandMarkComponent across consumers

Updates landing + header. Removes the BrandLogoComponent + its PNG-backed
glyph. The Ω SVG mark now adapts to any palette without asset re-export."
```

---

### Task 8: Generate the new favicon and replace the legacy PNGs

**Files:**
- Create: `frontend/scripts/generate-favicon.mjs`
- Modify: `frontend/public/favicon.png`
- Create: `frontend/public/favicon-192.png`
- Delete: `frontend/public/logo-mark.png`
- Modify: `frontend/src/index.html` (add the 192px size for mobile)

- [ ] **Step 1: Create the favicon generator script**

`frontend/scripts/generate-favicon.mjs`:

```js
// Generates favicon.png (32×32) and favicon-192.png (192×192) from the Ω
// SVG mark. Run once after changing the mark; commit the outputs.
//
// Usage: node scripts/generate-favicon.mjs

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

// Match the SVG in BrandMarkComponent. Filled background so it reads at
// 16×16 in browser tabs against light/dark surfaces.
const svg = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="oklch(0.14 0.012 80)"/>
  <path
    d="M5 20 L9 20 L9 16 C6 14 5 11 5 9 C5 5 8 3 12 3 C16 3 19 5 19 9 C19 11 18 14 15 16 L15 20 L19 20"
    fill="none"
    stroke="oklch(0.82 0.16 75)"
    stroke-width="2.4"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
</svg>
`;

const svgBuffer = Buffer.from(svg, 'utf8');

for (const size of [32, 192]) {
  const out = resolve(publicDir, size === 32 ? 'favicon.png' : `favicon-${size}.png`);
  const png = await sharp(svgBuffer)
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
  await writeFile(out, png);
  console.log(`wrote ${out} (${png.byteLength} bytes)`);
}
```

- [ ] **Step 2: Run the generator**

```bash
cd frontend && node scripts/generate-favicon.mjs
```

Expected stdout:
```
wrote <path>/frontend/public/favicon.png (≈… bytes)
wrote <path>/frontend/public/favicon-192.png (≈… bytes)
```

- [ ] **Step 3: Delete the legacy PNG**

```bash
git rm frontend/public/logo-mark.png
```

- [ ] **Step 4: Reference the new favicon sizes in `index.html`**

In `frontend/src/index.html`, replace the existing favicon `<link>` lines with:

```html
<link rel="icon" type="image/png" sizes="32x32" href="favicon.png">
<link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png">
<link rel="apple-touch-icon" href="favicon-192.png">
```

- [ ] **Step 5: Verify in a browser**

Restart the dev server, hard-refresh the page, and confirm the browser tab shows the new amber Ω on dark. (Browsers cache favicons aggressively — use a private window if needed.)

- [ ] **Step 6: Commit**

```bash
git add frontend/scripts/generate-favicon.mjs frontend/public/favicon.png frontend/public/favicon-192.png frontend/src/index.html
git commit -m "feat(design): regenerate favicon from new Ω brand mark

Adds sharp-based one-shot favicon generator. logo-mark.png removed; the
brand mark is now exclusively the SVG in BrandMarkComponent."
```

---

### Task 9: Reskin UiButtonComponent

**Files:**
- Modify: `frontend/src/app/shared/components/ui/button.component.ts`
- Modify (if needed): `frontend/src/app/shared/components/ui/button.component.spec.ts` — only if existing specs assert on visual classes that change

- [ ] **Step 1: Read the existing button component**

```bash
cat frontend/src/app/shared/components/ui/button.component.ts
```

Note the current `variant` types (primary/secondary/ghost likely) and the API surface. The reskin must not change inputs/outputs.

- [ ] **Step 2: Update the component styles only**

In `button.component.ts`, find the `styles: [\`…\`]` block and replace it. Key requirements:

- `variant="primary"`: `background: var(--color-accent); color: var(--color-bg); border: 1px solid var(--color-accent); border-radius: var(--radius-md);` Hover: `background: color-mix(in oklch, var(--color-accent) 92%, white);` No translate-Y. No gradient.
- `variant="secondary"`: `background: transparent; color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md);` Hover: `border-color: var(--color-accent-soft);`
- `variant="ghost"`: `background: transparent; color: var(--color-text-muted); border: 1px solid transparent; border-radius: var(--radius-md);` Hover: `color: var(--color-text); background: var(--color-surface-1);`
- Sizes: `sm` (h-8, px-3, font-size 0.6875rem), `md` (h-10, px-4, font-size 0.8125rem), `lg` (h-12, px-6, font-size 0.9375rem). Match the spec's type scale.
- `transition: background 0.15s, border-color 0.15s, color 0.15s;` — no transform transitions.

Do not change the template, inputs, outputs, host bindings, or the variant union type. Only the contents of `styles` change.

- [ ] **Step 3: Run the existing button specs**

```bash
cd frontend && npx ng test --include='**/button.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: pass. If any spec asserted on a v2-specific class like `.btn--gold` and now fails, update the assertion to the new class name.

- [ ] **Step 4: Smoke-check visually**

Restart dev server and check any page with a button (e.g., the landing CTA, the dashboard "New Build" button). Buttons should now be amber on near-black, square-cornered, no float on hover.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/button.component.ts frontend/src/app/shared/components/ui/button.component.spec.ts
git commit -m "feat(design): reskin UiButtonComponent for Pip-Tek

Amber primary, slate secondary, ghost variant. Square corners, border-color
hover instead of translateY. No gradient on primary."
```

---

### Task 10: Reskin UiCardComponent

**Files:**
- Modify: `frontend/src/app/shared/components/ui/card.component.ts`

- [ ] **Step 1: Reskin the styles**

Update only the `styles: [\`…\`]` block in `card.component.ts`. Target:

```css
:host {
  display: block;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  transition: border-color 0.2s var(--ease-out);
}
:host(:hover) {
  border-color: color-mix(in oklch, var(--color-accent-soft) 60%, var(--color-border));
}
```

Drop any existing drop shadow, translate-Y, or `::before` gradient overlay.

- [ ] **Step 2: Run unit tests**

```bash
cd frontend && npx ng test --include='**/card.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

If no card spec exists, that's fine.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/shared/components/ui/card.component.ts
git commit -m "feat(design): reskin UiCardComponent — flat surface, border-only hover"
```

---

### Task 11: Reskin UiInputComponent + UiTextareaComponent (add mono prop to both)

**Files:**
- Modify: `frontend/src/app/shared/components/ui/input.component.ts`
- Modify: `frontend/src/app/shared/components/ui/textarea.component.ts`

- [ ] **Step 1: Read the current input component**

```bash
cat frontend/src/app/shared/components/ui/input.component.ts
```

Note the current `input()` signals and the host element pattern.

- [ ] **Step 2: Add a `mono` input signal**

Add to the class:

```ts
mono = input<boolean>(false);
```

In the host bindings (existing `host: { … }` block), add:

```ts
'[class.ui-input--mono]': 'mono()',
```

- [ ] **Step 3: Update the styles**

Add to the `styles: [\`…\`]` block:

```css
:host {
  display: inline-flex;
  align-items: center;
  width: 100%;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  font-size: 0.9375rem;
  color: var(--color-text);
  transition: border-color 0.15s;
}
:host(:focus-within) {
  border-color: var(--color-accent);
}
:host(.ui-input--mono) {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0;
}
:host input,
:host textarea {
  background: transparent;
  border: none;
  outline: none;
  color: inherit;
  font: inherit;
  width: 100%;
}
:host input::placeholder,
:host textarea::placeholder {
  color: var(--color-text-dim);
}
```

- [ ] **Step 4: Mirror the changes in `textarea.component.ts`**

Same `mono` input, same host class, same styles (replace the `input` selector with `textarea` where applicable; keep `display: block` rather than `inline-flex` for the textarea host if the existing component already does so).

- [ ] **Step 5: Verify dev build**

```bash
cd frontend && npx ng build --configuration=development
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared/components/ui/input.component.ts frontend/src/app/shared/components/ui/textarea.component.ts
git commit -m "feat(design): reskin UiInput/UiTextarea, add mono prop

Adds the [mono] input that swaps the value font to JetBrains Mono. Used for
API key inputs, file paths, and other technical-string fields per the
mono-usage rule in CLAUDE.md."
```

---

### Task 12: Fix + reskin UiSelectComponent

**Files:**
- Modify: `frontend/src/app/shared/components/ui/select.component.ts`
- Modify: `frontend/src/app/features/landing/landing.component.ts` (restore barrel import)

- [ ] **Step 1: Identify the TS error blocking the barrel import**

Read `frontend/src/app/shared/components/ui/select.component.ts` and `frontend/src/app/features/landing/landing.component.ts` lines 23-25 (the comment documenting the issue). Confirm the error by running:

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -i select
```

Expected: a TS error pointing at `select.component.ts`.

- [ ] **Step 2: Fix the TS error**

The fix depends on what the error is. Common causes in this codebase:
- Generic type parameter not propagated to a CDK overlay or `signal<T>` input.
- A `Type<>` import missing.
- An incorrect `provide` type for a CDK service.

Apply the smallest change that satisfies `tsc --noEmit -p tsconfig.app.json` while preserving the public API (inputs, outputs, exported types like `UiSelectOption`). Do not rewrite the component.

- [ ] **Step 3: Reskin styles to match the new input**

Update the `styles: [\`…\`]` block so the trigger matches `UiInputComponent`:
- Same background, border, radius, padding, font as the input host.
- Dropdown panel: `background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md);` Items: hover background `var(--color-surface-1)`, selected accent color.

- [ ] **Step 4: Confirm the barrel import now works**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

Expected: zero errors.

- [ ] **Step 5: Restore the barrel import in `landing.component.ts`** *(only if it was actively using the workaround)*

`landing.component.ts` lines 23-25 currently document avoiding the barrel. If the imports a few lines below use the long form like `'../../shared/components/ui/button.component'`, change them to `'../../shared/components/ui'` so the codebase stops working around the bug.

- [ ] **Step 6: Build the app**

```bash
cd frontend && npx ng build --configuration=development
```

Expected: success.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/components/ui/select.component.ts frontend/src/app/features/landing/landing.component.ts
git commit -m "fix(design): unblock UiSelect TS error, reskin to match new input

Restores the barrel import in landing.component.ts that was working around
the type error. UiSelect now visually matches the reskinned UiInput."
```

---

### Task 13: Fix + reskin UiDialogComponent and UiSheetComponent

**Files:**
- Modify: `frontend/src/app/shared/components/ui/dialog.component.ts`
- Modify: `frontend/src/app/shared/components/ui/sheet.component.ts`

- [ ] **Step 1: Fix the dialog TS error**

Same approach as Task 12 Step 2 — the smallest change to satisfy `tsc --noEmit`. Run:

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -i dialog
```

Identify the error, fix it, confirm the diagnostic clears.

- [ ] **Step 2: Reskin the dialog**

Update the dialog's overlay + panel styles:

```css
.ui-dialog__overlay {
  position: fixed;
  inset: 0;
  background: oklch(0 0 0 / 0.6);
  backdrop-filter: blur(2px);
}
.ui-dialog__panel {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
```

(Class names follow the existing component's pattern — adjust to match what the file uses.)

- [ ] **Step 3: Reskin the sheet**

`UiSheetComponent` is a side-anchored panel. Apply the same surface + border treatment:

```css
.ui-sheet__panel {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
}
```

Preserve its existing side-anchor behavior (`type SheetSide`).

- [ ] **Step 4: Build the app**

```bash
cd frontend && npx ng build --configuration=development
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/dialog.component.ts frontend/src/app/shared/components/ui/sheet.component.ts
git commit -m "fix(design): unblock UiDialog TS error, reskin Dialog + Sheet for Pip-Tek"
```

---

### Task 14: Reskin UiBadge, UiSeparator, UiLabel

**Files:**
- Modify: `frontend/src/app/shared/components/ui/badge.component.ts`
- Modify: `frontend/src/app/shared/components/ui/separator.component.ts`
- Modify: `frontend/src/app/shared/components/ui/label.component.ts`

- [ ] **Step 1: Reskin badge**

In `badge.component.ts`, update styles. Variants (preserve existing variant API):
- `default`: `background: var(--color-surface-2); color: var(--color-text-muted);`
- `accent`: `background: color-mix(in oklch, var(--color-accent) 10%, transparent); color: var(--color-accent); border: 1px solid color-mix(in oklch, var(--color-accent) 25%, transparent);`
- `success` / `warning` / `danger`: same shape, swap the color token.
- All variants: `border-radius: var(--radius-sm); padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; font-family: var(--font-mono); letter-spacing: 0.04em; text-transform: uppercase;`

- [ ] **Step 2: Reskin separator**

In `separator.component.ts`:

```css
:host {
  display: block;
  background: var(--color-border);
  height: 1px;
  width: 100%;
}
:host([orientation="vertical"]) {
  width: 1px;
  height: 100%;
}
```

- [ ] **Step 3: Reskin label**

In `label.component.ts`:

```css
:host {
  display: inline-block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  letter-spacing: -0.005em;
}
```

- [ ] **Step 4: Build the app**

```bash
cd frontend && npx ng build --configuration=development
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/badge.component.ts frontend/src/app/shared/components/ui/separator.component.ts frontend/src/app/shared/components/ui/label.component.ts
git commit -m "feat(design): reskin Badge, Separator, Label for Pip-Tek"
```

---

### Task 15: Add UiTerminalLogComponent (new primitive)

**Files:**
- Create: `frontend/src/app/shared/components/ui/terminal-log.component.ts`
- Create: `frontend/src/app/shared/components/ui/terminal-log.component.spec.ts`

- [ ] **Step 1: Write the failing test**

`frontend/src/app/shared/components/ui/terminal-log.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiTerminalLogComponent, type TerminalLogEntry } from './terminal-log.component';

describe('UiTerminalLogComponent', () => {
  let fixture: ComponentFixture<UiTerminalLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiTerminalLogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiTerminalLogComponent);
  });

  it('renders one .terminal-log__line per entry', () => {
    const entries: TerminalLogEntry[] = [
      { level: 'info', text: 'started' },
      { level: 'ok',   text: 'resolved 47 mods' },
      { level: 'warn', text: 'one conflict deferred' },
    ];
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();

    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines.length).toBe(3);
  });

  it('uses the level as the prefix and applies a level class', () => {
    fixture.componentRef.setInput('entries', [{ level: 'err', text: 'pipeline aborted' }] satisfies TerminalLogEntry[]);
    fixture.detectChanges();
    const line = fixture.nativeElement.querySelector('.terminal-log__line');
    expect(line.classList.contains('terminal-log__line--err')).toBe(true);
    const prefix = line.querySelector('.terminal-log__prefix');
    expect(prefix.textContent.trim()).toBe('[err]');
  });

  it('renders the > prefix for level=info', () => {
    fixture.componentRef.setInput('entries', [{ level: 'info', text: 'starting' }] satisfies TerminalLogEntry[]);
    fixture.detectChanges();
    const prefix = fixture.nativeElement.querySelector('.terminal-log__prefix');
    expect(prefix.textContent.trim()).toBe('>');
  });
});
```

- [ ] **Step 2: Run the test — verify it FAILS**

```bash
cd frontend && npx ng test --include='**/terminal-log.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: all three specs fail (component doesn't exist).

- [ ] **Step 3: Implement the component**

`frontend/src/app/shared/components/ui/terminal-log.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TerminalLogLevel = 'info' | 'ok' | 'warn' | 'err';

export interface TerminalLogEntry {
  level: TerminalLogLevel;
  text: string;
}

const PREFIX_FOR: Record<TerminalLogLevel, string> = {
  info: '>',
  ok:   '[ok]',
  warn: '[warn]',
  err:  '[err]',
};

@Component({
  selector: 'ui-terminal-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminal-log">
      @for (entry of entries(); track $index) {
        <div class="terminal-log__line" [class]="'terminal-log__line--' + entry.level">
          <span class="terminal-log__prefix">{{ prefixFor(entry.level) }}</span>
          <span class="terminal-log__text">{{ entry.text }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .terminal-log {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--color-text-muted);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.875rem 1rem;
      overflow-y: auto;
    }
    .terminal-log__line {
      display: flex;
      gap: 0.625rem;
      align-items: baseline;
    }
    .terminal-log__prefix {
      flex: 0 0 auto;
      font-weight: 500;
      color: var(--color-text-dim);
      user-select: none;
    }
    .terminal-log__line--ok   .terminal-log__prefix { color: var(--color-success); }
    .terminal-log__line--warn .terminal-log__prefix { color: var(--color-warning); }
    .terminal-log__line--err  .terminal-log__prefix { color: var(--color-danger); }
    .terminal-log__line--info .terminal-log__prefix { color: var(--color-accent); }

    .terminal-log__line--ok   .terminal-log__text { color: var(--color-text); }
    .terminal-log__line--warn .terminal-log__text { color: var(--color-warning); }
    .terminal-log__line--err  .terminal-log__text { color: var(--color-danger); }
  `],
})
export class UiTerminalLogComponent {
  entries = input.required<TerminalLogEntry[]>();
  prefixFor(level: TerminalLogLevel): string { return PREFIX_FOR[level]; }
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

```bash
cd frontend && npx ng test --include='**/terminal-log.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Expected: 3 passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/terminal-log.component.ts frontend/src/app/shared/components/ui/terminal-log.component.spec.ts
git commit -m "feat(design): add UiTerminalLogComponent primitive

Scrolling monospaced log with level-based prefix coloring (>/[ok]/[warn]/[err]).
Used in landing hero and generation runtime (both arrive in Plan 2)."
```

---

### Task 16: Add UiPhaseCounterComponent

**Files:**
- Create: `frontend/src/app/shared/components/ui/phase-counter.component.ts`
- Create: `frontend/src/app/shared/components/ui/phase-counter.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiPhaseCounterComponent } from './phase-counter.component';

describe('UiPhaseCounterComponent', () => {
  let fixture: ComponentFixture<UiPhaseCounterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiPhaseCounterComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UiPhaseCounterComponent);
  });

  it('formats current/total with zero-padded two-digit numbers', () => {
    fixture.componentRef.setInput('current', 3);
    fixture.componentRef.setInput('total', 13);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.phase-counter__label');
    expect(label.textContent.trim()).toBe('PHASE 03/13');
  });

  it('sets the progress bar fill to (current/total) * 100%', () => {
    fixture.componentRef.setInput('current', 4);
    fixture.componentRef.setInput('total', 10);
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('.phase-counter__fill');
    expect(fill.style.width).toBe('40%');
  });

  it('clamps total=0 to 0%', () => {
    fixture.componentRef.setInput('current', 0);
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('.phase-counter__fill');
    expect(fill.style.width).toBe('0%');
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd frontend && npx ng test --include='**/phase-counter.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 3: Implement the component**

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-phase-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="phase-counter">
      <span class="phase-counter__label">PHASE {{ pad(current()) }}/{{ pad(total()) }}</span>
      <div class="phase-counter__track">
        <div class="phase-counter__fill" [style.width]="fillWidth()"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .phase-counter__label {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--color-accent);
    }
    .phase-counter__track {
      height: 4px;
      background: var(--color-surface-2);
      border-radius: 2px;
      margin-top: 0.5rem;
      overflow: hidden;
    }
    .phase-counter__fill {
      height: 100%;
      background: var(--color-accent);
      border-radius: 2px;
      transition: width 0.3s var(--ease-out);
    }
  `],
})
export class UiPhaseCounterComponent {
  current = input.required<number>();
  total   = input.required<number>();

  fillWidth = computed(() => {
    const t = this.total();
    if (t <= 0) return '0%';
    return `${Math.min(100, Math.max(0, (this.current() / t) * 100))}%`;
  });

  pad(n: number): string {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
  }
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
cd frontend && npx ng test --include='**/phase-counter.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/phase-counter.component.ts frontend/src/app/shared/components/ui/phase-counter.component.spec.ts
git commit -m "feat(design): add UiPhaseCounterComponent primitive

Renders 'PHASE 03/13' with a progress bar. Used by the generation runtime
(Plan 2) to show pipeline position."
```

---

### Task 17: Add UiKbdComponent

**Files:**
- Create: `frontend/src/app/shared/components/ui/kbd.component.ts`
- Create: `frontend/src/app/shared/components/ui/kbd.component.spec.ts`

- [ ] **Step 1: Write the failing test**

`frontend/src/app/shared/components/ui/kbd.component.spec.ts`:

```ts
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiKbdComponent } from './kbd.component';

// Test host so we can project text into <ui-kbd> via Angular's standard
// template path — no innerHTML, no manual DOM mutation.
@Component({
  standalone: true,
  imports: [UiKbdComponent],
  template: `<ui-kbd>Ctrl</ui-kbd>`,
})
class HostComponent {}

describe('UiKbdComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('wraps projected content in a <kbd> element', () => {
    const tag = fixture.nativeElement.querySelector('kbd');
    expect(tag).toBeTruthy();
    expect(tag.textContent.trim()).toBe('Ctrl');
  });

  it('host element has the ui-kbd class', () => {
    const host = fixture.nativeElement.querySelector('ui-kbd');
    expect(host.classList.contains('ui-kbd')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd frontend && npx ng test --include='**/kbd.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 3: Implement**

`frontend/src/app/shared/components/ui/kbd.component.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-kbd',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ui-kbd' },
  template: `<kbd><ng-content></ng-content></kbd>`,
  styles: [`
    :host { display: inline-block; }
    kbd {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--color-text);
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.0625rem 0.375rem;
      line-height: 1.4;
      white-space: nowrap;
    }
  `],
})
export class UiKbdComponent {}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd frontend && npx ng test --include='**/kbd.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/kbd.component.ts frontend/src/app/shared/components/ui/kbd.component.spec.ts
git commit -m "feat(design): add UiKbdComponent primitive

Mono-pill <kbd> for keyboard shortcuts in docs and methodology pages."
```

---

### Task 18: Update the UI barrel export and CI smoke step

**Files:**
- Modify: `frontend/src/app/shared/components/ui/index.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update the barrel**

Add to `frontend/src/app/shared/components/ui/index.ts`:

```ts
export { UiTerminalLogComponent, type TerminalLogEntry, type TerminalLogLevel } from './terminal-log.component';
export { UiPhaseCounterComponent } from './phase-counter.component';
export { UiKbdComponent } from './kbd.component';
```

- [ ] **Step 2: Read the current CI workflow**

```bash
cat .github/workflows/ci.yml
```

Note the existing job(s) (`npm ci`, `ng test`, `ng build`). Identify where to insert the e2e step — it should run after the build.

- [ ] **Step 3: Add the Playwright smoke step**

Append to the existing job's `steps:` block (after the production build step):

```yaml
      - name: Install Playwright browsers
        working-directory: frontend
        run: npx playwright install --with-deps chromium

      - name: Serve production build
        working-directory: frontend
        run: npx http-server dist/frontend/browser -p 4200 -s &

      - name: Wait for server
        run: |
          for i in 1 2 3 4 5 6 7 8 9 10; do
            curl -sf http://localhost:4200 > /dev/null && break || sleep 2
          done

      - name: Run Playwright smoke test
        working-directory: frontend
        run: npm run test:e2e
```

(`http-server` is invoked via `npx`, no install needed at the job level.)

- [ ] **Step 4: Build + serve locally to dry-run the CI flow**

```bash
cd frontend && npx ng build --configuration=production
npx http-server dist/frontend/browser -p 4200 -s &
sleep 2
npm run test:e2e
kill %1
```

Expected: 1 spec, 1 pass against the production bundle.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/components/ui/index.ts .github/workflows/ci.yml
git commit -m "feat(ci): export new primitives and add Playwright smoke step

The smoke test asserts design tokens resolve at runtime against the
production build — catches future @theme regressions of the v2.0.0 class."
```

---

### Task 19: Final verification — full build + all tests + manual walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: all specs pass (including the four new ones: brand-mark, terminal-log, phase-counter, kbd).

- [ ] **Step 2: Build production**

```bash
cd frontend && npx ng build --configuration=production
```

Expected: build succeeds, output in `frontend/dist/frontend/browser/`.

- [ ] **Step 3: Serve and run smoke test against production**

```bash
cd frontend && npx http-server dist/frontend/browser -p 4200 -s &
sleep 2
npm run test:e2e
kill %1
```

Expected: 1 pass.

- [ ] **Step 4: Manual visual walkthrough**

Start the dev server, open every route in the browser, confirm:

- `/` Landing — dark background, amber accents, Ω mark in header + footer, "Built by AI" gradient text visible. Layout unchanged from v2 (rebuild is Plan 2).
- `/dashboard` — dark, mod cards bordered, "+ New Build" button is amber.
- `/setup` — wizard renders; primary buttons amber.
- `/settings` — provider tabs visible. The existing Ollama console-error on mount is **not** fixed in this plan (Plan 3 fixes it) — note it without action.
- `/compatibility`, `/methodology`, `/support`, `/modlist/*`, `/generate/*` (with any test session) — dark + amber, layouts unchanged.
- DevTools: no console errors related to fonts (no 400s from Google Fonts).

- [ ] **Step 5: Verify no stale token-system references remain**

```bash
grep -rIn "tokens.scss\|BrandLogoComponent\|app-brand-logo\|Playfair Display\|Instrument Serif\|DM Sans" frontend/src
```

Expected: zero hits in source. (Hits in `node_modules/`, `.angular/`, or build output are fine.)

- [ ] **Step 6: Push the branch and open PR**

```bash
git push -u origin feat/pip-tek-foundation
gh pr create --title "feat(design): Pip-Tek foundation — fix tokens + new palette/type/logo + primitives" --body "$(cat <<'EOF'
## Summary

- Fix the v2.0.0 token-system regression: move `@theme` out of SCSS and into a Tailwind-processed CSS file, so `:root` actually emits the design tokens.
- Switch to the Pip-Tek v3 design system: Pip-Boy amber on warm near-black, Inter + JetBrains Mono, Ω SVG brand mark.
- Reskin every shared UI primitive (Button, Card, Input, Textarea, Select, Dialog, Sheet, Badge, Separator, Label).
- Add three new primitives: `UiTerminalLogComponent`, `UiPhaseCounterComponent`, `UiKbdComponent`.
- Fix latent TS errors in `UiSelect` and `UiDialog` that were blocking the barrel import.
- Add a Playwright smoke test (`frontend/e2e/smoke.spec.ts`) wired into CI that catches future token regressions of this class.

Implements Decisions 1-5 and 7 from `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md`. Per-route Rebuild/Reskin work (Decision 6) lands in follow-up PRs from Plans 2-4.

## Test plan

- [x] All Karma unit specs pass
- [x] Playwright smoke test passes against the production build
- [x] Manual walkthrough of every route confirms dark theme + amber accents render
- [x] No console errors related to fonts on initial load
- [ ] Code review

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Notes for the executor

- **Worktree**: if you're using `superpowers:using-git-worktrees`, this branch lives in an isolated worktree. The dev server (`npm start`) and the Playwright run share the worktree's `frontend/` directory.
- **Karma + Playwright coexist**: Karma is for unit tests (component logic, signal bindings); Playwright is for browser-truth assertions about computed styles. Don't try to assert computed CSS values in Karma — Karma uses Jasmine's testbed which doesn't run a real browser layout for the smoke-test probe.
- **CSS variable names are load-bearing**: 535 places in the codebase reference `var(--color-*)`. The new token names in §Decision 2 of the spec keep every name that v2 used (`--color-bg`, `--color-accent`, `--color-text`, etc.) — only the *values* change. Do not rename a token without grepping consumers first.
- **`color-mix(in oklch, …)` everywhere**: the new palette relies heavily on `color-mix(in oklch, var(--color-accent) N%, transparent)` for borders, glows, and hover states. This is well-supported in modern browsers and matches the existing patterns.
- **Version**: this plan does NOT bump `VERSION` or `frontend/package.json` version. Per the spec's Decision 8, the version bump happens in the *last* PR of the migration (Plan 4).
