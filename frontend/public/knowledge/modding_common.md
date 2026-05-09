<system_context>
game_modding_knowledge_base
scope: universal_across_bethesda_games
applies_to: [skyrimse, fallout4]
version: 1.0
last_updated: 2026-02-27
</system_context>

# Universal Modding Knowledge Base

<universal_principles>

## Engine Fundamentals (Creation Engine)

Record priority follows "last loaded wins" — the final plugin touching a record determines game state. There is no merging; only the complete winning record is used.

Left pane (install order in MO2) controls asset priority for loose files and BSA/BA2 archives. Right pane (plugin load order) controls record priority for plugin data. These are independent systems that must both be managed.

Loose files always override archived files (BSAs/BA2s) regardless of left-pane position. This is hardcoded engine behavior.

The engine groups plugins at load time: master-flagged plugins load first (in listed order), then non-master plugins (in listed order). Within each group, the listed order determines priority.

LOOT sorts plugins via topological sort on a directed acyclic graph built from: master dependencies (hard requirement), plugin flags, LOOT masterlist metadata (community-sourced), group assignments, and record overlap heuristics. Cyclic dependencies cause sort failures.

</universal_principles>

<mod_selection_rules>

## Universal Mod Selection Rules

**Requirement checking before selection:** Before adding any mod to the modlist, check its Nexus Mods page "Requirements" dropdown. This lists DLC Requirements and Nexus Requirements (other mods it depends on). If a required mod is not already in the modlist, it must be added first. Only the "Mods requiring this file" section is irrelevant unless one of those dependent mods is also being added to the modlist.

**Modlist building vs modlist ordering are separate processes.** Building is selecting which mods belong in the list (with requirement verification at selection time). Ordering is arranging them into correct install order and plugin load order afterward. Do not conflate the two.

**Phase 2/3 revisit after content selection:** After all content phases (4-10) are complete, revisit Phase 2 (Frameworks and Resources) and Phase 3 (Bug Fixes and Patches) to verify that every framework, resource library, and patch required by the selected content mods is present in the modlist. Content mods chosen in later phases may introduce new framework dependencies that were not apparent during the initial Phase 2/3 pass.

</mod_selection_rules>

<phases>

## Modlist Building Phases

These phases define the sequential workflow for building a stable modlist. Skipping or reordering phases compromises stability.

Each phase includes a `nexus_categories` field in the game-specific files listing the Nexus Mods categories to search for candidate mods. The LLM's responsibility in each phase is: selecting appropriate mods, ensuring version compatibility, specifying correct install order, and flagging potential conflicts.

### Phase 1: Engine Foundation
**Purpose:** Select mods that expand the inherent functionality of the game engine without affecting content. These are foundational tools every modlist requires regardless of content choices.
**LLM responsibility:** Reference the game-specific file's `phase_1_essentials` list for the defined set of foundational mods. Ensure every DLL mod matches the user's exact game executable version. A version mismatch is the #1 crash cause after game updates. Specify install order so that dependencies load before dependents.

### Phase 2: Frameworks and Resources
**Purpose:** Select extension frameworks, resource libraries, and shared asset packs that content mods depend on.
**LLM responsibility:** Identify which frameworks are required by downstream mods the user wants. Ensure framework versions are compatible with the engine foundation from Phase 1.
**Prerequisite:** Phase 1 complete.

### Phase 3: Bug Fixes and Patches
**Purpose:** Select supplementary community bug fix compilations and patches beyond the unofficial patch included in Phase 1.
**LLM responsibility:** Identify bug fix mods that address issues not covered by the unofficial patch. These often form master dependencies for downstream plugins.
**Prerequisite:** Phase 2 complete.

### Phase 4: Interface and HUD
**Purpose:** Select UI replacers, HUD mods, and menu overhauls.
**LLM responsibility:** Verify hard dependencies on SkyUI/MCM from Phase 2. Flag that only one comprehensive HUD/UI overhaul should be active per UI slot to avoid conflicts.
**Prerequisite:** Phase 2 complete (MCM framework selected).

### Phase 5: Models, Textures, and Visuals
**Purpose:** Select mesh replacers, texture overhauls, and visual improvement mods.
**LLM responsibility:** Texture conflicts are resolved in the left pane (install order), not the right pane — specify overwrite priority. Match texture resolution to user's VRAM (see VRAM table). Normal maps consume 40-50%+ of texture VRAM — recommend reducing normal map resolution one step below diffuse for best performance-per-quality ratio.
**Prerequisite:** Phase 1 complete.

### Phase 6: Animation, Skeleton, and Physics
**Purpose:** Select skeleton frameworks, animation engines, and physics mods.
**LLM responsibility:** Ensure skeleton mod is positioned before all animation mods in install order. Reference game-specific file for animation framework details and constraints. Physics mods require FPS capping.
**Prerequisite:** Phase 1 complete.

### Phase 7: Audio and Music
**Purpose:** Select sound overhauls and music replacers.
**LLM responsibility:** Audio mods rarely cause instability. Specify left-pane overwrite order for file-level conflicts. Plugin conflicts on sound records are uncommon.
**Prerequisite:** Phase 1 complete.

### Phase 8: Character Appearance
**Purpose:** Select body, skin, hair, and NPC appearance mods.
**LLM responsibility:** Only one body framework should be active. Skin textures overlay body mesh, so body framework must be installed before skin textures in the left pane. Reference game-specific file for appearance conflict patterns.
**Prerequisite:** Phase 5 complete.

### Phase 9: Gameplay Overhauls
**Purpose:** Select mods that change game mechanics: combat, magic, perks, economy, AI, quests, immersion.
**LLM responsibility:** Flag leveled list conflicts when multiple mods edit the same lists — recommend Bashed Patch or Synthesis for merging in Phase 11. Game setting conflicts are pure "last loaded wins" — specify which mod should win. Flag that perk overhauls are mutually exclusive.
**Prerequisite:** Phases 1-3 complete.

### Phase 10: Locations and Environment
**Purpose:** Select city overhauls, new locations, landscape changes, flora/grass mods, water overhauls.
**LLM responsibility:** Flag cell header conflicts between location mods that require forwarding patches in Phase 11. Reference universal_prohibitions for navmesh rules.
**Prerequisite:** Phase 5 complete.

### Phase 11: Conflict Resolution and Load Order
**Purpose:** Specify final load order, identify needed patches, flag where Bashed Patch/Synthesis are required.
**LLM responsibility:** Specify patch load positions (after mods they patch). Flag leveled list merging needs. Flag ITM/UDR cleaning needs. Verify no missing masters in the final load order. Bashed Patch near end, Synthesis after Bashed Patch.
**Prerequisite:** All content phases (1-10) complete.

### Phase 12: Lighting, Weather, and Post-Processing
**Purpose:** Select weather overhaul, interior/exterior lighting mods, ENB/ReShade/Community Shaders.
**LLM responsibility:** Reference game-specific file for weather/lighting mutual exclusivity rules and post-processing compatibility constraints.
**Prerequisite:** Phase 11 complete.

### Phase 13: Generated Output and LOD
**Purpose:** Specify which generation tools need to be run and in what order.
**LLM responsibility:** List required generation steps (Nemesis, TexGen, DynDOLOD, Occlusion, LOOT sort). Specify that DynDOLOD.esm loads as last ESM; DynDOLOD.esp and Occlusion.esp load at the very end. Flag that adding/removing mods after this phase requires regenerating all outputs.
**Prerequisite:** All previous phases complete.

</phases>

<conflict_resolution_patterns>

## Universal Conflict Patterns

**LEVELED LISTS** — Most frequent conflict. Without merging, only last-loaded mod's items appear. Solved by Bashed Patch or Synthesis.

**CELL HEADER CONFLICTS** — Two mods altering same cell header (lighting, water, music, ownership). Requires a forwarding patch in xEdit.

**KEYWORD CONFLICTS** — Mods adding different keywords to same item/NPC. Synthesis or xEdit merged patch handles merging.

**GAME SETTING CONFLICTS** — Global values (fJumpHeightMin, fCombatDistance, etc.). Pure "last loaded wins" — specify which mod should win.

**ITMs (Identical to Master)** — Silently revert changes from earlier mods. Flag for cleaning with xEdit.

**UDRs (Undeleted/Disabled References)** — Cause CTDs. Flag for cleaning with xEdit.

</conflict_resolution_patterns>

<plugin_management>

## Plugin Limits and ESL Flagging

Hard limit: 254 full plugins (0x00-0xFD). Exceeding causes save corruption.

ESP-FE (ESL-flagged .esp) share the 0xFE index space — up to 4096 can coexist. Prefer ESP-FE when available.

Do NOT ESL-flag: plugins that are masters of other plugins, plugins active in existing saves, or plugins exceeding ESL record capacity.

</plugin_management>

<vram_guidelines>

## Texture Resolution by VRAM

| VRAM | Diffuse | Normal Maps | ENB Viable |
|------|---------|-------------|------------|
| 4 GB | 1K broad, 2K mountains only | 512-1K | No |
| 6-8 GB | 2K broad | 1K | Light/performance ENB |
| 12 GB+ | 2K broad, selective 4K large objects | 2K | Full ENB presets |
| 16-24 GB | 4K where available | 2K-4K | Full ENB + parallax |

Normal maps consume 40-50%+ of total texture VRAM. Reducing normal map resolution one step below diffuse yields the best performance-per-quality ratio.

</vram_guidelines>

<universal_prohibitions>

## Mods and Practices to Always Avoid

NEVER select mods that delete navmeshes — causes CTDs when NPCs path through deleted triangles.

NEVER recommend increasing Papyrus INI values — masks symptoms while worsening root cause.

Do NOT recommend updating mods mid-playthrough without reading changelogs — script-level changes corrupt saves.

Prefer actively maintained mods (updated within 12 months) with high endorsements.

</universal_prohibitions>

<mod_manager_principles>

## Mod Manager Principles (MO2)

MO2 virtualizes the Data folder — no files placed in game directory. Left pane priority: lower in list wins file conflicts. Right pane: plugin load order. Master-flagged plugins always load before non-master regardless of position.

Overwrite folder: tool-generated files (xEdit, Nemesis, BodySlide output) land here — should be moved to dedicated mods.

</mod_manager_principles>

<post_build_audit>

## Post-Build Verification Audit

Run this verification pass after all phases (1-13) are complete, before presenting the final modlist.

**Dependency completeness:** Verify every mod's Nexus Requirements (DLC and mod dependencies) are satisfied by another mod in the list. Flag any missing requirements.

**Version consistency:** Confirm all DLL-based mods target the same game executable version. No mixing SE/AE (Skyrim) or OG/NG (Fallout 4) DLL mods.

**Mutual exclusivity:** Check that no conflicting mods coexist. Common violations: multiple weather overhauls, multiple skeleton replacers, ENB + Community Shaders, overlapping perk overhauls.

**Plugin count:** Total active ESPs must be under 254. Identify ESL-flaggable plugins (under 2048 records for Skyrim SE/AE, under 4096 for Fallout 4) and recommend flagging to reclaim slots.

**VRAM budget:** Confirm selected texture resolutions are appropriate for the user's stated VRAM capacity per the vram_guidelines table.

**SSD space:** Compare total download/install size of all selected mods against the user's available SSD space. If the total exceeds available space, report the deficit.

**Precombine safety (Fallout 4 only):** Verify no mods break precombines/previs without PRP coverage. Confirm PRP is present and its cell header records win all conflicts.

**Prohibition check:** Scan the modlist against universal_prohibitions and game-specific prohibitions. Flag any violations.

</post_build_audit>
