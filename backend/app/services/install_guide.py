"""Install-guide generator for a generated modlist.

Produces a structured guide (dict) that covers both MO2 and Vortex install
workflows, tailored to the game and the user's chosen game version. The same
structure can be serialized to JSON for the frontend or to Markdown for a
downloadable file.
"""

from dataclasses import dataclass, field

from app.models.game import Game
from app.models.modlist import Modlist, ModlistEntry


# Game-version presentation labels used in copy shown to the user.
VERSION_LABELS = {
    "SE": "Skyrim Special Edition (1.5.97)",
    "AE": "Skyrim Anniversary Edition (1.6.1170+)",
    "Standard": "Fallout 4 (pre-Next-Gen, 1.10.163)",
    "Next-Gen": "Fallout 4 Next-Gen (1.10.980+)",
}


@dataclass
class GuideStep:
    title: str
    body: str  # Multi-line plain text. Renderer handles formatting.


@dataclass
class GuideSection:
    id: str  # Stable identifier used by the frontend for tab/anchor routing
    title: str
    summary: str
    steps: list[GuideStep] = field(default_factory=list)


@dataclass
class InstallGuide:
    modlist_id: str
    game_name: str
    game_slug: str
    game_version: str | None
    mod_count: int
    patch_count: int
    mo2_section: GuideSection
    vortex_section: GuideSection
    version_notes: list[str]
    troubleshooting: list[GuideStep]


def _skse_details(game_slug: str, version: str | None) -> tuple[str, str]:
    """Return (script extender name, required build for the version)."""
    if game_slug == "skyrimse":
        if version == "AE":
            return ("SKSE64", "v2.2.6 (AE 1.6.x build)")
        if version == "SE":
            return ("SKSE64", "v2.0.20 (SE 1.5.97 build)")
        return ("SKSE64", "the build matching your installed game version — v2.0.20 for SE 1.5.97, v2.2.6 for AE 1.6.x")
    if game_slug == "fallout4":
        if version == "Next-Gen":
            return ("F4SE", "Next-Gen build from silverlock.org")
        if version == "Standard":
            return ("F4SE", "v0.6.23 (pre-Next-Gen build)")
        return ("F4SE", "the build matching your installed game version — v0.6.23 for pre-NG 1.10.163, NG build for 1.10.980+")
    return ("script extender", "matching your game version")


def _post_install_tools(game_slug: str) -> list[str]:
    """External tools users typically run after enabling mods."""
    if game_slug == "skyrimse":
        return [
            "LOOT — automatically sorts plugin load order.",
            "Nemesis Unlimited Behavior Engine — regenerate animation behavior (run after adding/removing any animation mod).",
            "Wrye Bash — build a Bashed Patch to merge leveled lists.",
            "xEdit (SSEEdit) — resolve remaining conflicts and clean master files.",
            "DynDOLOD/TexGen — generate LOD meshes and textures (run last, before launching).",
        ]
    if game_slug == "fallout4":
        return [
            "LOOT — sorts plugin load order.",
            "Wrye Bash — build a Bashed Patch if leveled list conflicts exist.",
            "xEdit (FO4Edit) — resolve remaining conflicts. IMPORTANT: do NOT edit cell headers after PRP, or you will break previs.",
            "Make sure Previsibines Repair Pack (PRP) loads LAST in your plugin list.",
        ]
    return []


def _version_notes(game_slug: str, version: str | None) -> list[str]:
    """Version-specific warnings shown prominently on the guide page."""
    notes: list[str] = []
    if game_slug == "skyrimse":
        if version == "SE":
            notes.append(
                "You are on Skyrim Special Edition 1.5.97. Every SKSE DLL plugin in this list "
                "MUST use the SE build — not the AE build. On Address Library AIO, the runtime "
                "picks the correct versionlib file automatically."
            )
            notes.append(
                "Do NOT let Steam auto-update the game. In Steam → Skyrim Special Edition → "
                "Properties → Updates, set updates to 'Only update this game when I launch it.'"
            )
        elif version == "AE":
            notes.append(
                "You are on Skyrim Anniversary Edition 1.6.1170+. Every SKSE DLL plugin MUST "
                "be the AE build. USSEP v4.3.x requires the Creation Club masters — if any of "
                "them are missing from your game folder, USSEP will fail to load."
            )
        else:
            notes.append(
                "Game version was not recorded. Verify each SKSE DLL plugin matches your actual "
                "game executable version before launching."
            )
    elif game_slug == "fallout4":
        if version == "Standard":
            notes.append(
                "You are on pre-Next-Gen Fallout 4 (1.10.163). If your game is currently on the "
                "Next-Gen update (1.10.980+), use the Simple Fallout 4 Downgrader "
                "(Nexus mod #81933) BEFORE installing this modlist. Disable Steam auto-updates afterward."
            )
            notes.append(
                "Use Classic F4SE (v0.6.23) and Classic Buffout 4 — NOT the NG versions."
            )
        elif version == "Next-Gen":
            notes.append(
                "You are on Fallout 4 Next-Gen (1.10.980+). Use the Next-Gen F4SE build from "
                "silverlock.org and Buffout 4 NG (Nexus #64880). XDI and many pre-2024 DLL plugins "
                "do NOT work on NG and must be skipped."
            )
        else:
            notes.append(
                "Game version was not recorded. Check each DLL plugin's mod page to verify "
                "Next-Gen compatibility before launching."
            )
    return notes


def _troubleshooting(game_slug: str) -> list[GuideStep]:
    common = [
        GuideStep(
            title="Game crashes immediately on launch",
            body=(
                "Most common causes, in order of likelihood:\n"
                "1. Script-extender DLL does not match your game version. Re-download the matching build.\n"
                "2. A DLL plugin requires a game version you do not have. Check the crash logger output.\n"
                "3. Missing master files (the plugin depends on an .esm that is not enabled).\n"
                "4. Wrong Address Library file. Delete the versionlib .bin files that do not match your exe."
            ),
        ),
        GuideStep(
            title="Game launches but mods don't appear",
            body=(
                "You likely launched the game executable directly instead of through your mod manager. "
                "Always launch via MO2 (run SKSE/F4SE from MO2's executable dropdown) or through the "
                "Vortex Dashboard launch button so the mod manager can inject its virtual file system."
            ),
        ),
    ]
    if game_slug == "skyrimse":
        common.append(GuideStep(
            title="NPCs have dark/grey faces",
            body=(
                "NPC FaceGen mismatch. Ensure the plugin controlling NPC appearance (right pane) and "
                "the loose files or archive providing FaceGen textures (left pane) are both present "
                "and in compatible priority. Face Discoloration Fix (#42441) is a runtime safety net."
            ),
        ))
    if game_slug == "fallout4":
        common.append(GuideStep(
            title="FPS drops below 20 in downtown Boston",
            body=(
                "Something broke previs/precombines. Check that PRP loads last, and that no mod in "
                "your list modifies vanilla placed objects without regenerating precombines. Remove "
                "any 'Scrap Everything'-style mod immediately."
            ),
        ))
    return common


def build_guide(
    modlist: Modlist,
    game: Game,
    entries: list[ModlistEntry],
) -> InstallGuide:
    """Build an InstallGuide from DB objects."""
    version = modlist.game_version
    version_label = VERSION_LABELS.get(version or "", version or "unspecified version")

    mod_count = sum(1 for e in entries if not e.is_patch)
    patch_count = sum(1 for e in entries if e.is_patch)

    script_extender_name, script_extender_build = _skse_details(game.slug, version)

    # --- MO2 section (automated via ModdersOmni plugin) ---
    mo2_steps = [
        GuideStep(
            title="1. Install Mod Organizer 2",
            body=(
                "Download MO2 from https://www.modorganizer.org and install it into a folder that is "
                "NOT inside Program Files (e.g. D:\\MO2). Create a new profile for this modlist so "
                "you can switch back to vanilla any time."
            ),
        ),
        GuideStep(
            title=f"2. Install the script extender ({script_extender_name})",
            body=(
                f"Download the {script_extender_name} build matching your game version — "
                f"{script_extender_build}. Extract the contents into your game's root folder "
                "(the folder containing the main .exe), NOT through MO2. This is the ONLY mod in "
                "your list that installs directly to the game folder."
            ),
        ),
        GuideStep(
            title="3. Install the ModdersOmni MO2 plugin",
            body=(
                "Click the 'Download MO2 plugin' button at the top of this page to save "
                "moddersomni_import.py. Copy it into your MO2 installation's plugins/ folder. "
                'Restart MO2 — you should now see "Import from ModdersOmni" under the Tools menu '
                "(the puzzle-piece icon in the toolbar)."
            ),
        ),
        GuideStep(
            title="4. Create a plugin token on your account",
            body=(
                "In your ModdersOmni account, go to Settings → Plugin Tokens → Create New. Copy the "
                "token — you'll paste it into the MO2 import dialog. Tokens are long-lived but can be "
                "revoked at any time from the same page."
            ),
        ),
        GuideStep(
            title="5. Import the modlist",
            body=(
                f"In MO2: Tools → Import from ModdersOmni. Paste this modlist's URL ({_modlist_url(modlist)}) "
                "and your plugin token. Enter your Nexus personal API key (get it from nexusmods.com/users/myaccount"
                "?tab=api+access) so downloads resolve correctly. Click Import. MO2 will queue all "
                f"{mod_count} mod downloads and install them in order."
            ),
        ),
        GuideStep(
            title="6. Enable plugins in the right pane and resolve conflicts",
            body=(
                "After installation finishes, tick the checkbox next to each plugin in MO2's right pane. "
                "Run LOOT from MO2's executable dropdown to auto-sort. Review any conflict warnings "
                "LOOT surfaces — most will be resolved by the patches already in your list."
            ),
        ),
        GuideStep(
            title="7. Run required post-install tools",
            body="Run these in order from MO2's executable dropdown:\n  • " + "\n  • ".join(_post_install_tools(game.slug)),
        ),
    ]
    mo2_section = GuideSection(
        id="mo2",
        title="Mod Organizer 2 (recommended)",
        summary=(
            "MO2 uses a virtualized file system that keeps your game folder clean and lets you manage "
            "multiple profiles. The ModdersOmni MO2 plugin automates the download and install of this "
            "entire modlist in one pass."
        ),
        steps=mo2_steps,
    )

    # --- Vortex section (manual workflow) ---
    vortex_steps = [
        GuideStep(
            title="1. Install Vortex",
            body=(
                "Download Vortex from https://www.nexusmods.com/site/mods/1. During setup, choose "
                f"{game.name} as a managed game. Vortex will detect your game installation automatically."
            ),
        ),
        GuideStep(
            title=f"2. Install the script extender ({script_extender_name})",
            body=(
                f"Download {script_extender_name} — {script_extender_build} — from silverlock.org and "
                "extract it into your game's root folder. Vortex does NOT manage the script extender "
                "binaries; these always install manually."
            ),
        ),
        GuideStep(
            title="3. Download each mod via 'Mod Manager Download'",
            body=(
                f"Open the downloadable modlist file (modlist-{_short_id(modlist)}.md) and click each "
                "Nexus Mods link in order. On each mod page, click the 'Mod Manager Download' button "
                "on the main file. Vortex will intercept the download and queue it automatically. "
                f"You will repeat this {mod_count} times — Vortex does not support bulk URL import."
            ),
        ),
        GuideStep(
            title="4. Enable each mod and deploy",
            body=(
                "In Vortex: Mods tab. Set each mod's status to 'Enabled'. Click 'Deploy Mods' in the "
                "toolbar. Vortex uses hardlinking by default — deployment is near-instant and uses "
                "almost no extra disk space."
            ),
        ),
        GuideStep(
            title="5. Set plugin load order",
            body=(
                "Go to the Plugins tab in Vortex. The ordering we provide uses the category sequence "
                "defined in the modlist (essentials first, patches last). You can either drag-and-drop "
                "to match the order exactly, or install the 'LOOT' extension for Vortex and let LOOT "
                "sort — LOOT's order will generally match what we generated within ±5 slots."
            ),
        ),
        GuideStep(
            title="6. Resolve file conflicts as Vortex prompts",
            body=(
                "Vortex will pop up conflict dialogs for overlapping loose files. Generally: let the "
                "mod LOWER in the install order win (so later mods overwrite earlier ones). For each "
                "flagged patch mod in your list, make sure it overrides the mods it patches."
            ),
        ),
        GuideStep(
            title="7. Run required post-install tools",
            body="From Vortex's Dashboard, launch each of the following as a tool:\n  • " + "\n  • ".join(_post_install_tools(game.slug)),
        ),
    ]
    vortex_section = GuideSection(
        id="vortex",
        title="Vortex (Nexus's official manager)",
        summary=(
            "Vortex is simpler to set up but requires you to click through each mod page manually. "
            "It does NOT currently have a ModdersOmni plugin — installation of this modlist in Vortex "
            "is entirely a per-mod, hand-driven workflow."
        ),
        steps=vortex_steps,
    )

    return InstallGuide(
        modlist_id=str(modlist.id),
        game_name=game.name,
        game_slug=game.slug,
        game_version=version_label if version else None,
        mod_count=mod_count,
        patch_count=patch_count,
        mo2_section=mo2_section,
        vortex_section=vortex_section,
        version_notes=_version_notes(game.slug, version),
        troubleshooting=_troubleshooting(game.slug),
    )


def _short_id(modlist: Modlist) -> str:
    return str(modlist.id)[:8]


def _modlist_url(modlist: Modlist) -> str:
    # URL is informational in copy only; actual link lives in the frontend.
    return f"https://moddersomni.com/modlist/{modlist.id}"


def guide_to_dict(guide: InstallGuide) -> dict:
    """Serialize the guide for the JSON API response."""
    return {
        "modlist_id": guide.modlist_id,
        "game_name": guide.game_name,
        "game_slug": guide.game_slug,
        "game_version": guide.game_version,
        "mod_count": guide.mod_count,
        "patch_count": guide.patch_count,
        "version_notes": guide.version_notes,
        "mo2_section": _section_to_dict(guide.mo2_section),
        "vortex_section": _section_to_dict(guide.vortex_section),
        "troubleshooting": [{"title": s.title, "body": s.body} for s in guide.troubleshooting],
    }


def _section_to_dict(section: GuideSection) -> dict:
    return {
        "id": section.id,
        "title": section.title,
        "summary": section.summary,
        "steps": [{"title": s.title, "body": s.body} for s in section.steps],
    }


def guide_to_markdown(guide: InstallGuide, entries: list[ModlistEntry], game_domain: str | None) -> str:
    """Render the guide as a downloadable Markdown document including the full modlist."""
    lines: list[str] = []
    lines.append(f"# Install Guide — {guide.game_name}")
    if guide.game_version:
        lines.append(f"**Game version:** {guide.game_version}")
    lines.append(f"**Mods:** {guide.mod_count} (+ {guide.patch_count} compatibility patches)")
    lines.append("")
    lines.append(f"Generated by ModdersOmni for modlist `{guide.modlist_id}`.")
    lines.append("")

    if guide.version_notes:
        lines.append("## ⚠ Before you start — version notes")
        lines.append("")
        for note in guide.version_notes:
            lines.append(f"> {note}")
            lines.append("")

    for section in (guide.mo2_section, guide.vortex_section):
        lines.append(f"## {section.title}")
        lines.append("")
        lines.append(section.summary)
        lines.append("")
        for step in section.steps:
            lines.append(f"### {step.title}")
            lines.append("")
            lines.append(step.body)
            lines.append("")

    if guide.troubleshooting:
        lines.append("## Troubleshooting")
        lines.append("")
        for step in guide.troubleshooting:
            lines.append(f"### {step.title}")
            lines.append("")
            lines.append(step.body)
            lines.append("")

    lines.append("## Full modlist (in install order)")
    lines.append("")
    for entry in entries:
        marker = "PATCH: " if entry.is_patch else ""
        author = f" by {entry.author}" if entry.author else ""
        lines.append(f"{entry.load_order or '?'}. **{marker}{entry.name}**{author}")
        if entry.nexus_mod_id and game_domain:
            lines.append(f"   https://www.nexusmods.com/{game_domain}/mods/{entry.nexus_mod_id}")
        if entry.compatibility_notes:
            lines.append(f"   *Note: {entry.compatibility_notes}*")
        lines.append("")

    return "\n".join(lines)
