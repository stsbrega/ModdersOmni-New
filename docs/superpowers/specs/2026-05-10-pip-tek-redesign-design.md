---
name: ModdersOmni v3 — Pip-Tek Redesign — Design
date: 2026-05-10
status: Draft (pending user review)
---

# ModdersOmni v3 — Pip-Tek Redesign — Design

## Context

ModdersOmni v2.0.0 shipped on 2026-05-09 with a new OKLCH design token system intended to be consumed by Tailwind 4's `@theme` directive. A Playwright audit on 2026-05-10 found that the deployed app renders with the dark theme entirely collapsed: the body computes to default UA white-on-black-default-text, the hero accent "Built by AI" is invisible, and 535 `var(--color-*)` references across the codebase silently fall back to their initial values.

Root cause: `frontend/src/styles/tokens.scss` declares `@theme { … }` but is consumed via SCSS `@use` from `styles.scss`. The SCSS compiler emits `@theme` as a raw CSS at-rule. Tailwind 4 never sees the directive — its only entry point is `frontend/src/tailwind.css`, a one-line `@import "tailwindcss"`. Browsers ignore unknown at-rules. No `:root` custom properties are emitted.

Rather than hotfix the plumbing and ship the v2 design, this redesign takes the opportunity to rebuild the visual system in a "Pip-Tek" direction — a modder's-workbench aesthetic with amber-on-near-black palette, balanced sans/mono typography, and an Ω monogram brand mark. The new system is targeted at the actual user (PC modders who use MO2/Vortex/xEdit) rather than the generic SaaS aesthetic v2 chased.

## Goals

- Fix the broken design token plumbing so `:root` custom properties resolve at runtime.
- Replace the v2 amber-and-blue palette with a focused single-accent amber palette inspired by the Fallout Pip-Boy.
- Replace the v2 Instrument-Serif-driven editorial direction with a balanced Inter + JetBrains Mono pair.
- Replace the existing PNG logo with an Ω SVG monogram + wordmark lockup.
- Rebuild the public-facing surfaces (landing, generation runtime) and reskin every other route consistently.
- Add a CI smoke test that catches future token-resolution regressions.

## Non-Goals

- Changing the application's functional behavior. Generation pipeline, knowledge resolver, sub-passes, overseer review, modlist export — all stay exactly as they are. This is a visual-system rewrite.
- Adding new features (multi-language, theming, light mode, additional games). Out of scope.
- Backend or pipeline changes. Out of scope.
- Renaming the product. "ModdersOmni" stays.
- Migrating away from Tailwind 4, Angular 19, or `@angular/cdk`. Stack stays.

## Architectural Decisions

### Decision 1 — Tailwind 4 owns the `@theme` block

Move the `@theme { … }` declaration into a `.css` file imported directly by Tailwind, not through SCSS. The SCSS compiler will no longer touch design-token declarations.

**Implementation:**

- New file `frontend/src/styles/theme.css` contains the entire `@theme { … }` block.
- `frontend/src/tailwind.css` becomes:
  ```css
  @import "tailwindcss";
  @import "./styles/theme.css";
  ```
- `frontend/src/styles/tokens.scss` is **deleted**. Its `:root` layout helpers (`--max-width`, `--header-height`, `--grain-url`) migrate into `frontend/src/styles.scss` directly, since those are plain CSS custom properties — they don't belong inside `@theme`.
- `styles.scss` loses its `@use 'styles/tokens.scss'` import line. The rest of the file (resets, body, scrollbar, keyframes, accessibility helpers) is unchanged.
- Tailwind 4 `@theme` semantics emit `:root { --color-bg: …; … }` at build time. After this change, `getComputedStyle(document.documentElement).getPropertyValue('--color-accent')` returns the OKLCH value at runtime, and all `var(--color-*)` consumers in the codebase resolve correctly.

**Why:** Tailwind 4's `@theme` is a directive interpreted by the Tailwind preprocessor. The SCSS pipeline that currently processes `tokens.scss` runs before Tailwind sees the file, so the directive is emitted as a literal at-rule that browsers discard. Routing the token file through Tailwind directly is the structural fix; ad-hoc workarounds (e.g., expanding `@theme` to `:root` manually) would lose Tailwind's auto-generated utility classes (`bg-bg`, `text-accent`, etc.) that the primitives rely on.

### Decision 2 — Palette: single-accent amber on warm near-black

A single chromatic accent (amber, hue 75) replaces v2's amber-and-blue dual-accent system. Base surfaces are warm-tinted (chroma ~0.012 at hue 80) rather than cool. Status colors (success/warning/danger) are held at consistent lightness so they don't visually punch through the amber when shown side-by-side.

```css
@theme {
  /* Base — warm-tinted dark */
  --color-bg:        oklch(0.14 0.012 80);
  --color-surface-1: oklch(0.18 0.014 80);
  --color-surface-2: oklch(0.22 0.016 80);
  --color-border:    oklch(0.28 0.018 80);
  --color-border-strong: oklch(0.38 0.020 80);

  /* Text */
  --color-text:       oklch(0.94 0.012 80);
  --color-text-muted: oklch(0.70 0.012 80);
  --color-text-dim:   oklch(0.50 0.010 80);

  /* Accent — Pip-Boy amber */
  --color-accent:        oklch(0.82 0.16 75);
  --color-accent-soft:   oklch(0.55 0.12 75);
  --color-accent-dim:    oklch(0.32 0.06 75);

  /* Secondary — used sparingly for non-amber data viz and informational status */
  --color-secondary: oklch(0.75 0.08 240);

  /* Status */
  --color-success: oklch(0.78 0.14 145);
  --color-warning: oklch(0.82 0.15 95);
  --color-danger:  oklch(0.68 0.20 25);
}
```

**Why:** v2's amber-and-blue dual-accent diluted the brand — anything could be either color, so neither carried meaning. A single accent means amber always means "primary action / brand surface" and the secondary cool hue is reserved for cases where amber would be ambiguous (e.g., a Skyrim game tag next to a Fallout game tag, where amber would tilt the Fallout side).

### Decision 3 — Typography: Inter + JetBrains Mono, no display serif

Drop `Instrument Serif`. Headings use Inter at 600 weight; body uses Inter at 400/500. JetBrains Mono is reserved for technical strings: file paths, mod IDs, version numbers, phase counters, log output, tags, keyboard shortcuts.

```css
@theme {
  --font-sans:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;
  --font-display: 'Inter', system-ui, sans-serif;
}
```

**Mono usage rule** (must be codified in `CLAUDE.md` for future contributors): JetBrains Mono is used only for content that is *technically* monospaced — code, paths, IDs, log output, version strings, keyboard keys, the brand wordmark in lockup, phase counters. Body copy and headings stay sans regardless of how "techy" the surrounding section feels.

**Type scale:**

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 0.6875rem (11px) | 500 | mono labels, tags |
| `text-sm` | 0.8125rem (13px) | 500 | secondary body, captions |
| `text-base` | 0.9375rem (15px) | 400 | body |
| `text-lg` | 1.0625rem (17px) | 500 | section leads |
| `text-xl` | 1.375rem (22px) | 600 | card titles, modal heads |
| `text-2xl` | 1.875rem (30px) | 600 | section headings |
| `text-3xl` | clamp(2rem, 4vw, 3rem) | 600 | secondary hero |
| `text-4xl` | clamp(2.5rem, 6vw, 4.25rem) | 600 | landing hero only |

Body line-height 1.55; heading line-height 1.15. Sans body letter-spacing -0.005em; sans headings -0.02em; mono 0 (default).

**Why:** Instrument Serif was an editorial choice that fit the v2 "premium AI product" framing but pulls against a modder-tool identity. Inter is the most-tested sans on the web; pairing with JetBrains Mono gives the technical-surface vocabulary we need without paying a second display-font tax.

### Decision 4 — Brand mark: Ω SVG monogram + "ModdersOmni" wordmark

The current PNG (`/logo-mark.png`) and the `BrandLogoComponent` that wraps it are replaced by an inline-SVG Ω monogram and a wordmark where the "Omni" half is rendered in amber.

**SVG specification:**

```html
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path
    d="M5 20 L9 20 L9 16 C6 14 5 11 5 9 C5 5 8 3 12 3 C16 3 19 5 19 9 C19 11 18 14 15 16 L15 20 L19 20"
    fill="none"
    stroke="var(--color-accent)"
    stroke-width="2"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
</svg>
```

Component name: `BrandMarkComponent` (new), exporting `<app-brand-mark>` with the same `size` prop signature as the existing `BrandLogoComponent` for drop-in replacement.

Wordmark: "Modders**Omni**" — "Modders" in `--color-text`, "Omni" in `--color-accent`. Font Inter 600, letter-spacing -0.02em.

**Favicon:** SVG renders poorly at favicon resolution due to stroke aliasing. Generate a 32×32 PNG from the SVG (one-time build artifact, checked into `frontend/public/favicon.png`). Replace the existing `favicon.png` and `logo-mark.png`.

**Why:** An inline SVG with `currentColor`/`var(--color-accent)` adapts to any palette change without re-exporting assets and renders crisp at every scale (except 16/32 px favicon, hence the raster fallback). The Ω form makes the "Omni" half of the name literal — "the last letter," signaling universal/all-encompassing scope — and is recognizable at 16 px without text.

### Decision 5 — Component primitive sweep

Every existing primitive in `frontend/src/app/shared/components/ui/` gets reskinned to the new tokens. The sweep is "reskin," not "rewrite" — APIs are stable, internal templates change only where required.

**Existing primitives:**

- `button.component.ts` — variant `primary` (amber bg, near-black fg, no gradient), `secondary` (bordered, transparent fg), `ghost` (no border, text-only with hover bg). Hard-edged corners (radius-md = 5px). Hover state lifts the border color rather than translating Y.
- `card.component.ts` — 1px border on `--color-surface-1` background. Hover border interpolates to `--color-accent-soft`. No translate-Y bounce; no drop shadow.
- `input.component.ts` — flat surface, 1px border, focused border in `--color-accent`. Optional `mono` prop renders the value in `--font-mono` (used for API key inputs, file paths).
- `select.component.ts` — current TS error blocking the barrel import (`frontend/src/app/features/landing/landing.component.ts:23-25` documents this) is fixed as part of the sweep. Reskin to match input styling.
- `dialog.component.ts` — same TS-error fix. Reskin: full-screen overlay at `oklch(0 0 0 / 0.6)`, modal centered with `--color-surface-1` background, border on `--color-border`.

**New primitives:**

- `terminal-log.component.ts` — scrolling monospaced log with line prefixes (`>`, `[ok]`, `[warn]`, `[err]`). Prefix colors map to `--color-accent` / `--color-success` / `--color-warning` / `--color-danger`. Accepts an `entries` signal input. Used in the landing hero animation and the generation runtime.
- `phase-counter.component.ts` — renders `PHASE 03/13` in mono with a progress bar underneath. Accepts `current` and `total` inputs. Used in the generation runtime header and on the landing page as a marketing visual.
- `kbd.component.ts` — `<kbd>` styled as a mono pill (border-radius 3px, `--color-surface-2` background, mono font, 11px). For keyboard shortcuts in docs and methodology pages.

**Deleted:**

- `BrandLogoComponent` and its PNG. Replaced by `BrandMarkComponent` (§Decision 4).

### Decision 6 — Per-route plan

Each route gets one of three treatments: **Rebuild** (new layout + new content), **Reskin** (same layout, new palette/type), **Light** (palette-only touch-up).

| Route | Treatment | Notes |
|---|---|---|
| `/` Landing | Rebuild | New Pip-Tek hero with a `terminal-log` animation as the centerpiece, replacing the mock-dashboard preview. Section count trimmed from 5 to 3 (hero / how-it-works / cta). Footer compressed. Exactly one primary CTA on the page ("Build my modlist" → `/setup`); no competing secondary CTAs in hero or sections. |
| `/setup` Setup wizard | Reskin | 4-step structure preserved. Each step header rendered as a `>` shell-prompt line. Hardware paste-box uses `mono` input variant. |
| `/dashboard` | Reskin + empty state rebuild | List rows become bordered cards with mono mod-count and date. Empty state ("No modlists yet") gets a Pip-Tek treatment with an ASCII-art placeholder and a single CTA. |
| `/generate/:id` Runtime | Rebuild | Two-column layout: left = `terminal-log` of tool calls + reviewer output; right = modlist being built as cards. `phase-counter` at top. v2's stack-build timeline animation is removed. Pause/resume controls stay functional. |
| `/modlist/:id` | Reskin | List rows with mono mod IDs, conflict warnings in `--color-danger`, export buttons styled as mono pseudo-shell commands (`> export --mo2`). |
| `/modlist/:id/guide` | Reskin | Installation steps rendered as numbered `>` lines. Commands shown as mono code blocks. |
| `/settings` | Reskin + Ollama probe fix | Provider tabs use mono labels. API key inputs use `mono` variant. Fix: the current implementation probes `http://localhost:11434/api/tags` on `/settings` mount and produces a console error when Ollama isn't running. The probe becomes lazy — fired only when the user activates the Local Providers tab or clicks "Test Connection". |
| `/compatibility` | Reskin | Mod A vs Mod B input area uses `mono` inputs. Compatibility result rendered as a terminal-diff-style output (`+` for compatible flags, `-` for conflicts) in `terminal-log`. |
| `/methodology` | Reskin | 13-phase pipeline list rendered as numbered terminal lines (`[01]` … `[13]`). Each phase description in sans body. |
| `/support` | Light | Ko-fi and Patreon brand colors (hardcoded orange) stay — those are external brand requirements. Card surfaces and copy get the new palette. |
| 404 | Rebuild | Single Pip-Tek moment: full theatrical `> ERR 404 / not_found` with scanlines, blinking cursor, and a "return to base" link. |

**Audit pass:** After the per-route treatments, do one final sweep for hardcoded RGB literals in component styles. The audit found stragglers like `rgba(192, 160, 96, 0.12)` in `landing.component.ts` that were left from before the v2 token migration. Replace each with the appropriate `color-mix(in oklch, var(--color-*) … %, transparent)` expression.

### Decision 7 — CI smoke test

Add a Playwright smoke test invoked from `.github/workflows/ci.yml` that catches the exact regression class this redesign is recovering from.

**Infrastructure (new):** The repo today only has Karma + Jasmine for unit tests. Playwright is consumed via the MCP plugin during development but isn't installed as a project dev-dependency. This decision adds:

- `@playwright/test` as a `devDependency` in `frontend/package.json`.
- `frontend/playwright.config.ts` configured to run against the built static output served by `npx http-server frontend/dist/frontend/browser -p 4200`.
- `frontend/e2e/` directory for spec files (gitignored output: `frontend/playwright-report/`, `frontend/test-results/`).
- A `test:e2e` script in `package.json`: `"test:e2e": "playwright test"`.
- CI step in `.github/workflows/ci.yml` after the production build: install browsers (`npx playwright install --with-deps chromium`), serve the build, run `npm run test:e2e`. Hard-fail.

**Test:**

```ts
// frontend/e2e/smoke.spec.ts (new)
test('design tokens resolve at runtime', async ({ page }) => {
  await page.goto('/');
  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  // oklch(0.14 0.012 80) rendered as rgb — should be a dark warm tone, NOT default white
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(bgColor).not.toBe('rgb(255, 255, 255)');

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

**Integration:** Per the "Infrastructure" subsection above. The test runs against the production output, not the dev server, so it catches issues that only surface after the build pipeline (token resolution is one such case).

**Why:** The v2 regression passed `ng test` + `ng build --configuration=production` cleanly because both only validate that CSS *compiles*, not that tokens *resolve at runtime*. A 30-line Playwright check would have stopped v2 from shipping in its current state.

### Decision 8 — Migration order

The redesign ships across several PRs, in this order. Each step is independently mergeable and visually meaningful.

1. **Tokens fix** (§Decision 1, §Decision 2) — One PR. Doesn't change any layouts; only unblocks the `:root` variables and switches the palette. Manual verification: open every route, confirm dark theme renders.
2. **Typography + global styles** (§Decision 3) — Drop Instrument Serif, install Inter, update body styles and global keyframes.
3. **Brand mark** (§Decision 4) — Ω SVG component, replace `<app-brand-logo>` usage in every consumer, delete the PNGs.
4. **Primitive sweep** (§Decision 5) — Button → Card → Input → Select (fix TS error) → Dialog (fix TS error) → new primitives (`terminal-log`, `phase-counter`, `kbd`).
5. **Landing rebuild** (§Decision 6) — Front door first.
6. **Generation runtime rebuild** (§Decision 6) — Second-most-visible surface.
7. **Reskin sweep** — `/setup`, `/dashboard`, `/modlist/*`, `/settings` (incl. Ollama probe fix), `/compatibility`, `/methodology`, `/support`. Each route is one commit; the sweep is one PR.
8. **404 rebuild + audit pass** (§Decision 6 audit) — Final visual moment + cleanup of hardcoded RGB stragglers.
9. **CI smoke test** (§Decision 7) — Lands last so the test gates future regressions but doesn't block earlier steps.

## Testing Strategy

- Existing Karma + Jasmine unit specs remain. Component reskins do not require new tests since behavior is unchanged.
- New primitives (`terminal-log`, `phase-counter`, `kbd`) get unit specs covering input-binding and rendered output.
- Playwright smoke test (§Decision 7) added to CI.
- Manual regression checklist: open every route in dev, confirm dark theme + amber accent renders, confirm no console errors on initial mount, confirm primary user flow (landing → setup → generation kickoff) works end-to-end. This is captured as a markdown checklist in the implementation plan, not as automated tests.

## Versioning

Per `CLAUDE.md`'s versioning rules, this is a `feat:` series and bumps the minor: 2.0.0 → 2.1.0. The version bump happens in the **last** PR of the migration (or the single PR if the whole thing is bundled), in the same commit as the changes.

## Open Questions

None at design time. Layout-detail questions for individual route rebuilds (landing hero, generation runtime layout, 404 moment) are deferred to the implementation plan, where each will get its own wireframe pass.
