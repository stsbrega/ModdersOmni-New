# ModdersOmni v3 — Pip-Tek Final Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the Pip-Tek redesign. Rebuild the 404 page as the one theatrical Pip-Tek moment the spec calls for (scanlines, blinking cursor, `> ERR 404 / not_found`). Run a final audit pass across the entire `frontend/src/` tree (not just `features/`) to catch any remaining stale v1 references that Plan 3's scoped grep missed. Bump VERSION + `frontend/package.json` from 2.0.0 → 2.1.0 to mark the end of the v3 redesign series.

**Architecture:** Two real code changes plus a version bump:
1. `NotFoundComponent` already uses v3 tokens correctly, but its current presentation is a plain "404 / This page doesn't exist." card. The spec Decision 6 explicitly designates 404 as a **Rebuild** with full theatrical Pip-Tek treatment. Replace its template with a scanline-overlaid terminal screen showing `> ERR 404 / not_found` with a blinking cursor and a "return to base" link.
2. Audit sweep across the codebase root level (`frontend/src/app/core/`, `frontend/src/app/shared/`, plus everything outside `frontend/src/app/features/` which Plan 3 already cleaned). Same grep contract as Plan 3: zero hits for stale tokens, v1 RGB literals, and stale font names.

**Tech Stack:** Same as Plans 1-3. Theatrical effects use plain CSS animations (`@keyframes` for scanlines + cursor blink). No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-10-pip-tek-redesign-design.md` (commit `d0734ab`). This plan implements:
- Decision 6's **404 Rebuild** row.
- Decision 6's **Audit pass** (scoped to non-feature paths Plan 3 didn't touch).
- Decision 8 step 9 (version bump). The CI smoke test from Decision 7 already landed in Plan 1.

**Prerequisite:** PRs #1, #2, and #3 must be merged to main in order. Branch this plan from `feat/pip-tek-reskin-sweep` (PR #3's branch) until that chain merges, then rebase. Branch name: `feat/pip-tek-final`.

---

## File Structure

### Modified files

| File | Change |
|---|---|
| `frontend/src/app/shared/components/not-found/not-found.component.ts` | Rebuild template + styles. Full Pip-Tek theatrical: scanline overlay, blinking cursor, `> ERR 404 / not_found` heading, single "return to base" link. Behavior unchanged — still routes to `/` or `/dashboard`. |
| `VERSION` | `2.0.0` → `2.1.0` |
| `frontend/package.json` | `"version": "2.0.0"` → `"version": "2.1.0"` |
| Any files surfaced by the audit pass (Task 3) | Targeted stale-reference cleanup |

### Created files

None.

### Deleted files

None.

---

## Tasks

### Task 1: Pre-flight + audit grep (whole-tree scope)

**Files:** none (verification + branch creation)

- [ ] **Step 1: Create the branch**

If PRs #1-3 are merged:
```bash
git checkout main && git pull
git checkout -b feat/pip-tek-final
```

Otherwise:
```bash
git checkout feat/pip-tek-reskin-sweep && git pull
git checkout -b feat/pip-tek-final
```

- [ ] **Step 2: Audit grep across the whole frontend tree**

The Plan 3 sweep was scoped to `frontend/src/app/features/`. This pass widens to everything:

```bash
# A: Stale token names anywhere in frontend/src
grep -rIn "var(--accent)\\|var(--text-primary)\\|var(--text-secondary)\\|var(--text-muted)\\|var(--border-color)" frontend/src

# B: v1 gold/blue RGB literals anywhere in frontend/src
grep -rIn "rgba(192, 160, 96\\|rgba(123, 164, 192\\|rgba(192,160,96\\|rgba(123,164,192" frontend/src

# C: Stale font literals
grep -rIn "'Playfair Display'\\|'DM Sans'\\|'Instrument Serif'" frontend/src

# D: Stale Tailwind utility class strings on host elements
grep -rIn "host:\\s*{\\s*class:" frontend/src/app
```

For categories A and B, **exclude** any hit inside `node_modules/`, `.angular/`, or `dist/` — those don't count. Categories should report only `frontend/src/app/` and immediate children.

Capture the output. The Task 3 cleanup task will work through whatever this finds.

- [ ] **Step 3: Smoke test still passes**

```bash
cd frontend && npm start  # background
# wait for "Local: http://localhost:4200/"
cd frontend && npm run test:e2e
# stop the dev server
```

Expected: 1 pass.

- [ ] **Step 4: No commit**

Skip the marker commit.

---

### Task 2: Rebuild `NotFoundComponent` with the Pip-Tek theatrical treatment

**Files:**
- Modify: `frontend/src/app/shared/components/not-found/not-found.component.ts`

The spec language for this route: *"Single Pip-Tek moment: full theatrical `> ERR 404 / not_found` with scanlines, blinking cursor, and a 'return to base' link."*

This is the one place in the app where we let the theatrical full-pip-tek aesthetic loose. Everywhere else is "balanced" — body sans, mono for technical surfaces. The 404 is allowed to go all-in because it's a moment, not a screen the user lives in.

### Step 1: Replace the template + styles

Open `frontend/src/app/shared/components/not-found/not-found.component.ts` and replace the entire `template` and `styles` blocks (keep the imports, class signature, and OnPush — only the visual layer changes).

```ts
template: `
  <main class="not-found">
    <div class="not-found__scanlines" aria-hidden="true"></div>
    <div class="not-found__vignette" aria-hidden="true"></div>

    <div class="not-found__content">
      <div class="not-found__prompt">
        <span class="not-found__prefix">&gt;</span>
        <span class="not-found__heading">ERR 404 / not_found</span>
        <span class="not-found__cursor" aria-hidden="true"></span>
      </div>

      <pre class="not-found__diag">
[stack trace]
  at router.match(/{{ requestedPath }})
  at route_table.lookup()
  at <strong>404</strong>
</pre>

      <p class="not-found__sub">the page you requested isn't part of this build.</p>

      <div class="not-found__actions">
        <a routerLink="/" class="not-found__link not-found__link--primary">
          <span>&gt; return --to base</span>
        </a>
        <a routerLink="/setup" class="not-found__link">
          <span>&gt; start --new-modlist</span>
        </a>
      </div>
    </div>
  </main>
`,
styles: [`
  :host { display: block; }

  .not-found {
    position: relative;
    min-height: calc(100vh - var(--header-height, 64px));
    background: var(--color-bg);
    color: var(--color-text);
    display: grid;
    place-content: center;
    overflow: hidden;
    padding: 4rem 2rem;
    font-family: var(--font-mono);
  }

  /* Scanline overlay — translucent horizontal lines like a CRT */
  .not-found__scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      transparent 0,
      transparent 2px,
      color-mix(in oklch, var(--color-accent) 4%, transparent) 2px,
      color-mix(in oklch, var(--color-accent) 4%, transparent) 3px
    );
    mix-blend-mode: screen;
    opacity: 0.6;
  }

  /* Vignette to mimic a curved CRT screen */
  .not-found__vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse at center,
      transparent 40%,
      oklch(0 0 0 / 0.55) 100%
    );
  }

  .not-found__content {
    position: relative;
    z-index: 1;
    text-align: left;
    max-width: 640px;
  }

  .not-found__prompt {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: clamp(1.25rem, 3.5vw, 1.875rem);
    color: var(--color-accent);
    margin-bottom: 1.5rem;
    text-shadow: 0 0 12px color-mix(in oklch, var(--color-accent) 30%, transparent);
  }

  .not-found__prefix {
    font-weight: 600;
  }

  .not-found__heading {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: lowercase;
  }

  .not-found__cursor {
    display: inline-block;
    width: 0.6em;
    height: 1.1em;
    background: var(--color-accent);
    margin-left: 0.25rem;
    animation: not-found-cursor 1s steps(1) infinite;
    align-self: center;
    box-shadow: 0 0 8px color-mix(in oklch, var(--color-accent) 40%, transparent);
  }
  @keyframes not-found-cursor {
    50% { opacity: 0; }
  }

  .not-found__diag {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--color-text-muted);
    margin: 0 0 2rem;
    padding: 1rem 1.25rem;
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-surface-1));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    white-space: pre;
    overflow-x: auto;
  }
  .not-found__diag strong {
    color: var(--color-danger);
    font-weight: 600;
  }

  .not-found__sub {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    margin: 0 0 2rem;
  }

  .not-found__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .not-found__link {
    display: inline-flex;
    align-items: center;
    padding: 0.625rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    text-decoration: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    background: var(--color-bg);
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .not-found__link:hover {
    color: var(--color-accent);
    border-color: color-mix(in oklch, var(--color-accent) 35%, var(--color-border));
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg));
  }
  .not-found__link--primary {
    color: var(--color-accent);
    border-color: color-mix(in oklch, var(--color-accent) 30%, var(--color-border));
  }
  .not-found__link--primary:hover {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  /* Reduced motion: kill the cursor blink */
  @media (prefers-reduced-motion: reduce) {
    .not-found__cursor { animation: none; opacity: 1; }
    .not-found__scanlines { display: none; }
  }
`],
```

Add the `requestedPath` field to the component class (the diagnostic block needs it):

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,  // as above
  styles: [...],     // as above
})
export class NotFoundComponent {
  private readonly router = inject(Router);
  // Capture the actual URL the user tried to reach — appears in the diag block.
  protected readonly requestedPath = this.router.url || '/';
}
```

### Step 2: Verify

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
cd frontend && npx ng build --configuration=development
```

Both must succeed.

### Step 3: Manual smoke check (if you can)

Start the dev server, navigate to `http://localhost:4200/this-route-does-not-exist`. Confirm:
- The page shows the scanline overlay (subtle horizontal lines).
- The `> ERR 404 / not_found` heading has a glow + a blinking amber block cursor.
- The diagnostic block lists `at <strong>404</strong>` in danger color.
- Two `> return --to base` / `> start --new-modlist` link buttons at the bottom.
- The links route correctly.

If you can't open a browser, the build/typecheck gates are sufficient.

### Step 4: Commit

```bash
git add frontend/src/app/shared/components/not-found/not-found.component.ts
git commit -m "feat(design): rebuild 404 page as the Pip-Tek theatrical moment

Scanline-overlaid terminal screen with > ERR 404 / not_found heading,
blinking amber cursor, fake stack-trace diagnostic block, and two
shell-prompt-style nav links. The 404 is the one route in the app where
full-theatrical Pip-Tek is allowed — every other surface stays balanced.

prefers-reduced-motion disables the cursor blink and scanlines."
```

---

### Task 3: Final audit pass — clean up anything Task 1's grep surfaced

**Files:** any files Task 1's grep flagged.

### Step 1: Replay the audit greps from Task 1

```bash
grep -rIn "var(--accent)\\|var(--text-primary)\\|var(--text-secondary)\\|var(--text-muted)\\|var(--border-color)" frontend/src
grep -rIn "rgba(192, 160, 96\\|rgba(123, 164, 192" frontend/src
grep -rIn "'Playfair Display'\\|'DM Sans'\\|'Instrument Serif'" frontend/src
```

### Step 2: For each hit, apply the same conversion patterns Plans 1-3 used

- **Pattern C (stale token):** Replace per the table:
  - `var(--accent)` → `var(--color-accent)`
  - `var(--text-primary)` → `var(--color-text)`
  - `var(--text-secondary)` → `var(--color-text-muted)`
  - `var(--text-muted)` → `var(--color-text-dim)`
  - `var(--border-color)` → `var(--color-border)`

- **Pattern D (RGB literal):** Replace with `color-mix(in oklch, var(--color-accent|secondary) N%, transparent)`. Skip any literal inside a clearly brand-locked context (Ko-fi, Patreon, GitHub, etc.) — these are usually in `frontend/src/app/features/support/`, but the audit sweep may catch instances in shared components too. If you're unsure whether a literal is brand-locked, search the surrounding 10 lines for a brand name; if you find one, preserve the literal.

- **Pattern E (font literal):** Replace per the table:
  - `'Playfair Display'` → `var(--font-display)`
  - `'DM Sans'` → `var(--font-sans)`
  - `'Instrument Serif'` → `var(--font-display)`

### Step 3: Confirm zero hits

```bash
grep -rIn "var(--accent)\\|var(--text-primary)\\|var(--text-secondary)\\|var(--text-muted)\\|var(--border-color)\\|'Playfair Display'\\|'DM Sans'\\|'Instrument Serif'\\|rgba(192, 160, 96\\|rgba(123, 164, 192" frontend/src
```

Must return zero. This is the cleanup contract for the entire v3 redesign series — at the end of Plan 4, no v1 cruft survives anywhere in `frontend/src/`.

### Step 4: Verify build + smoke

```bash
cd frontend && npx ng build --configuration=development
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Build succeeds. Karma still green (~229 specs).

### Step 5: Commit (only if Task 1's grep found anything)

```bash
git add -A frontend/src
git commit -m "fix(design): final audit pass cleanup

Cleans up the last v1 stale references outside the features/ tree that
Plan 3's scoped sweep didn't catch. Final grep contract — zero hits for
stale tokens, font literals, or v1 palette RGB literals across the
entire frontend/src tree."
```

If Task 1's grep returned zero hits, skip this commit. Move directly to Task 4.

---

### Task 4: Version bump + final verification + open PR #4

**Files:**
- Modify: `VERSION`
- Modify: `frontend/package.json`

### Step 1: Bump the version

`VERSION`:
```
2.1.0
```

`frontend/package.json`: change the line `"version": "2.0.0"` to `"version": "2.1.0"`.

Both bumps happen in the same commit. Per CLAUDE.md: "Bump in the same commit as the change — not a separate commit." Since this is the final PR of the redesign series, the bump rides this PR.

### Step 2: Run the full suite one more time

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
cd frontend && npx ng build --configuration=production
npx http-server dist/frontend/browser -p 4200 -s &
sleep 3
npm run test:e2e
kill %1
```

All green.

### Step 3: One last sanity grep

```bash
grep -rIn "var(--accent)\\|var(--text-primary)\\|var(--text-secondary)\\|var(--text-muted)\\|var(--border-color)\\|'Playfair Display'\\|'DM Sans'\\|'Instrument Serif'\\|rgba(192, 160, 96\\|rgba(123, 164, 192" frontend/src
```

Zero hits. Across the whole tree.

### Step 4: Commit + push + open PR

```bash
git add VERSION frontend/package.json
git commit -m "chore: release v2.1.0 — Pip-Tek redesign complete

Caps the v3 visual redesign series:
- Plan 1: foundation (tokens, palette, type, brand, primitives, CI smoke test)
- Plan 2: landing + generation runtime rebuilds
- Plan 3: reskin sweep across 7 routes + Ollama auto-probe fix
- Plan 4: 404 theatrical rebuild + final audit + version bump"

git push -u origin feat/pip-tek-final

gh pr create \
  --base feat/pip-tek-reskin-sweep \
  --title "feat(design): Pip-Tek final — 404 rebuild + audit + v2.1.0" \
  --body "$(cat <<'EOF'
## Summary

Closes out the v3 Pip-Tek redesign series.

### 404 rebuild
The `NotFoundComponent` becomes the one theatrical Pip-Tek moment in the app — scanline overlay, vignette, glowing `> ERR 404 / not_found` heading with a blinking amber block cursor, fake stack-trace diagnostic block, and shell-prompt-style nav links. \`prefers-reduced-motion\` disables the cursor blink and scanlines.

Per the spec, the 404 is the only place where full-theatrical Pip-Tek is allowed; every other route stays balanced (sans body, mono for technical surfaces).

### Final audit pass
A whole-tree grep across `frontend/src/` confirms zero remaining v1 cruft: no stale token names (`--accent`, `--text-primary`, etc.), no v1 palette RGB literals (`rgba(192,160,96,…)`, `rgba(123,164,192,…)`), no stale font literals (`'Playfair Display'`, `'DM Sans'`, `'Instrument Serif'`).

### v2.1.0
Version bump in this same PR per CLAUDE.md's versioning rules — `VERSION` and `frontend/package.json` both move from 2.0.0 → 2.1.0. This caps the v3 series: Plans 1-4 are now feature-complete.

## Test plan

- [x] All Karma specs pass
- [x] Playwright smoke test passes against the production build
- [x] Whole-tree sanity grep returns zero hits
- [ ] Manual: navigate to a non-existent route and confirm the new 404 renders
- [ ] Code review

## Notes

- Base branch: `feat/pip-tek-reskin-sweep` (PR #3). Merge order: #1 → #2 → #3 → #4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 5: Report

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED
- Final Karma count, smoke test result, sanity-grep result (zero matches)
- The PR URL

---

## Notes for the executor

- **404 is the only theatrical surface.** Don't apply scanlines or blinking cursors anywhere else — the spec was explicit that everywhere else stays balanced. If you're tempted to add theatrical flourishes to landing or generation, resist.
- **Sanity-grep is the contract.** At the end of Plan 4, the whole-tree grep must return zero. That's the visible signal that the v3 redesign series is complete.
- **The CI smoke test (Decision 7) is already in place** from Plan 1 — it runs on PR #1 and every subsequent PR. Plan 4 doesn't touch it.
- **No version bump anywhere except VERSION + package.json**, and both happen in the same commit as Task 4 Step 1.
