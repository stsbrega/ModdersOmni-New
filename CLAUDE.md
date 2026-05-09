# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ModdersOmni is an AI-powered game modding assistant. Users describe their hardware and playstyle; an LLM searches Nexus Mods in real time and builds a personalized modlist phase by phase. Supports Skyrim SE/AE and Fallout 4. Currently at **v1.0.0**.

**Stack**: Angular 19 (standalone components) + Tailwind CSS 4 | Python 3.12 + FastAPI 0.115 + SQLAlchemy 2.0 (async) | PostgreSQL 16 (asyncpg) | Deployed on Render.

**Repo layout**:
- `backend/` — FastAPI app (`app/`), Alembic migrations (`alembic/`), tests (`tests/`)
- `frontend/` — Angular 19 SPA
- `plugins/mo2/moddersomni_import.py` — Mod Organizer 2 plugin (installs a generated modlist)
- `docs/superpowers/{plans,specs}/` — feature planning/spec docs
- `.github/workflows/` — CI (`ci.yml`), auto-changelog (`changelog.yml`), Claude bots (`claude.yml`, `claude-code-review.yml`)
- `cliff.toml` — git-cliff config for auto-generated CHANGELOG
- `render.yaml` — Render deployment (Postgres + web service)

## Common Commands

### Backend (run from `backend/`)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload          # Dev server on localhost:8000
python -m app.seeds.run_seed           # Create tables + seed data
python -m ruff check app/              # Lint — ruff is NOT on PATH locally, use python -m
pytest tests/ -v                       # Tests (needs aiosqlite: pip install aiosqlite)
mypy app/ --ignore-missing-imports --no-strict-optional
```

### Frontend (run from `frontend/`)

```bash
npm install
npm start                              # Dev server on localhost:4200 (proxies /api → :8000)
npx ng build --configuration=production
npm test
```

### Single test

```bash
# Backend
pytest tests/test_auth_service.py -v

# Frontend — Karma runs all; no built-in single-test shortcut
```

## Architecture

### Generation Pipeline (Core Feature)

`POST /api/generation/start` → background task → SSE streaming → `GET /api/generation/{id}/events`

The LLM processes a game's ordered `ModBuildPhase` records one at a time (Skyrim: ~10 phases — Essentials → ... → Compatibility Patches). Within each phase it runs a tool-calling loop: `search_nexus`, `get_mod_details`, `add_to_modlist`, `finalize`. A Gemini Pro overseer (`reviewer.py`) independently reviews each phase's selections before the pipeline advances.

Key files in `backend/app/services/generation/`:
- `pipeline.py` — Main phased loop
- `session.py` — `GenerationSession` dataclass; full state captured for pause/resume
- `handlers.py` / `tools.py` — Tool call execution
- `reviewer.py` — Per-phase Gemini Pro quality reviewer
- `preset.py` — `SizePreset` enum (SMALL/MEDIUM/LARGE/MASSIVE/ULTIMATE). Multiplier applied to each phase's `max_mods * scale_weight`. Free tier is capped at SMALL/MEDIUM; LARGE+ requires BYOK.
- `sub_pass.py` — When a phase's effective cap exceeds `PER_SUB_PASS_MAX` (25), split into N sub-passes so each LLM turn starts with fresh context plus a compact "already added" summary. Prevents in-context drift past ~25 items.
- `prompts.py` — System/phase prompt construction
- `version.py` — Pipeline version tag recorded on each run
- `exceptions.py` — `PauseGeneration` carries `session_snapshot` for resume

`GenerationManager` (`services/generation_manager.py`) is an in-memory singleton that stores events and subscriber queues. SSE events replay on reconnect.

### LLM / Dispatcher

`backend/app/llm/registry.py` — **14 providers** in `PROVIDER_REGISTRY`: `anthropic`, `openai`, `gemini`, `gemini_pro`, `groq`, `groq_scout`, `together`, `deepseek`, `mistral`, `qwen`, `cerebras`, `openrouter`, `ollama`, `ollama_cloud`. Anthropic uses the native API; all others use OpenAI-compatible format. Compatible-provider groups (`groq`/`groq_scout`, `gemini`/`gemini_pro`) share API keys via `_COMPATIBLE_PROVIDERS`.

`backend/app/llm/dispatcher.py` — Routes each phase to the optimal model by user tier (Free/BYOK/Credits) and phase complexity.

### Knowledge Base

`backend/app/knowledge/` — Hybrid Markdown+XML files injected into LLM prompts. `resolver.py` parses at import time and returns only sections relevant to the current phase (keeps token cost under ~4,700). Inject `modding_common.md` + the game-specific file; never cross-inject.

### API Surface

11 routers registered in `backend/app/main.py`, all under `/api`:
`auth`, `specs`, `games`, `modlist`, `settings`, `stats`, `generation`, `compatibility`, `plugin`, `nexus/oauth`, `user`. Plus `GET /api/health` for readiness.

### Lifespan Background Tasks

`main.py` starts two long-running loops on app startup (in addition to `init_db`):
- `_run_account_cleanup_loop` — periodic inactive-account warning/deletion (`services/account_cleanup.py`); interval from `account_cleanup_interval_hours`.
- `_run_nexus_token_refresh_loop` — refreshes Nexus OAuth tokens every ~2 min before the 5-min expiry window (`services/nexus_token_refresh.py`).

Both are cancelled on shutdown. DB failures are logged but do not crash the app — `/api/health` reports `db_ready`.

### Frontend

Angular 19 standalone components, feature-based under `src/app/features/`. Components use **inline templates and styles** (single `.ts` files). Key services in `src/app/core/services/`.

Feature modules: `auth`, `compatibility`, `dashboard`, `generation`, `landing`, `methodology`, `modlist`, `settings`, `setup`, `support`. Structure also includes `core/{guards,interceptors,services,utils}/` and `shared/{components,models}/`.

`core/utils/key-detection.ts` → `detectProvider(key, providers)` — use this to identify LLM providers from pasted API keys; don't parse model names or error messages.

API base URL: `window.__env.API_URL` with fallback to `/api` (dev proxy in `proxy.conf.json`).

### MO2 Plugin

`plugins/mo2/moddersomni_import.py` is a standalone Mod Organizer 2 plugin that imports a generated modlist. It authenticates via the `/api/plugin` router (plugin tokens, model `PluginToken`).

### Nexus Mods integration

**Do NOT reintroduce personal Nexus API keys.** Nexus Support (Kurtis, Apr 2026) confirmed that personal API keys are forbidden in public-facing applications. Reads go through the unauthenticated Nexus GraphQL v2 endpoint (`https://api.nexusmods.com/v2/graphql`) — `NexusModsClient()` takes no arguments. Writes (collection publishing, file downloads) use OAuth2 (`https://users.nexusmods.com/oauth/authorize` + `/token`) with a registered app client_id; per-user tokens exchanged via Authorization Code + PKCE, stored in the `user_nexus_token` table, refreshed by `services/nexus_token_refresh.py`. HTTP flow lives in `api/nexus_oauth.py` + `services/nexus_oauth.py`. There is no Nexus key field in user settings, no `/validate-nexus-key` endpoint, and no `apikey` header on any request.

## Non-Obvious Gotchas

### Backend

- **`bcrypt`/`passlib` incompatibility**: Use `bcrypt` directly — passlib is incompatible with bcrypt 4+ / Python 3.13+. Don't introduce passlib.
- **`AppSettingsUpdate` uses Optional fields intentionally** for partial updates. Callers send only changed fields. Never add non-Optional defaults to `AppSettingsUpdate` — it will silently reset unmentioned fields.
- **`get_current_user` dep** (in `deps.py`) eagerly loads `User.settings` via `selectinload` — no extra DB query needed in endpoints.
- **Local Python is 3.14** but `requirements.txt` pins versions for Render (Python 3.12). If pinned versions fail to build locally, install deps individually.
- **`ruff` is not on PATH locally** — always use `python -m ruff check app/`. Unused imports (F401) are the most common CI failure.
- **`conftest.py` imports `app.main`** which chains all app imports — all backend deps must be installed even for pure unit tests.
- **Alembic is the active schema manager.** 7 migrations currently in `backend/alembic/versions/` (baseline `3bafe21fc9f7_baseline_v0_9_0`, `6510883aa7bd_playstyle_icons`, `0bb29e20bfe6_v1_0_scale_and_sizes`, `001_add_storage_drives`, `002_modlist_agentic`, `003_add_llm_api_keys_json`, `004_add_mod_build_phases`). Apply with `alembic upgrade head` (runs in Render pre-deploy). `Base.metadata.create_all()` is intentionally not called in the lifespan — schema changes MUST be added via `alembic revision --autogenerate -m "…"` and reviewed before commit.
- **Idempotent inline migrations** (`_apply_migrations` in `seeds/run_seed.py`) still run every startup for safety on fresh DBs. Prefer Alembic for new changes.

### Frontend

- **`authInterceptor`** uses `inject(Injector)` + lazy `injector.get(AuthService)` to avoid circular DI. Do NOT change this to direct `inject(AuthService)`.
- **LLM API keys single source of truth**: `llm_api_keys` JSON column via `PATCH /api/settings/llm-keys`. Legacy per-provider columns on `UserSettings` (`groq_api_key`, `llm_provider`, `ollama_*`, `together_*`, `huggingface_*`, `custom_source_api_*`) have been removed from the model. Three UI entry points (Settings, Setup wizard, Generation pause form) all write to the `llm_api_keys` JSON column.
- **Stale dev server**: After modifying frontend files, if behavior seems stale: `rm -rf frontend/.angular/cache` and restart.
- **Google Fonts syntax**: Use simple weight syntax (`wght@300;400;500;600;700`), NOT variable font axis syntax — variable syntax causes 400 errors during Angular font inlining.
- **Fonts**: DM Sans (body) + Playfair Display (headings).

## Environment Variables (Local Dev)

Create `backend/.env`. Minimum:

```env
DATABASE_URL=postgresql+asyncpg://modify:modify@localhost:5432/modify
SECRET_KEY=any-random-string
```

Free-tier LLM features need: `GEMINI_API_KEY`, optionally `GEMINI_PRO_API_KEY` (falls back to `GEMINI_API_KEY`). Do NOT add `NEXUS_API_KEY` — the app reads Nexus data unauthenticated per their API policy.

## Versioning Rules

Version lives in `VERSION` (root) — single source of truth. Currently `1.0.0`. `frontend/package.json` must stay in sync.

- `feat:` commits → bump **minor** (1.0.0 → 1.1.0)
- `fix:` / `perf:` commits → bump **patch** (1.0.0 → 1.0.1)
- Bump in the **same commit** as the change — not a separate commit.
- `CHANGELOG.md` is auto-generated by GitHub Actions via `git-cliff` (see `cliff.toml`) — **do not edit manually**.

## CI (GitHub Actions)

Workflows in `.github/workflows/`:
- `ci.yml` — backend ruff lint, mypy (soft), pytest; frontend `ng build --configuration=production`, `ng lint` (soft)
- `changelog.yml` — `git-cliff` auto-generates `CHANGELOG.md` on push to main
- `claude-code-review.yml` — Claude reviews PRs automatically
- `claude.yml` — Claude responds to `@claude` mentions in comments/reviews

Hard-fail: `ruff check`, `pytest`, `ng build --configuration=production`
Soft: `mypy`, `ng lint`

PostgreSQL service container used for backend tests. Health check: `pg_isready -U modify -d modify_test`.

## Content Filtering

When generating code referencing custom mod sources, use generic terms ("custom mod source") rather than naming specific adult content sites — the Anthropic API blocks responses with explicit site references.
