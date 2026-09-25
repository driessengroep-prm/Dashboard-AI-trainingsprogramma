/**
 * Automated privacy check (runs in CI before the build is deployed).
 *
 * Fails when:
 *  1. an .xlsx/.xls/.csv file exists in the repo outside testdata/fictief/;
 *  2. the build output (dist/) contains an e-mail address that does not end in .example
 *     (also inside bundled .xlsx files);
 *  3. source files or the build contain something that looks like an API key or an
 *     Azure OpenAI endpoint.
 *
 * Usage: npm run privacy-check            (run after `npm run build:demo` to include dist/)
 *        npm run privacy-check -- --repo  (repository only, e.g. before the build)
 * Output never prints the offending addresses themselves, only file names and counts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { leesAlleTabellen } from '../src/core/parsing/xlsx';
import { gevondenGeheimen, nietToegestaneEmails, verbodenDatabestanden } from './privacyRegels';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const TEKST = /\.(ts|tsx|js|mjs|cjs|jsx|json|md|html|css|txt|yml|yaml|env|example|svg|map|toml|ini|sh)$/i;

const ALLEEN_REPO = process.argv.includes('--repo');
const fouten: string[] = [];

function repoBestanden(): string[] {
  // Tracked files plus new files that are not ignored
  const uit = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  return uit.split('\n').filter(Boolean).filter((p) => existsSync(join(ROOT, p)));
}

function alleBestanden(map: string): string[] {
  return readdirSync(map).flatMap((n) => {
    const p = join(map, n);
    return statSync(p).isDirectory() ? alleBestanden(p) : [p];
  });
}

async function main() {
  const bestanden = repoBestanden();

  // 1. Data files outside testdata/fictief/
  for (const p of verbodenDatabestanden(bestanden)) fouten.push(`Databestand buiten testdata/fictief/: ${p}`);

  // 3a. Secrets / endpoints in the repository (package-lock contains only hashes/URLs of packages)
  for (const p of bestanden) {
    if (!TEKST.test(p) || p === 'package-lock.json') continue;
    for (const naam of gevondenGeheimen(readFileSync(join(ROOT, p), 'utf8'))) fouten.push(`${naam} gevonden in ${p}`);
  }

  // 2 + 3b. Build output
  if (ALLEEN_REPO) {
    // skipped on request
  } else if (!existsSync(DIST)) {
    console.warn('Let op: dist/ bestaat niet; build-output niet gecontroleerd. Draai eerst `npm run build:demo`.');
    if (process.env.CI) fouten.push('dist/ ontbreekt in CI: de build-output moet worden gecontroleerd.');
  } else {
    for (const p of alleBestanden(DIST)) {
      const rel = relative(ROOT, p);
      if (/\.xlsx$/i.test(p)) {
        const tabellen = await leesAlleTabellen(new Uint8Array(readFileSync(p)));
        const tekst = tabellen.flat(2).filter((c) => typeof c === 'string').join('\n');
        const n = nietToegestaneEmails(tekst).length;
        if (n) fouten.push(`${n} niet-.example e-mailadres(sen) in ${rel}`);
      } else if (/\.(xls|csv)$/i.test(p)) {
        fouten.push(`Onverwacht databestand in build-output: ${rel}`);
      } else {
        const tekst = readFileSync(p, 'utf8');
        const n = nietToegestaneEmails(tekst).length;
        if (n) fouten.push(`${n} niet-.example e-mailadres(sen) in ${rel}`);
        for (const naam of gevondenGeheimen(tekst)) fouten.push(`${naam} gevonden in ${rel}`);
      }
    }
  }

  if (fouten.length) {
    console.error('Privacycheck MISLUKT:');
    for (const f of fouten) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`Privacycheck geslaagd (${bestanden.length} repo-bestanden${!ALLEEN_REPO && existsSync(DIST) ? ' + dist/' : ''} gecontroleerd).`);
}

main().catch((e) => {
  console.error('Privacycheck kon niet worden uitgevoerd:', e instanceof Error ? e.message : e);
  process.exit(1);
});
