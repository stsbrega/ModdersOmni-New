# Test Coverage Analysis & Improvement Plan

_Date: 2026-04-22_

## Current State

### Backend (`backend/tests/`)

14 test modules covering ~focused units:

| File | Scope |
| --- | --- |
| `test_auth_service.py` | bcrypt hashing, JWT create/decode, email + password-reset tokens |
| `test_dispatcher.py` | `dispatcher.py` phase→model routing |
| `test_generation_gate.py` | BYOK key validation gate at `/api/generation/start` |
| `test_generation_manager.py` | In-memory event store / subscriber queues |
| `test_generation_complete_email.py` | Completion email dispatch |
| `test_llm_registry.py` | `PROVIDER_REGISTRY` integrity, compatible-provider groups |
| `test_oauth.py` | OAuth state cookies, PKCE flow |
| `test_preset.py` | Preset enums + multipliers |
| `test_size_summary.py` | `GET /api/modlist/{id}/size-summary` |
| `test_spec_parser.py` | Spec file parsing |
| `test_sub_pass.py` | Sub-pass loop count / cap math |
| `test_tier_classifier.py` | Hardware tier classification |
| `test_account_deletion.py` | Cascade deletion of user data |
| `test_health.py` | `/api/health` readiness |

### Frontend (`frontend/src/`)

**0 `.spec.ts` files.** Karma is wired in `angular.json` but no specs exist for:
- 7 core services (`api`, `auth`, `generation`, `hardware-detector`, `notification`, `plugin-token`, `theme`)
- 21 feature components (auth flow, setup wizard, dashboard, generation, modlist, settings, etc.)
- Interceptors (`authInterceptor` — has a known DI gotcha, see `CLAUDE.md`)
- Guards
- Utilities including `core/utils/key-detection.ts` (`detectProvider`)

### MO2 Plugin (`plugins/mo2/`)

No tests for `moddersomni_import.py`.

## Critical Gaps

### Tier 1 — High blast radius, no coverage

1. **Generation pipeline core** (`backend/app/services/generation/`)
   - `pipeline.py` (~741 LOC) — orchestrates the entire phased loop, pause/resume via `PauseGeneration`, version tagging. **Untested end-to-end.**
   - `handlers.py` (~525 LOC) — executes `search_nexus` / `get_mod_details` / `add_to_modlist` / `finalize` tool calls. **Untested.**
   - `reviewer.py` (~539 LOC) — Gemini Pro per-phase reviewer. **Untested.**
   - `prompts.py` — phase prompt construction with knowledge-base injection. **Untested.**
   - `session.py` — `GenerationSession` snapshotting (the basis of resume). **No round-trip tests.**

2. **LLM provider layer** (`backend/app/llm/provider.py`)
   - Streaming, retry/backoff, error mapping across 14 providers. Only the registry is smoke-tested today. A regression here breaks every paid path silently.

3. **Auth router HTTP layer** (`backend/app/api/auth.py`, ~719 LOC)
   - `test_auth_service.py` covers token primitives but not the 15+ endpoints: register, login, password reset, email verify, OAuth callbacks, hardware reporting, profile mutations. Negative-path tests (expired tokens, replay, wrong user) absent.

4. **Background lifespan tasks**
   - `services/account_cleanup.py` — periodic warning + deletion of inactive accounts. Cascade is tested, but the loop's selection criteria, idempotency, and error swallowing are not.
   - `services/nexus_token_refresh.py` — refreshes OAuth tokens before the 5-min expiry. A bug here logs out every Nexus-linked user.

### Tier 2 — Moderate risk

5. **Nexus + custom-source clients**
   - `nexus_client.py` (GraphQL v2) and `custom_source_client.py` have no parser/error-mapping tests. Easy to regress when Nexus tweaks their schema.
   - `nexus_collections.py` (publishing path) untested.

6. **Plugin auth**
   - `api/plugin.py` (~145 LOC) + `services/plugin_auth.py` — token issuance, scoping, revocation. Breaking this lets stale tokens read modlists.

7. **Other routers**
   - `compatibility.py`, `games.py`, `modlist.py` (mutations), `settings.py` (the `llm_api_keys` JSON column merge logic — risk of silently wiping keys per the `AppSettingsUpdate` gotcha), `specs.py`, `stats.py`, `user.py`.

8. **Knowledge resolver** (`backend/app/knowledge/resolver.py`)
   - Section-selection logic gates the prompt token budget (~4,700 cap). No regression test for cross-game leakage (`modding_common.md` + game-specific only).

### Tier 3 — Frontend (entire surface)

9. **Angular services** — zero coverage. Highest-value targets:
   - `auth.service.ts` + `authInterceptor` (DI ordering matters, per CLAUDE.md)
   - `generation.service.ts` — SSE reconnection / event replay
   - `api.service.ts` — base URL resolution (`window.__env.API_URL` fallback)
   - `core/utils/key-detection.ts` `detectProvider()` — pure function, trivial to test, currently the only sanctioned way to identify providers from pasted keys.

10. **Auth flow components** — login, register, forgot/reset/verify, OAuth callback. These are the front door.

11. **Settings + Setup wizard + Generation pause form** — three UI entry points all writing to `llm_api_keys` (per CLAUDE.md). A merge bug wipes keys across all three.

## Proposed Improvements (priority order)

### P0 — This sprint

- **Pipeline integration tests with mocked LLM/Nexus**: Drive `pipeline.py` through a 2-phase scripted run; assert tool calls, reviewer invocation, event emission, pause+resume snapshot round-trip. Stub `dispatcher` and `NexusModsClient`.
- **`handlers.py` unit tests**: Each tool handler in isolation with a fake session; verify modlist mutation, finalize semantics, and error paths (Nexus 404, malformed args).
- **Auth router HTTP tests** using FastAPI `TestClient` + `aiosqlite`: register/login happy path, password reset replay protection, expired email-verify tokens, OAuth callback with mismatched state.
- **Frontend test bootstrapping**: add `auth.service.spec.ts`, `authInterceptor.spec.ts`, `key-detection.spec.ts`, `api.service.spec.ts`. Wire into `ci.yml` as a hard-fail step (`npx ng test --watch=false --browsers=ChromeHeadless`).

### P1 — Next sprint

- **Background-task tests** for `account_cleanup` and `nexus_token_refresh`: time-mocked single iterations; assert selection queries, error handling, no-crash on DB outage.
- **Nexus client tests** with recorded GraphQL fixtures; cover error envelopes and rate-limit handling.
- **Settings router test** for the `llm_api_keys` partial-update merge — explicitly assert that omitted providers are *preserved*, not reset (the `AppSettingsUpdate` gotcha).
- **Reviewer + sub-pass integration** under a deterministic LLM stub.

### P2 — Backlog

- **Coverage measurement in CI**: add `pytest --cov=app --cov-report=xml` and `ng test --code-coverage`; fail under a starting threshold (suggest 50%, ratchet up).
- **Frontend component smoke tests** for auth + setup wizard.
- **Knowledge resolver** golden tests per game/phase to lock the section-selection contract and the cross-game leakage invariant.
- **MO2 plugin**: extract pure logic from `moddersomni_import.py` into a testable module; mock the MO2 PyQt API.
- **Contract tests for the `/api/plugin` token surface** consumed by the MO2 plugin.

## Suggested CI changes

In `.github/workflows/ci.yml`:
1. Promote `ng test --watch=false --browsers=ChromeHeadless` from non-existent → hard-fail.
2. Add `pytest --cov=app --cov-fail-under=<n>` once a baseline is measured.
3. Upload coverage XML to the run as an artifact for trend tracking.
