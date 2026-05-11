// Generates favicon.png (32x32) and favicon-192.png (192x192) from the Omega
// SVG mark. Run once after changing the mark; commit the outputs.
//
// Usage: node scripts/generate-favicon.mjs

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

// Match the SVG in BrandMarkComponent. Filled background so it reads at
// 16x16 in browser tabs against light/dark surfaces.
// oklch(0.14 0.012 80) => #15130e (warm near-black)
// oklch(0.82 0.16 75)  => #e4a050 (Pip-Boy amber)
const svg = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="#15130e"/>
  <path
    d="M5 20 L9 20 L9 16 C6 14 5 11 5 9 C5 5 8 3 12 3 C16 3 19 5 19 9 C19 11 18 14 15 16 L15 20 L19 20"
    fill="none"
    stroke="#e4a050"
    stroke-width="2.4"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
</svg>
`;

const svgBuffer = Buffer.from(svg, 'utf8');

for (const size of [32, 192]) {
  const out = resolve(publicDir, size === 32 ? 'favicon.png' : `favicon-${size}.png`);
  const png = await sharp(svgBuffer)
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
  await writeFile(out, png);
  console.log(`wrote ${out} (${png.byteLength} bytes)`);
}
