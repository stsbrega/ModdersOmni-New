# ModdersOmni

**AI-powered modlist builder for Skyrim Special Edition and Fallout 4 — runs entirely in your browser.**

ModdersOmni reads your hardware spec, asks what kind of playthrough you want, and builds a phased modlist tailored to your system using an LLM you bring (or a local Ollama install). Export the result to Mod Organizer 2 or Vortex and let your mod manager download and install everything.

> **Status: v2.0.0 in active development.** This repository is a fresh-history rebuild of ModdersOmni. The previous v1.0 was a hosted full-stack web app on Render with user accounts, OAuth, and a Postgres database. v2 is a static, self-hosted single-page app — no backend, no accounts, no recurring infrastructure costs. See [`docs/superpowers/specs/2026-05-09-static-bundle-refactor-design.md`](docs/superpowers/specs/2026-05-09-static-bundle-refactor-design.md) for the full design.

## What v2 will give you

- **Phased modlist generation** — the LLM works through ordered build phases (Essentials → UI → Textures → Gameplay → … → Compatibility Patches), checking Nexus mod metadata at every step.
- **Per-phase overseer review** — a second LLM pass independently reviews each phase's selections for stability, theme fit, and conflicts. This is what makes the output beat a one-shot ChatGPT/Claude prompt.
- **Hardware-aware** — VRAM budgets, plugin counts, SSD space all factored in based on your spec.
- **Export to Mod Organizer 2 or Vortex** — generates a JSON manifest the included MO2 plugin imports directly. Your mod manager handles the actual downloads.
- **Bring your own LLM** — supports Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, and local Ollama. Keys are stored only in your browser's `localStorage`; no server ever sees them.
- **No accounts, no telemetry, no server.** The app talks only to your chosen LLM provider and the public Nexus Mods GraphQL API.

## Supported games

- The Elder Scrolls V: Skyrim Special Edition / Anniversary Edition
- Fallout 4 (Standard / Next-Gen)

## Distribution channels (post-release)

1. **Hosted:** Cloudflare Pages URL — added to this README on the v2.0.0 release.
2. **Offline / Nexus Mods:** downloadable zip on the project's Nexus Mods page. Unzip and serve locally with `npx serve .` or any static file server.

## Development

Requires Node 20+ and npm.

```bash
cd frontend/
npm install
npm start
```

Dev server runs on http://localhost:4200. There is no backend during development — everything runs client-side, the same as in production.

## Tech stack (v2 target)

| Layer | Technology |
|---|---|
| Framework | Angular 19 (standalone components, signals, new control flow) |
| Styling | Tailwind CSS 4 (OKLCH design tokens via `@theme`) |
| Components | spartan-ng (shadcn-style primitives) |
| Icons | lucide-angular |
| LLM SDKs | Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, Ollama — browser-direct |
| Mod data | Nexus Mods v2 GraphQL (unauthenticated reads) |
| Distribution | Cloudflare Pages + Nexus Mods downloadable zip |

## Project structure

The current code in this repo is the v1.0 baseline. The refactor progressively transforms it into the v2 static bundle. See the [migration plan in the design spec](docs/superpowers/specs/2026-05-09-static-bundle-refactor-design.md#migration-plan-order-of-operations) for the step-by-step order.

## Legal & methodology

ModdersOmni does not depend on Bethesda's source code or distribute reverse-engineered game code. Knowledge is sourced from publicly available, community-validated resources (Creation Kit docs, UESP Wiki, modding.wiki, CommonLibSSE, SKSE, xEdit, Champollion, LOOT). The generated output is original code that interfaces with the game via documented modding APIs. Where analysis beyond public docs is necessary, the project follows a clean-room methodology limited to functional interfaces (data formats, file structures, API specifications) — generally unprotectable under the idea/expression dichotomy (17 U.S.C. § 102(b); EU Directive Art. 1(2)).

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Acknowledgements

- [Nexus Mods](https://www.nexusmods.com/) for their public GraphQL API
- [CommonLibSSE](https://github.com/Ryan-rsm-McKenzie/CommonLibSSE) and [SKSE](https://skse.silverlock.org/) for foundational modding infrastructure
- [LOOT](https://loot.github.io/) for load order optimization research
- [spartan-ng](https://www.spartan.ng/) for the Angular component library
- The Bethesda modding community for decades of accumulated knowledge
