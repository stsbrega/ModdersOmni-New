---
name: ModdersOmni Static Bundle Refactor — Design
date: 2026-05-09
status: Draft (pending user review)
---

# ModdersOmni Static Bundle Refactor — Design

## Context

ModdersOmni is currently a deployed full-stack web application: Angular 19 SPA + FastAPI backend + PostgreSQL on Render. The user is moving on from this project and wants to eliminate ongoing hosting costs while preserving the core value proposition: AI-driven phased modlist generation that beats a one-shot frontier-chatbot prompt on mod fit, conflict detection, and patch placement.

The refactor reduces ModdersOmni to a self-contained static Angular bundle distributed via Cloudflare Pages and Nexus Mods. Users bring their own LLM API keys (or run a local Ollama). All authentication, user accounts, and server-side state are removed.

The refactor also takes the opportunity to upgrade the visual design — replacing per-feature scoped styles with a centralized component library (spartan-ng), OKLCH design tokens via Tailwind 4 `@theme`, sharper typography, and consistent iconography.

## Goals

- Eliminate Render hosting costs and Postgres storage. Zero recurring infrastructure spend.
- Distribute as both a hosted URL (Cloudflare Pages, free tier) and a downloadable zip on Nexus Mods.
- Preserve the generation quality differentiator: phased loop, tool calling, knowledge resolver, sub-passes, per-phase overseer review.
- Preserve the export-to-MO2/Vortex install path.
- Centralize the design system; visual upgrade to a sharper, more distinctive aesthetic.

## Non-Goals

- All authentication: Google OAuth, Discord OAuth, JWT, refresh tokens, sessions, email verification, account cleanup.
- All user accounts and per-user state.
- Nexus OAuth flow. Reads use unauthenticated GraphQL v2; downloads happen through MO2/Vortex (which have their own Nexus auth).
- Server-side LLM keys / "free tier" model routing. Everyone is BYOK or local Ollama.
- Multi-device sync, cloud-saved modlists, cross-device session continuity.
- Stripe / payments / credits / tier gates. All preset sizes available to everyone.

## Architectural Decisions

### Decision 1 — Single Angular static bundle, no backend

The entire app ships as the output of `ng build --configuration=production`: HTML + bundled JS + CSS + static assets. No Python, no Postgres, no Render web service.

**Why:** The user is moving on from this project and wants to eliminate hosting costs without sunsetting the tool entirely.

### Decision 2 — Distribute via Cloudflare Pages + Nexus Mods zip

**Primary channel:** Cloudflare Pages, deployed from the build output after each push to `main`. Free for static hosting. Existing Cloudflare API token (`~/.config/cloudflare/moddersomni.token`, per memory) is reused.

**Secondary channel:** A `moddersomni-vX.Y.Z.zip` of the same build output, published as a Nexus Mods file. Users can run it offline by serving the directory locally (`npx serve` or a bundled launcher script per OS).

**Why both:** Cloudflare gives instant updates and zero install friction. Nexus Mods gives discoverability in the modding community and an offline option for privacy-minded users.

### Decision 3 — Nexus integration uses unauthenticated GraphQL v2 only

No Nexus API key, no OAuth flow. The `NexusModsClient` is ported to TypeScript and calls `https://api.nexusmods.com/v2/graphql` directly from the browser.

**Why:** Per Nexus Support guidance (Kurtis, April 2026), personal API keys are forbidden in public-facing applications. A downloadable HTML on Nexus Mods is by definition public-facing. OAuth would require a hosted callback bridge (no longer single-file), and the only feature it would unlock — authenticated downloads — is a mod-organizer responsibility, not ModdersOmni's. MO2 and Vortex authenticate to Nexus themselves once handed an exported modlist.

**Trade-off accepted:** No premium auto-download from within ModdersOmni. Users click through to Nexus to download (the same UX as Wabbajack), or let MO2/Vortex handle it after import.

### Decision 4 — BYOK or local LLM, pruned to 6 providers

The backend's 14-provider registry is pruned to 6 well-supported, browser-direct-friendly providers:

| Provider | Notes |
|---|---|
| Anthropic | Header `anthropic-dangerous-direct-browser-access: true` |
| OpenAI | SDK `dangerouslyAllowBrowser: true` |
| Google Gemini | Direct REST, CORS supported |
| Groq | CORS supported, free-tier-friendly |
| OpenRouter | Meta-provider; one key, many models |
| Ollama (local) | Requires `OLLAMA_ORIGINS=*`; documented in Setup wizard |

Dropped: Together, DeepSeek, Mistral, Cerebras, Qwen, Ollama Cloud, Groq Scout (folded into Groq), Gemini Pro (folded into Gemini), custom mod source clients.

**Why:** Six providers cover the realistic BYOK landscape without the support burden of edge-case CORS issues from less-common providers.

### Decision 5 — Full port of the generation pipeline; per-phase overseer preserved

All current pipeline features survive:

- Phased loop processing each `ModBuildPhase` in order
- Tool calling within each phase: `search_nexus`, `get_mod_details`, `add_to_modlist`, `finalize`
- Knowledge resolver injecting per-phase-relevant slices of the markdown knowledge base
- Compatibility guidelines injection
- Sub-passes when phase cap > 25 (prevents in-context drift)
- Per-phase overseer that independently reviews phase results
- Pause/resume via session snapshots (now serialized to localStorage)

**Overseer model:** defaults to the same provider+model used for generation. Advanced setting allows users to pick a different provider+model for review (e.g., generate with Sonnet, review with Opus).

**Why:** The overseer and sub-passes are exactly what justify ModdersOmni existing as a tool rather than a prompt template. Cutting them to save porting effort defeats the benchmark goal of beating a one-shot frontier-chatbot prompt.

### Decision 6 — localStorage for persistence; multi-modlist supported

All state — settings, LLM keys, in-progress generations, saved modlists — lives in `localStorage`. Modlist JSON is ~50–200 KB; the typical 5–10 MB ceiling supports many modlists per device.

**Why:** Simplest possible persistence. Survives reloads, lost on browser data clear (acceptable for a local tool). No IndexedDB complexity.

### Decision 7 — All preset sizes available to everyone

The current code caps free-tier users at SMALL/MEDIUM and gates LARGE/MASSIVE/ULTIMATE behind BYOK. Without a "free tier" — everyone is BYOK or local — the gate is meaningless. All 5 presets unlocked unconditionally.

### Decision 8 — Stay on Angular 19; adopt spartan-ng. Do not switch to React or Stylex

The frontend is incrementally refactored, not rewritten. Angular 19's standalone components, signals, and new control flow are sufficient; spartan-ng provides a shadcn-quality component library that closes the design ceiling gap with React.

**Why not React:** A Vite + React rewrite is realistically 4–6 weeks of focused work for ~12 features and gains nothing technical. Effort goes into platform porting instead of design quality.

**Why not Stylex:** No first-class Angular tooling in 2026 (Meta has explicitly declined to maintain examples). Switching off Tailwind 4 (which uses OKLCH natively and is excellent) gains nothing.

### Decision 9 — Visual identity shift: "engineered modding tool"

Move from luxury-SaaS-with-gold to a sharper, more distinctive aesthetic:

- **Component foundation:** spartan-ng for all interactive primitives, composed in `shared/components/ui/`.
- **Design tokens:** Tailwind 4 `@theme` with OKLCH palette
  - `--color-bg: oklch(0.16 0.015 260)` (deep near-black, not pure)
  - `--color-accent: oklch(0.78 0.18 75)` (warm amber — evokes parchment / forge without skeuomorphism)
  - `--color-secondary: oklch(0.72 0.09 230)` (cool blue)
- **Typography:** Instrument Serif (display, replaces Playfair) + DM Sans (body, kept) + JetBrains Mono (mod IDs, file IDs, load order, version strings)
- **Iconography:** `lucide-angular` (replaces all inline hand-coded SVGs)
- **Surface treatment:** sharp-edged tactile design with hairline borders. Glassmorphism removed (peaked 2024, now reads dated).
- **Motion:** centralized `core/motion/` directory with named easing tokens. Generation page phase advance becomes a vertical "stack building" animation rather than a fade.

## Architecture

### High-level diagram

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Angular 19 SPA, served from CF Pages /         │
│           Nexus Mods zip)                                │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────┐         │
│  │ UI features  │    │ Core services (TS)      │         │
│  │  (kept,      │◄───┤  - GenerationPipeline   │         │
│  │   restyled)  │    │  - KnowledgeService     │         │
│  └──────────────┘    │  - NexusService         │         │
│                      │  - LLMDispatcher (6)    │         │
│  ┌──────────────┐    │  - SpecParser           │         │
│  │ localStorage │◄───┤  - InstallGuide         │         │
│  │  (settings,  │    │  - ModlistStore         │         │
│  │   modlists,  │    │  - Reviewer             │         │
│  │   sessions)  │    └─────────────────────────┘         │
│  └──────────────┘                ▲                       │
└──────────────────────────┬───────┴───────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │ LLM provider (BYOK)  │    │ Nexus GraphQL v2     │
   │  Anthropic / OpenAI /│    │  (unauthenticated    │
   │  Gemini / Groq /     │    │   reads only)        │
   │  OpenRouter / Ollama │    └──────────────────────┘
   └──────────────────────┘
```

### Component boundaries

Every Angular service has one responsibility, one well-defined interface, and is independently testable:

- **`NexusService`** — GraphQL queries; returns typed mod metadata. No LLM awareness.
- **`KnowledgeService`** — loads the 4 markdown files at app startup, exposes `resolveForPhase(game, phase): string`.
- **`LLMDispatcherService`** — given an `LLMConfig` (provider + model + key) and a request, returns a streamed response. Knows nothing about modlists.
- **`GenerationPipelineService`** — orchestrates the phased loop. Composes the above. Emits an RxJS observable of typed events for the UI.
- **`ReviewerService`** — runs the overseer pass. Takes phase output and a (possibly different) `LLMConfig`.
- **`ModlistStore`** — localStorage-backed CRUD for saved modlists.
- **`InstallGuideService`** — generates MO2/Vortex import payloads.
- **`SpecParserService`** — parses hardware specs (existing logic, ported from Python).

### Data flow — generation

1. User opens `/generation`, selects game + preset, fills hardware spec, clicks Start.
2. `GenerationPipelineService.start({game, spec, preset, llmConfig, overseerConfig?})` is called.
3. Pipeline loads `/data/build-phases.{game}.json` (static asset).
4. For each phase in order:
   1. `KnowledgeService.resolveForPhase(game, phase)` returns the relevant prompt slice.
   2. `PromptsService.buildPhasePrompt(...)` assembles the system + user prompts.
   3. If `phase.cap > PER_SUB_PASS_MAX` (25), `SubPassController` splits into N sub-passes.
   4. For each sub-pass, run the LLM tool-calling loop until `finalize` is called or max-turns reached.
      - `search_nexus` → `NexusService.search(...)`
      - `get_mod_details` → `NexusService.getMod(...)`
      - `add_to_modlist` → push to session
      - `finalize` → end sub-pass
   5. After all sub-passes for the phase, `ReviewerService.review(phase, results, overseerConfig)` runs.
      - On review failure, retry the phase up to N times (N = 2 by default), feeding the reviewer's feedback back into the next attempt.
   6. Snapshot session to localStorage on every event.
5. After all phases complete, the modlist is persisted via `ModlistStore.save(...)`. UI shows export buttons.

### Data flow — pause / resume

- Every event the pipeline emits triggers `SessionSnapshotService.persist(session)` which writes to `localStorage['session.<id>']`.
- On app startup, if any in-progress sessions exist, the generation feature offers "Resume previous generation."
- Resume calls `GenerationPipelineService.resume(sessionId)`, which validates the LLM key is still configured, then continues from the next phase or sub-pass boundary.

### Data flow — MO2 / Vortex export

1. User clicks "Export for MO2" (or "Export for Vortex") on a completed modlist.
2. `InstallGuideService.buildMO2Payload(modlist)` returns a JSON document with: game, ordered mod entries (`mod_id`, `file_id`, `name`, `install_order`, `notes`), and a textual install instructions readme.
3. Browser triggers a download of `moddersomni-{name}-{timestamp}.json`.
4. User opens MO2 → runs the moddersomni import plugin → file picker → selects the JSON.
5. Plugin parses the JSON and queues installs through MO2's existing Nexus Mods integration.

Vortex export uses the same JSON shape with a Vortex-specific instructions readme.

## Component Inventory

### Backend → DELETE entirely

The whole `backend/` tree, plus `render.yaml`. Specifically:

- All API routers: `auth.py`, `user.py`, `stats.py`, `plugin.py`, `nexus_oauth.py`, `settings.py`, `specs.py`, `games.py`, `modlist.py`, `generation.py`, `compatibility.py`, `deps.py`, `__init__.py`
- All SQLAlchemy models: `user`, `user_settings`, `user_oauth_provider`, `user_nexus_token`, `refresh_token`, `email_verification`, `plugin_token`, `playstyle`, `playstyle_mod`, `mod`, `mod_build_phase`, `modlist`, `game`, `compatibility`
- All Alembic migrations and `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`
- Background services: `account_cleanup.py`, `nexus_token_refresh.py`, `email/*`, `plugin_auth.py`, `oauth.py` (Google/Discord), `nexus_oauth.py`, `nexus_collections.py`, `tier_classifier.py`, `auth.py`
- `requirements.txt`, `Dockerfile` (if present), `app/seeds/`
- `backend/tests/`

### Backend → PORT TO TYPESCRIPT

| Python source | TypeScript destination |
|---|---|
| `services/nexus_client.py` | `frontend/src/app/core/services/nexus.service.ts` |
| `services/generation/pipeline.py` | `frontend/src/app/core/services/generation/pipeline.service.ts` |
| `services/generation/session.py` | `frontend/src/app/core/services/generation/session.ts` |
| `services/generation/handlers.py` + `tools.py` | `frontend/src/app/core/services/generation/tools.service.ts` |
| `services/generation/reviewer.py` | `frontend/src/app/core/services/generation/reviewer.service.ts` |
| `services/generation/sub_pass.py` | `frontend/src/app/core/services/generation/sub-pass.ts` |
| `services/generation/preset.py` | `frontend/src/app/core/services/generation/preset.ts` |
| `services/generation/prompts.py` | `frontend/src/app/core/services/generation/prompts.ts` |
| `services/generation/exceptions.py` | `frontend/src/app/core/services/generation/errors.ts` |
| `knowledge/resolver.py` | `frontend/src/app/core/services/knowledge.service.ts` |
| `services/spec_parser.py` | `frontend/src/app/core/services/spec-parser.service.ts` |
| `services/install_guide.py` | `frontend/src/app/core/services/install-guide.service.ts` |
| `llm/registry.py` + `dispatcher.py` | `frontend/src/app/core/services/llm/registry.ts` + `dispatcher.service.ts` |

### Backend assets → MOVE TO STATIC

- `backend/app/knowledge/*.md` → `frontend/public/knowledge/*.md`. Loaded via `fetch()` at app startup, cached in memory.
- DB-seeded data → JSON files under `frontend/public/data/`:
  - `games.json` (Skyrim SE/AE, Fallout 4)
  - `build-phases.skyrim.json`, `build-phases.fallout4.json`
  - `playstyles.json`
  - `compatibility-rules.json` (the seed-time default ruleset; LLM extends at runtime)

### Frontend → KEEP (restyled)

- `features/`: `browse`, `compatibility`, `dashboard`, `downloads`, `generation`, `landing`, `methodology`, `modlist`, `settings`, `setup`, `support`
- `core/services/`: `notification`, `theme`, `hardware-detector`, `key-detection` (util)

### Frontend → DELETE

- `features/auth/` (login, signup, OAuth callbacks)
- `core/services/auth.service.ts`
- `core/services/api.service.ts`
- `core/services/plugin-token.service.ts`
- `core/interceptors/auth.interceptor.ts`
- `core/interceptors/error.interceptor.ts`
- `core/guards/auth.guard.ts`
- All `Route.canActivate` references using `auth.guard`

### Frontend → REWIRE

- `core/services/generation.service.ts` — currently subscribes to backend SSE; replaced with a thin wrapper around `GenerationPipelineService`'s observable.

### MO2 plugin → REWORK

`plugins/mo2/moddersomni_import.py` reduces to:

1. File picker dialog (existing MO2 plugin API).
2. Parse selected JSON.
3. Queue installs through MO2's Nexus Mods integration (existing API).

Removed: HTTP client, plugin-token storage, token refresh, plugin auth flow, backend URL configuration. ~70% of the current code goes.

### Repo structure after refactor

```
ModdersOmni/
├── frontend/                       # Angular SPA — the entire app
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── motion/         # NEW — centralized easing/animation tokens
│   │   │   │   └── services/
│   │   │   │       ├── generation/ # NEW — ported pipeline
│   │   │   │       ├── llm/        # NEW — ported dispatcher
│   │   │   │       └── ...         # nexus, knowledge, spec-parser, install-guide
│   │   │   ├── features/
│   │   │   └── shared/
│   │   │       └── components/
│   │   │           └── ui/         # NEW — spartan-ng-based primitives
│   │   ├── styles.scss             # Tailwind 4 @theme block, OKLCH palette
│   │   └── index.html
│   ├── public/
│   │   ├── knowledge/              # MD files, copied from backend
│   │   └── data/                   # games, build-phases, playstyles, compat JSON
│   └── package.json
├── plugins/mo2/                    # MO2 plugin (rewritten for file-based import)
├── docs/superpowers/{plans,specs}/
├── .github/workflows/
│   ├── ci.yml                      # frontend-only
│   ├── changelog.yml
│   ├── deploy.yml                  # NEW — Cloudflare Pages deploy
│   ├── claude.yml
│   └── claude-code-review.yml
├── VERSION
├── CHANGELOG.md
├── cliff.toml
├── README.md
└── CLAUDE.md
```

`backend/`, `render.yaml`, `alembic/`, `alembic.ini` — gone.

## Error Handling

| Failure mode | Behavior |
|---|---|
| No LLM key configured for selected provider | Block generation start; route user to Settings with a clear message |
| LLM CORS / network error | Surface the raw error; offer "switch provider" guidance for known cases |
| LLM rate limit (HTTP 429) | Pause generation; show "rate limited, paste a different key or wait Nm"; resume button |
| LLM auth error (HTTP 401) | Pause generation; show "key invalid; update in Settings"; resume after fix |
| Nexus GraphQL transient failure | Retry with exponential backoff (3 tries) |
| Nexus GraphQL persistent failure | Show degraded-mode banner; LLM still generates but mod metadata flagged "unverified" |
| Pipeline crash mid-generation | localStorage snapshot persists; on next page load, offer resume |
| Ollama not reachable | Pre-flight ping in Setup wizard; if it fails, link to docs for `OLLAMA_ORIGINS=*` |
| localStorage quota exceeded | Show "device storage full; delete saved modlists" UI |

## Testing

- **Unit tests (Jasmine, in `frontend/src/`)**:
  - Generation pipeline with mocked `LLMDispatcher` and mocked `NexusService`
  - Knowledge resolver (port the existing Python test cases)
  - Spec parser
  - Modlist store CRUD
  - Install guide payload shape (snapshot tests)
- **Integration tests**: a real run against a live BYOK key, generating a SMALL modlist for Skyrim, verifying export JSON shape. Requires a key in env; skipped in CI unless `LLM_KEY` is set.
- **E2E manual loop** (per existing `project_e2e_loop_state.md` memory): full SMALL/MEDIUM generation for Skyrim and Fallout 4 against real LLM, verifying:
  - Phase progression and sub-pass behavior
  - Overseer review actually catches at least one bad phase result
  - MO2 export JSON imports successfully into MO2
- **Visual regression**: not automated. Manual review against design-system screenshots after each shared-primitive PR.

## CI / Deployment

**`.github/workflows/ci.yml`:**
- Drops the backend job entirely.
- Keeps `npm ci`, `ng build --configuration=production`, `ng lint` (soft), `ng test --watch=false --browsers=ChromeHeadless`.
- Hard-fails on `ng build`. Soft on lint/test.

**`.github/workflows/deploy.yml` (new):**
- Triggers on push to `main` after CI passes.
- Builds `frontend/`, uploads `dist/` to Cloudflare Pages via the existing Cloudflare API token.
- Generates `moddersomni-vX.Y.Z.zip` of `dist/` and uploads as a GitHub release artifact (mirroring to Nexus Mods is a manual step).

**`.github/workflows/changelog.yml`:** unchanged.
**`.github/workflows/claude*.yml`:** kept; independent of deployment.
**`render.yaml`:** deleted.

## Versioning

Unchanged rules: `VERSION` (root) is the single source of truth, `frontend/package.json` stays in sync, `feat:` bumps minor, `fix:` / `perf:` bumps patch. Bumped in the same commit as the change. The static-bundle release will be tagged **v2.0.0** (major bump justified by the architectural inversion).

## Migration Plan (Order of Operations)

The implementation plan (separate document, written next via the writing-plans skill) will follow this order. Each step is independently mergeable.

1. **Knowledge & static data setup**
   - Copy `backend/app/knowledge/*.md` to `frontend/public/knowledge/`.
   - Generate `frontend/public/data/{games,build-phases.<game>,playstyles,compatibility-rules}.json` from current DB seed.
   - Port `KnowledgeService` to TypeScript with tests.
2. **Nexus client port** — TS implementation of `NexusModsClient`, with tests against the live unauthenticated endpoint.
3. **LLM dispatcher port** — pruned to 6 providers, with mock LLM tests covering each provider's request/response shape.
4. **Generation pipeline port** — handlers, tools, sub-pass, reviewer; behind a feature flag (`useClientPipeline`) so the existing backend can run in parallel during transition.
5. **Wire generation UI to client pipeline** — replace SSE consumer with RxJS observable from `GenerationPipelineService`.
6. **Modlist store** — localStorage CRUD; migrate dashboard to read from local store instead of API.
7. **Frontend redesign — Phase 1: tokens & primitives**
   - 7a. Tailwind 4 `@theme` block with OKLCH palette; replace scattered CSS variables.
   - 7b. Install spartan-ng + lucide-angular; build shared primitives in `shared/components/ui/`.
   - 7c. Update `index.html` fonts: drop Playfair, add Instrument Serif + JetBrains Mono.
8. **Frontend redesign — Phase 2: feature migrations** — one PR per feature, in order: landing → setup → settings → generation → modlist → dashboard → compatibility → support → methodology → browse → downloads.
9. **Frontend redesign — Phase 3: surface & motion** — strip glassmorphism, sharp tactile surfaces, centralized motion tokens, generation page "stack building" animation.
10. **Strip auth** — delete `features/auth/`, `auth.service`, `auth.interceptor`, `auth.guard`, all auth routes; make all routes public.
11. **MO2 plugin rework** — file-picker import flow; remove HTTP/auth code.
12. **CF Pages deploy workflow** — verify deploy from a feature branch first.
13. **Backend deletion** — remove `backend/`, `render.yaml`, alembic config; update root scripts and CI workflows. Remove the `useClientPipeline` feature flag.
14. **Docs** — update `README.md`, `CLAUDE.md`, Nexus Mods page copy.
15. **Final E2E pass** — full generation + export for both games against real BYOK key.
16. **Cut v2.0.0 release** — bump `VERSION`, regenerate `CHANGELOG`, deploy to Cloudflare Pages, upload Nexus zip.

## Open Risks

- **Ollama setup friction.** Many users won't know how to set `OLLAMA_ORIGINS=*`. Mitigation: explicit Setup wizard step with copy-paste-ready commands per OS, plus a "test connection" button.
- **LLM key leakage anxiety.** Users may worry about pasting API keys into a downloadable HTML. Mitigation: clear in-app messaging — "keys stored only in your browser's localStorage; the app makes no calls to any server other than your chosen LLM provider and Nexus Mods."
- **CORS surprises.** Provider CORS policies can change. Mitigation: a weekly smoke test (free GitHub Action cron) that hits each provider's CORS preflight from a static page and alerts on regression.
- **Knowledge base updates.** Currently knowledge file changes require a backend redeploy. Going forward, they require an Angular rebuild + CF Pages deploy. Acceptable given low change frequency.
- **localStorage cap.** A user with many large modlists could approach 5–10 MB. Mitigation: store only essentials in modlist JSON (`mod_id`, `file_id`, `install_order`, `notes`); fetch fresh metadata from Nexus on display.

## Security Considerations

- **No server, no server-side secrets.** No tokens, JWTs, OAuth client secrets, DB credentials.
- **LLM keys** stored in `localStorage`, never transmitted anywhere except the user's chosen provider's endpoint.
- **No telemetry.** No analytics, no error reporting to a third party.
- **CSP headers** on Cloudflare Pages: `connect-src` allows only the 6 LLM provider endpoints, the Nexus GraphQL endpoint, and `localhost` for Ollama.
- **Subresource Integrity (SRI)** on all third-party CDN links (Google Fonts, etc.).
