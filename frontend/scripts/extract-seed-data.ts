// One-shot Node wrapper that runs the Python seed dump and writes the
// per-table JSON files under public/data/.
//
// Run with: npx tsx frontend/scripts/extract-seed-data.ts
//
// Uses execFileSync(args-as-array) — no shell interpolation, no command
// injection surface even if the path contained special characters.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PY_SCRIPT = join(HERE, 'dump_seed_data.py');
const OUT_DIR = join(HERE, '..', 'public', 'data');

mkdirSync(OUT_DIR, { recursive: true });

const stdout = execFileSync('python', [PY_SCRIPT], { encoding: 'utf-8' });
const data = JSON.parse(stdout);

const writes: Array<[string, unknown]> = [
  ['games.json', data.games],
  ['playstyles.json', data.playstyles],
  ['build-phases.skyrim.json', data.build_phases_skyrim],
  ['build-phases.fallout4.json', data.build_phases_fallout4],
  ['compatibility.skyrim.json', data.compatibility_skyrim],
  ['compatibility.fallout4.json', data.compatibility_fallout4],
];

for (const [filename, payload] of writes) {
  const out = join(OUT_DIR, filename);
  writeFileSync(out, JSON.stringify(payload, null, 2));
  const count = Array.isArray(payload) ? payload.length : Object.keys(payload as object).length;
  console.log(`wrote ${filename} (${count} entries)`);
}
