/**
 * Generates two fictitious .xlsx exports in testdata/fictief/ with the same
 * structure as the real exports (sheet names, title rows, columns).
 *
 * Companies, organisational units and headcounts follow the real structure
 * (scripts/data/organisatie-2026.ts); names, e-mail addresses and training data are fictitious.
 * Deterministic: a seeded PRNG makes the output identical on every run.
 * All e-mail addresses end in `.example`.
 *
 * Usage: npm run testdata
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEDRIJVEN, type Bedrijf } from '../src/core/config/bedrijven';
import { PROGRAMMA_TRAININGEN } from '../src/core/config/programma';
import { ORGANISATIE_2026 } from './data/organisatie-2026';
import {
  DEMO_HR_BESTAND,
  DEMO_POWERUP_BESTAND,
  DEMO_PROGRAMMA_CURSUSSEN,
} from '../src/data/demoConfig';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'testdata', 'fictief');
const PEILDATUM = new Date(Date.UTC(2026, 8, 1)); // 1 Sep 2026

// --- Seeded PRNG (mulberry32) ---------------------------------------------------------
let seed = 20260901;
function rnd(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const intTussen = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

// --- Fictitious names ------------------------------------------------------------------
const VOORNAMEN = [
  'Anouk', 'Bram', 'Charlotte', 'Daan', 'Eva', 'Floor', 'Gijs', 'Hanna', 'Ilse', 'Joost',
  'Kim', 'Lars', 'Maud', 'Niels', 'Olga', 'Pim', 'Quinten', 'Roos', 'Sander', 'Tessa',
  'Ugo', 'Vera', 'Wout', 'Xander', 'Yara', 'Zeno', 'Amira', 'Bilal', 'Chen', 'Dewi',
  'Emre', 'Fleur', 'Gerrit', 'Hatice', 'Ivo', 'Jolien', 'Koen', 'Lotte', 'Mees', 'Noor',
];
const ACHTERNAMEN = [
  'Akkerman', 'Bosveld', 'Claessen', 'Dijkhoff', 'Elzinga', 'Feenstra', 'Groenewoud',
  'Hofstede', 'IJzerman', 'Jansma', 'Kloosterboer', 'Lindeman', 'Mulderij', 'Nieuwland',
  'Oosterhof', 'Postma', 'Quaedvlieg', 'Rietveld', 'Schoonhoven', 'Terpstra', 'Uiterwijk',
  'Vermeulen', 'Wildschut', 'Zandbergen', 'Brouwershaven', 'Kortenhoeven', 'Meerdink',
];
const TUSSENVOEGSELS = ['', '', '', '', 'van', 'de', 'van der', 'van den', 'ter'];

// Participation profile per company: chance of being registered in Power UP, of enrolling
// in a training, and of having completed it. Deterministic variation per company.
function profiel(code: string) {
  const h = [...code].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const f = (h % 1000) / 1000; // 0..1, stable per company
  return { registratie: 0.62 + f * 0.33, afrond: 0.25 + ((h >>> 10) % 1000) / 1000 * 0.45 };
}

// Enrolment chance per training (mandatory trainings higher than optional ones)
const INSCHRIJFKANS: Record<string, number> = Object.fromEntries(
  PROGRAMMA_TRAININGEN.map((t) => [t.naam, t.verplicht ? 0.92 : 0.45]),
);

interface Mw {
  naam: string;
  voorletter: string;
  achternaamVolledig: string;
  email: string;
  bedrijf: Bedrijf;
  afdeling: string;
  leidinggevende: string;
}

function maakMedewerkers(): Mw[] {
  const gebruikt = new Set<string>();
  const lijst: Mw[] = [];
  for (const [werkgevernaam, oes] of Object.entries(ORGANISATIE_2026)) {
    const b = BEDRIJVEN.find((x) => x.werkgevernaam === werkgevernaam);
    if (!b) throw new Error(`Bedrijf ontbreekt in src/core/config/bedrijven.ts: ${werkgevernaam}`);
    const domein = `${b.code}.example`;
    for (const [afd, aantal] of oes) {
      const leiding = `${pick(VOORNAMEN)} ${pick(ACHTERNAMEN)}`;
      for (let i = 0; i < aantal; i++) {
        let voornaam: string, tv: string, achternaam: string, email: string;
        do {
          voornaam = pick(VOORNAMEN);
          tv = pick(TUSSENVOEGSELS);
          achternaam = pick(ACHTERNAMEN);
          const local = `${voornaam}.${tv ? tv.replace(/ /g, '') : ''}${achternaam}`.toLowerCase();
          email = `${local}@${domein}`;
        } while (gebruikt.has(email));
        gebruikt.add(email);
        const achternaamVolledig = tv ? `${tv} ${achternaam}` : achternaam;
        lijst.push({
          naam: `${voornaam} ${achternaamVolledig}`,
          voorletter: voornaam[0],
          achternaamVolledig,
          email,
          bedrijf: b,
          afdeling: afd, // shown exactly as in the source, including the prefix
          leidinggevende: leiding,
        });
      }
    }
  }
  return lijst;
}

interface PuRij {
  gebruiker: string;
  email: string;
  cursus: string;
  ingeschrevenOp: Date;
  status: string | number;
  tijd: string;
}

function tijdString(seconden: number): string {
  if (seconden <= 0) return '-';
  const d = Math.floor(seconden / 86400);
  const h = Math.floor((seconden % 86400) / 3600);
  const m = Math.floor((seconden % 3600) / 60);
  const s = seconden % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function nieuwWerkboek(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  // Fixed metadata so the generated files are byte-for-byte reproducible
  wb.creator = 'genereer-testdata (fictief)';
  wb.created = PEILDATUM;
  wb.modified = PEILDATUM;
  return wb;
}

function datumVoor(dagenTerug: number): Date {
  return new Date(PEILDATUM.getTime() - dagenTerug * 86400000);
}

function maakInschrijving(gebruiker: string, email: string, cursus: string, afrondKans: number): PuRij {
  const r = rnd();
  let status: string | number;
  let tijd: number;
  if (r < afrondKans) {
    // Mostly "Voltooid", occasionally the numeric value 1 (also means completed)
    status = rnd() < 0.9 ? 'Voltooid' : 1;
    tijd = intTussen(1800, 60 * 86400);
  } else if (r < afrondKans + (1 - afrondKans) * 0.55) {
    status = Math.round((0.05 + rnd() * 0.9) * 100) / 100;
    tijd = intTussen(300, 20 * 86400);
  } else {
    status = 'Niet gestart';
    tijd = 0;
  }
  return {
    gebruiker,
    email,
    cursus,
    ingeschrevenOp: datumVoor(intTussen(10, 200)),
    status,
    tijd: tijdString(tijd),
  };
}

function metRommelInEmail(email: string, i: number): string {
  // Edge case: capitals and surrounding whitespace in e-mail addresses
  if (i % 17 === 0) return `  ${email.toUpperCase()} `;
  if (i % 11 === 0) return email.replace(/^./, (c) => c.toUpperCase()) + ' ';
  return email;
}

async function schrijfHr(medewerkers: Mw[]) {
  const wb = nieuwWerkboek();
  const ws = wb.addWorksheet('DG MW in dienst');
  ws.addRow(['Lijst FvB — medewerkers in dienst (FICTIEF)']);
  ws.addRow([`Peildatum: 01-09-2026`]);
  ws.addRow([]);
  ws.addRow([
    'Personeelsnummer', 'Naam', 'E-mail werk', 'Werkgevernaam', 'Org. eenheid omschrijving',
    'Leidinggevende', 'Functie',
  ]);
  medewerkers.forEach((m, i) => {
    ws.addRow([
      100000 + i,
      m.naam,
      i % 23 === 0 ? `${m.email.toUpperCase()}` : m.email,
      m.bedrijf.werkgevernaam,
      m.afdeling,
      m.leidinggevende,
      pick(['Medewerker', 'Senior medewerker', 'Specialist', 'Coördinator', 'Adviseur']),
    ]);
  });
  await wb.xlsx.writeFile(join(OUT_DIR, DEMO_HR_BESTAND));
}

async function schrijfPowerUp(rijen: PuRij[]) {
  const wb = nieuwWerkboek();
  const ws = wb.addWorksheet('Gebruikers');
  ws.addRow(['Voortgangsrapport']);
  ws.addRow(['Get Responsive — Power UP (FICTIEF)']);
  ws.addRow(['Gegenereerd op 01-09-2026 08:00']);
  ws.addRow([]);
  ws.addRow(['Gebruiker', 'E-mail', 'Cursus', 'Ingeschreven op', 'Status', 'Tijd']);
  for (const r of rijen) {
    ws.addRow([r.gebruiker, r.email, r.cursus, r.ingeschrevenOp, r.status, r.tijd]);
  }
  ws.getColumn(4).numFmt = 'dd-mm-yyyy';
  await wb.xlsx.writeFile(join(OUT_DIR, DEMO_POWERUP_BESTAND));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const medewerkers = maakMedewerkers();
  const rijen: PuRij[] = [];
  let zonderInschrijving = 0;

  medewerkers.forEach((m, i) => {
    const p = profiel(m.bedrijf.code);
    const gebruiker = `${m.voorletter}. ${m.achternaamVolledig}`;
    // Edge case: employees who have not logged in to Power UP yet (no enrolment at all)
    if (rnd() > p.registratie) {
      zonderInschrijving++;
      return;
    }
    const email = metRommelInEmail(m.email, i);
    for (const cursus of DEMO_PROGRAMMA_CURSUSSEN) {
      if (rnd() < INSCHRIJFKANS[cursus]) rijen.push(maakInschrijving(gebruiker, email, cursus, p.afrond));
    }
  });

  // Edge case: Power UP users who are not in the HR list
  const extern = ['stagiair.een@stage.example', 'extern.adviseur@partner.example', 'oud.medewerker@driessen.example'];
  // (these addresses do not occur in the HR list)
  for (const email of extern) {
    rijen.push(maakInschrijving('X. Extern', email, DEMO_PROGRAMMA_CURSUSSEN[0], 0.5));
  }

  // Keep the deliberate edge cases below isolated: drop any regular row for that person + course first.
  const zonderRij = (email: string, cursus: string) => {
    for (let i = rijen.length - 1; i >= 0; i--) {
      if (rijen[i].email.trim().toLowerCase() === email && rijen[i].cursus === cursus) rijen.splice(i, 1);
    }
  };

  // Edge case: duplicate enrolment (same person + course, different dates)
  const dubbel = medewerkers[5];
  zonderRij(dubbel.email, DEMO_PROGRAMMA_CURSUSSEN[1]);
  rijen.push({
    gebruiker: `${dubbel.voorletter}. ${dubbel.achternaamVolledig}`,
    email: dubbel.email,
    cursus: DEMO_PROGRAMMA_CURSUSSEN[1],
    ingeschrevenOp: datumVoor(300),
    status: 'Niet gestart',
    tijd: '-',
  });
  rijen.push({
    gebruiker: `${dubbel.voorletter}. ${dubbel.achternaamVolledig}`,
    email: dubbel.email,
    cursus: DEMO_PROGRAMMA_CURSUSSEN[1],
    ingeschrevenOp: datumVoor(5),
    status: 0.4,
    tijd: tijdString(5400),
  });

  // Edge case: unknown status value
  const onbekend = medewerkers[142];
  zonderRij(onbekend.email, DEMO_PROGRAMMA_CURSUSSEN[2]);
  rijen.push({
    gebruiker: `${onbekend.voorletter}. ${onbekend.achternaamVolledig}`,
    email: onbekend.email,
    cursus: DEMO_PROGRAMMA_CURSUSSEN[2],
    ingeschrevenOp: datumVoor(20),
    status: 'In afwachting',
    tijd: '-',
  });

  await schrijfHr(medewerkers);
  await schrijfPowerUp(rijen);
  console.log(
    `Testdata gegenereerd in ${OUT_DIR}: ${medewerkers.length} medewerkers, ` +
      `${rijen.length} Power UP-rijen, ${zonderInschrijving} zonder inschrijving.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
