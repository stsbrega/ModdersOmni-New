# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

ModdersOmni is an AI-powered game modding assistant. Users input their PC hardware specs and gameplay preferences, then an LLM generates a personalized mod list by searching Nexus Mods in real time. Currently supports Skyrim SE/AE and Fallout 4.

## Tech Stack

- **Frontend**: Angular 19.2 (standalone components, no NgModules) + Tailwind CSS 4 + inline SCSS
- **Backend**: Python 3.12 + FastAPI 0.115 + SQLAlchemy 2.0 (async) + Pydantic 2
- **Database**: PostgreSQL 16 (asyncpg)
- **Auth**: JWT (python-jose) + bcrypt (direct, not passlib — passlib is incompatible with bcrypt 4+/Python 3.13+) + OAuth (authlib — Google, Discord) + email verification (fastapi-mail)
- **LLM**: OpenAI-compatible SDK supporting 12 providers (Anthropic, OpenAI, Gemini, Gemini Pro, Groq, Groq Scout, Together AI, DeepSeek, Mistral, Qwen, Cerebras, OpenRouter)
- **Mod API**: Nexus Mods v2 GraphQL API (per-user API keys)
- **Deployment**: Render (Python backend, static frontend, managed PostgreSQL). Defined in `render.yaml`.

## Common Commands

### Backend (run from `backend/`)

```bash
pip install -r requirements.txt          # Install deps
uvicorn app.main:app --reload            # Dev server (localhost:8000)
python -m app.seeds.run_seed             # Create tables + seed data
ruff check app/                          # Lint (hard-fail in CI)
mypy app/ --ignore-missing-imports --no-strict-optional  # Type check
pytest tests/ -v                         # Tests (require PostgreSQL or aiosqlite)
```

### Local Dev Environment
- Local Python is 3.14; `requirements.txt` pins versions for Render (Python 3.12). Install deps individually (`pip install <pkg>`) if pinned versions fail to build.
- Running tests requires `aiosqlite` (not in requirements.txt): `pip install aiosqlite`
- `conftest.py` imports `app.main` which chains all app imports — all backend deps must be installed even for pure unit tests
- `ruff` is not on PATH locally — use `python -m ruff check app/` instead of `ruff check app/`
- Always run ruff before pushing — `ruff check` is a hard-fail in CI (unused imports = F401 are the most common cause)

### Frontend (run from `frontend/`)

```bash
npm install                              # Install deps
npm start                                # Dev server (localhost:4200, proxies /api to :8000)
npx ng build --configuration=production  # Production build (hard-fail in CI)
npm test                                 # Karma/Jasmine tests
```

### CI (GitHub Actions — `.github/workflows/`)

Main CI (`ci.yml`) runs on push/PR to main:
- Backend: `ruff check` (hard-fail), `mypy` (soft), `pytest` (hard-fail, graceful if no tests)
- Frontend: `ng build --configuration=production` (hard-fail), `ng lint` (soft)

PostgreSQL service container used for backend tests. Health check: `pg_isready -U modify -d modify_test`.

Additional workflows: `Codex-review.yml` (AI code review on PRs), `Codex.yml` (Codex PR assistant).

## Architecture

### Generation Pipeline (Core Feature)

The generation system is the heart of the app — an LLM searches Nexus Mods in real time and builds a modlist phase by phase.

**Flow**: `POST /api/generation/start` → background task → SSE streaming → `GET /api/generation/{id}/events`

**Key files**:
- `backend/app/api/generation.py` — HTTP endpoints (start, events SSE, status polling, resume)
- `backend/app/services/generation_manager.py` — In-memory singleton tracking all active generations (events, subscribers, status)
- `backend/app/services/generation/` — Core generation package (refactored from monolithic `modlist_generator.py`):
  - `pipeline.py` — Main phased generation loop
  - `tools.py` — LLM tool definitions (search_nexus, add_to_modlist, etc.)
  - `prompts.py` — System/user prompt construction
  - `session.py` — GenerationSession dataclass (state for pause/resume)
  - `handlers.py` — Tool call handlers
  - `exceptions.py` — PauseGeneration and other generation-specific exceptions
  - `version.py` — Generation format versioning
  - `reviewer.py` — Gemini Pro overseer: per-phase quality review of mod selections (removes/flags unsuitable mods)

**Phased architecture**: Each game has ordered `ModBuildPhase` records in the DB (e.g., Skyrim has ~10 phases: Essentials → UI → Textures → Gameplay → Combat → Environment → ... → Compatibility Patches). The LLM processes one phase at a time.

**Tool-calling loop**: The LLM has tools: `search_nexus`, `get_mod_details`, `add_to_modlist`, `finalize`. For the final patch-review phase: `search_patches`, `add_patch`, `flag_user_knowledge`, `finalize_review`. The loop runs until the LLM calls `finalize`.

**SSE streaming**: Events are emitted via `GenerationManager.emit()` → stored in list + pushed to subscriber queues. Frontend subscribes via `EventSource`. Events replay on reconnect (reconnection-safe). Event types: `phase_start`, `phase_complete`, `thinking`, `searching`, `mod_added`, `provider_error`, `provider_switch`, `paused`, `complete`, `error`.

**Multi-provider fallback**: If provider A fails on a phase, tries provider B from user's configured keys. If all fail, emits `paused` event. `GenerationSession` dataclass captures full state (modlist, patches, knowledge flags, completed phases, description cache) for resume.

**Pause/resume**: `PauseGeneration` exception carries `session_snapshot`. Frontend can `POST /api/generation/{id}/resume` to restart from the paused phase with potentially different API keys.

### LLM Provider System

**Files**: `backend/app/llm/provider.py` (abstract base + OpenAI-compatible impl), `backend/app/llm/registry.py` (provider catalog)

Registry pattern — 12 providers with id, name, model, base_url, type, placeholder, hint_url, key_prefixes, context_window. Compatible-provider groups (groq/groq_scout, gemini/gemini_pro) share API keys — handled by `_COMPATIBLE_PROVIDERS` mapping. Factory: `LLMProviderFactory.create_from_request(provider_id, api_key, base_url, model)`. Anthropic uses native API; all others use OpenAI-compatible format.

Key methods: `generate(system_prompt, user_prompt)` for simple completions, `generate_with_tools(messages, tools, tool_handlers, max_iterations)` for the tool-calling loop used in generation.

### Smart Dispatcher

**File**: `backend/app/llm/dispatcher.py` — Routes each build phase to the optimal LLM model based on user tier (Free/BYOK/Credits), phase complexity, and available resources (API keys, credit balance). Classifies models into tiers: free, budget, standard, premium.

### Modding Knowledge Base

**Directory**: `backend/app/knowledge/` — Phase-targeted methodology context injected into LLM prompts.

- `resolver.py` — Parses structured markdown at import time, returns relevant sections for each generation phase
- `skyrim.md`, `fallout4.md` — Per-game modding methodology (phase-specific guidance, compatibility rules, load order principles)
- `modding_common.md` — Cross-game modding knowledge shared across all games

### Nexus Mods Integration

**File**: `backend/app/services/nexus_client.py` — GraphQL client for Nexus Mods v2 API.

- Semaphore: max 10 concurrent requests
- Retry: exponential backoff (rate limits: 5s/10s/20s; server errors: 3s/6s/12s)
- Per-user API keys (no server-side fallback) — user must provide their own key in Settings

### Frontend Architecture

Angular 19 standalone components with feature-based organization. Key routing:

| Route | Component | Auth |
|-------|-----------|------|
| `/setup` | Hardware detection + playstyle + Nexus key + AI provider config | Optional (redirects to register on generate) |
| `/generate/:id` | Real-time SSE streaming UI | Required |
| `/modlist/:id` | View generated modlist | Public |
| `/dashboard` | User's saved modlists | Required |
| `/settings` | LLM provider & API key management | Required |

**Generation streaming**: `core/services/generation.service.ts` wraps `EventSource` for SSE. The generation component (`features/generation/`) renders events in real time with animations.

**Setup wizard**: `features/setup/steps/playstyle-select/` contains the main wizard step with game selection, playstyle choice, Nexus API key input, and AI provider key configuration. Keys are saved to user profile via `PUT /api/settings/`. Generation is gated on both Nexus key and at least one LLM provider key.

**LLM API Key storage**: All LLM keys are stored in the `llm_api_keys` JSON column (single source of truth) via `PATCH /api/settings/llm-keys`. Legacy per-provider columns (`groq_api_key`, `together_api_key`, etc.) in `UserSettings` are deprecated — not read or written, kept only to avoid a DB migration. Keys are entered in 3 places (Settings page, Setup wizard, Generation pause form) — all write to the same JSON column.

**Provider auto-detection**: `core/utils/key-detection.ts` exports `detectProvider(key, providers)` — matches API key prefixes from the provider registry to identify the provider. Use this instead of parsing model names or error messages.

**API base URL**: Reads `window.__env.API_URL` (generated at build time on Render) with fallback to `/api` (proxied to localhost:8000 in dev via `proxy.conf.json`).

## Project Structure

```
backend/
  app/
    api/              # FastAPI route handlers
      auth.py         #   /auth/* — register, login, OAuth, email verify, password reset
      generation.py   #   /generation/* — start, SSE events, status, resume
      modlist.py      #   /modlist/* — retrieve modlists
      credits.py      #   /credits/* — credit balance, purchase, usage
      plugin.py       #   /plugin/* — plugin token auth
      settings.py     #   /settings/ — user settings (Nexus key, LLM keys)
      games.py        #   /games/ — game list, playstyles
      specs.py        #   /specs/parse — hardware text parsing
      stats.py        #   /stats/ — landing page metrics
      deps.py         #   JWT dependency injection (get_current_user eagerly loads User.settings)
    models/           # SQLAlchemy ORM (User, UserSettings, UserOAuthProvider, Modlist, ModlistEntry, ModBuildPhase, Game, Playstyle, PlaystyleMod, Credit, PluginToken, RefreshToken, EmailVerification, Compatibility)
    schemas/          # Pydantic request/response schemas
    services/         # Business logic
      generation/           # Core: phased LLM tool-calling generation (package)
        pipeline.py         #   Main generation loop
        tools.py            #   LLM tool definitions
        prompts.py          #   Prompt construction
        session.py          #   GenerationSession state
        handlers.py         #   Tool call handlers
        exceptions.py       #   PauseGeneration etc.
        version.py          #   Format versioning
        reviewer.py         #   Gemini Pro per-phase quality reviewer
      generation_manager.py # In-memory generation state + SSE event dispatch
      account_cleanup.py    # Background task: inactive account warning + deletion
      nexus_client.py       # Nexus Mods v2 GraphQL client
      custom_source_client.py # Custom mod source client
      credit_service.py     # Credit balance, purchase, usage logic
      plugin_auth.py        # Plugin token authentication
      auth.py               # JWT creation/validation, password hashing
      email.py              # SMTP email sending
      oauth.py              # OAuth provider abstraction (Google, Discord)
      spec_parser.py        # Hardware text parsing (regex-based)
      tier_classifier.py    # GPU/CPU tier classification (low/mid/high/ultra)
    knowledge/            # Modding methodology knowledge base
      resolver.py         #   Phase-targeted methodology resolver (parsed at import time)
      skyrim.md           #   Skyrim SE/AE modding methodology
      fallout4.md         #   Fallout 4 modding methodology
      modding_common.md   #   Cross-game modding fundamentals
    llm/              # LLM provider abstraction
      provider.py     #   Abstract base + OpenAI-compatible + Anthropic implementations
      registry.py     #   Provider catalog (12 providers)
      dispatcher.py   #   Smart model routing by user tier + phase complexity
    seeds/            # Database seed data (run_seed.py creates tables + seeds games/playstyles/phases)
    config.py         # Settings via pydantic-settings (.env)
    database.py       # SQLAlchemy async engine + session factory
    main.py           # FastAPI app entry + lifespan (DB init, seed, CORS)
  tests/              # pytest + pytest-asyncio
  alembic/            # Migration config (not actively used — seed uses create_all)

frontend/
  src/app/
    core/
      services/       # ApiService, AuthService, GenerationService, NotificationService, ThemeService, CreditService, PluginTokenService, HardwareDetectorService
      interceptors/   # AuthInterceptor (JWT header), ErrorInterceptor
      guards/         # authGuard, guestGuard
      utils/          # key-detection (auto-detect LLM provider from pasted API key)
    shared/
      components/     # header, notification-toast, api-key-guide
      models/         # TypeScript interfaces (auth, credit, game, generation, mod, specs)
    features/
      auth/           # Login, register, OAuth callback, email verify, password reset
      setup/          # Hardware setup wizard (game-select, spec-input, playstyle-select)
      generation/     # Real-time SSE streaming UI during modlist generation
      modlist/        # Generated mod list view
      credits/        # Credits balance and purchase UI
      dashboard/      # User's saved modlists
      settings/       # User settings
      landing/        # Landing page
    app.routes.ts     # Top-level routing
    app.config.ts     # App config (providers, interceptors)
  proxy.conf.json     # Dev proxy: /api → localhost:8000
  public/env-config.js # Runtime API URL (generated on Render)
```

## Code Conventions

### Backend
- Async throughout (`async def`, `await`)
- Models in `models/`, Pydantic schemas in `schemas/`, business logic in `services/`
- All API routes prefixed with `/api/`
- `ruff` for linting, `black` for formatting
- `get_current_user` dependency (in `deps.py`) eagerly loads `User.settings` via `selectinload` — no extra DB query needed in endpoints
- `PUT /api/settings/` uses `AppSettingsUpdate` (Optional fields) for partial updates — callers can send only the fields they want to change. `GET` returns `AppSettings` (concrete values with defaults). Don't add non-Optional defaults to `AppSettingsUpdate` or partial updates will silently reset unmentioned fields.

### Frontend
- Angular 19 standalone component API (no NgModules)
- Feature components use **inline templates and styles** (single `.ts` files)
- CSS custom properties defined in `styles.scss` for theming; component styles use inline SCSS
- Fonts: DM Sans (body) + Playfair Display (headings) via Google Fonts — use simple weight syntax (`wght@300;400;500;600;700`), NOT variable font axis syntax (causes 400 errors during Angular font inlining)
- `authInterceptor` uses `inject(Injector)` + lazy `injector.get(AuthService)` to avoid circular DI (AuthService → HttpClient → interceptor → AuthService). Do NOT change this to direct `inject(AuthService)`.
- After modifying frontend files, if dev server shows stale behavior, clear `.angular/cache` and restart (`rm -rf frontend/.angular/cache`)

## Environment Variables (Local Dev)

Backend reads `backend/.env` via pydantic-settings. Minimum for local dev:

```env
DATABASE_URL=postgresql+asyncpg://modify:modify@localhost:5432/modify
SECRET_KEY=any-random-string
```

Optional — enable specific features:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Free-tier generation (Gemini 2.5 Flash) |
| `GEMINI_PRO_API_KEY` | Free-tier reviewer (Gemini 2.5 Pro) — falls back to `GEMINI_API_KEY` |
| `GROQ_API_KEY` | Free-tier generation (Groq) |
| `CEREBRAS_API_KEY` | Free-tier generation (Cerebras) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Email verification |

**Free-tier architecture**: Users without BYOK keys get server-side free models (Gemini Flash, Groq, Cerebras). The smart dispatcher (`llm/dispatcher.py`) routes phases to the best available free model. Gemini Pro acts as a per-phase quality reviewer when its key is set.

## Deployment

- **Frontend**: `https://moddersomni.com` (Cloudflare Pages, serving `frontend/dist/frontend/browser`)
- **Backend**: `https://api.moddersomni.com/api` (Render, Python 3.12 native runtime — first-party subdomain CNAMEd to `moddersomni-api-53il.onrender.com`)
- **Database**: Managed PostgreSQL 16 on Render

Backend infrastructure defined in `render.yaml`. Push to `main` auto-deploys both backend (Render) and frontend (Cloudflare Pages). Pre-deploy runs `python -m app.seeds.run_seed`.

Env vars marked `sync: false` in `render.yaml` must be set manually in Render dashboard: OAuth credentials (Google, Discord), SMTP credentials, `GROQ_API_KEY`.

Ollama (local LLM) does not work on Render — use cloud providers.

## Versioning

The app version lives in `VERSION` (root) — this is the single source of truth. `frontend/package.json` must stay in sync.

**When committing work that adds a feature, fixes a bug, or makes a notable change, bump the version:**
- `feat:` commits → bump **minor** (0.1.0 → 0.2.0)
- `fix:` / `perf:` commits → bump **patch** (0.1.0 → 0.1.1)
- Multiple changes in one commit → use the highest bump

**How to bump:** Update both `VERSION` and `frontend/package.json` `"version"` field in the same commit as the change. Do not create a separate version-bump commit.

**Changelog:** Auto-generated by GitHub Actions (`.github/workflows/changelog.yml` + `cliff.toml`) on push to `main`. Do not manually edit `CHANGELOG.md`.

## Content Filtering Note

When generating code or text related to custom mod sources, use generic terms like "custom mod source" rather than naming specific adult content sites. The Anthropic API blocks responses containing explicit site references.
