<system_context>
game: skyrimse
extends: modding_common.md
engine: creation_engine_skyrim
nexus_site: nexusmods.com/skyrimspecialedition
supported_versions: [SE_1.5.97, AE_1.6.1170, BoBW]
version: 1.0
last_updated: 2026-02-27
</system_context>

# Skyrim SE/AE Modding Knowledge

<version_management>

## SE vs AE Version Matrix

| Component | SE 1.5.97 | AE 1.6.1170 | BoBW |
|-----------|-----------|-------------|------|
| SKSE | v2.0.20 | v2.2.6 | v2.0.20 |
| Address Library | SE-specific download | All-in-One AE V11 | SE-specific download |
| Crash Logger | .NET Script Framework (#21294) | Crash Logger SSE (#59818) | .NET Script Framework |
| USSEP | v4.2.5b (last SE version) | v4.3.x (requires CC masters) | v4.2.5b |
| ESL Record Cap | 2048 (without BEES) | 4096 | 4096 (with BEES) |

Address Library SE and AE packages are NOT interchangeable — memory offset IDs differ between executables. Wrong version causes all SKSE plugins to fail.

BoBW downgrades EXE/DLLs to 1.5.97 while keeping AE content. Requires BEES (Backported Extended ESL Support) and SE Address Library.

</version_management>

<version_specific_selection>
<!-- phases: 1, 2, 3, 11 -->

## Per-Version Mod Selection Rules (SE vs AE)

These rules gate individual mod selections based on `user_game_version` (SE or AE). Apply them IN ADDITION to the general quality signals in the universal guidelines.

**DLL/SKSE plugin version-locking is absolute.** A native DLL plugin compiled for 1.5.97 will CRASH or silently no-op on 1.6.1170, and vice versa. The game exe version determines which memory offsets the plugin hooks into — there is no forward/backward compatibility. Before adding ANY SKSE-dependent mod:
1. Check the mod's Files tab for a build matching the user's exact game version
2. If only one version's build exists and it does not match the user, EXCLUDE the mod (do not substitute a "close enough" version)
3. Framework mods that say "Works on both SE and AE" almost always ship separate downloads per version — pick the right one and note the version in compatibility_notes

<!-- version_scope: AE -->
**SE-only exclusion rule (your user is on AE — exclude these SE-only mods):**
- Mods whose latest file upload date is before August 2022 AND whose Files tab has no 1.6.x build are SE-only. Exclude from AE modlists regardless of download count or endorsement ratio.
- Do not trust "should work on AE" comments in mod descriptions — verify on the Files tab, not the description.
- Common SE-only abandoned plugins: many pre-AE "minor" SKSE tweaks whose authors did not port to AE. Popularity is not a signal of AE compatibility.
- USSEP v4.3.x (AE variant) requires Creation Club masters. Bug Fixes SSE and Crash Logger SSE ship AE-specific downloads — specify "AE variant" in compatibility_notes.
<!-- /version_scope -->

<!-- version_scope: SE -->
**AE-only exclusion rule (your user is on SE — exclude these AE-only mods):**
- Mods requiring Creation Club masters (Saints & Seducers, fishing, survival mode, Rare Curios, etc.) MUST be excluded — the user lacks the CC .esm files and the plugin will fail to load entirely.
- USSEP v4.3.x requires CC masters; for SE 1.5.97, use USSEP v4.2.5b instead.
- Bug Fixes SSE and Crash Logger SSE ship separate SE-1.5.97 downloads. Specify "SE 1.5.97 variant" in compatibility_notes.
<!-- /version_scope -->

**Address Library selection:**
- Address Library AIO package contains BOTH SE and AE versionlib files. SKSE picks the matching one at runtime — this is fine and preferred for modlists that might be used on either version. Never install two separate Address Library downloads (one SE, one AE) in the same modlist — that causes duplicate file overwrites in MO2.
- If the user has a specific version need (e.g., a pinned ENB preset that assumes a specific layout), fall back to the version-specific Address Library download matching the user's exe.

**ENB preset pinning:**
- ENB presets frequently require a specific weather mod AND a specific game version. A preset description that says "For SE 1.5.97 with Cathedral Weathers" will produce broken lighting on AE — check the preset's required game version on the Files tab before pairing. When the version cannot be confirmed, prefer Community Shaders (version-agnostic) over ENB in AE modlists.

**Flagging format:** when excluding a mod for version reasons, surface the reason in compatibility_notes using the exact pattern: `Excluded: requires {SE|AE} {version}; user is on {SE|AE} {version}`. This gives the user actionable context for swapping in an alternative.

</version_specific_selection>

<nexus_category_mapping>

## Nexus Mods Categories → Phase Theme (Skyrim SE/AE)

When selecting mods, map Nexus Mods categories to the phase theme currently being
built. Phase numbers are NOT fixed — the pipeline tells you the current phase name
and number in its own prompt. Match by theme:

**Engine Foundation / Frameworks theme:**
nexus_categories: [Utilities, Modders Resources, Miscellaneous]

**Bug Fixes theme:**
nexus_categories: [Bug Fixes, Patches]

**UI / Interface theme:**
nexus_categories: [User Interface]

**Textures / Visuals / Meshes theme:**
nexus_categories: [Models and Textures, Visuals and Graphics, Environmental, Buildings]

**Animation / Physics theme:**
nexus_categories: [Animation]

**Audio theme:**
nexus_categories: [Audio]

**Character Appearance theme:**
nexus_categories: [Body, Face, and Hair, NPC, Character Presets, Races, Classes, and Birthsigns]

**Gameplay / Playstyle theme:**
nexus_categories: [Gameplay, Combat, Overhauls, Immersion, Quests and Adventures, Skills and Leveling, Stealth, Alchemy, Crafting, Guilds/Factions, Magic - Gameplay, Magic - Spells & Enchantments, Shouts, Followers & Companions, Followers & Companions - Creatures, Collectables, Treasure Hunts, and Puzzles, Items and Objects - Player, Items and Objects - World]

**Locations / World theme:**
nexus_categories: [Cities, Towns, Villages, and Hamlets, Locations - New, Locations - Vanilla, Dungeons, Environmental, Player homes]

**Lighting / Weather / Post-Processing theme:**
nexus_categories: [Presets - ENB and ReShade, Visuals and Graphics]

**Compatibility / Conflict Resolution theme:**
nexus_categories: [Patches, Utilities]

**Cross-theme categories (assign based on context):**
Armour, Armour - Shields, Weapons, Weapons and Armour → Gameplay (new items/distribution) or Visuals (retextures only)
Clothing and Accessories → Character Appearance or Visuals (retextures only)
Creatures and Mounts, Creatures - Companions → Gameplay (behavior) or Visuals (retextures only)

**Important:** If a user explicitly requested a mod and its theme fits the current
phase, add it now. Do NOT defer to a "later phase" by theme name — add it when you
find the fit.

**Excluded from standard modlists:**
Cheats and God items, Save Games, VR (unless user specifies VR)

</nexus_category_mapping>

<phase_1_essentials>

## Phase 1: Essential Engine Stack

The pipeline distributes essentials across Phases 1 (Essentials & Frameworks, max 5), 2 (UI & Interface, max 4), and 3 (Fixes & Bug Patches, max 5). Pick from this list in the assigned phase — do NOT skip any item below in favor of "nice to have" mods.

**Phase 1 — Essentials & Frameworks (pick exactly these 5 in order):**

1. **SKSE64** (#30379) — **MUST be load_order=1 in EVERY Skyrim modlist regardless of preset, hardware, or playstyle.** SKSE64 IS hosted on Nexus (#30379) — do not skip it just because the actual binary installs to the game root rather than through MO2. It is NEVER optional. Without SKSE64, every other SKSE-dependent mod silently fails to load. v2.0.20 for SE; v2.2.6 for AE.
2. **Address Library** (#32444) — SE and AE are SEPARATE downloads. Requires SKSE64 (#30379) to function — never add Address Library without also adding SKSE64.
3. **SSE Engine Fixes** (#17230) — Two-part: Part 1 via MO2, Part 2 (d3dx9_42.dll) to game root. Fixes file handle limit, tree LOD, save corruption.
4. **SSE Display Tweaks** (#34705) — Frame limiter, physics fix. FPS cap = refresh rate minus 1. NEVER OMIT — physics break above 60 FPS without it. More critical than any single bug-fix mod.
5. **po3's Papyrus Extender** (#22854) — 374+ new Papyrus functions; foundational dependency for many other mods.

**Phase 2 — UI & Interface (must include the first 2):**

1. **SkyUI** (#12604) — MCM framework. Works on all versions.
2. **MCM Helper** (#53000) — Persistent MCM settings. Replaces FISSES.
3. **ConsoleUtilSSE NG** (#76649) — Common framework dependency; place here when Phase 1 is full.
4. (Phase 2's 4th slot is open for HUD/UI of choice: TrueHUD, iHUD, A Quality World Map, etc.)

**Phase 3 — Fixes & Bug Patches (must include the first 5):**

1. **USSEP** (#266) — v4.2.5b for SE; v4.3.x for AE (requires CC masters). Comprehensive bugfix patch — counts as a "fix" not an "essential".
2. **Bug Fixes SSE** (#33261) — Separate downloads for SE and AE.
3. **Scrambled Bugs** (#43532) — Configurable fixes via TOML config.
4. **po3's Tweaks** (#51073) — Required by Papyrus Extender.
5. **Crash Logger** — #59818 for AE; .NET Script Framework (#21294) for SE. NEVER OMIT — without a crash logger, all later debugging is impossible.

**Frameworks that may not fit in capped phases (if any phase has spare slots, add these — otherwise note in compatibility patches phase that they were skipped):**
- **PapyrusUtil SE** (#13048) — Widely depended-upon scripting utilities.
- **JContainers SE** (#16495) — Complex data structures for Papyrus.
- **More Informative Console** (#19250) — Essential for debugging.

</phase_1_essentials>

<animation_framework>

## Phase 6: Animation and Skeleton (Skyrim-Specific)

**XPMSSE** is the standard skeleton framework. Nearly all animation mods require it. Only one skeleton mod should be active.

**Nemesis Unlimited Behavior Engine** (#60033) generates behavior files. Output must be regenerated after adding/removing any animation mod — missing output causes crashes on character load. Nemesis generates a dummy FNIS.esp for backward compatibility — do not remove it.

**FNIS** is only needed for creature animation mods Nemesis doesn't support.

**OAR** (Open Animation Replacer) is the actively maintained successor to **DAR**. Both allow condition-based animation swaps without Nemesis patches. OAR has better performance and more conditions.

</animation_framework>

<weather_lighting>

## Phase 12: Weather and Lighting (Skyrim-Specific)

Weather overhauls are mutually exclusive — select exactly ONE (Cathedral Weathers, Obsidian Weathers, NAT, Azurite, etc.).

ENB presets are designed for specific weather mods — verify compatibility before pairing.

Community Shaders and ENB are mutually exclusive:
- ENB: Best quality, highest performance cost. Requires matched weather mod.
- Community Shaders: Open-source, lighter. No weather-specific tuning needed.
- ReShade: Post-processing only. Compatible with Community Shaders but not ENB.

**Lux** (interior lighting) and **Window Shadows** are compatible and commonly paired.

**Lux interior overhauls require explicit patches.** Lux modifies vanilla interior lighting templates. ANY mod that overhauls a vanilla interior cell (College of Winterhold mods, JK's Interiors, city overhauls, player home mods placed inside vanilla buildings) will conflict with Lux unless an explicit "Lux - <ModName> patch" is on Nexus. Always search for the dedicated Lux patch before pairing them, or skip Lux for that cell.

</weather_lighting>

<load_order_categories>

## Load Order Category Sequence (22 Categories)

Both left-pane and right-pane should follow this sequence:

1. Utilities and tools (SKSE, ENB binaries, Root Builder)
2. Bug fixes and engine patches (USSEP, SSE Engine Fixes, Scrambled Bugs)
3. Extension frameworks (Address Library, Papyrus Extender, SPID, KID)
4. Resource libraries (shared asset packs)
5. UI and HUD (SkyUI, TrueHUD, iHUD, MCM Helper)
6. Quality of life (display tweaks, hotkeys)
7. Meshes/textures — architecture and landscape (SMIM, Skyrim 2020, Skyland)
8. Meshes/textures — clutter and items
9. Weather and lighting (Cathedral, Lux, ELFX, Window Shadows)
10. Landscape and environment (grass, flora, terrain, water, trees)
11. Cities and towns (JK's Skyrim, city overhauls)
12. Gameplay overhauls (perks, combat, magic, economy)
13. NPC appearance and AI (NPC replacers, AI Overhaul)
14. Body, skin, and hair (CBBE/BHUNP/HIMBO, skin textures)
15. Creatures and enemies (retextures, new enemies, spawns)
16. Items, weapons, and armor (new gear, distribution mods)
17. Quests and new lands (quest mods, worldspaces, followers)
18. Audio and music
19. Animations (movement, combat, idle)
20. Late loaders and compatibility patches
21. Generated output (Bashed Patch, Synthesis, Nemesis, DynDOLOD, Occlusion)
22. ENB/ReShade/Community Shaders

Rules: Patches after mods they patch. Bashed Patch near end. Synthesis after Bashed Patch. DynDOLOD.esm as last ESM; DynDOLOD.esp and Occlusion.esp at very end.

</load_order_categories>

<conflict_patterns_skyrim>

## Skyrim-Specific Conflict Patterns

**NPC DARK FACE BUG** — Plugin controlling NPC appearance (right pane) doesn't match FaceGen files loaded (left pane). Ensure left-pane asset priority mirrors right-pane plugin order for NPC mods. Face Discoloration Fix (#42441) is a runtime safety net.

**WINTERHOLD CLUSTER CONFLICT** — Obscure's College of Winterhold, JK's College of Winterhold, College of Winterhold - Quest Expansion, and most player home mods placed inside Winterhold all heavily edit the same College cells (navmeshes, placed objects, lighting templates). Selecting two from this cluster requires an explicit Nexus compatibility patch. If no patch exists, REMOVE one of the conflicting mods — unresolved cell conflicts produce visual glitches, NPC pathfinding bugs, and crashes.

**COMBAT OVERHAUL CLUSTER CONFLICT** — Wildcat - Combat of Skyrim, Valhalla Combat, Smilodon, Mortal Enemies, Combat Gameplay Overhaul (CGO), Blade and Blunt, and similar full combat reworks all touch the same actor value records, hit reactions, and timing curves. Pick AT MOST ONE primary combat overhaul. Smaller targeted tweaks (TK HitStop, Toggleable Directional Power Attacks, Dynamic Stamina, animation packs like Leviathan or Goetia) are layerable on top of one primary overhaul. Two primary overhauls in the same modlist double-apply damage modifiers and produce inconsistent enemy behavior.

**CITY OVERHAUL CLUSTER CONFLICT** — JK's Skyrim, The Great Cities, Cities of the North, ETaC (Expanded Towns and Cities), Capital Whiterun Expansion, and similar full city replacers all heavily edit the same exterior cells (navmeshes, placed objects, NPC pathing). Pick ONE primary city overhaul. Compatibility patches between e.g. JK's Skyrim and The Great Cities EXIST on Nexus — search for "JK's Skyrim - The Great Cities patch" before pairing them. If no published patch exists for the specific pair, REMOVE one. Stacking two city overhauls without a patch produces floating objects, broken NPC schedules, and CTDs on cell load.

**LUX INTERIOR PATCH REQUIREMENT** — When Lux is in the modlist alongside ANY mod that overhauls vanilla interior cells (JK's Interiors, Obscure's College of Winterhold, JK's College of Winterhold, the various JK's "X interior" mods, Capital Whiterun, etc.), an explicit "Lux - <ModName>" patch from the Lux maintainer page MUST be added to the compatibility patches phase. Lux maintainers publish these patches as separate downloads. If no patch exists for a specific interior overhaul, either skip Lux for that cell or remove the interior overhaul.

**ANIMATION PACK STACKING** — Stacking many animation replacer packs (e.g., multiple Leviathan packs, multiple Goetia packs, multiple Vanargand packs) is fine ONLY if each pack covers a different action set (one for high stance, one for power attacks, one for normal attacks, etc.) AND OAR conditions disambiguate them. If two packs replace the same animation file without OAR conditions, the later-loaded one silently wins — this looks like a broken pack rather than a conflict. Always verify pack scopes before stacking.

**CONFLICT DETECTION DUTY** — The compatibility patches phase MUST surface every conflict it finds, even ones it cannot resolve. Flagging a conflict without a fix is BETTER than silently shipping a broken modlist. The pipeline depends on this phase to detect cell, leveled-list, OMOD, navmesh, and load-order conflicts. Do NOT suppress flagging because no patch was found — surface the flag AND apply the resolution rule below.

**UNRESOLVABLE CONFLICT RULE** — After flagging a critical conflict, if no published patch is found on Nexus, the resolution path is: (1) REMOVE the lower-priority mod from the modlist (prefer keeping the more foundational/essential one), OR (2) keep both but explicitly mark one as "manual user review required" in the compatibility note. Shipping a modlist with known unresolvable conflicts is the worst outcome — but silently dropping the flag entirely is the SECOND worst. Always flag, then resolve.

</conflict_patterns_skyrim>

<skyrim_prohibitions>

## Skyrim-Specific Prohibitions

Do NOT select ENBoost for SSE — Oldrim-only utility. SSE is 64-bit and does not need it.

Do NOT select multiple skeleton mods — XPMSSE is the standard.

</skyrim_prohibitions>
