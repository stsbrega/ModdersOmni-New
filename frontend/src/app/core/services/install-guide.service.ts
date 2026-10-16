import { Injectable } from '@angular/core';
import { Game } from '../../shared/models/game.model';
import {
  GuideSection,
  GuideStep,
  InstallGuide,
  ModEntry,
  Modlist,
} from '../../shared/models/mod.model';

/**
 * InstallGuideService — TS port of `backend/app/services/install_guide.py`.
 *
 * IMPORTANT — deviation from the plan: the plan's example tests reference
 * `buildMO2Payload` / `buildVortexPayload` returning a flat `mods` array
 * with `nexusModId`/`fileId`/`installOrder`. No such functions exist in
 * the Python source. The Python module produces an `InstallGuide` object
 * (already mirrored as the `InstallGuide` interface in `mod.model.ts`)
 * containing `mo2_section`, `vortex_section`, `version_notes`, and
 * `troubleshooting`. We port the actual Python contract.
 *
 * Three exposed methods:
 *   - buildGuide(modlist, game): structured guide (steps + version notes)
 *   - guideToDict(guide): JSON-shaped object for response payloads
 *   - guideToMarkdown(guide, entries, gameDomain?): downloadable Markdown
 */

const VERSION_LABELS: Readonly<Record<string, string>> = {
  SE: 'Skyrim Special Edition (1.5.97)',
  AE: 'Skyrim Anniversary Edition (1.6.1170+)',
  Standard: 'Fallout 4 (pre-Next-Gen, 1.10.163)',
  'Next-Gen': 'Fallout 4 Next-Gen (1.10.980+)',
};

@Injectable({ providedIn: 'root' })
export class InstallGuideService {
  /**
   * Build a structured install guide from a Modlist + Game pair.
   * `modlist.entries` supplies the per-mod info used in the Markdown
   * rendering and to compute mod/patch counts.
   */
  buildGuide(modlist: Modlist, game: Game): InstallGuide {
    const version = modlist.game_version ?? null;
    const versionLabel = version
      ? VERSION_LABELS[version] ?? version
      : null;

    const entries = modlist.entries ?? [];
    const modCount = entries.filter((e) => !e.is_patch).length;
    const patchCount = entries.filter((e) => e.is_patch).length;

    const [seName, seBuild] = this.scriptExtenderDetails(game.slug, version);
    const postTools = this.postInstallTools(game.slug);

    const mo2Steps: GuideStep[] = [
      {
        title: '1. Install Mod Organizer 2',
        body:
          'Download MO2 from https://www.modorganizer.org and install it into a folder that is ' +
          'NOT inside Program Files (e.g. D:\\MO2). Create a new profile for this modlist so ' +
          'you can switch back to vanilla any time.',
      },
      {
        title: `2. Install the script extender (${seName})`,
        body:
          `Download the ${seName} build matching your game version — ` +
          `${seBuild}. Extract the contents into your game's root folder ` +
          "(the folder containing the main .exe), NOT through MO2. This is the ONLY mod in " +
          'your list that installs directly to the game folder.',
      },
      {
        title: '3. Install the ModdersOmni MO2 plugin',
        body:
          "Click 'Download MO2 plugin' at the top of this page to save moddersomni_import.py. " +
          "Copy it into the plugins/ folder inside your MO2 installation, then restart MO2. " +
          "You should now see 'ModdersOmni Import' under the Tools menu (the puzzle-piece icon " +
          'in the toolbar).',
      },
      {
        title: '4. Download your modlist file',
        body:
          "Click 'Download modlist for MO2' at the top of this page. This saves a small .json file " +
          'listing every mod and the exact Nexus file to fetch. Nothing is uploaded; the file ' +
          'stays on your computer.',
      },
      {
        title: '5. Import the modlist',
        body:
          'Make sure MO2 is logged in to Nexus Mods (Settings → Nexus → Connect to Nexus). ' +
          'Then choose Tools → ModdersOmni Import and select the .json file. MO2 will queue all ' +
          `${modCount + patchCount} downloads in install order. When they finish, install each one ` +
          'from the Downloads tab, top to bottom.',
      },
      {
        title: '6. Enable plugins in the right pane and resolve conflicts',
        body:
          "After installation finishes, tick the checkbox next to each plugin in MO2's right pane. " +
          "Run LOOT from MO2's executable dropdown to auto-sort. Review any conflict warnings " +
          'LOOT surfaces — most will be resolved by the patches already in your list.',
      },
      {
        title: '7. Run required post-install tools',
        body:
          "Run these in order from MO2's executable dropdown:\n  • " +
          postTools.join('\n  • '),
      },
    ];

    const mo2_section: GuideSection = {
      id: 'mo2',
      title: 'Mod Organizer 2 (recommended)',
      summary:
        'MO2 uses a virtualized file system that keeps your game folder clean and lets you manage ' +
        'multiple profiles. The ModdersOmni MO2 plugin queues every download for this ' +
        'entire modlist in one pass.',
      steps: mo2Steps,
    };

    const vortexSteps: GuideStep[] = [
      {
        title: '1. Install Vortex',
        body:
          'Download Vortex from https://www.nexusmods.com/site/mods/1. During setup, choose ' +
          `${game.name} as a managed game. Vortex will detect your game installation automatically.`,
      },
      {
        title: `2. Install the script extender (${seName})`,
        body:
          `Download ${seName} — ${seBuild} — from silverlock.org and ` +
          "extract it into your game's root folder. Vortex does NOT manage the script extender " +
          'binaries; these always install manually.',
      },
      {
        title: "3. Download each mod via 'Mod Manager Download'",
        body:
          "Open the downloaded guide (.md), which lists every mod with its Nexus link, or use the " +
          "link icons on your modlist page. Visit each mod in order. On each mod page, click the 'Mod Manager Download' button " +
          'on the main file. Vortex will intercept the download and queue it automatically. ' +
          `You will repeat this ${modCount} times — Vortex does not support bulk URL import.`,
      },
      {
        title: '4. Enable each mod and deploy',
        body:
          "In Vortex: Mods tab. Set each mod's status to 'Enabled'. Click 'Deploy Mods' in the " +
          'toolbar. Vortex uses hardlinking by default — deployment is near-instant and uses ' +
          'almost no extra disk space.',
      },
      {
        title: '5. Set plugin load order',
        body:
          'Go to the Plugins tab in Vortex. The ordering we provide uses the category sequence ' +
          'defined in the modlist (essentials first, patches last). You can either drag-and-drop ' +
          "to match the order exactly, or install the 'LOOT' extension for Vortex and let LOOT " +
          "sort — LOOT's order will generally match what we generated within ±5 slots.",
      },
      {
        title: '6. Resolve file conflicts as Vortex prompts',
        body:
          'Vortex will pop up conflict dialogs for overlapping loose files. Generally: let the ' +
          'mod LOWER in the install order win (so later mods overwrite earlier ones). For each ' +
          'flagged patch mod in your list, make sure it overrides the mods it patches.',
      },
      {
        title: '7. Run required post-install tools',
        body:
          "From Vortex's Dashboard, launch each of the following as a tool:\n  • " +
          postTools.join('\n  • '),
      },
    ];

    const vortex_section: GuideSection = {
      id: 'vortex',
      title: "Vortex (Nexus's official manager)",
      summary:
        'Vortex is simpler to set up but requires you to click through each mod page manually. ' +
        'It does NOT currently have a ModdersOmni plugin — installation of this modlist in Vortex ' +
        'is entirely a per-mod, hand-driven workflow.',
      steps: vortexSteps,
    };

    return {
      modlist_id: modlist.id,
      game_name: game.name,
      game_slug: game.slug,
      game_version: versionLabel,
      mod_count: modCount,
      patch_count: patchCount,
      version_notes: this.versionNotes(game.slug, version),
      mo2_section,
      vortex_section,
      troubleshooting: this.troubleshooting(game.slug),
    };
  }

  /** Serialize the guide to a JSON-shaped plain object (matches Python `guide_to_dict`). */
  guideToDict(guide: InstallGuide): Record<string, unknown> {
    return {
      modlist_id: guide.modlist_id,
      game_name: guide.game_name,
      game_slug: guide.game_slug,
      game_version: guide.game_version,
      mod_count: guide.mod_count,
      patch_count: guide.patch_count,
      version_notes: guide.version_notes,
      mo2_section: this.sectionToDict(guide.mo2_section),
      vortex_section: this.sectionToDict(guide.vortex_section),
      troubleshooting: guide.troubleshooting.map((s) => ({ title: s.title, body: s.body })),
    };
  }

  /**
   * Render the guide as a downloadable Markdown document.
   * Mirrors Python `guide_to_markdown(guide, entries, game_domain)`.
   */
  guideToMarkdown(
    guide: InstallGuide,
    entries: ModEntry[],
    gameDomain: string | null,
  ): string {
    const lines: string[] = [];
    lines.push(`# Install Guide — ${guide.game_name}`);
    if (guide.game_version) lines.push(`**Game version:** ${guide.game_version}`);
    lines.push(`**Mods:** ${guide.mod_count} (+ ${guide.patch_count} compatibility patches)`);
    lines.push('');
    lines.push(`Generated by ModdersOmni for modlist \`${guide.modlist_id}\`.`);
    lines.push('');

    if (guide.version_notes.length > 0) {
      lines.push('## ⚠ Before you start — version notes');
      lines.push('');
      for (const note of guide.version_notes) {
        lines.push(`> ${note}`);
        lines.push('');
      }
    }

    for (const section of [guide.mo2_section, guide.vortex_section]) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.summary);
      lines.push('');
      for (const step of section.steps) {
        lines.push(`### ${step.title}`);
        lines.push('');
        lines.push(step.body);
        lines.push('');
      }
    }

    if (guide.troubleshooting.length > 0) {
      lines.push('## Troubleshooting');
      lines.push('');
      for (const step of guide.troubleshooting) {
        lines.push(`### ${step.title}`);
        lines.push('');
        lines.push(step.body);
        lines.push('');
      }
    }

    lines.push('## Full modlist (in install order)');
    lines.push('');
    for (const entry of entries) {
      const marker = entry.is_patch ? 'PATCH: ' : '';
      const author = entry.author ? ` by ${entry.author}` : '';
      lines.push(`${entry.load_order ?? '?'}. **${marker}${entry.name}**${author}`);
      if (entry.nexus_mod_id && gameDomain) {
        lines.push(`   https://www.nexusmods.com/${gameDomain}/mods/${entry.nexus_mod_id}`);
      }
      if (entry.compatibility_notes) {
        lines.push(`   *Note: ${entry.compatibility_notes}*`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // --- private helpers -----------------------------------------------------

  private scriptExtenderDetails(
    gameSlug: string,
    version: string | null,
  ): [string, string] {
    if (gameSlug === 'skyrimse') {
      if (version === 'AE') return ['SKSE64', 'v2.2.6 (AE 1.6.x build)'];
      if (version === 'SE') return ['SKSE64', 'v2.0.20 (SE 1.5.97 build)'];
      return [
        'SKSE64',
        'the build matching your installed game version — v2.0.20 for SE 1.5.97, v2.2.6 for AE 1.6.x',
      ];
    }
    if (gameSlug === 'fallout4') {
      if (version === 'Next-Gen') return ['F4SE', 'Next-Gen build from silverlock.org'];
      if (version === 'Standard') return ['F4SE', 'v0.6.23 (pre-Next-Gen build)'];
      return [
        'F4SE',
        'the build matching your installed game version — v0.6.23 for pre-NG 1.10.163, NG build for 1.10.980+',
      ];
    }
    return ['script extender', 'matching your game version'];
  }

  private postInstallTools(gameSlug: string): string[] {
    if (gameSlug === 'skyrimse') {
      return [
        'LOOT — automatically sorts plugin load order.',
        'Nemesis Unlimited Behavior Engine — regenerate animation behavior (run after adding/removing any animation mod).',
        'Wrye Bash — build a Bashed Patch to merge leveled lists.',
        'xEdit (SSEEdit) — resolve remaining conflicts and clean master files.',
        'DynDOLOD/TexGen — generate LOD meshes and textures (run last, before launching).',
      ];
    }
    if (gameSlug === 'fallout4') {
      return [
        'LOOT — sorts plugin load order.',
        'Wrye Bash — build a Bashed Patch if leveled list conflicts exist.',
        'xEdit (FO4Edit) — resolve remaining conflicts. IMPORTANT: do NOT edit cell headers after PRP, or you will break previs.',
        'Make sure Previsibines Repair Pack (PRP) loads LAST in your plugin list.',
      ];
    }
    return [];
  }

  private versionNotes(gameSlug: string, version: string | null): string[] {
    const notes: string[] = [];
    if (gameSlug === 'skyrimse') {
      if (version === 'SE') {
        notes.push(
          'You are on Skyrim Special Edition 1.5.97. Every SKSE DLL plugin in this list ' +
            'MUST use the SE build — not the AE build. On Address Library AIO, the runtime ' +
            'picks the correct versionlib file automatically.',
        );
        notes.push(
          'Do NOT let Steam auto-update the game. In Steam → Skyrim Special Edition → ' +
            "Properties → Updates, set updates to 'Only update this game when I launch it.'",
        );
      } else if (version === 'AE') {
        notes.push(
          'You are on Skyrim Anniversary Edition 1.6.1170+. Every SKSE DLL plugin MUST ' +
            'be the AE build. USSEP v4.3.x requires the Creation Club masters — if any of ' +
            'them are missing from your game folder, USSEP will fail to load.',
        );
      } else {
        notes.push(
          'Game version was not recorded. Verify each SKSE DLL plugin matches your actual ' +
            'game executable version before launching.',
        );
      }
    } else if (gameSlug === 'fallout4') {
      if (version === 'Standard') {
        notes.push(
          'You are on pre-Next-Gen Fallout 4 (1.10.163). If your game is currently on the ' +
            'Next-Gen update (1.10.980+), use the Simple Fallout 4 Downgrader ' +
            '(Nexus mod #81933) BEFORE installing this modlist. Disable Steam auto-updates afterward.',
        );
        notes.push('Use Classic F4SE (v0.6.23) and Classic Buffout 4 — NOT the NG versions.');
      } else if (version === 'Next-Gen') {
        notes.push(
          'You are on Fallout 4 Next-Gen (1.10.980+). Use the Next-Gen F4SE build from ' +
            'silverlock.org and Buffout 4 NG (Nexus #64880). XDI and many pre-2024 DLL plugins ' +
            'do NOT work on NG and must be skipped.',
        );
      } else {
        notes.push(
          'Game version was not recorded. Check each DLL plugin\'s mod page to verify ' +
            'Next-Gen compatibility before launching.',
        );
      }
    }
    return notes;
  }

  private troubleshooting(gameSlug: string): GuideStep[] {
    const common: GuideStep[] = [
      {
        title: 'Game crashes immediately on launch',
        body:
          'Most common causes, in order of likelihood:\n' +
          '1. Script-extender DLL does not match your game version. Re-download the matching build.\n' +
          '2. A DLL plugin requires a game version you do not have. Check the crash logger output.\n' +
          '3. Missing master files (the plugin depends on an .esm that is not enabled).\n' +
          '4. Wrong Address Library file. Delete the versionlib .bin files that do not match your exe.',
      },
      {
        title: "Game launches but mods don't appear",
        body:
          'You likely launched the game executable directly instead of through your mod manager. ' +
          "Always launch via MO2 (run SKSE/F4SE from MO2's executable dropdown) or through the " +
          'Vortex Dashboard launch button so the mod manager can inject its virtual file system.',
      },
    ];
    if (gameSlug === 'skyrimse') {
      common.push({
        title: 'NPCs have dark/grey faces',
        body:
          'NPC FaceGen mismatch. Ensure the plugin controlling NPC appearance (right pane) and ' +
          'the loose files or archive providing FaceGen textures (left pane) are both present ' +
          'and in compatible priority. Face Discoloration Fix (#42441) is a runtime safety net.',
      });
    }
    if (gameSlug === 'fallout4') {
      common.push({
        title: 'FPS drops below 20 in downtown Boston',
        body:
          'Something broke previs/precombines. Check that PRP loads last, and that no mod in ' +
          'your list modifies vanilla placed objects without regenerating precombines. Remove ' +
          "any 'Scrap Everything'-style mod immediately.",
      });
    }
    return common;
  }

  private sectionToDict(section: GuideSection): Record<string, unknown> {
    return {
      id: section.id,
      title: section.title,
      summary: section.summary,
      steps: section.steps.map((s) => ({ title: s.title, body: s.body })),
    };
  }
}
