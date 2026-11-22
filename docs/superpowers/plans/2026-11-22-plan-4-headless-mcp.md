# Plan 4 — Go headless: ModdersOmni as an MCP server

_Date: 2026-11-22 · Status: **DRAFT, awaiting approval** · Target version: 3.0.0 (breaking)_

## Goal

Replace the Angular web app with a **Model Context Protocol (MCP) server**. Users connect it to
the AI app they already use (Claude, ChatGPT, VS Code, Goose, …). **Their** model does the thinking,
so token costs sit with the user, and ModdersOmni stops calling LLMs entirely. When something is
easier to look at than read, the server sends **visual cards** (MCP Apps) that render inside the chat
and can take approvals.

## What changes, in one table

| Today (web app) | After (MCP server) |
| --- | --- |
| Angular SPA on Cloudflare Pages | MCP server on Cloudflare Workers (remote URL) + local stdio mode |
| Our pipeline drives an LLM phase by phase | The user's AI drives the phases, guided by our tools and briefs |
| 6 LLM providers, API keys in localStorage | **No LLM code, no API keys** |
| Overseer reviewer LLM pass | A review checklist the user's AI runs on itself, plus rule-based checks |
| Dashboard, setup wizard, modlist pages | Visual cards in chat |
| Modlist in browser storage | Modlist stored server-side by an unguessable id (KV on Workers, files locally) |
| MO2 JSON download button | `export_mo2` tool + download button on a card; MO2 plugin unchanged |

## What we keep (ported as plain TypeScript, no Angular)

- Nexus GraphQL v2 client — still unauthenticated, no personal API keys (Nexus policy).
- Build phases, playstyles, games, compatibility rules (`public/data/*.json`).
- Knowledge base + phase-scoped methodology resolver (`public/knowledge/*.md`).
- Hardware spec parser, tier scoring, VRAM/storage budgets.
- Size presets + sub-pass cap math.
- Install guide (MO2 + Vortex) and the MO2 manifest format (`version 2.0.0`), so
  `plugins/mo2/moddersomni_import.py` needs no changes.
- The phase prompt wording, reshaped into "briefs" returned by a tool.

## What we delete

`frontend/` entirely (Angular, Tailwind, Karma, Playwright), the LLM dispatcher/registry,
pipeline/reviewer services, settings store and key detection. Git history keeps it all.

## Tools (the server's surface)

**Setup**
1. `list_games` — supported games, versions, playstyles, size presets.
2. `analyze_hardware` — free-text specs (dxdiag, "RTX 3070, 16GB") → tier + VRAM/storage budgets.
3. `create_modlist` — game, version, playstyle, vision, must-have mods, hardware, size → `modlist_id`
   and the full phase plan with per-phase mod caps.

**Building (the user's AI loops over these)**
4. `get_phase_brief` — everything for one phase: goal, search tips, rules, examples, cap, the relevant
   knowledge-base sections, mods already chosen, hardware budget, and an end-of-phase review checklist.
5. `search_mods` — Nexus title search (sort by endorsements/downloads/updated); repeat-query guard.
6. `get_mod_details` — description, requirements, "mods requiring this", primary file, image.
7. `add_mods` — batch add with reasons; dedupes, resolves file id + size, warns on rule conflicts
   and missing requirements immediately.
8. `remove_mods` / `reorder_mod` — edits, with load order renumbered.
9. `add_patch` and `flag_issue` — compatibility patches and "user needs to know" warnings.
10. `complete_phase` — marks a phase done (or "awaiting approval" when the user wants to sign off).

**Checking and finishing**
11. `check_compatibility` — rule table + missing requirements + size/VRAM budget report.
12. `get_modlist` — full current state (text).
13. `get_knowledge` — browse/read any knowledge-base topic on demand.
14. `export_mo2` — MO2 manifest JSON (fills missing file ids from Nexus).
15. `get_install_guide` — MO2 + Vortex steps, version notes, troubleshooting, linked modlist.

**Visual cards (MCP Apps — render in chat, fall back to text where unsupported)**
16. `show_modlist` — interactive modlist: grouped by phase, sizes, thumbnails, remove buttons,
    "Approve phase" / "Keep going" buttons that message the AI, download-for-MO2 button.
    Tabs for **Plan** (phase progress) and **Compatibility** (issues report).
17. `show_mod` — a single mod card (image, stats, requirements, add/skip buttons).
18. `show_card` — **generic card builder** the AI can use for anything: title, stats row, key/value
    list, table, bullet list, callouts, image, and action buttons. This is the "spin up a card as
    needed" tool.

One HTML bundle (`ui://moddersomni/card.html`) powers every card; each tool sends different data.

**Prompts:** `build_modlist` (full guided workflow) and `review_modlist` (audit an existing list),
so users can start with one click in apps that show prompts. Server `instructions` describe the
workflow for apps that don't.

## Typical conversation

1. User: "Survival Skyrim AE, RTX 3070, 16 GB RAM, ~150 mods."
2. AI: `analyze_hardware` → `create_modlist` → `show_modlist` (Plan tab) for a quick look.
3. Per phase: `get_phase_brief` → `search_mods` / `get_mod_details` → `add_mods` → self-review
   with the brief's checklist → `complete_phase`. Optionally pause for an approval card.
4. Final: `check_compatibility` → `add_patch` / `flag_issue` → `show_modlist` → `export_mo2`.

## Hosting & storage

- **Remote (default):** Cloudflare Worker using the MCP SDK v2 web-standard handler
  (`createMcpHandler`), Streamable HTTP at `/mcp`. Stateless per request; modlists in a KV
  namespace keyed by a random id, expiring after 90 days of no edits. `/` serves a small
  "how to connect" page (the only web page left).
- **Local:** `npx moddersomni-mcp` over stdio for Claude Desktop / Claude Code etc.; modlists
  saved as JSON files under `~/.moddersomni/modlists/`.
- No accounts and no auth in v3.0: a modlist id is the only key, like an unlisted link.

## Package layout

```
mcp/
  src/core/      nexus, knowledge, data, hardware, preset, sub-pass, modlist ops,
                 compatibility, briefs, install-guide, mo2 manifest, store (KV / file / memory)
  src/server.ts  builds the McpServer: tools, prompts, card resource
  src/ui/        card app (TypeScript + CSS) bundled into one HTML file
  src/entry/     worker.ts (Cloudflare), stdio.ts (local)
  test/          vitest: pure logic + in-memory end-to-end tool calls (Nexus mocked)
  wrangler.toml
```

Libraries: `@modelcontextprotocol/server` 2.x, `@modelcontextprotocol/ext-apps` 2.x, `zod` 4,
`esbuild`, `vitest`, `wrangler`.

## CI / deploy / docs

- `ci.yml`: `npm ci`, typecheck, `vitest`, build — in `mcp/` (Angular jobs removed).
- `deploy.yml`: `wrangler deploy` of the Worker (replaces the Pages deploy).
- Update `CLAUDE.md`, `AGENTS.md`, `README.md`; bump `VERSION` + `mcp/package.json` to 3.0.0
  with a `feat!:` commit.

## Needs from you before go-live

1. A Cloudflare API token with **Workers + KV** permission (the current Pages token may not have it),
   saved as the `CLOUDFLARE_API_TOKEN` repo secret.
2. One-time `wrangler kv namespace create MODLISTS`, then paste the id into `wrangler.toml`.
3. Optional: a custom domain such as `mcp.moddersomni.com`.

## Risks & open questions

- **Quality now depends on the user's AI.** Strong models will do well; weak ones may skip steps.
  Mitigation: detailed briefs, server-side dedupe/rule checks, and a checklist per phase.
- **Card support varies by app.** Claude, ChatGPT, VS Code and Goose render them today; elsewhere
  every card tool also returns a readable text version.
- **Nexus rate limits** now hit one Worker instead of many browsers. Mitigation: response caching;
  watch usage after launch.
- **Losing a casual web audience.** Anyone without an MCP-capable AI app can't use v3. Option:
  keep a static landing page explaining setup (planned), or keep the old site up read-only.
- **No accounts:** users must keep their modlist id (cards show it; export is always possible).

## Phases of work

1. Core port + tools + tests (no UI).
2. Card app + card tools.
3. Worker + stdio entries, landing page, local end-to-end test with an MCP client.
4. Delete `frontend/`, update CI/deploy/docs, version bump, PR.
