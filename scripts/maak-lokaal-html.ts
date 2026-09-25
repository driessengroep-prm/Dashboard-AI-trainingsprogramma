/**
 * Turns the local build (dist-lokaal/, VITE_APP_MODE=lokaal) into ONE self-contained
 * HTML file that can be opened offline (file://) to test with real exports.
 *
 * - All JavaScript, CSS and the logo are inlined; no bundled (demo) data.
 * - A strict Content-Security-Policy blocks every network request, so uploaded data
 *   cannot leave the browser. Nothing is stored (memory only).
 * - Output: dist-lokaal/dashboard-ai-trainingsprogramma-lokaal.html (gitignored,
 *   never published: it is a tool, the data is only ever loaded at runtime).
 *
 * Usage: npm run build:lokaal
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist-lokaal');
const UIT = join(DIST, 'dashboard-ai-trainingsprogramma-lokaal.html');

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  "connect-src 'none'",
  "font-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
const assets = readdirSync(join(DIST, 'assets'));
if (assets.some((a) => !/\.(js|css)$/.test(a))) throw new Error(`Onverwacht bestand in dist-lokaal/assets: ${assets.join(', ')}`);
if (assets.filter((a) => a.endsWith('.js')).length !== 1) throw new Error('Verwacht precies één JavaScript-bundel.');

const lees = (href: string) => readFileSync(join(DIST, href.replace(/^\.\//, '')), 'utf8');
// Prevent "</script>" / "</style>" inside the code from closing the inline element
const veilig = (code: string, tag: string) => code.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src: string) => {
  return `<script type="module">${veilig(lees(src), 'script')}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/, (_, href: string) => `<style>${veilig(lees(href), 'style')}</style>`);
html = html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);

if (/<script[^>]+src=|<link[^>]+href=/.test(html)) throw new Error('Niet alle bestanden zijn ingevoegd.');
writeFileSync(UIT, html);
console.log(`Lokaal HTML-bestand gemaakt: ${UIT} (${Math.round(html.length / 1024)} kB)`);
