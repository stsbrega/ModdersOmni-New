#!/usr/bin/env node
// Generates public/env-config.js from environment variables.
// Called before ng build on Render / Cloudflare Pages.
// Falls back to the correct API hostname if API_URL is not set or is incomplete.

const fs = require('fs');
const path = require('path');

const CORRECT_API_URL = 'https://api.moddersomni.com/api';

let apiUrl = process.env.API_URL || '';

// Reject obviously wrong values (missing hostname, bare path, missing TLD)
if (!apiUrl || apiUrl === '/api' || !apiUrl.startsWith('http') || !apiUrl.includes('.')) {
  console.warn(`[generate-env] API_URL="${apiUrl}" looks invalid — using fallback: ${CORRECT_API_URL}`);
  apiUrl = CORRECT_API_URL;
}

// Strip trailing slash for consistency
apiUrl = apiUrl.replace(/\/$/, '');

const content = `(function(window) {
  window.__env = {
    API_URL: "${apiUrl}"
  };
})(window);
`;

const outPath = path.join(__dirname, 'public', 'env-config.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log(`[generate-env] Wrote ${outPath} with API_URL=${apiUrl}`);
