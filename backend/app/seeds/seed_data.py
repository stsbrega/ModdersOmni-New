"""Seed data for games, playstyles, and curated mods."""

GAMES = [
    {
        "name": "Skyrim Special Edition",
        "slug": "skyrimse",
        "nexus_domain": "skyrimspecialedition",
        "image_url": None,
        "versions": ["SE", "AE"],
    },
    {
        "name": "Fallout 4",
        "slug": "fallout4",
        "nexus_domain": "fallout4",
        "image_url": None,
        "versions": ["Standard", "Next-Gen"],
    },
]

PLAYSTYLES = {
    "skyrimse": [
        {
            "name": "Vanilla+",
            "slug": "vanilla-plus",
            "description": "Keep the core Skyrim experience with quality-of-life improvements, bug fixes, and subtle visual upgrades.",
            "icon": "sparkles",
        },
        {
            "name": "Survival / Hardcore",
            "slug": "survival",
            "description": "Hunger, cold, fatigue, and deadly encounters. Transform Skyrim into a harsh survival experience.",
            "icon": "tent",
        },
        {
            "name": "Combat Overhaul",
            "slug": "combat",
            "description": "Revamp melee, archery, and magic combat with new animations, dodge mechanics, and enemy AI.",
            "icon": "swords",
        },
        {
            "name": "Magic / Spellcaster",
            "slug": "magic",
            "description": "Expand the magic system with hundreds of new spells, enchantments, and magical mechanics.",
            "icon": "wand-2",
        },
        {
            "name": "Visual / Graphics",
            "slug": "visual",
            "description": "Push Skyrim's visuals to the limit with ENB presets, texture packs, weather overhauls, and lighting mods.",
            "icon": "camera",
        },
        {
            "name": "Immersion / Roleplay",
            "slug": "immersion",
            "description": "Deep roleplaying with NPC overhauls, dialogue expansion, economy changes, and world-building mods.",
            "icon": "drama",
        },
    ],
    "fallout4": [
        {
            "name": "Vanilla+",
            "slug": "vanilla-plus",
            "description": "Improve the base Fallout 4 experience with essential fixes, UI improvements, and balanced tweaks.",
            "icon": "sparkles",
        },
        {
            "name": "Survival / Hardcore",
            "slug": "survival",
            "description": "Real needs, harder combat, scarce resources, and a truly post-apocalyptic survival experience.",
            "icon": "tent",
        },
        {
            "name": "Settlement Builder",
            "slug": "settlement",
            "description": "Supercharge settlement building with expanded objects, snapping, power tools, and city-scale builds.",
            "icon": "hammer",
        },
        {
            "name": "Combat / Tactical",
            "slug": "combat",
            "description": "Realistic ballistics, weapon overhauls, new animations, tactical AI, and cover-based combat.",
            "icon": "swords",
        },
        {
            "name": "Visual / Graphics",
            "slug": "visual",
            "description": "Transform the Commonwealth with high-resolution textures, lighting overhauls, weather, and ENB.",
            "icon": "camera",
        },
        {
            "name": "Sim Settlements",
            "slug": "sim-settlements",
            "description": "Let settlers build their own homes and shops. Cities grow organically with Sim Settlements framework.",
            "icon": "building-2",
        },
    ],
}

# Curated mod database for Skyrim SE
# Each entry: (nexus_mod_id, name, author, summary, category, performance_impact,
#               vram_requirement_mb, game_version_support)
# game_version_support: "all", "se_only", "ae_required", "ae_recommended"
SKYRIM_MODS = [
    # === Essential / Vanilla+ (all tiers) ===
    (266, "Unofficial Skyrim Special Edition Patch", "Arthmoor",
     "Comprehensive bug fix compilation for Skyrim SE.",
     "Bug Fixes", "minimal", None, "all"),
    (1651, "SSE Engine Fixes", "aers",
     "Engine-level bug fixes and memory patches for Skyrim SE.",
     "Bug Fixes", "minimal", None, "all"),
    (32444, "Address Library for SKSE Plugins", "meh321",
     "Shared library of memory addresses used by SKSE plugins.",
     "Modders Resources", "minimal", None, "all"),
    (12604, "SkyUI", "SkyUI Team",
     "Elegant, PC-friendly interface with mod configuration menu.",
     "User Interface", "minimal", None, "all"),
    (19246, "Static Mesh Improvement Mod", "Brumbek",
     "Improved 3D models for architecture, clutter, landscape, and more.",
     "Models and Textures", "low", 512, "all"),
    (18830, "A Quality World Map", "IcePenguin",
     "High quality world map with roads and detailed terrain.",
     "User Interface", "minimal", None, "all"),
    (3863, "Cutting Room Floor", "Arthmoor",
     "Restores content cut from the final game release.",
     "Gameplay", "minimal", None, "all"),
    (21294, "Weapons Armor Clothing and Clutter Fixes", "kryptopyr",
     "Fixes bugs and inconsistencies for items in Skyrim.",
     "Bug Fixes", "minimal", None, "all"),

    # === AE-Specific Essential ===
    (97972, "AE CC Content Fixes", "Jelidity",
     "Bug fixes for all Anniversary Edition Creation Club content.",
     "Bug Fixes", "minimal", None, "ae_required"),
    (58425, "Skyrim Anniversary Edition Content Integration", "Various",
     "Integrates AE Creation Club content into the world more naturally.",
     "Gameplay", "minimal", None, "ae_required"),
    (98864, "CC Survival Mode - Improved", "Parapets",
     "Enhances the CC Survival Mode with better balance and features.",
     "Gameplay", "minimal", None, "ae_required"),
    (64578, "Saints and Seducers Extended Cut", "Various",
     "Expanded version of the AE Saints and Seducers quest.",
     "Quests", "minimal", None, "ae_required"),

    # === Survival ===
    (28029, "Frostfall - Hypothermia Camping Survival", "Chesko",
     "Comprehensive cold weather survival system with camping.",
     "Immersion", "minimal", None, "all"),
    (38571, "Campfire - Complete Camping System", "Chesko",
     "Portable camping gear, tents, fires, and skill system.",
     "Immersion", "minimal", None, "all"),
    (50251, "Sunhelm Survival and Needs", "colinswrath",
     "Lightweight survival mod covering hunger, fatigue, and cold.",
     "Immersion", "minimal", None, "all"),
    (2018, "Hunterborn", "unuroboros",
     "Expanded hunting and foraging mechanics for animal harvesting.",
     "Gameplay", "minimal", None, "all"),
    (67890, "The Frozen North - Minimalist Survival Overhaul", "Parapets",
     "Lightweight survival overhaul that works alongside CC Survival Mode.",
     "Immersion", "minimal", None, "ae_recommended"),

    # === Combat ===
    (15170, "Wildcat - Combat of Skyrim", "EnaiSiaion",
     "Lethal and dynamic combat overhaul with injuries and timed block.",
     "Combat", "minimal", None, "all"),
    (99233, "Valhalla Combat", "dTry",
     "Modernized combat with timed block, stamina management, and execution.",
     "Combat", "minimal", None, "all"),
    (2700, "TK Dodge RE", "tktk",
     "Responsive dodge roll mechanic for melee and ranged combat.",
     "Combat", "minimal", None, "all"),
    (53148, "True Directional Movement", "Ersh",
     "Target lock, directional movement, and headtracking.",
     "Combat", "minimal", None, "all"),
    (76843, "Precision - Accurate Melee Collisions", "Ersh",
     "Physics-based melee hit detection and weapon trails.",
     "Combat", "minimal", None, "all"),
    (111850, "MCO - Modern Combat Overhaul", "distar",
     "Complete animation-based combat overhaul with commitment attacks.",
     "Combat", "minimal", None, "all"),
    (85661, "SCAR - Skyrim Combos AI Revolution", "NickNak",
     "AI combat enhancements with combo support for enemies.",
     "Combat", "minimal", None, "all"),

    # === Magic ===
    (9137, "Apocalypse - Magic of Skyrim", "EnaiSiaion",
     "Adds 155 new spells across all schools of magic.",
     "Magic", "minimal", None, "all"),
    (104440, "Mysticism - A Magic Overhaul", "SimonMagus",
     "Rebalances and expands vanilla magic with new spells and effects.",
     "Magic", "minimal", None, "all"),
    (39199, "Triumvirate - Mage Archetypes", "EnaiSiaion",
     "Adds unique spells and powers for mage character archetypes.",
     "Magic", "minimal", None, "all"),
    (80660, "Odin - Skyrim Magic Overhaul", "EnaiSiaion",
     "Overhauls vanilla spells and adds new ones with improved effects.",
     "Magic", "minimal", None, "all"),
    (106030, "Arclight - A Complete Shock Magic Overhaul", "Jeir",
     "Rebalances and expands destruction shock magic with new effects.",
     "Magic", "minimal", None, "all"),

    # === Visual - Low/Mid tier ===
    (2347, "Skyrim Flora Overhaul", "vurt",
     "Overhauls trees, plants, and grass with new models and textures.",
     "Models and Textures", "medium", 1024, "all"),
    (607, "Noble Skyrim Mod HD-2K", "Shutt3r",
     "Complete texture pack covering architecture, landscape, and more.",
     "Models and Textures", "medium", 2048, "all"),
    (17802, "Realistic Water Two", "isoku",
     "Overhauls water with realistic textures, flow, and effects.",
     "Models and Textures", "low", 256, "all"),
    (2572, "Climates Of Tamriel", "JJC71",
     "Weather and lighting overhaul with hundreds of new weather types.",
     "Environment", "low", 256, "all"),
    (47785, "ELFX - Enhanced Lights and FX", "anamorfus",
     "Interior and exterior lighting overhaul for more atmospheric visuals.",
     "Environment", "low", 256, "all"),

    # === Visual - High/Ultra tier ===
    (1089, "ENB Series - Rudy ENB", "Rudy102",
     "Photorealistic ENB preset with advanced lighting and effects.",
     "ENB Preset", "extreme", 4096, "all"),
    (42521, "Obsidian Weathers and Seasons", "Obsidian",
     "Modern weather overhaul with seasons and dynamic weather.",
     "Environment", "low", 256, "all"),
    (68292, "Lux - Via", "Sukolgaming",
     "Complete lighting overhaul for road and bridge lighting.",
     "Environment", "low", 128, "all"),
    (113588, "Skyland AIO", "Skyland",
     "All-in-one texture pack covering landscapes, architecture, and dungeons.",
     "Models and Textures", "medium", 2048, "all"),
    (75790, "Lux", "Sukolgaming",
     "Complete interior lighting overhaul with hand-placed light sources.",
     "Environment", "medium", 512, "all"),
    (89455, "Skyrim Particle Patch for ENB", "mindflux",
     "Fixes particle lights and glow effects for use with ENB.",
     "ENB Preset", "minimal", None, "all"),
    (85547, "Community Shaders", "doodlum",
     "Open-source shader framework as an alternative to ENB.",
     "ENB Preset", "medium", 1024, "all"),

    # === Immersion / Roleplay ===
    (36334, "Relationship Dialogue Overhaul", "CloudedTruth",
     "Thousands of new lines of dialogue for followers and NPCs.",
     "Immersion", "minimal", None, "all"),
    (29969, "Immersive Citizens - AI Overhaul", "Arnaud dOrchymont",
     "Overhauls NPC AI for more realistic schedules and behavior.",
     "NPC", "minimal", None, "all"),
    (11811, "Ordinator - Perks of Skyrim", "EnaiSiaion",
     "Overhauls the perk tree with 469 new perks across all skill trees.",
     "Gameplay", "minimal", None, "all"),
    (1334, "Interesting NPCs", "Kris Takahashi",
     "Adds over 250 fully voiced NPCs with quests and follower options.",
     "NPC", "low", 512, "all"),
    (68000, "JK Skyrim", "Jkrojmal",
     "Overhauls all major cities and towns with new architecture and details.",
     "Environment", "medium", 1024, "all"),
    (56785, "Inigo", "SmartBlueCat",
     "Fully voiced Khajiit companion with over 7000 lines of dialogue.",
     "NPC", "minimal", None, "all"),
    (98160, "Sirenroot - Deluge of Deceit", "ggunit",
     "A substantial quest mod with dungeons, puzzles, and voice acting.",
     "Quests", "low", 256, "all"),
]

# Curated mod database for Fallout 4
# game_version_support: "all", "pre_nextgen", "nextgen_only", "nextgen_recommended"
FALLOUT4_MODS = [
    # === Essential / Vanilla+ ===
    (4598, "Unofficial Fallout 4 Patch", "Arthmoor",
     "Comprehensive bug fix compilation for Fallout 4.",
     "Bug Fixes", "minimal", None, "all"),
    (102, "Armorsmith Extended", "Gambit77",
     "Full armor customization with layered system and workbench crafting.",
     "Crafting", "minimal", None, "all"),
    (4472, "Full Dialogue Interface", "Cirosan",
     "Shows the full text of dialogue options instead of abbreviated summaries.",
     "User Interface", "minimal", None, "all"),
    (6091, "Improved Map with Visible Roads", "mm137",
     "Better world map with visible roads and colored regions.",
     "User Interface", "minimal", None, "all"),
    (27602, "Sim Settlements 2", "kinggath",
     "Settlers build their own homes, shops, and defenses automatically.",
     "Settlement", "low", 512, "all"),
    (3841, "Spring Cleaning", "Sp4rkR4t",
     "Enables scrapping of all static objects in settlements.",
     "Settlement", "minimal", None, "all"),

    # === Next-Gen Specific ===
    (78900, "Fallout 4 Next-Gen Patch Fix", "Various",
     "Community patch fixing issues introduced by the Next-Gen Update.",
     "Bug Fixes", "minimal", None, "nextgen_only"),
    (79050, "Buffout 4 NG", "aers",
     "Crash logger and engine fixes updated for the Next-Gen runtime.",
     "Bug Fixes", "minimal", None, "nextgen_only"),
    (79200, "F4SE Next-Gen Compatible", "ianpatt",
     "Script Extender for the Next-Gen version of Fallout 4.",
     "Modders Resources", "minimal", None, "nextgen_only"),

    # === Pre-Next-Gen Only (classic F4SE) ===
    (47327, "Buffout 4", "aers",
     "Crash logger and engine bug fixes for classic Fallout 4.",
     "Bug Fixes", "minimal", None, "pre_nextgen"),
    (42147, "F4SE - Fallout 4 Script Extender", "ianpatt",
     "Script Extender for classic Fallout 4 (pre-Next-Gen).",
     "Modders Resources", "minimal", None, "pre_nextgen"),

    # === Survival ===
    (12511, "Horizon", "Zawinul",
     "Complete survival overhaul covering loot, crafting, combat, and progression.",
     "Gameplay Overhaul", "minimal", None, "all"),
    (37793, "Gas Masks of the Wasteland", "lKocMoHaBTl",
     "Environmental hazards require gas masks and filters to survive.",
     "Immersion", "minimal", None, "all"),
    (55520, "Wasteland Survival Guide", "Various",
     "Adds survival mechanics including radiation sickness and disease.",
     "Immersion", "minimal", None, "all"),

    # === Combat / Tactical ===
    (15429, "Arbitration - Combat AI", "Greslin",
     "Smarter enemy AI with flanking, grenades, and realistic detection.",
     "Combat", "minimal", None, "all"),
    (10737, "Better Locational Damage", "Zzyxzz",
     "Realistic damage based on hit location with armor penetration.",
     "Combat", "minimal", None, "all"),
    (3177, "Enhanced Blood Textures", "dDefinder",
     "Improved blood textures, splatter, and wound effects.",
     "Models and Textures", "low", 256, "all"),
    (22223, "See Through Scopes", "henkspamansen",
     "Aim through scopes in real-time without the black overlay.",
     "Combat", "medium", 512, "all"),

    # === Visual ===
    (217, "Vivid Fallout - All in One", "Hein84",
     "Complete landscape texture overhaul for the Commonwealth.",
     "Models and Textures", "medium", 2048, "all"),
    (34346, "PhyLight - Physics based Relighting", "Rez de Chaussee",
     "Realistic lighting overhaul with physically based rendering.",
     "Environment", "medium", 1024, "all"),
    (1355, "True Storms - Wasteland Edition", "fadingsignal",
     "Intense weather with radiation storms, heavy fog, and dust storms.",
     "Environment", "low", 256, "all"),
    (27043, "NAC X - Natural and Atmospheric Commonwealth", "l00ping",
     "Weather, lighting, and visual effects overhaul for the Commonwealth.",
     "Environment", "medium", 1024, "all"),

    # === Settlement ===
    (7683, "Place Everywhere", "TheLich",
     "Remove placement restrictions for complete building freedom.",
     "Settlement", "minimal", None, "all"),
    (30396, "Workshop Framework", "kinggath",
     "Framework for advanced settlement scripting and management.",
     "Settlement", "minimal", None, "all"),
    (35005, "Homemaker - Expanded Settlements", "NovaCoru",
     "Hundreds of new settlement objects including institute and vault items.",
     "Settlement", "minimal", None, "all"),
]

# Compatibility rules: (mod_name_1, mod_name_2, rule_type, notes)
SKYRIM_COMPATIBILITY = [
    ("Wildcat - Combat of Skyrim", "Valhalla Combat", "conflicts",
     "Both overhaul combat mechanics. Choose one."),
    ("Climates Of Tamriel", "Obsidian Weathers and Seasons", "conflicts",
     "Both overhaul weather. Choose one."),
    ("Apocalypse - Magic of Skyrim", "Ordinator - Perks of Skyrim", "patch_available",
     "Use Apocalypse-Ordinator Compatibility Patch for full integration."),
    ("True Directional Movement", "Precision - Accurate Melee Collisions", "load_after",
     "Load Precision after TDM for proper hit detection."),
    ("Frostfall - Hypothermia Camping Survival", "Campfire - Complete Camping System", "requires",
     "Frostfall requires Campfire as a framework."),
    ("SkyUI", "Frostfall - Hypothermia Camping Survival", "requires",
     "Frostfall requires SkyUI for the MCM configuration menu."),
    ("Noble Skyrim Mod HD-2K", "Skyland AIO", "conflicts",
     "Both are full texture packs. Choose one based on your preference."),
    ("MCO - Modern Combat Overhaul", "Wildcat - Combat of Skyrim", "conflicts",
     "MCO replaces combat mechanics. Use one combat overhaul."),
    ("MCO - Modern Combat Overhaul", "Valhalla Combat", "conflicts",
     "MCO replaces combat mechanics. Use one combat overhaul."),
    ("ELFX - Enhanced Lights and FX", "Lux", "conflicts",
     "Both overhaul interior lighting. Choose one."),
    ("Mysticism - A Magic Overhaul", "Odin - Skyrim Magic Overhaul", "conflicts",
     "Both overhaul vanilla spells. Choose one."),
    ("CC Survival Mode - Improved", "Sunhelm Survival and Needs", "conflicts",
     "Both add survival needs. Choose one (CC Survival for AE, Sunhelm for SE)."),
    ("ENB Series - Rudy ENB", "Community Shaders", "conflicts",
     "Both are shader frameworks. Choose ENB or Community Shaders."),
]

FALLOUT4_COMPATIBILITY = [
    ("Horizon", "Better Locational Damage", "conflicts",
     "Horizon includes its own damage system. Do not combine."),
    ("Sim Settlements 2", "Workshop Framework", "requires",
     "Sim Settlements 2 requires Workshop Framework."),
    ("Sim Settlements 2", "Place Everywhere", "load_after",
     "Load Place Everywhere after Sim Settlements 2."),
    ("Buffout 4", "Buffout 4 NG", "conflicts",
     "Use Buffout 4 for classic or Buffout 4 NG for Next-Gen. Never both."),
    ("F4SE - Fallout 4 Script Extender", "F4SE Next-Gen Compatible", "conflicts",
     "Use the F4SE version matching your game version."),
]

# Playstyle -> mod assignments with priority and min hardware tier
# Format: (mod_name, priority, hardware_tier_min)
SKYRIM_PLAYSTYLE_MODS = {
    "vanilla-plus": [
        ("Unofficial Skyrim Special Edition Patch", 10, "low"),
        ("SSE Engine Fixes", 10, "low"),
        ("Address Library for SKSE Plugins", 10, "low"),
        ("SkyUI", 9, "low"),
        ("Static Mesh Improvement Mod", 7, "low"),
        ("A Quality World Map", 8, "low"),
        ("Cutting Room Floor", 6, "low"),
        ("Weapons Armor Clothing and Clutter Fixes", 8, "low"),
        ("Noble Skyrim Mod HD-2K", 5, "mid"),
        ("Realistic Water Two", 6, "low"),
        ("AE CC Content Fixes", 7, "low"),
        ("Skyrim Anniversary Edition Content Integration", 6, "low"),
    ],
    "survival": [
        ("Unofficial Skyrim Special Edition Patch", 10, "low"),
        ("SSE Engine Fixes", 10, "low"),
        ("Address Library for SKSE Plugins", 10, "low"),
        ("SkyUI", 9, "low"),
        ("Frostfall - Hypothermia Camping Survival", 9, "low"),
        ("Campfire - Complete Camping System", 9, "low"),
        ("Sunhelm Survival and Needs", 8, "low"),
        ("Hunterborn", 7, "low"),
        ("Wildcat - Combat of Skyrim", 6, "low"),
        ("Climates Of Tamriel", 5, "low"),
        ("The Frozen North - Minimalist Survival Overhaul", 7, "low"),
        ("CC Survival Mode - Improved", 8, "low"),
    ],
    "combat": [
        ("Unofficial Skyrim Special Edition Patch", 10, "low"),
        ("SSE Engine Fixes", 10, "low"),
        ("Address Library for SKSE Plugins", 10, "low"),
        ("SkyUI", 9, "low"),
        ("Valhalla Combat", 9, "low"),
        ("TK Dodge RE", 8, "low"),
        ("True Directional Movement", 9, "low"),
        ("Precision - Accurate Melee Collisions", 8, "low"),
        ("Ordinator - Perks of Skyrim", 6, "low"),
        ("MCO - Modern Combat Overhaul", 8, "low"),
        ("SCAR - Skyrim Combos AI Revolution", 7, "low"),
    ],
    "magic": [
        ("Unofficial Skyrim Special Edition Patch", 10, "low"),
        ("SSE Engine Fixes", 10, "low"),
        ("Address Library for SKSE Plugins", 10, "low"),
        ("SkyUI", 9, "low"),
        ("Apocalypse - Magic of Skyrim", 9, "low"),
        ("Mysticism - A Magic Overhaul", 8, "low"),
        ("Triumvirate - Mage Archetypes", 7, "low"),
        ("Odin - Skyrim Magic Overhaul", 7, "low"),
        ("Ordinator - Perks of Skyrim", 8, "low"),
        ("Arclight - A Complete Shock Magic Overhaul", 6, "low"),
    ],
    "visual": [
        ("Unofficial Skyrim Special Edition Patch", 10, "low"),
        ("SSE Engine Fixes", 10, "low"),
        ("Address Library for SKSE Plugins", 10, "low"),
        ("SkyUI", 9, "low"),
        ("Static Mesh Improvement Mod", 8, "low"),
        ("Skyrim Flora Overhaul", 7, "mid"),
        ("Noble Skyrim Mod HD-2K", 7, "mid"),
        ("Skyland AIO", 7, "mid"),
        ("Realistic Water Two", 8, "low"),
        ("Obsidian Weathers and Seasons", 8, "low"),
        ("Lux - Via", 6, "mid"),
        ("Lux", 7, "mid"),
        ("ELFX - Enhanced Lights and FX", 6, "mid"),
        ("ENB Series - Rudy ENB", 5, "high"),
        ("Skyrim Particle Patch for ENB", 5, "high"),
        ("Community Shaders", 6, "mid"),
    ],
    "immersion": [
        ("Unofficial Skyrim Special Edition Patch", 10, "low"),
        ("SSE Engine Fixes", 10, "low"),
        ("Address Library for SKSE Plugins", 10, "low"),
        ("SkyUI", 9, "low"),
        ("Relationship Dialogue Overhaul", 8, "low"),
        ("Immersive Citizens - AI Overhaul", 8, "low"),
        ("Ordinator - Perks of Skyrim", 7, "low"),
        ("Interesting NPCs", 7, "low"),
        ("JK Skyrim", 6, "mid"),
        ("Cutting Room Floor", 7, "low"),
        ("Climates Of Tamriel", 5, "low"),
        ("Inigo", 7, "low"),
        ("Sirenroot - Deluge of Deceit", 5, "low"),
    ],
}

FALLOUT4_PLAYSTYLE_MODS = {
    "vanilla-plus": [
        ("Unofficial Fallout 4 Patch", 10, "low"),
        ("Full Dialogue Interface", 9, "low"),
        ("Improved Map with Visible Roads", 8, "low"),
        ("Armorsmith Extended", 7, "low"),
        ("Vivid Fallout - All in One", 6, "mid"),
        ("True Storms - Wasteland Edition", 5, "low"),
        ("Buffout 4", 9, "low"),
        ("Buffout 4 NG", 9, "low"),
    ],
    "survival": [
        ("Unofficial Fallout 4 Patch", 10, "low"),
        ("Full Dialogue Interface", 9, "low"),
        ("Horizon", 9, "low"),
        ("Gas Masks of the Wasteland", 7, "low"),
        ("True Storms - Wasteland Edition", 6, "low"),
        ("Enhanced Blood Textures", 4, "low"),
        ("Wasteland Survival Guide", 6, "low"),
    ],
    "settlement": [
        ("Unofficial Fallout 4 Patch", 10, "low"),
        ("Full Dialogue Interface", 9, "low"),
        ("Sim Settlements 2", 9, "low"),
        ("Workshop Framework", 8, "low"),
        ("Place Everywhere", 8, "low"),
        ("Spring Cleaning", 7, "low"),
        ("Homemaker - Expanded Settlements", 6, "low"),
    ],
    "combat": [
        ("Unofficial Fallout 4 Patch", 10, "low"),
        ("Full Dialogue Interface", 9, "low"),
        ("Arbitration - Combat AI", 8, "low"),
        ("Better Locational Damage", 8, "low"),
        ("Enhanced Blood Textures", 5, "low"),
        ("Armorsmith Extended", 6, "low"),
        ("See Through Scopes", 6, "mid"),
    ],
    "visual": [
        ("Unofficial Fallout 4 Patch", 10, "low"),
        ("Full Dialogue Interface", 9, "low"),
        ("Vivid Fallout - All in One", 8, "mid"),
        ("PhyLight - Physics based Relighting", 7, "mid"),
        ("True Storms - Wasteland Edition", 7, "low"),
        ("NAC X - Natural and Atmospheric Commonwealth", 6, "mid"),
    ],
    "sim-settlements": [
        ("Unofficial Fallout 4 Patch", 10, "low"),
        ("Full Dialogue Interface", 9, "low"),
        ("Sim Settlements 2", 10, "low"),
        ("Workshop Framework", 9, "low"),
        ("Place Everywhere", 7, "low"),
        ("Spring Cleaning", 6, "low"),
        ("Homemaker - Expanded Settlements", 5, "low"),
    ],
}

# ──────────────────────────────────────────────
# Mod Build Phases — ordered generation steps
# ──────────────────────────────────────────────

SKYRIM_BUILD_PHASES = [
    {
        "phase_number": 1,
        "name": "Essentials & Frameworks",
        "description": "Core framework mods that other mods depend on. These must be installed first.",
        "search_guidance": (
            "Search for essential Skyrim modding framework mods. These are the backbone "
            "that other mods require as dependencies. Focus on: script extenders, engine fixes, "
            "address library, unofficial patches, and core resource frameworks. "
            "Every modlist needs these regardless of playstyle."
        ),
        "rules": (
            "Only add universally-needed framework mods. Do NOT add gameplay or visual mods here. "
            "For SE, use SE-compatible versions. For AE, use AE-compatible versions. "
            "Check mod descriptions for version compatibility before adding. "
            "These mods should have very high endorsement counts (10k+) as they are community staples."
        ),
        "example_mods": "SKSE, Address Library for SKSE Plugins, SSE Engine Fixes, Unofficial Skyrim Special Edition Patch, PapyrusUtil",
        "is_playstyle_driven": False,
        "max_mods": 8,
        "scale_weight": 0.1,
    },
    {
        "phase_number": 2,
        "name": "UI & Interface",
        "description": "User interface improvements, HUD mods, and mod configuration menus.",
        "search_guidance": (
            "Search for UI and interface mods for Skyrim. Focus on: inventory management, "
            "HUD improvements, mod configuration menus (MCM), map improvements, "
            "and quality-of-life interface changes. SkyUI is essential as many mods require it."
        ),
        "rules": (
            "SkyUI is almost always required — add it first. "
            "Interface mods should improve usability without being intrusive. "
            "Avoid mods that dramatically change the aesthetic unless the playstyle calls for it. "
            "Check that UI mods are compatible with each other."
        ),
        "example_mods": "SkyUI, MCM Helper, A Quality World Map, SkyHUD, moreHUD, TrueHUD",
        "is_playstyle_driven": False,
        "max_mods": 10,
        "scale_weight": 0.5,
    },
    {
        "phase_number": 3,
        "name": "Fixes & Bug Patches",
        "description": "Community bug fixes beyond the unofficial patch. Stability and consistency improvements.",
        "search_guidance": (
            "Search for Skyrim bug fix and stability mods. Focus on: script fixes, "
            "mesh fixes, NPC behavior fixes, quest fixes, animation fixes, and "
            "engine-level stability patches. These improve the base game without changing gameplay."
        ),
        "rules": (
            "Only add mods that fix genuine bugs or inconsistencies. "
            "Do NOT add gameplay-changing mods here — those go in the Gameplay phase. "
            "Prefer well-established fix compilations over individual micro-fixes. "
            "Check for overlap with USSEP (avoid redundant fixes)."
        ),
        "example_mods": "Scrambled Bugs, Assorted mesh fixes, Unofficial Material Fix, powerofthree's Tweaks, Landscape Fixes For Grass Mods",
        "is_playstyle_driven": False,
        "max_mods": 10,
        "scale_weight": 0.1,
    },
    {
        "phase_number": 4,
        "name": "Foundation Textures & Meshes",
        "description": "Base texture overhauls, mesh improvements, and landscape textures. Hardware-aware selections.",
        "search_guidance": (
            "Search for texture and mesh overhaul mods. Focus on: architecture textures, "
            "landscape textures, static mesh improvements (SMIM), and large-scale visual overhauls. "
            "Choose resolution based on user hardware: 1K for <4GB VRAM, 2K for 4-8GB, 4K for 8GB+. "
            "AI-upscaled textures use more VRAM than hand-crafted ones of the same resolution."
        ),
        "rules": (
            "CRITICAL: Match texture resolution to hardware. If VRAM < 4096MB, use 1K textures only. "
            "If VRAM 4096-8192MB, use 2K textures. Only use 4K for 8GB+ VRAM. "
            "Avoid AI-upscaled texture packs on lower-end hardware (they use disproportionate VRAM). "
            "Prefer comprehensive overhauls over many small replacers to reduce conflicts. "
            "Cathedral/Pfuscher/Skyrim Realistic Overhaul are common base overhauls."
        ),
        "example_mods": "Static Mesh Improvement Mod, Skyrim Realistic Overhaul, Cathedral Landscapes, Majestic Mountains, RUSTIC CLOTHING",
        "is_playstyle_driven": False,
        "max_mods": 40,
        "scale_weight": 3.0,
        "sub_pass_guidance": [
            "Focus on landscape, terrain, and environmental textures first.",
            "Now emphasize architecture and static mesh improvements.",
            "Next: armor, weapon, and clothing textures.",
            "Now: NPC body, face, and hair textures.",
            "Finally: creature, clutter, and miscellaneous textures.",
        ],
    },
    {
        "phase_number": 5,
        "name": "Animation & Physics",
        "description": "Skeleton frameworks, movement animations, and physics improvements.",
        "search_guidance": (
            "Search for animation and physics mods. Focus on: skeleton frameworks (XP32), "
            "movement animations, combat animations, physics mods, and animation frameworks. "
            "A proper skeleton mod is the foundation for all other animation replacers."
        ),
        "rules": (
            "XP32 Maximum Skeleton (XPMSSE) is the standard skeleton framework — include it. "
            "Animation mods must be compatible with the skeleton being used. "
            "For combat-focused playstyles, prioritize combat animations. "
            "Physics mods (HDT-SMP, CBPC) require significant CPU/GPU overhead."
        ),
        "example_mods": "XP32 Maximum Skeleton Special Extended, Dynamic Animation Replacer, Nemesis Unlimited Behavior Engine, Realistic Ragdolls and Force",
        "is_playstyle_driven": True,
        "max_mods": 12,
        "scale_weight": 1.0,
    },
    {
        "phase_number": 6,
        "name": "Audio",
        "description": "Sound effects, music, and audio improvements.",
        "search_guidance": (
            "Search for audio and sound mods. Focus on: immersive sound overhauls, "
            "music replacers or additions, ambient sound improvements, and "
            "specific sound effect improvements (combat, footsteps, weather)."
        ),
        "rules": (
            "Audio mods generally have minimal performance impact. "
            "Avoid multiple sound overhauls that edit the same categories (they will conflict). "
            "Music mods are safe to add in any quantity. "
            "Immersive sounds of Skyrim or Audio Overhaul for Skyrim are popular base options."
        ),
        "example_mods": "Immersive Sounds - Compendium, Audio Overhaul Skyrim, Sounds of Skyrim Complete, Musical Lore",
        "is_playstyle_driven": False,
        "max_mods": 8,
        "scale_weight": 1.0,
    },
    {
        "phase_number": 7,
        "name": "Gameplay & Playstyle",
        "description": "The core gameplay modifications tailored to the user's chosen playstyle.",
        "search_guidance": (
            "Search for gameplay mods that match the user's playstyle. This is the most "
            "important phase — these mods define the gameplay experience. "
            "Cover: combat mechanics, skill systems, economy, crafting, AI behavior, "
            "immersion features, and quest modifications. Search with playstyle-specific terms."
        ),
        "rules": (
            "This phase is HEAVILY driven by the user's playstyle choice. "
            "For Vanilla+: subtle improvements only (no overhauls). "
            "For Survival: hunger/cold/fatigue/camping systems. "
            "For Combat: combat overhauls, dodge mechanics, enemy AI. "
            "For Magic: spell packs, enchanting overhauls, magical mechanics. "
            "For Visual: skip this phase (few gameplay mods). "
            "For Immersion: NPC behavior, economy, needs, consequences. "
            "AVOID combining competing overhauls (e.g., two combat systems). "
            "Always use get_mod_details to verify playstyle fit before adding."
        ),
        "example_mods": "Ordinator, Apocalypse Magic, Wildcat Combat, Campfire, Frostfall, iNeed, Morrowloot Ultimate, CBBE, Growl",
        "is_playstyle_driven": True,
        "max_mods": 25,
        "scale_weight": 0.7,
    },
    {
        "phase_number": 8,
        "name": "Locations & World",
        "description": "City overhauls, new locations, and world-space additions.",
        "search_guidance": (
            "Search for location and world mods. Focus on: city overhauls, "
            "town expansions, new worldspaces, and landmark improvements. "
            "These add visual variety and exploration content."
        ),
        "rules": (
            "Location overhauls can conflict with each other if they edit the same areas. "
            "JK's Skyrim and Dawn of Skyrim are popular but can conflict — pick one style. "
            "Large new worldspaces (e.g., Beyond Skyrim, Falskaar) add significant content but also storage. "
            "Check storage budget before adding large worldspaces."
        ),
        "example_mods": "JK's Skyrim, Dawn of Skyrim, The Great Cities, Immersive College of Winterhold, Solitude Expansion",
        "is_playstyle_driven": True,
        "max_mods": 15,
        "scale_weight": 1.5,
    },
    {
        "phase_number": 9,
        "name": "Lighting & Weather",
        "description": "Weather systems, lighting overhauls, and optional ENB/post-processing.",
        "search_guidance": (
            "Search for lighting and weather mods. Focus on: weather overhauls, "
            "interior lighting improvements, and ENB presets (only for high-end hardware). "
            "A good weather mod transforms the visual atmosphere."
        ),
        "rules": (
            "CRITICAL HARDWARE CHECK: "
            "If VRAM < 4096MB: Skip ENB entirely. Use only a lightweight weather mod. "
            "If VRAM 4096-8192MB: Use a performance-friendly ENB or Reshade preset. "
            "If VRAM > 8192MB: Full ENB preset is viable. "
            "Only pick ONE weather overhaul (they are incompatible with each other). "
            "ENB presets are designed for specific weather mods — check compatibility. "
            "Reshade is a lighter alternative to ENB with less visual impact but much better performance."
        ),
        "example_mods": "Cathedral Weathers, Obsidian Weathers, Rudy ENB, Silent Horizons ENB, Lux, Window Shadows",
        "is_playstyle_driven": False,
        "max_mods": 5,
        "scale_weight": 2.0,
        "sub_pass_guidance": [
            "Pick one core weather/climate overhaul.",
            "Pick one core lighting overhaul (interior or full).",
            "Add atmospheric effects: rain, fog, particles.",
            "Add ENB preset or Reshade preset if the hardware tier supports it.",
        ],
    },
    {
        "phase_number": 10,
        "name": "Compatibility Patches",
        "description": "Conflict resolution patches between all previously added mods. Always the final phase.",
        "search_guidance": (
            "Review the complete modlist built so far and search for compatibility patches. "
            "Check each mod's description page for listed patches and requirements. "
            "Search Nexus for '[Mod A] [Mod B] patch' combinations. "
            "Focus on mods that edit the same game systems."
        ),
        "rules": (
            "Patches must load AFTER the mods they patch in the load order. "
            "Not every mod pair needs a patch — only flag genuine conflicts. "
            "Framework mods (SKSE, Address Library) don't need patches with each other. "
            "Focus on: mods editing the same game records, two overhauls of the same system, "
            "texture/mesh conflicts between visual mods. "
            "If no patch exists for a real conflict, use flag_user_knowledge to warn the user."
        ),
        "example_mods": "Bash Patch, Conflict Resolution Patch, various mod-specific patches",
        "is_playstyle_driven": False,
        "max_mods": 20,
        "scale_weight": 0.1,
    },
]

FALLOUT4_BUILD_PHASES = [
    {
        "phase_number": 1,
        "name": "Essentials & Frameworks",
        "description": "Core framework mods that other Fallout 4 mods depend on.",
        "search_guidance": (
            "Search for essential Fallout 4 framework mods. Focus on: F4SE (script extender), "
            "Address Library, performance fixes, and core resource frameworks. "
            "These are universal requirements regardless of playstyle."
        ),
        "rules": (
            "For Standard (pre-Next-Gen): use classic F4SE and Buffout 4. "
            "For Next-Gen: use Next-Gen compatible F4SE and Buffout 4 NG. "
            "DO NOT mix Standard and Next-Gen versions of framework mods. "
            "High FPS Physics Fix is essential for uncapping framerate safely."
        ),
        "example_mods": "F4SE, Address Library for F4SE Plugins, High FPS Physics Fix, Buffout 4",
        "is_playstyle_driven": False,
        "max_mods": 8,
        "scale_weight": 0.1,
    },
    {
        "phase_number": 2,
        "name": "Bug Fixes",
        "description": "Community bug fixes and stability patches for the base game.",
        "search_guidance": (
            "Search for Fallout 4 bug fix mods. Focus on: unofficial patches (UFO4P), "
            "engine fixes, NPC fixes, quest fixes, and stability improvements. "
            "Prioritize well-established fix compilations."
        ),
        "rules": (
            "UFO4P (Unofficial Fallout 4 Patch) is the essential base fix. "
            "Avoid redundant fixes already covered by UFO4P. "
            "Weapon Debris Crash Fix is only needed for Nvidia 20-series+ GPUs. "
            "Previsibines Repair Pack can improve performance in specific areas."
        ),
        "example_mods": "Unofficial Fallout 4 Patch, Buffout 4, Weapon Mod Fixes, Sprint Stuttering Fix, Previsibines Repair Pack",
        "is_playstyle_driven": False,
        "max_mods": 10,
        "scale_weight": 0.1,
    },
    {
        "phase_number": 3,
        "name": "UI & Interface",
        "description": "HUD improvements, Pip-Boy enhancements, and menu modifications.",
        "search_guidance": (
            "Search for Fallout 4 UI and interface mods. Focus on: HUD improvements, "
            "Pip-Boy enhancements, dialogue interface, inventory sorting, "
            "and quality-of-life interface changes."
        ),
        "rules": (
            "DEF_UI/FallUI are popular comprehensive UI overhauls — pick one family. "
            "Full Dialogue Interface restores full dialogue lines (very popular). "
            "Check compatibility between UI mods — they often conflict."
        ),
        "example_mods": "DEF_UI, FallUI, Full Dialogue Interface, Better Console, Extended Dialogue Interface",
        "is_playstyle_driven": False,
        "max_mods": 8,
        "scale_weight": 0.5,
    },
    {
        "phase_number": 4,
        "name": "Tweaks & Quality of Life",
        "description": "Small gameplay tweaks and quality-of-life improvements.",
        "search_guidance": (
            "Search for Fallout 4 quality-of-life and tweak mods. Focus on: "
            "survival mode improvements, weapon holstering, reload animations, "
            "crafting improvements, and small convenience mods."
        ),
        "rules": (
            "Tweaks should improve convenience without fundamentally changing gameplay. "
            "Classic Holstered Weapons is popular but may conflict with animation mods. "
            "For survival playstyles, include mods that enhance Survival mode. "
            "Prefer modular/configurable tweaks over rigid changes."
        ),
        "example_mods": "Classic Holstered Weapons, Bullet Counted Reload, Faster Workbench Exit, Simple Offence Suppression, Unlimited Survival Mode",
        "is_playstyle_driven": True,
        "max_mods": 8,
        "scale_weight": 1.0,
    },
    {
        "phase_number": 5,
        "name": "Foundation Textures",
        "description": "Base texture improvements matched to user hardware.",
        "search_guidance": (
            "Search for Fallout 4 texture improvement mods. Focus on: "
            "comprehensive texture overhauls, landscape textures, architecture textures, "
            "and material fixes. Match resolution to hardware capability."
        ),
        "rules": (
            "CRITICAL: Match texture resolution to hardware. "
            "If VRAM < 4096MB: 1K textures only. "
            "If VRAM 4096-8192MB: 2K textures. "
            "If VRAM > 8192MB: 4K viable for key textures. "
            "Avoid AI-upscaled textures on lower-end hardware. "
            "Fallout 4 HD Overhaul and Vivid Fallout are popular base choices."
        ),
        "example_mods": "Vivid Fallout, FlaconOil's Retexture Project, Targeted Textures, Enhanced Vanilla Water",
        "is_playstyle_driven": False,
        "max_mods": 25,
        "scale_weight": 3.0,
        "sub_pass_guidance": [
            "Focus on landscape, terrain, and environmental textures first.",
            "Now emphasize architecture and static mesh improvements.",
            "Next: armor, weapon, and clothing textures.",
            "Now: NPC body, face, and hair textures.",
            "Finally: creature, clutter, and miscellaneous textures.",
        ],
    },
    {
        "phase_number": 6,
        "name": "Gameplay",
        "description": "Core gameplay modifications tailored to the user's playstyle.",
        "search_guidance": (
            "Search for Fallout 4 gameplay mods matching the user's playstyle. "
            "Cover: combat mechanics, loot balance, faction gameplay, power armor, "
            "settlement building, companion improvements, and difficulty scaling."
        ),
        "rules": (
            "This phase is HEAVILY driven by the user's playstyle choice. "
            "For Vanilla+: subtle loot/economy tweaks only. "
            "For Survival/Hardcore: damage overhauls, needs systems, scarcity. "
            "For Combat: weapon balance, enemy AI, tactical combat. "
            "For Settlement: settlement building expansions, Sim Settlements. "
            "For Exploration: new encounters, fast travel tweaks, discovery rewards. "
            "AVOID combining competing overhauls. "
            "Encounter Zone Recalculation is good for level scaling."
        ),
        "example_mods": "Loot Logic and Reduction, Encounter Zone Recalculation, Legendaries They Can Use, Who's The General, SPARS",
        "is_playstyle_driven": True,
        "max_mods": 20,
        "scale_weight": 0.7,
    },
    {
        "phase_number": 7,
        "name": "Content & Quests",
        "description": "New quests, faction expansions, and content additions.",
        "search_guidance": (
            "Search for Fallout 4 quest and content mods. Focus on: "
            "new quests, faction expansions, companion mods, and world content additions. "
            "Prioritize mods that integrate well with the base game."
        ),
        "rules": (
            "Content mods should feel integrated with the base game, not jarring. "
            "Check that new quest mods don't conflict with faction overhauls. "
            "Large content mods (new worldspaces) consume significant storage — check budget. "
            "You And What Army and similar faction mods enhance existing content."
        ),
        "example_mods": "You And What Army 2, Tales from the Commonwealth, Depravity, Outcasts and Remnants, Nuka-World Reborn",
        "is_playstyle_driven": True,
        "max_mods": 10,
        "scale_weight": 1.5,
    },
    {
        "phase_number": 8,
        "name": "Visuals & Lighting",
        "description": "Lighting overhauls, particle effects, and weather improvements.",
        "search_guidance": (
            "Search for Fallout 4 visual and lighting mods. Focus on: "
            "lighting overhauls, weather mods, particle patches, "
            "and environmental visual improvements."
        ),
        "rules": (
            "CRITICAL HARDWARE CHECK: "
            "If VRAM < 4096MB: Skip ENB. Use only lightweight lighting. "
            "If VRAM 4096-8192MB: Performance-friendly ENB or Reshade. "
            "If VRAM > 8192MB: Full ENB viable. "
            "Only ONE lighting overhaul (they are incompatible). "
            "Lightweight Lighting is a good performance-friendly option. "
            "Particle patches reduce glow effects and improve performance."
        ),
        "example_mods": "Lightweight Lighting, Fallout 4 Particle Patch, NAC X, True Storms, Ultra Interior Lighting",
        "is_playstyle_driven": False,
        "max_mods": 5,
        "scale_weight": 2.0,
        "sub_pass_guidance": [
            "Pick one core weather/climate overhaul.",
            "Pick one core lighting overhaul (interior or full).",
            "Add atmospheric effects: rain, fog, particles.",
            "Add ENB preset or Reshade preset if the hardware tier supports it.",
        ],
    },
    {
        "phase_number": 9,
        "name": "Compatibility Patches",
        "description": "Conflict resolution for all added mods. Always the final phase.",
        "search_guidance": (
            "Review the complete Fallout 4 modlist and search for compatibility patches. "
            "Check each mod's description for listed patches. "
            "Search for '[Mod A] [Mod B] patch' combinations. "
            "Focus on mods that edit the same game records."
        ),
        "rules": (
            "Patches must load AFTER the mods they patch. "
            "Not every mod pair needs a patch — only flag genuine conflicts. "
            "Framework mods don't need patches with each other. "
            "UFO4P patches are especially common and important. "
            "If no patch exists for a real conflict, use flag_user_knowledge."
        ),
        "example_mods": "Various mod-specific patches, combined patch files",
        "is_playstyle_driven": False,
        "max_mods": 15,
        "scale_weight": 0.1,
    },
]
