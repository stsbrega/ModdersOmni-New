# ModdersOmni v3 — Pip-Tek Reskin Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the 7 lower-effort routes onto the Pip-Tek system landed by Plans 1-2. Each route keeps its existing layout and behavior — only the styling layer changes. Routes covered: `/setup` (with 4 step sub-components), `/dashboard`, `/modlist/:id` + `/modlist/:id/guide`, `/settings`, `/compatibility`, `/methodology`, `/support`. The sweep cleans up three classes of v2 latent bugs along the way: Tailwind utility class strings that never resolved (because this project doesn't run Tailwind's preprocessor), pre-v2 stale token names (`--accent`, `--text-primary`, `--border-color`, etc.), and hardcoded RGB color literals.

**Architecture:** This is a pure styling sweep — no logic changes, no template-structure rewrites. For each route file, apply the same conversion pattern Plans 1-2 established: Tailwind utility class strings on `host: { class: '…' }` or template `class="…"` attributes get replaced with marker classes (`route-name__element`) plus a real `styles: [\`…\`]` block consuming `var(--color-*)` directly. Stale token names get find-and-replaced to the current v3 token set. Hardcoded RGB literals get replaced with `color-mix(in oklch, var(--color-*) N%, transparent)` expressions. Each route gets reviewed for layout consistency (border radius, spacing, type scale) but the existing component structure stays intact.

**Tech Stack:** Angular 19 standalone components, OKLCH tokens from `theme.css`, Inter + JetBrains Mono, Lucide icons. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md` (commit `d0734ab`). This plan implements the **Reskin** + **Light** rows of Decision 6. Per-route notes below cite the exact spec language for each route's expected treatment.

**Prerequisite:** PRs #1 (foundation) and #2 (rebuilds) must be merged to `main` first, OR you branch from `feat/pip-tek-rebuilds` and rebase later. The branch for this plan is `feat/pip-tek-reskin-sweep`.

---

## Conversion pattern (apply to every route)

For each component file, look for three v2 patterns and convert them:

### Pattern A — Tailwind utility class strings on `host: { class: '…' }`

**Bad (v2):**
```ts
host: { class: 'block bg-surface-1 border border-border rounded-md p-6' }
```

**Good (v3):**
```ts
host: { class: 'route-name' }
// + add a styles: [`:host.route-name { background: var(--color-surface-1); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.5rem; }`] block
```

### Pattern B — Tailwind utility class strings in templates

**Bad (v2):**
```html
<div class="flex items-center gap-2 text-text-muted">…</div>
```

**Good (v3):**
```html
<div class="route-name__row">…</div>
<!-- + add :host .route-name__row { display: flex; align-items: center; gap: 0.5rem; color: var(--color-text-muted); } -->
```

### Pattern C — Stale pre-v2 token names

These appeared in my audit and predate the v2 token migration. Find-and-replace across each route file:

| Stale token | Replacement |
|---|---|
| `var(--accent)` | `var(--color-accent)` |
| `var(--text-primary)` | `var(--color-text)` |
| `var(--text-secondary)` | `var(--color-text-muted)` |
| `var(--text-muted)` | `var(--color-text-dim)` |
| `var(--border-color)` | `var(--color-border)` |
| `'Playfair Display'` (font literal) | `var(--font-display)` |
| `'DM Sans'` (font literal) | `var(--font-sans)` |
| `'Instrument Serif'` (font literal) | `var(--font-display)` |

### Pattern D — Hardcoded RGB literals tied to brand colors

Replace literals like `rgba(192, 160, 96, 0.12)` (the v1 gold tint at 12%) with `color-mix(in oklch, var(--color-accent) 10%, transparent)`. Similar for any `rgba(123, 164, 192, …)` cool-blue literals (replace with `--color-secondary` analogues).

**Don't** replace literals that are intentionally brand-locked, e.g.:
- Ko-fi orange in `support.component.ts` (`#FF5E5B` — that's Ko-fi's brand color).
- Patreon red in `support.component.ts` (`#FF424D` — Patreon's brand color).

If unsure whether a literal is brand-locked, search for the hex value in the component's surrounding context. If it appears next to a brand name (Ko-fi, Patreon, etc.), preserve it.

---

## File Structure

### Modified files (12 component files across 7 routes)

| File | Treatment per spec |
|---|---|
| `frontend/src/app/features/setup/setup.component.ts` | Reskin — wizard frame, 4-step nav. |
| `frontend/src/app/features/setup/steps/game-select/game-select.component.ts` | Reskin — Skyrim / Fallout 4 picker cards. |
| `frontend/src/app/features/setup/steps/playstyle-select/playstyle-select.component.ts` | Reskin — playstyle radio cards + the inline Ollama URL field. Note: this file has Tailwind utility class strings (per Pattern A/B). |
| `frontend/src/app/features/setup/steps/spec-input/spec-input.component.ts` | Reskin — hardware paste box. The paste textarea should use the new `mono` variant of `UiTextareaComponent` (added in Plan 1) since the content is technical. |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Reskin + empty-state refresh. List rows become bordered cards with mono mod-count + date. Empty state ("No modlists yet") gets a Pip-Tek treatment with an ASCII-art placeholder and a single CTA. |
| `frontend/src/app/features/modlist/modlist.component.ts` | Reskin — mod ID renders in `var(--font-mono)`, conflict warnings in `var(--color-danger)`. |
| `frontend/src/app/features/modlist/size-summary-card.component.ts` | Reskin — stale `--text-muted` references found by audit. |
| `frontend/src/app/features/modlist/modlist-guide.component.ts` | Reskin — install steps as numbered `>` lines, commands in mono blocks. |
| `frontend/src/app/features/settings/settings.component.ts` | Reskin — provider tabs use mono labels, API key inputs use the `mono` variant from Plan 1. Verify no Ollama probe fires on `/settings` mount (audit grep already confirms only `testOllamaConnection()` hits the network — should be no-op). |
| `frontend/src/app/features/compatibility/compatibility.component.ts` | Reskin — Mod A vs B inputs use `mono` variant. Compatibility result rendered as a terminal-diff in `UiTerminalLogComponent` with `+`/`-` prefixes. (The grep found Tailwind utility classes here too.) |
| `frontend/src/app/features/methodology/methodology.component.ts` | Reskin — 13-phase list as numbered terminal lines `[01]`..`[13]`. |
| `frontend/src/app/features/support/support.component.ts` | Light — card surfaces get the new tokens. Ko-fi orange + Patreon red literals stay (those are external brand colors). |

### Created files

None. This plan is pure reskin — no new components.

### Deleted files

None.

---

## Tasks

### Task 1: Pre-flight — branch + audit pass

**Files:** none (verification + branch creation only)

- [ ] **Step 1: Create the branch**

If PRs #1 and #2 have both merged to main:
```bash
git checkout main && git pull
git checkout -b feat/pip-tek-reskin-sweep
```

Otherwise:
```bash
git checkout feat/pip-tek-rebuilds && git pull
git checkout -b feat/pip-tek-reskin-sweep
```

- [ ] **Step 2: Catalog the work**

Run these greps and record the output. Each match is a place this plan must touch.

```bash
# A: Tailwind utility class strings on host: { class: '...' }
grep -rIn "host:\s*{\s*class:" frontend/src/app/features/setup frontend/src/app/features/dashboard frontend/src/app/features/modlist frontend/src/app/features/settings frontend/src/app/features/compatibility frontend/src/app/features/methodology frontend/src/app/features/support

# B: Tailwind utility class strings inline in templates
grep -rIn 'class="[^"]*\(bg-\|text-\|border-\|p-\|m-\|gap-\|flex\|grid\)' frontend/src/app/features/setup frontend/src/app/features/dashboard frontend/src/app/features/modlist frontend/src/app/features/settings frontend/src/app/features/compatibility frontend/src/app/features/methodology frontend/src/app/features/support

# C: Stale token names
grep -rIn "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--text-muted)\|var(--border-color)" frontend/src/app/features

# D: Hardcoded RGB tied to the v1 palette
grep -rIn "rgba(192, 160, 96\|rgba(123, 164, 192\|rgba(192,160,96\|rgba(123,164,192" frontend/src/app/features

# E: Stale font literals
grep -rIn "'Playfair Display'\|'DM Sans'\|'Instrument Serif'" frontend/src/app/features
```

Write down which files have hits in which categories. The per-task work below maps to those hits.

- [ ] **Step 3: Verify the smoke test still passes**

```bash
cd frontend && npm start &  # background; wait for "Local: http://localhost:4200/"
npm run test:e2e
```

Expected: 1 pass. Stop the dev server.

- [ ] **Step 4: No commit**

Skip an empty marker commit. The first substantive commit is in Task 2.

---

### Task 2: Reskin `/setup` wizard (5 files)

**Files:**
- Modify: `frontend/src/app/features/setup/setup.component.ts`
- Modify: `frontend/src/app/features/setup/steps/game-select/game-select.component.ts`
- Modify: `frontend/src/app/features/setup/steps/playstyle-select/playstyle-select.component.ts`
- Modify: `frontend/src/app/features/setup/steps/spec-input/spec-input.component.ts`
- (Plus any other step file under `setup/steps/` you find during Task 1.)

- [ ] **Step 1: Read the setup container**

```bash
cat frontend/src/app/features/setup/setup.component.ts
```

Identify the wizard frame — likely a header with `STEP 1/4`-style breadcrumbs and the step content slot. Replace any Tailwind utility class strings on `host: { class: '…' }` with marker classes + a `styles: [\`…\`]` block. The wizard frame is a card-like container — use `--color-surface-1` background, `--color-border` 1px border, `--radius-lg`.

The step breadcrumbs should use `--font-mono` for the step counter (e.g. `STEP 02/04`) — same family as the new `UiPhaseCounterComponent` from Plan 1.

- [ ] **Step 2: Reskin each step component**

For `game-select.component.ts`, `playstyle-select.component.ts`, `spec-input.component.ts`, and any others:

- Apply Pattern A (host class) and Pattern B (template class) from the "Conversion pattern" section above.
- The game-select cards: amber border on hover, larger and more tactile than the v2 versions. Use `--radius-lg`.
- The playstyle-select radio cards: same hover treatment.
- The spec-input paste box: the inner `<textarea>` should now use `<ui-textarea mono>` (the `mono` prop was added in Plan 1) since the pasted content is hardware info that benefits from monospaced rendering.

- [ ] **Step 3: Apply Pattern C — find-and-replace stale token names**

For each file in this task, run the find-and-replace per the table at the top of this plan. After replacements:

```bash
grep -n "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--text-muted)\|var(--border-color)" frontend/src/app/features/setup
```

Should return zero matches.

- [ ] **Step 4: Apply Pattern D + E — RGB and font literals**

Same approach: grep first, then replace. After:

```bash
grep -rIn "rgba(192, 160, 96\|rgba(123, 164, 192\|'Playfair Display'\|'DM Sans'\|'Instrument Serif'" frontend/src/app/features/setup
```

Should return zero matches.

- [ ] **Step 5: Verify build + tests + smoke**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
cd frontend && npx ng test --include='**/setup/**' --watch=false --browsers=ChromeHeadless
cd frontend && npx ng build --configuration=development
```

All must succeed. (Karma may have no specs for setup — that's fine, the include filter just runs zero.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/setup/
git commit -m "feat(design): reskin /setup wizard for Pip-Tek

Wizard frame + game-select, playstyle-select, spec-input step components.
Replaces Tailwind utility class strings with marker classes + real styles
blocks (same pattern as Plan 1's primitive reskins). spec-input textarea
adopts the new [mono] variant for hardware paste content."
```

---

### Task 3: Reskin `/dashboard`

**Files:**
- Modify: `frontend/src/app/features/dashboard/dashboard.component.ts`

- [ ] **Step 1: Read the file**

```bash
cat frontend/src/app/features/dashboard/dashboard.component.ts
```

Identify:
- The "Welcome back" + modlist count header.
- The list of generated modlists (each row is a card link to `/modlist/:id`).
- The "+ New Build" CTA.
- The empty state ("No modlists yet").

- [ ] **Step 2: Reskin the modlist row cards**

Convert any Tailwind utility class strings to marker classes + styles. Each row card:
- `background: var(--color-surface-1); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem 1.25rem;`
- Hover: `border-color: color-mix(in oklch, var(--color-accent-soft) 60%, var(--color-border));`
- Mod count + date renders in `font-family: var(--font-mono); font-size: 0.75rem;`
- Game tag (Skyrim/Fallout) renders in `<ui-badge variant="info">` for Skyrim, `<ui-badge variant="success">` for Fallout (or whatever variant feels right — preserve the existing color split).

- [ ] **Step 3: Refresh the empty state**

The v2 empty state was a generic "No modlists yet" with a CTA. Make it Pip-Tek:

```html
@if (modlists().length === 0) {
  <div class="dashboard__empty">
    <pre class="dashboard__empty-ascii">{{ asciiPlaceholder }}</pre>
    <h2 class="dashboard__empty-title">No modlists yet.</h2>
    <p class="dashboard__empty-sub">Start a new build from the setup wizard.</p>
    <a ui-button variant="primary" size="md" routerLink="/setup">
      + New Build
      <lucide-icon name="arrow-right" [size]="14"></lucide-icon>
    </a>
  </div>
}
```

Where `asciiPlaceholder` is a small ASCII figure that fits the modder vibe — pick something simple and tasteful. A suggestion:

```
  [ ─── ]
  [ ─── ]
  [ ─── ]
```

(Just three empty bracketed lines representing "an empty modlist." Mono font, accent color, dim opacity.)

Style:
```css
.dashboard__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 5rem 2rem;
  text-align: center;
}
.dashboard__empty-ascii {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-accent);
  opacity: 0.5;
  margin: 0;
  white-space: pre;
}
.dashboard__empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
}
.dashboard__empty-sub {
  color: var(--color-text-muted);
  max-width: 320px;
}
```

- [ ] **Step 4: Patterns C/D/E sweep**

Same as Task 2 Steps 3-4 but scoped to `frontend/src/app/features/dashboard/`.

- [ ] **Step 5: Build + smoke**

```bash
cd frontend && npx ng build --configuration=development
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/dashboard/
git commit -m "feat(design): reskin /dashboard for Pip-Tek

Modlist rows become hairline-bordered cards with mono mod-count and date.
Empty state gets a Pip-Tek ASCII placeholder + single CTA, matching the
spec's modder-workbench treatment."
```

---

### Task 4: Reskin `/modlist/:id` + `/modlist/:id/guide`

**Files:**
- Modify: `frontend/src/app/features/modlist/modlist.component.ts`
- Modify: `frontend/src/app/features/modlist/modlist-guide.component.ts`
- Modify: `frontend/src/app/features/modlist/size-summary-card.component.ts`

- [ ] **Step 1: Read the three files**

```bash
cat frontend/src/app/features/modlist/modlist.component.ts | head -40
cat frontend/src/app/features/modlist/modlist-guide.component.ts | head -40
cat frontend/src/app/features/modlist/size-summary-card.component.ts
```

- [ ] **Step 2: Reskin `modlist.component.ts` (the list view)**

Apply Patterns A-D. Specific spec asks:
- Mod IDs render in `var(--font-mono)`.
- Conflict warnings use `var(--color-danger)`.
- Export buttons styled as mono pseudo-shell commands. E.g.: `<button ui-button variant="secondary"><span class="mono">&gt; export --mo2</span></button>`. Add a `.mono` utility class scoped to this component (or use `<span style="font-family: var(--font-mono)">`).

- [ ] **Step 3: Reskin `modlist-guide.component.ts` (the install walkthrough)**

Each install step renders as a numbered `>` line:

```html
<ol class="install-steps">
  @for (step of steps; track step.id; let i = $index) {
    <li class="install-step">
      <span class="install-step__num">{{ i + 1 | number: '2.0' }}</span>
      <span class="install-step__prompt">&gt;</span>
      <span class="install-step__text">{{ step.text }}</span>
    </li>
  }
</ol>
```

(Or whatever existing iteration pattern the v2 file uses — adapt as needed.)

Commands shown inside each step (e.g. `wabbajack install`) render as mono code blocks: `<pre class="install-code">…</pre>` with mono font + surface-2 background + radius-sm.

- [ ] **Step 4: Reskin `size-summary-card.component.ts`**

This is a small card. The audit found stale `var(--text-muted)` here — replace with `var(--color-text-dim)` per the table. Apply Patterns A-B if utility class strings exist.

- [ ] **Step 5: Patterns C/D/E sweep**

```bash
grep -rIn "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--text-muted)\|var(--border-color)" frontend/src/app/features/modlist
```

Should return zero matches.

- [ ] **Step 6: Build + smoke**

```bash
cd frontend && npx ng build --configuration=development
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/modlist/
git commit -m "feat(design): reskin /modlist + /modlist/:id/guide for Pip-Tek

Mod IDs in mono, conflict warnings in danger color, export buttons styled
as pseudo-shell commands. Install guide steps render as numbered '>' lines
with mono code blocks for actual commands."
```

---

### Task 5: Reskin `/settings`

**Files:**
- Modify: `frontend/src/app/features/settings/settings.component.ts`

- [ ] **Step 1: Read the file**

This is a long file. The relevant sections:
- The provider-tabs container (top of the page).
- The API-key entry section (per provider).
- The Local Providers tab (Ollama URL + Test Connection button).

- [ ] **Step 2: Reskin**

- Provider tabs: `font-family: var(--font-mono); text-transform: lowercase;`. Active tab gets `border-bottom: 2px solid var(--color-accent);` + amber color.
- API key inputs: use the `<ui-input mono>` variant. Existing key values get rendered masked but in mono.
- "Test Connection" button: `<button ui-button variant="secondary" size="sm">`. After a successful test, render the model list as mono lines.

- [ ] **Step 3: Verify NO Ollama probe fires on mount**

Read `ngOnInit` at line ~984. Confirm it only calls `loadSettings()`, `loadLlmProviders()`, `loadLlmKeys()`. None of those should call `fetch()` on `localhost:11434`. The only network call is `testOllamaConnection()` which is user-triggered. If you find a hidden auto-probe somewhere (e.g., in a constructor, an effect, or a service `inject`-side-effect), refactor it to lazy — only fire when the user activates the Local Providers tab.

If no auto-probe exists, no fix is needed — the audit's console error was likely retained from a prior navigation.

- [ ] **Step 4: Patterns C/D/E sweep**

```bash
grep -n "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--text-muted)\|var(--border-color)" frontend/src/app/features/settings/settings.component.ts
```

Should return zero matches after this task.

- [ ] **Step 5: Build + smoke**

```bash
cd frontend && npx ng build --configuration=development
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/settings/
git commit -m "feat(design): reskin /settings for Pip-Tek

Provider tabs in mono lowercase with amber active-state. API key inputs
adopt the [mono] variant. Verified no Ollama probe fires on mount —
the only network call is the user-triggered Test Connection button."
```

---

### Task 6: Reskin `/compatibility`

**Files:**
- Modify: `frontend/src/app/features/compatibility/compatibility.component.ts`

- [ ] **Step 1: Read the file**

The compatibility checker has:
- Two mod-name input fields (Mod A vs Mod B).
- A game selector.
- A "Check Compatibility" button.
- A results section that renders the AI's compatibility analysis.

- [ ] **Step 2: Reskin inputs**

The two mod-name inputs use `<ui-input mono>` since mod IDs and names are technical strings. Add a layout helper that displays them side-by-side with a "vs" separator.

- [ ] **Step 3: Reskin the results section**

Render the AI's compatibility findings inside a `<ui-terminal-log>` with diff-style prefixes:
- Compatible flag → `{ level: 'ok', text: '+ ...' }`
- Conflict / warning → `{ level: 'warn', text: '- ...' }`
- Hard incompatibility → `{ level: 'err', text: '- ...' }`

If the existing component's analysis return shape doesn't already split into compatible/conflict lists, you'll need a small transformer. Keep it inline in the component — don't extract a sub-component for this.

- [ ] **Step 4: Patterns C/D/E sweep**

```bash
grep -n "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--border-color)" frontend/src/app/features/compatibility/compatibility.component.ts
```

Should return zero matches.

- [ ] **Step 5: Build + smoke**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/compatibility/
git commit -m "feat(design): reskin /compatibility for Pip-Tek

Mod A vs Mod B inputs use the [mono] variant. Compatibility result is
rendered as a terminal-diff via UiTerminalLogComponent with +/- prefixes,
mapping compatibility findings to ok/warn/err levels."
```

---

### Task 7: Reskin `/methodology`

**Files:**
- Modify: `frontend/src/app/features/methodology/methodology.component.ts`

- [ ] **Step 1: Read the file**

Methodology explains the 13-phase pipeline. The v2 layout is a list of phase descriptions.

- [ ] **Step 2: Reskin the phase list**

Render each phase as a numbered terminal line:

```html
<ol class="methodology-phases">
  @for (phase of phases; track phase.id) {
    <li class="methodology-phase">
      <span class="methodology-phase__num">[{{ phase.number | number: '2.0' }}]</span>
      <h3 class="methodology-phase__name">{{ phase.name }}</h3>
      <p class="methodology-phase__desc">{{ phase.description }}</p>
    </li>
  }
</ol>
```

Styles: phase number in mono + amber; name in sans bold; description in sans muted.

- [ ] **Step 3: Patterns C/D/E sweep**

- [ ] **Step 4: Build + smoke**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/methodology/
git commit -m "feat(design): reskin /methodology for Pip-Tek

13-phase pipeline list rendered as numbered terminal lines ([01]..[13]),
phase number in mono+amber, descriptions in sans-muted."
```

---

### Task 8: Light pass on `/support`

**Files:**
- Modify: `frontend/src/app/features/support/support.component.ts`

- [ ] **Step 1: Read the file**

Support has Ko-fi + Patreon donation CTAs. The Ko-fi orange (`#FF5E5B`) and Patreon red (`#FF424D`) are intentional brand colors — **preserve them as literals**, don't try to tokenize.

- [ ] **Step 2: Reskin card surfaces and copy**

The container cards for the donation buttons should use the new token surface system:
- `background: var(--color-surface-1);`
- `border: 1px solid var(--color-border);`
- `border-radius: var(--radius-lg);`
- `padding: 1.5rem;`

The donation buttons themselves stay with their brand colors. Wrap each button in its own card.

- [ ] **Step 3: Patterns C and E sweep (skip D since brand colors are preserved)**

```bash
grep -n "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--border-color)\|'Playfair Display'\|'DM Sans'\|'Instrument Serif'" frontend/src/app/features/support/support.component.ts
```

Should return zero matches.

- [ ] **Step 4: Build + smoke**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/support/
git commit -m "feat(design): light reskin of /support for Pip-Tek

Card surfaces and copy adopt v3 tokens. Ko-fi orange + Patreon red brand
colors preserved as literals."
```

---

### Task 9: Final verification + open PR #3

**Files:** none (verification only)

- [ ] **Step 1: Full Karma**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: all specs pass (≈229 from end of Plan 2).

- [ ] **Step 2: Production build**

```bash
cd frontend && npx ng build --configuration=production
```

- [ ] **Step 3: Smoke test**

```bash
cd frontend && npx http-server dist/frontend/browser -p 4200 -s &
sleep 3
npm run test:e2e
kill %1
```

- [ ] **Step 4: Final sanity-grep — zero hits across all feature routes**

```bash
grep -rIn "var(--accent)\|var(--text-primary)\|var(--text-secondary)\|var(--text-muted)\|var(--border-color)\|'Playfair Display'\|'DM Sans'\|'Instrument Serif'\|rgba(192, 160, 96\|rgba(123, 164, 192" frontend/src/app/features
```

Expected: **zero matches**. The grep is the contract for the reskin sweep — every stale reference must be gone.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin feat/pip-tek-reskin-sweep
gh pr create \
  --base feat/pip-tek-rebuilds \
  --title "feat(design): Pip-Tek reskin sweep — 7 routes" \
  --body "$(cat <<'EOF'
## Summary

Reskins the 7 lower-effort routes onto the Pip-Tek system landed by Plans 1-2. Each route keeps its existing layout — only the styling layer changes.

### Routes touched

- `/setup` + 4 step sub-components (game-select, playstyle-select, spec-input)
- `/dashboard` (incl. empty-state refresh)
- `/modlist/:id` + `/modlist/:id/guide` + size-summary card
- `/settings` (verified no Ollama auto-probe — only the user-triggered Test Connection hits the network)
- `/compatibility` (results rendered as terminal-diff via UiTerminalLogComponent)
- `/methodology` (13-phase pipeline as numbered terminal lines)
- `/support` (light — Ko-fi + Patreon brand colors preserved as literals)

### Latent-bug cleanup along the way

- **Tailwind utility class strings** that never resolved (this project doesn't run Tailwind's preprocessor) — converted to marker classes + real `styles` blocks per the pattern established in Plan 1.
- **Pre-v2 stale token names** (`--accent`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-color`) — find-and-replaced to the current v3 token set.
- **Hardcoded RGB literals** tied to the v1 gold/blue palette — replaced with `color-mix(in oklch, var(--color-*) N%, transparent)`.
- **Stale font literals** (`'Playfair Display'`, `'DM Sans'`, `'Instrument Serif'`) — replaced with `var(--font-display)` / `var(--font-sans)`.

### Tests

- Full Karma suite green (no new specs — these are pure styling changes).
- Playwright smoke test passes.
- Sanity grep is zero hits across `frontend/src/app/features/`.

Implements the **Reskin** + **Light** rows of `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md` Decision 6.

## Test plan

- [x] All Karma specs pass
- [x] Playwright smoke test passes against the production build
- [x] No stale token references in `frontend/src/app/features/`
- [ ] Manual walkthrough of each reskinned route
- [ ] Code review

## Notes

- This PR's base branch is **\`feat/pip-tek-rebuilds\` (PR #2)**. Merge PR #1 → #2 → #3 in order.
- No version bump — that's locked for Plan 4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Notes for the executor

- **Stay style-only.** Every task in this plan is a styling sweep. If you find yourself tempted to refactor logic, restructure templates, or change behavior, STOP — that's not in scope. Plan 4 has an audit pass that could absorb structural cleanup if needed.
- **The 3 files with confirmed Tailwind utility strings** (per the Task 1 audit): `playstyle-select.component.ts`, `settings.component.ts`, `compatibility.component.ts`. These need the marker-class + styles-block conversion. Other route files may use plain CSS already — just sweep for stale tokens.
- **`.mono` utility class.** Several routes need to render technical strings (mod IDs, commands) inline in mono. Don't define a global `.mono` utility — each component that needs it should define it locally in its own styles block (`.modlist__mono-id { font-family: var(--font-mono); }`). Keeps component encapsulation clean.
- **Don't bump VERSION.** Plan 4 owns the bump.
- **Branch base.** This PR's base is `feat/pip-tek-rebuilds`. After PR #2 merges, you'll either rebase onto main manually or let GitHub auto-rebase when the base merges.
