<system_context>
scope: universal_modlist_compatibility
applies_to: [skyrimse, fallout4]
purpose: general_compatibility_rules_and_scale_strategies
version: 1.1
last_updated: 2026-04-17
</system_context>

# Modlist Compatibility Guidelines & Scale Strategies

<mod_type_compatibility_matrix>

## Mod Type Compatibility Matrix

This matrix classifies mod types by their conflict profile. Use it to determine whether two mods
can safely coexist, require ordering, or are mutually exclusive.

### Asset-Only Mods (No Plugin / No Scripts)

These mods contain only loose files or archives — textures (.dds), meshes (.nif), sounds (.wav/.xwm),
or animations (.hkx). They NEVER cause plugin-level conflicts.

**Safe to stack freely (conflicts resolved by install order alone):**
- Texture replacers (diffuse, normal, specular maps)
- Mesh replacers (geometry-only changes)
- Sound replacers (music, SFX, ambience, voice)
- Animation packs using OAR/DAR conditions (each targets different actions)
- LOD texture replacers

**Conflict resolution:** Last-installed (lowest in MO2 left pane) wins file-level conflicts.
When two texture packs cover overlapping files, the one lower in install order takes priority.
This is purely visual preference — no stability risk. The LLM should note overwrite relationships
but NOT flag them as errors.

### Plugin Mods — Safe to Stack (Low Conflict Risk)

These mod types use plugins but edit orthogonal record types, so they rarely conflict:

- **Item addition mods** (new weapons, armor, spells, ingredients) — each adds new FormIDs;
  conflicts only arise if two mods add distribution rules to the same leveled list.
- **Follower mods** — each creates a new NPC; safe unless two followers occupy the same
  editor ID (extremely rare).
- **Player home mods** — safe unless two homes edit the same cell (check worldspace).
- **Quest mods / New lands** — usually create new worldspaces; safe unless they edit
  vanilla cells or NPCs.
- **Crafting recipe mods** — add new COBJ records; safe to stack.
- **Book/note/lore mods** — add new BOOK records; safe to stack.

### Plugin Mods — Require Ordering or Patches (Medium Conflict Risk)

These mod types edit shared game records and need careful load ordering:

- **NPC appearance mods** (individual NPC replacers, AI overhauls) — multiple mods can edit
  the same NPC record. Last-loaded plugin wins all fields (appearance, AI packages, inventory,
  outfit). Patches merge changes from multiple mods.
- **Leveled list mods** (item distribution, enemy spawns, loot tables) — without a Bashed Patch
  or Synthesis patcher, only the last-loaded list applies. ALWAYS flag leveled list conflicts for
  merging in the conflict resolution phase.
- **Cell-editing mods** (city overhauls, interior redesigns, dungeon overhauls) — two mods editing
  the same cell header cause one to silently lose. Requires forwarding patches in xEdit.
- **Keyword/OMOD mods** — mods adding keywords or object modifications to the same item.
  Only last-loaded changes persist. Requires xEdit patch to merge.
- **SPID (Spell Perk Item Distributor) mods** — generally safe to stack, but mods distributing
  conflicting perks/spells to the same actor types can produce unintended gameplay interactions.
  No plugin conflict, but gameplay-level conflict.

### Plugin Mods — Mutually Exclusive (High Conflict Risk)

Only ONE mod from each cluster may be active. Selecting two from the same cluster produces
broken gameplay, not just visual glitches:

| Cluster | Examples (Skyrim) | Examples (Fallout 4) | Why Exclusive |
|---------|-------------------|---------------------|---------------|
| Combat overhaul | Wildcat, Valhalla, Blade & Blunt, Smilodon, CGO | Arbitration, Better Locational Damage, Damage Threshold | All edit actor values, hit reactions, timing |
| Perk overhaul | Ordinator, Vokrii, Adamant, Path of Sorcery | Be Exceptional, Fallout 4-76 | Completely replace perk trees |
| Weather overhaul | Cathedral, Obsidian, NAT, Azurite, Vivid | NAC X, True Storms, Polluted Climate | Replace all weather records |
| Skeleton replacer | XPMSSE only | — | Only one skeleton can be active |
| Body framework | CBBE, BHUNP, UNP, HIMBO | CBBE, Fusion Girl, Jane Bod | Replace body meshes/textures |
| Lighting overhaul (interior) | ELFX, Lux, RLO, ELE | Ultra Interior Lighting, ELFX FO4 | Edit interior cell lighting templates |
| Lighting overhaul (exterior) | Lux Via, ELFX Exteriors | — | Edit exterior cell lighting |
| Post-processing | ENB vs Community Shaders | ENB vs ReShade | Inject at same rendering stage |
| Survival overhaul | Sunhelm, Frostfall+iNeed, CC Survival | Horizon, Damn Apocalypse, Survival Options | All rebalance needs/economy |
| AI overhaul | AI Overhaul SSE, Immersive Citizens | — | Both edit NPC AI packages globally |
| Grass overhaul | Two FULL grass overhauls (SFO vs Veydosebrom vs Folkvangr — see note) | — | Override same grass records |
| Dragon overhaul | Diverse Dragons, Splendor, Dragon War | — | Edit dragon actor templates |

**Exception:** Small, targeted tweaks (e.g., "TK HitStop" on top of Wildcat, or a stamina
cost tweak on top of Blade & Blunt) CAN layer on a primary overhaul if they only touch
a narrow set of records. The rule is: one *comprehensive* overhaul per cluster, then
small targeted tweaks on top.

**Grass mod nuance:** Some grass mods (Cathedral, Folkvangr, Veydosebrom Regions) can be
combined via "QW's Grass Patch" which merges grasses from multiple sources per-region.
However, two FULL grass overhauls (e.g., SFO + Wildlands Renewal) that each replace ALL
grass records globally are still mutually exclusive. The key distinction: regional grass
mods that cover different biomes CAN stack with a patch; global grass replacers that
override the same records CANNOT.

</mod_type_compatibility_matrix>

<scale_strategies>

## Strategies for Building Large Modlists (1000-4000+ Mods)

Popular curated lists like Nolvus (~2050 mods), LoreRim (~4265 mods), and similar reach their
scale NOT by selecting 4000 unique "big" mods, but by combining broad coverage mods with
hundreds of granular, targeted replacers and patches. Understanding this composition is key
to generating competitive modlists.

### Where the Mod Count Comes From

A 2000-4000 mod list typically breaks down as:

| Category | % of Total | Typical Count (2000-mod list) | Nature |
|----------|-----------|------------------------------|--------|
| Textures & meshes | 30-40% | 600-800 | Individual asset replacers |
| Patches & compatibility | 15-20% | 300-400 | Per-mod-pair patches |
| Gameplay & overhauls | 10-15% | 200-300 | Systems, perks, combat, economy |
| NPC appearance | 5-10% | 100-200 | Per-NPC or per-faction replacers |
| Animations | 5-8% | 100-160 | Per-action animation packs |
| Quests & new content | 5-8% | 100-160 | Quest mods, new lands, followers |
| UI, audio, QoL | 3-5% | 60-100 | Interface, sounds, hotkeys |
| Framework & engine | 2-3% | 40-60 | SKSE, Address Library, etc. |
| Generated output | 1-2% | 20-40 | Synthesis, Nemesis, DynDOLOD |

### Sub-Category Expansion Strategy

To reach large-list scale, each phase should be broken into **granular sub-passes** that
cover specific asset/record domains. Here is the expansion model:

**Phase 5 (Textures & Visuals) — expand from 1 pass to 15+ sub-passes:**
(Based on Nolvus/Lexy's/Sinitar guide breakdowns which use 17+ visual subcategories)
1. Base textures & meshes (SMIM, overall texture packs — Noble, Skyland, Skyrim 2020)
2. Architecture — cities & settlements (Whiterun, Solitude, Riften, Markarth, Windhelm)
3. Architecture — dungeons & ruins (Nordic, Dwemer, Falmer, Imperial forts, caves, mines)
4. Landscape — mountains, rocks, stones, terrain
5. Landscape — roads, bridges, signs
6. Ice, snow, ash textures
7. Flora — trees (bark, leaves, LOD models)
8. Flora — grass (ONE overhaul only — mutually exclusive cluster)
9. Flora — flowers, shrubs, mushrooms, ferns
10. Water (rivers, lakes, ocean, waterfalls, foam)
11. Clutter — indoor objects (tableware, food, books, ingredients, candles, rugs)
12. Weapons retextures (per-weapon or per-category — swords, bows, staves)
13. Armor & clothing retextures (per-set replacers)
14. Creatures & animals (per-creature retextures — dragons, wolves, spiders, deer)
15. Effects & particles (fire, magic, smoke, blood, weather particles, ENB particles)
16. Sky & celestial (stars, moons, aurora, sun, clouds, night sky)
17. LOD assets (tree LOD, terrain LOD, object LOD billboards)

**Phase 8 (Character Appearance) — expand to 5+ sub-passes:**
1. Body framework + skin textures
2. Hair replacers (individual hair packs, HDT/SMP hair physics)
3. Eye textures and brow meshes
4. Warpaint, tattoos, scars, overlays
5. Per-NPC or per-faction appearance overhauls (each individual NPC replacer counts as 1 mod)

**Phase 9 (Gameplay) — expand to 8+ sub-passes:**
1. Combat (primary overhaul + targeted tweaks)
2. Magic & spells (new spell packs, enchantment changes)
3. Perks & leveling (primary overhaul + addons)
4. Economy & loot (vendor changes, loot distribution, gold economy)
5. Crafting & smithing (recipes, breakdown, smelting)
6. AI & NPC behavior (schedules, dialogue, reactions)
7. Immersion & roleplay (needs, camping, hypothermia, religion)
8. Items & equipment (new weapons, armor sets, jewelry, with distribution)

**Phase 10 (Locations) — expand to 4+ sub-passes:**
1. Major city overhauls
2. Towns & villages
3. New locations & dungeons
4. Player homes
5. Landscape & worldspace changes

### ESL Flagging Strategy at Scale

With 2000+ mods, the 254 full-plugin limit becomes the binding constraint.
Large lists survive by aggressively ESL-flagging eligible plugins:

**Always ESL-flag when possible:**
- Texture-only plugins with <4096 new records
- Individual NPC replacer plugins
- Small patch plugins (mod A + mod B compatibility)
- Single-item addition mods (one weapon, one armor set)
- Translation plugins

**Never ESL-flag:**
- Plugins that are masters for other plugins (breaks dependency chain)
- Plugins with >4096 new FormIDs (pre-1.6.1130: >2048)
- Plugins mid-save (ESL-flagging changes Form ID prefix, corrupts save references)
- DynDOLOD output or Synthesis output (complex record structures)

**Plugin budget rule of thumb:** Reserve ~100 full plugin slots for large mods that can't
be ESL-flagged. The remaining ~150 slots fill fast. Every small plugin that CAN be
ESL-flagged SHOULD be, freeing slots for the big mods that need them.

### Patch Density at Scale

Large lists have a **combinatorial patch problem**: N mods that could interact produces
up to N*(N-1)/2 potential patch needs. In practice:

- The top ~20 most popular "hub" mods (USSEP, major city overhaul, major weather mod,
  body framework, perk overhaul) each have 10-50 published patches on Nexus.
- Patch authors like "Janquel," "Slim," "kryptopyr" maintain large patch compilations.
- Search strategy: check the hub mod's Nexus page → "Mods requiring this file" tab.
  Patches are almost always listed there, not discoverable via title search.

### BA2 Archive Limit (Fallout 4 Specific)

Fallout 4 has a ~256 non-texture BA2 archive limit. At large scale this constrains
before the 254 plugin limit. Strategies:
- Prefer BA2-packed mods over loose files (FO4 stutters worse with loose files)
- Consolidate small mods' loose files into merged BA2s using Cathedral Assets Optimizer
- Monitor BA2 count alongside plugin count

</scale_strategies>

<pre_selection_conflict_check>

## Pre-Selection Conflict Checking (CRITICAL)

The LLM MUST check for mutual exclusivity BEFORE adding a mod, not just during the
final compatibility review phase. The patch phase (Phase 10/11) is a safety net, not
the primary conflict detection mechanism.

**Before calling add_to_modlist for any mod, the LLM should:**

1. **Check the mutually exclusive cluster table above.** If the mod belongs to a cluster
   (e.g., "grass overhaul," "combat overhaul," "weather overhaul") AND another mod from
   the same cluster is already in the modlist, DO NOT add it. Pick the better one or
   skip this one.

2. **Check if the mod replaces the same files as an existing mod.** Two comprehensive
   texture packs covering the same surfaces (e.g., two full landscape overhauls) are
   redundant — pick the one that better fits the user's aesthetic preference.

3. **Check the mod's Nexus description for explicit incompatibilities.** If get_mod_details
   reveals "incompatible with [mod already in list]," do not add it.

**Common violations observed in E2E testing:**

*Skyrim:*
- Adding two GLOBAL grass overhauls (e.g., SFO + Wildlands Renewal) that both replace ALL
  grass records. Note: regional grass mods (Cathedral 3D Pine, Folkvangr, Veydosebrom Regions)
  CAN be combined with a patch like "QW's Grass Patch" — but full-scope overhauls cannot.
- Adding both ENB and Community Shaders in the same list.
- Adding two full city overhaul suites (JK's Skyrim + ETaC) without verifying a patch exists.
- Adding Lux without queuing its required patches for every interior-editing mod in the list.

*Fallout 4:*
- Adding NICER Survival + Loot Overhaul + Survival Options — three mods all rebalancing the
  same survival/economy systems. Pick ONE comprehensive survival overhaul, then small tweaks.
- Adding Vivid Fallout AIO + FlaconOil Complete Retexture — two full-coverage texture packs
  replacing the same assets. Pick one base pack.
- Adding a weather-inclusive lighting mod (Lightweight Lighting) + a standalone weather mod
  (True Storms) — both replace weather records.
- Adding Arbitration (comprehensive combat overhaul) + Realistic Weapon Damages (also edits
  damage values) — overlapping combat record edits.

</pre_selection_conflict_check>

<dependency_chain_rules>

## Dependency Chain Rules

### Hard Dependencies (Must Be Present)

When the LLM adds a mod, it MUST check for and satisfy these dependency types:

1. **Plugin masters** — The mod's .esp/.esm lists master files in its header. Every master
   must be present and loaded earlier. Missing masters = instant CTD on game launch.
2. **Framework dependencies** — Mods requiring SKSE/F4SE, Address Library, SkyUI, MCM, etc.
   These are usually listed in the Nexus "Requirements" section.
3. **Asset dependencies** — Mods that reference textures/meshes from a resource pack
   (e.g., "Rustic Clothing" requires SMIM meshes). Missing assets = purple/invisible objects.
4. **DLC dependencies** — Many mods require specific DLCs (Dawnguard, Dragonborn, Hearthfire
   for Skyrim; Far Harbor, Nuka-World, Automatron for FO4). The LLM should verify DLC
   requirements match the user's owned content.

### Soft Dependencies (Recommended but Optional)

- **Suggested mods** — Listed on Nexus as "suggested" rather than "required." These enhance
  the mod but aren't needed for it to function.
- **Recommended patches** — Patches between two mods that share record space. Not required
  for either mod to work, but prevent one mod from silently overriding the other.

### Circular and Chain Dependencies

- Some mod ecosystems form long chains: Mod A requires B, B requires C, C requires D.
  The LLM should follow the chain to its root and include all links.
- Avoid circular dependencies (A requires B, B requires A) — these indicate an error
  on the mod page. Flag for user review.

</dependency_chain_rules>

<conflict_detection_heuristics>

## Conflict Detection Heuristics

### Record-Level Conflict Indicators

When two mods in the list edit the same record type, apply these heuristics:

| Record Type | Conflict Severity | Resolution |
|-------------|------------------|------------|
| CELL (cell headers) | HIGH — causes visual/performance bugs | Forwarding patch or remove one mod |
| NPC_ (NPC records) | MEDIUM — dark face bug, wrong AI | Load order or patch |
| LVLI/LVLN/LVSP (leveled lists) | HIGH — only last mod's items appear | Bashed Patch / Synthesis |
| WTHR (weather) | CRITICAL — only one weather system | Pick one weather overhaul |
| RACE (race records) | HIGH — body/face mesh mismatch | Only one race editor |
| GMST (game settings) | LOW — intentional overrides | Specify which mod should win |
| WEAP/ARMO (weapons/armor) | MEDIUM — stat/model conflicts | Load order preference |
| PERK (perk trees) | CRITICAL — broken perk progression | Mutually exclusive |
| MGEF (magic effects) | MEDIUM — overlapping spell behavior | Patch or load order |
| OMOD (object modifications, FO4) | HIGH — fixed slot conflicts | xEdit patch required |
| NAVM (navmeshes) | CRITICAL — CTD if deleted | Never delete; only add or modify |
| KYWD (keywords) | LOW-MEDIUM — distribution issues | Synthesis merge |

### Heuristic: Same-Category Overlap

If two mods are both categorized under the same Nexus category AND both have plugins,
they are likely to touch overlapping records. The LLM should proactively check the
mod description for compatibility notes.

### Heuristic: Name Pattern Matching

Mods whose names contain the same game system keyword (e.g., both contain "combat,"
both contain "perk," both contain "weather") have elevated conflict probability.
The LLM should verify they are compatible before including both.

### Heuristic: Author Ecosystem

Mods by the same author are usually designed to work together. Cross-author mods
covering the same system are more likely to conflict.

**Major author suites (Skyrim) — pick ONE suite per system, don't mix:**
- **EnaiRim** (EnaiSiaion): Ordinator (perks), Apocalypse (spells), Wildcat (combat),
  Thunderchild (shouts), Imperious (races), Wintersun (religion), Growl (werewolves),
  Sacrilege (vampires). Suite is "finished" — not actively updated.
- **SimonRim** (SimonMagus616): Adamant (perks), Mysticism (spells), Blade & Blunt
  (combat), Pilgrim (religion), Manbeast (werewolves), Scion (vampires), Mundus
  (standing stones), Aetherius (races). Actively maintained.
- **kryptopyr suite**: Complete Crafting Overhaul, Complete Alchemy & Cooking Overhaul,
  Weapons Armor Clothing & Clutter Fixes. These are compatible with both EnaiRim and
  SimonRim but require suite-specific patches.

You CAN mix mods from different suites if they cover DIFFERENT systems (e.g., Ordinator
perks + Blade & Blunt combat), but NEVER mix two mods from different suites that cover
the SAME system (e.g., Ordinator + Adamant both overhaul perks).

**NPC Replacer Ecosystem (scale driver):**
NPC appearance mods are organized by author/faction/group, not individual NPCs. A large
modlist typically stacks 30-50 NPC replacer mods:
- Pandorable series (~5 mods: NPCs, Dawnguard, Dragonborn, Males, Initiates)
- Bijin series (~8 mods: Warmaidens, NPCs, Wives + custom body variants)
- Modpocalypse series (~12 mods: vanilla NPCs + per-quest-mod patches)
- RS Children (~10 mods: base + per-mod patches)
These are safe to stack as long as left-pane (install) order is correct for FaceGen
file priority — see dark face bug rules in game-specific files.

### False Positive Conflict Guards

Do NOT flag these as conflicts — they look like conflicts but are intentional or harmless:

- **Mod-vs-vanilla overrides** — A mod changing a vanilla game setting (e.g., tree scale,
  NPC aggression radius) is the entire point of the mod, not a bug.
- **Identical-to-master records** — Records that are exact copies of vanilla data. These are
  unintentional copies (ITMs) and are noise, not real conflicts. Flag for xEdit cleaning only.
- **Multiple SKSE/F4SE DLL plugins** — DLL plugins use the engine's trampoline memory system
  and generally do NOT conflict unless they patch the exact same engine function. Well-designed
  plugins (e.g., SSE Engine Fixes + Bug Fixes SSE) auto-disable overlapping patches.
  Do NOT flag two SKSE plugins as conflicting just because "they're both SKSE plugins."
- **Persistent reference flag** — This flag is cumulative; if any mod sets it to true, it
  stays true regardless of load order. Always a false positive.
- **GMST (game settings) overrides** — These are pure "last loaded wins" by design. Flag
  which mod's values will take effect, but do NOT treat as an error requiring removal.

</conflict_detection_heuristics>

<patch_discovery_patterns>

## Patch Discovery Patterns

### Naming Conventions on Nexus (5 Formats)

Compatibility patches follow these predictable naming patterns. The LLM should try
searches in this order, as earlier formats are more likely to return results:

1. **Official Patch Hub** — `"[ModName] - Patch Hub"` or `"[ModName] Patch Hub"`
   Major mods bundle ALL their compatibility patches into a single FOMOD download.
   Examples: `Lux - Patch Hub`, `Lux Via - Patch Hub`, `ELFX Shadows - Official Patches Hub`.
   The FOMOD auto-detects installed mods and offers the right patches.

2. **Third-party Patch Collection** — `"[ModName] Patch Collection"` or `"Unofficial [ModName] Patches"`
   Community authors bundle patches for mods they didn't create.
   Examples: `JK's Skyrim Patch Collection`, `JK's Interiors Patch Collection`, `My Lux Patches`.

3. **Two-mod dash format** — `"[ModA] - [ModB] Patch"` (most common single-patch format)
   Examples: `JK's Skyrim - Dawn of Skyrim - Patch`, `Morrowloot Ultimate - Summermyst Patch`.

4. **Apostrophe-dropped variant** — Same as #3 but with punctuation removed.
   Example: `JKs Skyrim - AI Overhaul SSE Patch` (no apostrophe in "JK's").
   Always search both with and without apostrophes.

5. **Abbreviation style** — Major mods have well-known abbreviations used in patch names.
   Common abbreviations: ICOW (Immersive College of Winterhold), ELFX, SMIM, LOTD,
   ETaC, AOS, USSEP, UFO4P, CBBE, BHUNP, PRP, SFO, OWL.

### Discovery Strategy (Priority Order)

1. **Check the mod's own Nexus page** — Look at "Requirements" and "Mods requiring this file"
   tabs. Patches are almost always listed as requiring both mods they patch.
2. **Search for Patch Hub first** — Many major mods (Lux, ELFX, JK's Skyrim) bundle all
   patches in a single Hub download with an FOMOD installer. One download = dozens of patches.
3. **Check the other mod's page** — The reverse direction often has the patch listed too.
4. **Check known patch compilation mods** — Lexy's LOTD guide uses Part 10 entirely for
   patch collections organized by author. For FO4: `Vish's Patch Hub (UFO4P)`,
   `Who's The General Patch Hub`.
5. **Do NOT rely on Nexus title search as primary strategy** — Patch naming is inconsistent.
   Title search should be a last resort after checking mod pages and patch hubs.

### Prolific Patch Authors

**Skyrim:**
- Janquel (JK's Interiors patches, Lux patches)
- ElSopa (texture patches)
- agentw (LOTD patches)
- kryptopyr (gameplay/crafting overhaul patches — Weapons Armor Clothing and Clutter Fixes)
- The Lux team (official Lux Patch Hub — most interior mods have a Lux patch here)

**Fallout 4:**
- Vish (UFO4P patch hub)
- The PRP team (precombine patches for mods that break precombines)
Note: FO4's patch ecosystem is significantly less documented than Skyrim's. The LLM should
be more conservative about assuming patches exist for FO4 mod pairs.

</patch_discovery_patterns>

<phase_cap_guidelines>

## Phase Cap Guidelines for Scale

**Current state (as of v0.5.x):** The DB `max_mods` caps hard-limit modlist size.
Current totals: Skyrim = 54 max possible, Fallout 4 = 47 max possible. E2E tests
produce ~38-42 mods. To compete with Nolvus (2050) or LoreRim (4265), these caps
must increase dramatically.

### Current vs Recommended Phase Caps (Skyrim)

| Phase | Current Name | Current Cap | Recommended Cap (Medium ~150) | Recommended Cap (Large ~500) |
|-------|-------------|-------------|-------------------------------|------------------------------|
| 1 | Essentials & Frameworks | 5 | 8 | 15 |
| 2 | UI & Interface | 4 | 10 | 20 |
| 3 | Fixes & Bug Patches | 5 | 10 | 20 |
| 4 | Foundation Textures | 8 | 40 | 150 |
| 5 | Animation & Physics | 4 | 12 | 30 |
| 6 | Audio | 3 | 8 | 15 |
| 7 | Gameplay & Playstyle | 10 | 25 | 60 |
| 8 | Locations & World | 4 | 15 | 50 |
| 9 | Lighting & Weather | 3 | 5 | 10 |
| 10 | Compatibility Patches | 8 | 20 | 80 |
| **Total** | | **54** | **153** | **450** |

**Key insight:** Phase 4 (Textures) is the single biggest scale lever. Nolvus has 500+
texture/visual mods. Phase 10 (Patches) scales proportionally with content phases.
A 500-mod list generates ~80 compatibility patches.

### Where the Extra Mods Come From (Nolvus Breakdown)

Based on Nolvus's 2050-mod structure across 37 separators:
- **NPC overhauls**: ~50 mods (Pandorable, Bijin, Modpocalypse, RS Children series + patches)
- **Per-area texture replacers**: ~100 mods (individual architecture, dungeon, landscape packs)
- **Individual item retextures**: ~80 mods (per-weapon, per-armor retextures)
- **Creature retextures**: ~30 mods (per-creature replacers)
- **Animation packs**: ~40 mods (per-action OAR replacers)
- **Patches**: ~300 mods (per-mod-pair compatibility patches)
- **Frameworks/tools**: ~60 mods (SKSE plugins, resource libraries)

### Sub-Pass Implementation

For phases with caps above 30, the LLM should internally subdivide into sub-passes
to maintain focused search queries. Each sub-pass searches Nexus for its specific
domain and adds mods before moving to the next sub-pass. The sub-pass breakdown is
documented in the `<scale_strategies>` section above.

</phase_cap_guidelines>

<quality_signals>

## Mod Quality Signals

When evaluating mods at scale, the LLM should weight these quality signals:

### Strong Positive Signals
- **High endorsement count** (>1000 for Skyrim, >500 for FO4) — community validated
- **Recent updates** (within 12 months) — actively maintained
- **Low bug report ratio** (bugs tab has few open reports relative to downloads)
- **Author has multiple popular mods** — experienced modder
- **Listed as requirement by many other mods** — ecosystem hub mod
- **Present in major curated lists** (Nolvus, LoreRim, STEP, Lexy's) — expert-vetted

### Caution Signals
- **No updates in 2+ years** — may be abandoned; check if a successor exists
- **High bug count with no author response** — potential orphaned mod
- **"Alpha" or "Beta" in title** — unfinished, higher crash risk
- **Very low endorsements despite high downloads** — users downloaded but didn't endorse
  (often means it caused problems)
- **Mod description says "do not use with [common mod]"** — check if that mod is in the list

### Avoid Signals
- **Deleted/hidden from Nexus** — usually removed for a reason
- **Known to delete navmeshes** (per universal prohibitions)
- **Requires outdated frameworks** (e.g., FISS instead of MCM Helper, AWKCR instead of ECO)
- **Author explicitly states "incompatible with large modlists"**

</quality_signals>

<cross_game_differences>

## Key Cross-Game Compatibility Differences

### Skyrim SE/AE vs Fallout 4

| Aspect | Skyrim SE/AE | Fallout 4 |
|--------|-------------|-----------|
| Precombines | Not applicable | CRITICAL — breaking precombines tanks FPS |
| Loose files | Minor performance impact | Significant stutter; prefer BA2-packed |
| ESL record cap | 2048 (pre-BoBW) / 4096 (AE) | 4096 |
| Plugin limit | 254 full + 4096 ESL | 254 full + 4096 ESL |
| Archive limit | ~unlimited BSAs | ~256 non-texture BA2s |
| Texture stacking | Install order only | Install order only |
| Leveled list merge | Bashed Patch / Synthesis | Bashed Patch / Synthesis |
| Animation framework | Nemesis + OAR/DAR | No equivalent (limited animation modding) |
| Object modifications | N/A | OMOD system — fixed slots, no auto-merge |
| City overhaul safety | Navmesh conflicts | Precombine breaks + navmesh |
| Scrap mods | Generally safe (no precombines) | NEVER (breaks precombines) |

### Implications for LLM Selection

- **Skyrim lists can be more aggressive** with city overhauls, interior redesigns, and placed
  object changes because there's no precombine system to break.
- **Fallout 4 lists must be conservative** with any mod that edits placed vanilla objects.
  Texture-only and new-item-only mods are always safe. Interior/exterior redesigns require
  PRP patches or rebuilt precombines.
- **Both games** benefit equally from aggressive ESL flagging at scale.

### FO4 Settlement Mod Compatibility (Critical)

Settlement mods are a major FO4 category with unique precombine risks:

**Safe settlement mods (no precombine impact):**
- Mods that ADD new objects only (crafting stations, decorations, furniture)
- Sim Settlements 2 (uses its own build system, doesn't edit vanilla placed objects)
- Place Everywhere (DLL-only, no ESP, no cell edits)
- Clean My Settlement (removes bramble/vines without breaking precombines)
- Ultimate Scrap Recipes (scrap recipes with no cell edits)

**NEVER recommend these (break precombines):**
- Scrap Everything — breaks precombines globally, causes massive FPS drops in dense areas
- Clean and Simple — modifies vanilla settlement cells
- All Settlements Extended — edits vanilla settlement boundaries
- Any mod that moves, deletes, or resizes EXISTING vanilla placed objects

**Sim Settlements 2 specific conflicts:**
- Incompatible with mods that significantly alter vanilla settlement locations
- Requires XDI compatibility patch if Extended Dialogue Interface is present
- Beantown Interiors Project conflicts with SS2 interior cells (needs True Interior Patch)
- Flicker Fixer causes floor-clipping in SS2 cells

</cross_game_differences>

<generation_quality_rules>

## Rules for Generation Quality at Scale

### Diversity Over Popularity

Do NOT recommend the same "top 10" mods in every list. Large curated lists succeed because
they find the BEST mod for each specific niche, not the most popular mod that vaguely covers it.

**Example:** Instead of just "Skyrim 2020 Parallax" for all architecture textures, a large list
picks specialized replacers: one for Whiterun architecture, one for Solitude, one for Riften,
one for Dwemer ruins, one for Nordic ruins, one for Imperial forts — each by the artist with
the best version for that specific style.

### Version Consistency Over Quantity

A list of 500 version-consistent, non-conflicting mods is better than 2000 mods with
50 unresolved conflicts. Scale should NEVER come at the cost of stability.

### Respect the User's Vision

The user's playstyle preference, hardware constraints, and custom description should
influence mod selection at every phase. A "survival horror" playstyle list at 500 mods
looks completely different from a "visual showcase" list at 500 mods — the scale target
is the same but the composition differs dramatically.

### Don't Pad with Redundant Mods

Adding 5 different grass mods that all replace the same grass records is padding, not
scale. Each mod should add net-new visual or gameplay value. If two mods cover the same
niche, pick the better one — don't include both.

</generation_quality_rules>
