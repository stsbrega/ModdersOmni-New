# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ModdersOmni is an AI-powered game modding assistant. Users describe their hardware and playstyle; an LLM searches Nexus Mods in real time and builds a personalized modlist phase by phase. Supports Skyrim SE/AE and Fallout 4.

**Stack**: Angular 19 SPA (standalone components, signals) + Tailwind 4 + custom CDK-based primitives, deployed to Cloudflare Pages. No backend — the app runs entirely in the browser, calls the user's chosen LLM provider directly, and reads Nexus mod data via the unauthenticated GraphQL v2 endpoint. LLM keys are stored in `localStorage` via `SettingsStore`.

**Repo layout**:
- `frontend/` — Angular 19 SPA (the entire app)
- `plugins/mo2/moddersomni_import.py` — Mod Organizer 2 plugin (imports a generated modlist JSON; no network call)
- `docs/superpowers/{plans,specs}/` — feature planning/spec docs
- `.github/workflows/` — CI (`ci.yml`), Cloudflare Pages deploy (`deploy.yml`), auto-changelog (`changelog.yml`)
- `cliff.toml` — git-cliff config for auto-generated CHANGELOG

## Common Commands

Run from `frontend/`:

```bash
npm install
npm start                              # Dev server on localhost:4200
npx ng build --configuration=production
npm test                               # Karma + Jasmine, all specs
```

### Single test

Karma runs all specs; there is no built-in single-test shortcut. Use `fdescribe` / `fit` temporarily, or filter via `npx ng test --include='**/settings-store.service.spec.ts'`.

## Architecture

### Generation Pipeline (Core Feature)

Everything runs in-browser. There is no SSE and no `/api` layer.

`PipelineService.start(...)` returns an RxJS `Observable<PipelineEvent>`. `GenerationService` subscribes, accumulates state, and re-emits to the UI via signals. The pipeline processes a game's ordered build phases one at a time (Skyrim: ~10 phases — Essentials → ... → Compatibility Patches). Within each phase it runs a tool-calling loop: `search_nexus`, `get_mod_details`, `add_to_modlist`, `finalize`. A Gemini Pro overseer (`reviewer.service.ts`) independently reviews each phase's selections before the pipeline advances.

Key files in `frontend/src/app/core/services/generation/`:
- `pipeline.service.ts` — Main phased loop; emits an Observable of typed events
- `session.ts` — `GenerationSession` type; full state captured for pause/resume
- `tools.service.ts` — Tool call execution (Nexus reads, modlist mutations)
- `reviewer.service.ts` — Per-phase Gemini Pro quality reviewer
- `preset.ts` — `SizePreset` enum (SMALL/MEDIUM/LARGE/MASSIVE/ULTIMATE). Multiplier applied to each phase's `max_mods * scale_weight`.
- `sub-pass.ts` — When a phase's effective cap exceeds `PER_SUB_PASS_MAX` (25), split into N sub-passes so each LLM turn starts with fresh context plus a compact "already added" summary.
- `prompts.ts` — System/phase prompt construction
- `errors.ts` — `PauseGeneration` carries `session_snapshot` for resume
- `types.ts` — Pipeline event shapes

`GenerationService` (`core/services/generation.service.ts`) owns the live session signal and exposes the modlist + event timeline to feature components.

### LLM / Dispatcher

`frontend/src/app/core/services/llm/registry.ts` lists supported providers (`anthropic`, `openai`, `gemini`, `gemini_pro`, `groq`, `openrouter`, `ollama`, …). Anthropic uses the native browser SDK; the rest use the OpenAI-compatible chat-completions shape. `dispatcher.service.ts` routes each phase to the user-configured model based on phase complexity. Keys come from `SettingsStore` (localStorage).

### Knowledge Base

`frontend/src/app/core/services/knowledge.service.ts` loads bundled Markdown+XML knowledge files (`assets/knowledge/`) and returns only sections relevant to the current phase, keeping per-call token cost bounded. Inject `modding_common.md` + the game-specific file; never cross-inject.

### Frontend feature layout

Standalone components, feature-based under `src/app/features/`. Components use **inline templates and styles** (single `.ts` files) where practical. Key services in `src/app/core/services/`.

Feature modules: `compatibility`, `dashboard`, `generation`, `landing`, `methodology`, `modlist`, `settings`, `setup`, `support`. Structure also includes `core/{services,utils}/` and `shared/{components,models}/`.

`core/utils/key-detection.ts` → `detectProvider(key, providers)` — use this to identify LLM providers from pasted API keys; don't parse model names or error messages.

### Nexus Mods integration

**Do NOT reintroduce personal Nexus API keys.** Nexus Support (Kurtis, Apr 2026) confirmed personal API keys are forbidden in public-facing applications. Reads go through the unauthenticated Nexus GraphQL v2 endpoint (`https://api.nexusmods.com/v2/graphql`) — the browser-side `NexusService` calls it directly with no auth header. The MO2 plugin handles actual mod downloads via the user's existing Nexus account inside Mod Organizer 2.

### MO2 Plugin (file-import flow)

`plugins/mo2/moddersomni_import.py` is a standalone Mod Organizer 2 plugin. The user exports a JSON manifest from the web app, then opens it via **Tools → ModdersOmni Import** in MO2. The plugin reads the local JSON file and queues each mod through MO2's existing Nexus integration. There is no network call to ModdersOmni — the web app and the plugin only meet via the downloaded JSON file.

JSON shape (see `core/services/install-guide.service.ts`):

```json
{
  "version": "2.0.0",
  "game": "skyrim" | "fallout4",
  "name": "...",
  "mods": [{ "modId": 0, "fileId": 0, "name": "...", "installOrder": 0 }]
}
```

## Non-Obvious Gotchas

### Frontend

- **LLM API keys live in `localStorage`** via `SettingsStore` (`core/services/settings-store.service.ts`). Three UI entry points (Settings, Setup wizard, Generation pause form) all read/write through the same store — never bypass it with direct `localStorage` calls.
- **Stale dev server**: After modifying frontend files, if behavior seems stale: `rm -rf frontend/.angular/cache` and restart.
- **Google Fonts syntax**: Use simple weight syntax (`wght@300;400;500;600;700`), NOT variable font axis syntax — variable syntax causes 400 errors during Angular font inlining.
- **Fonts**: Inter (body + headings) + JetBrains Mono (technical strings only).
- **Mono usage rule (codified)**: `JetBrains Mono` is reserved for content that is *technically* monospaced — code, file paths, mod/version IDs, log output, keyboard shortcuts, phase counters (e.g. `PHASE 03/13`), and the brand wordmark in lockup. Body copy and headings stay in Inter regardless of how "techy" the surrounding section feels. This keeps mono meaningful — when it appears, the reader knows the content is literal/copyable.

## Versioning Rules

Version lives in `VERSION` (root) — single source of truth. `frontend/package.json` must stay in sync.

- `feat:` commits → bump **minor** (2.0.0 → 2.1.0)
- `fix:` / `perf:` commits → bump **patch** (2.0.0 → 2.0.1)
- Bump in the **same commit** as the change — not a separate commit.
- `CHANGELOG.md` is auto-generated by GitHub Actions via `git-cliff` (see `cliff.toml`) — **do not edit manually**.

## CI (GitHub Actions)

Workflows in `.github/workflows/`:
- `ci.yml` — frontend only: `npm ci`, `npx ng test --watch=false --browsers=ChromeHeadless`, `npx ng build --configuration=production`. `ng lint` is soft. No Postgres, no Python, no service containers.
- `deploy.yml` — on push to `main`: build the production bundle and deploy `frontend/dist/frontend/browser` to Cloudflare Pages via `cloudflare/wrangler-action@v3` (project `moddersomni`).
- `changelog.yml` — `git-cliff` auto-generates `CHANGELOG.md` on push to main

Hard-fail: `ng test`, `ng build --configuration=production`, deploy.
Soft: `ng lint`.

## Content Filtering

When generating code referencing custom mod sources, use generic terms ("custom mod source") rather than naming specific adult content sites — the Anthropic API blocks responses with explicit site references.
