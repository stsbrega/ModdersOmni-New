# ModdersOmni

**AI-powered modlist builder for Skyrim Special Edition and Fallout 4 — runs entirely in your browser.**

ModdersOmni reads your hardware spec, asks what kind of playthrough you want, and builds a phased modlist tailored to your system using an LLM you bring (or a local Ollama install). Export the result to Mod Organizer 2 or Vortex and let your mod manager download and install everything.

v2 is a static, self-hosted single-page app — no backend, no accounts, no recurring infrastructure costs. The app talks only to your chosen LLM provider and the public Nexus Mods GraphQL API.

## What ModdersOmni does

- **Phased modlist generation** — the LLM works through ordered build phases (Essentials → UI → Textures → Gameplay → … → Compatibility Patches), checking Nexus mod metadata at every step.
- **Per-phase overseer review** — a second LLM pass independently reviews each phase's selections for stability, theme fit, and conflicts. This is what makes the output beat a one-shot ChatGPT/Claude prompt.
- **Hardware-aware** — VRAM budgets, plugin counts, SSD space all factored in based on your spec.
- **Export to Mod Organizer 2 or Vortex** — generates a JSON manifest the included MO2 plugin imports directly. Your mod manager handles the actual downloads.
- **Bring your own LLM** — supports Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, and local Ollama. Keys are stored only in your browser's `localStorage`; no server ever sees them.
- **No accounts, no telemetry, no server.**

## Supported games

- The Elder Scrolls V: Skyrim Special Edition / Anniversary Edition
- Fallout 4 (Standard / Next-Gen)

## Distribution

1. **Hosted:** <https://moddersomni.pages.dev> — open and go.
2. **Offline / Nexus Mods:** downloadable zip on the project's Nexus Mods page. Unzip and serve locally with `npx serve .` or any static file server.

## First-run setup

1. **Open** <https://moddersomni.pages.dev> in your browser.
2. **Settings** → paste an API key for one of the supported LLM providers (Anthropic, OpenAI, Gemini, Groq, OpenRouter) or point at a local Ollama install. Keys are saved to `localStorage` and never leave your machine except to call your chosen provider directly.
3. **Setup wizard** → pick game (Skyrim SE/AE or Fallout 4), describe your hardware (or paste a DXDIAG), choose a size preset and a playstyle.
4. **Generate** → watch phases stream in. The overseer reviews each phase before the pipeline advances.
5. **Export to MO2** → download the JSON manifest, then open it in Mod Organizer 2 with the included plugin (see below).

## MO2 plugin

A small Mod Organizer 2 plugin imports a generated modlist JSON and queues each mod through MO2's existing Nexus Mods integration.

**Install:**
1. Copy `plugins/mo2/moddersomni_import.py` into `<MO2-install>/plugins/`.
2. Restart Mod Organizer 2.
3. Find **"ModdersOmni Import"** under the **Tools** menu.
4. Select the modlist JSON you exported from the web app — MO2 will queue downloads through your linked Nexus account.

The plugin reads a local JSON file; there is no network call to ModdersOmni.

## Development

Requires Node 20+ and npm.

```bash
cd frontend/
npm install
npm start
```

Dev server runs on http://localhost:4200. There is no backend during development — everything runs client-side, the same as in production.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Angular 19 (standalone components, signals, new control flow) |
| Styling | Tailwind 4 + custom CDK-based primitives (OKLCH design tokens via `@theme`) |
| Icons | lucide-angular |
| LLM SDKs | Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, Ollama — browser-direct |
| Mod data | Nexus Mods v2 GraphQL (unauthenticated reads) |
| Distribution | Cloudflare Pages + Nexus Mods downloadable zip |

## Legal & methodology

ModdersOmni does not depend on Bethesda's source code or distribute reverse-engineered game code. Knowledge is sourced from publicly available, community-validated resources (Creation Kit docs, UESP Wiki, modding.wiki, CommonLibSSE, SKSE, xEdit, Champollion, LOOT). The generated output is original code that interfaces with the game via documented modding APIs. Where analysis beyond public docs is necessary, the project follows a clean-room methodology limited to functional interfaces (data formats, file structures, API specifications) — generally unprotectable under the idea/expression dichotomy (17 U.S.C. § 102(b); EU Directive Art. 1(2)).

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Acknowledgements

- [Nexus Mods](https://www.nexusmods.com/) for their public GraphQL API
- [CommonLibSSE](https://github.com/Ryan-rsm-McKenzie/CommonLibSSE) and [SKSE](https://skse.silverlock.org/) for foundational modding infrastructure
- [LOOT](https://loot.github.io/) for load order optimization research
- The Bethesda modding community for decades of accumulated knowledge
