import { Injectable, inject } from '@angular/core';
import { Modlist } from '../../shared/models/mod.model';
import { NexusService } from './nexus.service';

/**
 * Mo2ExportService — builds the JSON manifest that the Mod Organizer 2
 * plugin (`plugins/mo2/moddersomni_import.py`) reads, and downloads it.
 *
 * The plugin calls `startDownloadNexusFile(modId, fileId)` for every entry
 * and skips any entry without a `fileId`. Modlists saved before file ids
 * were persisted don't carry them, so `exportManifest` resolves missing
 * ids through the unauthenticated Nexus GraphQL endpoint at export time.
 */

export interface Mo2ManifestMod {
  modId: number;
  fileId: number | null;
  name: string;
  installOrder: number;
  notes?: string;
}

export interface Mo2Manifest {
  version: string;
  game: 'skyrim' | 'fallout4';
  name: string;
  mods: Mo2ManifestMod[];
}

/** Manifest schema version the plugin accepts (any 2.x). */
export const MO2_MANIFEST_VERSION = '2.0.0';

/** Nexus domain → plugin game key. */
export function gameKeyForDomain(domain: string | undefined): 'skyrim' | 'fallout4' {
  return domain === 'fallout4' ? 'fallout4' : 'skyrim';
}

/** Pure: modlist → manifest. Entries without a Nexus mod id are dropped. */
export function buildMo2Manifest(modlist: Modlist): Mo2Manifest {
  const mods: Mo2ManifestMod[] = [];
  modlist.entries.forEach((e, i) => {
    const modId = e.nexus_mod_id ?? e.mod_id;
    if (!modId) return;
    const mod: Mo2ManifestMod = {
      modId,
      fileId: e.file_id ?? null,
      name: e.name,
      installOrder: i + 1,
    };
    if (e.is_patch && e.patches_mods?.length) {
      mod.notes = `Patch for ${e.patches_mods.join(' + ')}`;
    }
    mods.push(mod);
  });
  const game = gameKeyForDomain(modlist.game_domain);
  const date = modlist.created_at ? modlist.created_at.slice(0, 10) : '';
  return {
    version: MO2_MANIFEST_VERSION,
    game,
    name: `ModdersOmni ${game === 'fallout4' ? 'Fallout 4' : 'Skyrim'} loadout${date ? ' ' + date : ''}`,
    mods,
  };
}

const RESOLVE_CONCURRENCY = 4;

@Injectable({ providedIn: 'root' })
export class Mo2ExportService {
  private readonly nexus = inject(NexusService);

  /**
   * Build the manifest, filling any missing file ids from Nexus.
   * Returns the manifest plus how many mods still lack a file id.
   */
  async exportManifest(modlist: Modlist): Promise<{ manifest: Mo2Manifest; unresolved: number }> {
    const manifest = buildMo2Manifest(modlist);
    const domain = modlist.game_domain;
    const missing = manifest.mods.filter((m) => m.fileId == null);

    if (domain && missing.length > 0) {
      let next = 0;
      const worker = async () => {
        while (next < missing.length) {
          const mod = missing[next++];
          try {
            const files = await this.nexus.getModFiles(domain, mod.modId);
            const primary = files.find((f) => f.primary) ?? files[0];
            const id = primary ? Number(primary.fileId) : NaN;
            if (Number.isFinite(id) && id > 0) mod.fileId = id;
          } catch {
            /* leave unresolved; the plugin reports it as skipped */
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(RESOLVE_CONCURRENCY, missing.length) }, worker));
    }

    const unresolved = manifest.mods.filter((m) => m.fileId == null).length;
    return { manifest, unresolved };
  }

  /** Trigger a browser download of the manifest JSON. */
  download(manifest: Mo2Manifest, modlistId: string): void {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moddersomni-${manifest.game}-${modlistId.slice(-6).replace(/^-+/, '')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
