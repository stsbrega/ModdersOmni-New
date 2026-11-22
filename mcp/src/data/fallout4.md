<system_context>
game: fallout4
extends: modding_common.md
engine: creation_engine_fallout4
nexus_site: nexusmods.com/fallout4
supported_versions: [OG_1.10.163, NextGen]
version: 1.0
last_updated: 2026-02-27
</system_context>

# Fallout 4 Modding Knowledge

<version_management>

## OG vs Next-Gen Version Matrix

Community consensus: stay on pre-next-gen version 1.10.163. The April 2024 Next-Gen Update broke F4SE and most DLL mods.

| Component | OG (1.10.163) | Next-Gen |
|-----------|---------------|----------|
| F4SE | v0.6.23 | NG-specific builds (limited) |
| Buffout 4 | Classic Buffout 4 | Buffout 4 NG (#64880) |
| Address Library | OG version | NG version |
| UFO4P | v2.2.0a (requires all DLCs) | Latest NG-compatible |
| PRP | Version matched to build | Version matched to build |

</version_management>

<version_specific_selection>
<!-- phases: 1, 2, 3, 11 -->

## Per-Version Mod Selection Rules (OG vs NG)

These rules gate individual mod selections based on `user_game_version` (Standard/OG or Next-Gen). Apply them IN ADDITION to the general quality signals in the universal guidelines.

**The April 2024 Next-Gen Update broke every F4SE-dependent DLL plugin.** A plugin compiled for 1.10.163 will crash FO4 on NG (1.10.980+), and NG builds will not function on 1.10.163. This is a hard version boundary — there is no "close enough."

<!-- version_scope: Next-Gen -->
**NG-specific rules (your user is on Next-Gen — apply these):**
- Mods whose latest file upload date is before May 2024 AND whose Files tab has NO "NG" or "1.10.980+" build are UNVERIFIED for NG. Default-exclude them. Acceptable override: the mod page explicitly states the author tested it on NG.
- Known-broken on NG: **XDI (Extended Dialogue Interface)** — EXCLUDE regardless of description claims.
- Classic Buffout 4 does NOT work on NG — pick Buffout 4 NG (#64880) instead.
- Classic F4SE (0.6.23) does NOT work on NG — the plugin author maintains a separate NG build at silverlock.org.
- Many classic FO4 mod authors have publicly stated they will not port to NG. Do not add mods based on historical popularity — check the mod page for author NG-porting statements.
<!-- /version_scope -->

<!-- version_scope: Standard -->
**OG/pre-NG rules (your user is on pre-Next-Gen 1.10.163 — apply these):**
- NG-only texture upscales and NG-optimized performance mods may not install cleanly on 1.10.163. When a mod's description says "for Next-Gen" or "requires 1.10.980+", exclude it.
- Buffout 4 NG (#64880) CAN work on OG 1.10.163 in most cases but is NOT the preferred build — use Classic Buffout 4 for OG modlists.
- Use Classic F4SE v0.6.23; NG-specific F4SE builds will fail on 1.10.163.
<!-- /version_scope -->

**DLL plugin selection:**
- When a mod has SEPARATE "OG" and "NG" files in its Files tab, pick the file matching `user_game_version` and note it explicitly in compatibility_notes (e.g., "Install the NG variant from the Files tab").
- Mods with only OG files and a post-May 2024 comment from the author saying "NG compatible" can be included on NG, but flag as `requires_verification` in compatibility_notes.
- Never stack Classic Buffout 4 and Buffout 4 NG in the same modlist — their DLLs conflict.

**Downgrader tools are NOT modlist content.**
- Simple Fallout 4 Downgrader (#81933) and similar tools modify the game executable. They belong in the user's manual pre-install workflow, NOT as a mod in the load order.
- Do NOT select downgrader tools via `add_to_modlist`. If the user wants pre-NG modding on an NG-patched install, surface the downgrader workflow in the user guide instead.

**Flagging format:** when excluding a mod for version reasons, surface the reason in compatibility_notes using the exact pattern: `Excluded: requires {OG|NG}; user is on {OG|NG}`. This gives the user actionable context for swapping in an alternative.

</version_specific_selection>

<nexus_category_mapping>

## Nexus Mods Categories → Phase Theme (Fallout 4)

When selecting mods, map Nexus Mods categories to the phase theme currently being
built. Phase numbers are NOT fixed — the pipeline tells you the current phase name
and number in its own prompt. Match by theme:

**Engine Foundation / Frameworks theme:**
nexus_categories: [Utilities, Performance, Modders Resources and Tutorials, Miscellaneous]

**Bug Fixes theme:**
nexus_categories: [Bug Fixes, Patches]

**UI / Interface theme:**
nexus_categories: [User Interface, Pip-Boy]

**Textures / Visuals / Meshes theme:**
nexus_categories: [Models and Textures, Visuals and Graphics, Environment, Buildings]

**Animation / Physics theme:**
nexus_categories: [Animation, Poses]

**Audio theme:**
nexus_categories: [Audio - SFX, Audio - Music, Audio - Voice, Audio - Misc, Radio]

**Character Appearance theme:**
nexus_categories: [Body, Face, and Hair, NPC, Character Presets, Tattoos]

**Gameplay / Playstyle / Settlement Content theme:**
nexus_categories: [Gameplay, Overhauls, Immersion, Quests and Adventures, Perks, Skills and Leveling, Factions, Companions, Crafting - Equipment, Crafting - Other, Items (Food, Drinks, Chems, etc), Ammo, Collectibles, Treasure Hunts, and Puzzles, NPC - Vendors, Locations - New, Locations - Vanilla, New Lands, Player Homes, Player Settlement, Crafting - Home/Settlement, Sim Settlements, Sim Settlements 2]

**Lighting / Weather / Post-Processing theme:**
nexus_categories: [Weather and Lighting, ENB Presets, ReShade Presets]

**Compatibility / Conflict Resolution theme:**
nexus_categories: [Patches, Utilities]

**Cross-theme categories (assign based on context):**
Armour, Clothing, Power Armour → Gameplay (new items/distribution) or Visuals (retextures only)
Weapons, Weapons and Armour → Gameplay (new weapons) or Visuals (retextures only)
Creatures → Gameplay (behavior) or Visuals (retextures only)
Vehicles → Gameplay

**Important:** If a user explicitly requested a mod and its theme fits the current
phase, add it now. Do NOT defer to a "later phase" by theme name — add it when you
find the fit.

**Excluded from standard modlists:**
Cheats and God items, Saved Games, Transfer Settlement Blueprints, Videos and Trailers, VR (unless user specifies VR)

</nexus_category_mapping>

<precombines>

## Precombines and Previs — CRITICAL FO4 Knowledge

This is the MOST IMPORTANT methodological difference between Skyrim and Fallout 4 modding. No equivalent system exists in Skyrim.

**PRECOMBINES** merge multiple static meshes into single draw calls. **PREVIS** is precomputed occlusion data telling the engine to skip hidden objects.

ANY modification to an existing placed object in a precombined mesh — moving, deleting, disabling, resizing, or changing properties — breaks ALL precombines in that cell. A single broken precombine disables previs for a 3x3 cell area (9 cells). FPS drops from 60+ to single digits in dense areas like downtown Boston.

Adding NEW objects (not in vanilla) does NOT break precombines. Only modifications to existing placed objects trigger breakage.

**PRP** (Previsibines Repair Pack, #46403) rebuilds precombines/previs for all vanilla cells. PRP cell header records must ALWAYS win conflicts — its records must load last. Non-negotiable.

PRP cannot repair breakage caused by third-party mods editing vanilla placed objects.

</precombines>

<phase_1_essentials>

## Phase 1: Essential Engine Stack

Target pre-NG version 1.10.163. The pipeline distributes essentials across Phases 1 (Essentials & Frameworks, max 5), 2 (Bug Fixes, max 6), 3 (UI & Interface, max 4), and 4 (Tweaks & QoL, max 5). Pick from this list in the assigned phase — do NOT skip any item below.

**F4SE is hosted off-Nexus at f4se.silverlock.org** — when searching Nexus you will NOT find it directly. Always include F4SE as load_order=1 in the modlist with a note that the user must download it from silverlock.org. Do not pick a Nexus mod with a similar-sounding name as a substitute.

**Phase 1 — Essentials & Frameworks (pick exactly these 5 in order):**

1. **F4SE** (f4se.silverlock.org) — v0.6.23 for OG, NG-specific build for Next-Gen. Installs to game root, NOT through MO2. Note: NOT on Nexus — record as off-site download.
2. **Address Library for F4SE** (#47327) — Match to game version (separate OG and NG packages).
3. **xSE PluginPreloader F4** — REQUIRED by Buffout 4 (Buffout 4 will not function without it).
4. **Buffout 4 NG** (#64880) — Crash logger + 15+ engine fixes. Replaces standalone Achievements Mod, Auto Gamepad Switch, Faster Workshop.
5. **High FPS Physics Fix** — CRITICAL: physics break above 60 FPS without this. NEVER OMIT.

**Phase 2 — Bug Fixes (must include the first 5):**

1. **UFO4P** (Unofficial Fallout 4 Patch) — v2.2.0a; requires all DLCs.
2. **Previsibines Repair Pack** (#46403) — Rebuilt precombines/previs. See `<precombines>` for conflict rules. Cell header records MUST load last.
3. **Weapon Debris Crash Fix** (#48078) — Fixes FleX crash on Nvidia 16/20/30/40 series.
4. **Sprint Stuttering Fix** (#47760) — Camera stutter on uneven terrain.
5. **Mentats - F4SE** (#91565) — Engine-level fix collection.

**Phase 3 — UI & Interface (must include the first 2):**

1. **Mod Configuration Menu (MCM)** (#21497)
2. **MCM Booster** (#56997)
3. (Two more UI/HUD slots open: FallUI suite, HUDFramework, Full Dialogue Interface, Better Console - F4SE.)

**Phase 4 — Tweaks & QoL (one slot reserved for):**

1. **X-Cell** — Performance/threading improvements. Separate OG and NG installs. **Do NOT trust any specific Nexus ID printed in old documentation — search Nexus for "X-Cell" by name and verify the result author/description before adding.** A previous version of this knowledge file cited Nexus ID #84214, which is actually a different mod (Addictol). Treat any cached ID for X-Cell as unverified.

</phase_1_essentials>

<fo4_specific_methodology>

## FO4-Specific Technical Details

**AWKCR is deprecated.** Use **ECO Redux** (#55503). Legacy AWKCR-dependent mods can use "Grilled Cheese" or "AWKCR-R" as lightweight shims.

**BA2 archive rules:** FO4 loads up to 4 BA2s per plugin with MANDATORY suffixes:
- `PluginName - Main.ba2`
- `PluginName - Textures.ba2`
- `PluginName - Voices_en.ba2`
- `PluginName - Voices_XX.ba2`
FO4 will NOT load archives without these exact naming conventions (including spaces around hyphen).

**BA2 archive limit:** ~256 non-texture BA2s. Often constrains large modlists before the 254 plugin limit. Monitor count when building large lists.

**Loose files vs BA2:** Loose files cause significantly more stutter in FO4 than Skyrim. Always prefer BA2-packed versions.

**OMOD/ModCol system:** Object Modifications use fixed slots per weapon/armor. Multiple mods editing the same weapon's OMODs will conflict — only last-loaded changes persist. No automatic merging. Requires manual xEdit patches to combine.

</fo4_specific_methodology>

<load_order_categories>

## Fallout 4 Load Order Category Sequence

1. Masters and base game ESMs
2. Unofficial Patches (UFO4P)
3. Frameworks and resource libraries (ECO Redux, keyword frameworks)
4. Bug fixes and engine patches
5. UI and HUD (DEF_UI/FallUI, Full Dialogue Interface, HUDFramework)
6. Gameplay overhauls (combat, loot, economy)
7. New content (quests, factions, companions, worldspaces)
8. Weapons and armor (new gear, retextures, OMOD mods)
9. NPC and AI modifications
10. Visuals and textures
11. Settlement mods (ONLY mods adding new objects — never precombine-breaking scrap mods)
12. Conflict resolution patches (Bashed Patch, Synthesis, manual CR)
13. **Previs patches — MUST load last (see `<precombines>` rules)**

</load_order_categories>

<conflict_patterns_fo4>

## FO4-Specific Conflict Patterns

**PRECOMBINE/PRP CONFLICTS** — See `<precombines>` for full rules. Any mod loading cell headers after PRP invalidates precombine/previs data.

**OMOD/MODCOL CONFLICTS** — Multiple mods modifying same weapon's Object Modifications conflict on fixed slots. No merge possible — requires manual xEdit patching.

**BA2 ARCHIVE LIMIT** — ~256 non-texture BA2s. Exceeding causes silent asset loading failures.

**SPAWN/POPULATION CLUSTER CONFLICT** — War Of The Commonwealth (WOTC), You And What Army 2, The Deadly Commonwealth Expansion, NPCs Travel, and Crowded Commonwealth all modify enemy/NPC spawn lists and faction loadouts. Pick AT MOST ONE from this cluster — combining two stacks spawns to silly levels (50+ enemies per encounter), tanks performance on mid-tier hardware, and produces leveled list conflicts that can crash on cell load.

**COMBAT OVERHAUL CLUSTER CONFLICT** — Arbitration, TRUE - F76 Enemy Scaling, Better Locational Damage, Damage Threshold Framework, and similar combat/damage rebalances all touch the same actor value records. Pick AT MOST ONE primary combat overhaul; secondary tweaks must be small in scope (e.g., a "headshot damage only" patch is fine alongside Arbitration, but two full overhauls are not).

**SURVIVAL REBALANCE CLUSTER CONFLICT** — NICER Survival, Fallout 4 Loot Overhaul, Survival Options, Horizon (the big one), and Better Survival all rebalance economy/loot/needs. They are NOT additive — pick ONE comprehensive survival overhaul, then layer SMALL targeted tweaks (slower healing, modified ammo weight, modified needs interval) on top. Never select two comprehensive survival overhauls in the same modlist.

**TEXTURE PACK OVERLAP** — Vivid Fallout, FlaconOil's Complete Retexture, Valius High Resolution Texture Pack, and similar "complete" texture packs all replace the same vanilla textures. Pick ONE base pack, then layer category-specific add-ons (water, ivy, weapons) on top. Stacking two AIO packs wastes VRAM and produces inconsistent style. On mid-tier hardware (≤6 GB VRAM) prefer the lower-resolution versions of a single pack.

**UNRESOLVABLE CONFLICT RULE** — When two mods have a critical conflict and no published patch is found on Nexus, do NOT leave the modlist with both included and a "needs patch" note. Either: (1) remove the lower-priority mod (prefer keeping the more foundational/essential one), or (2) explicitly reduce one to "manual user review" status. Shipping a modlist with known unresolvable conflicts produces broken loadouts.

**FALSE-POSITIVE CONFLICT GUARD** — Before flagging mod A as "redundant with" or "conflicting with" mod B, verify that they actually overlap in scope. A mod that adds a craftable item is NOT redundant with a crash logger just because both are F4SE plugins. If the only basis for the conflict is "they sound similar" or "both are F4SE", do NOT flag it.

</conflict_patterns_fo4>

<fo4_prohibitions>

## FO4-Specific Prohibitions

NEVER select "Scrap Everything" or similar precombine-disabling mods — see `<precombines>`.

NEVER select AWKCR — deprecated, bloated, crash-prone. Use ECO Redux.

NEVER select mods that modify vanilla placed objects unless they explicitly regenerate precombines.

Do NOT mix OG and Next-Gen versions of framework mods.

</fo4_prohibitions>
