/**
 * Generates two fully fictitious .xlsx exports in testdata/fictief/ with the same
 * structure as the real exports (sheet names, title rows, columns).
 *
 * Deterministic: a seeded PRNG makes the output identical on every run.
 * All e-mail addresses end in `.example`.
 *
 * Usage: npm run testdata
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEDRIJVEN } from '../src/core/config/bedrijven';
import {
  DEMO_HR_BESTAND,
  DEMO_OVERIGE_CURSUS,
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

// Departments per company. Numbers are target headcounts; some are deliberately < 5.
const AFDELINGEN: Record<string, [string, number][]> = {
  driessen: [
    ['Directie', 3], ['Financiën', 9], ['HR', 7], ['ICT', 15], ['Marketing & Communicatie', 8],
    ['Inkoop', 4], ['Juridische zaken', 6],
  ],
  ijk: [
    ['Projecten', 28], ['Werkvoorbereiding', 14], ['Uitvoering', 26], ['Calculatie', 6],
    ['Kwaliteit & Veiligheid', 3],
  ],
  jeij: [['Advies', 18], ['Engineering', 24], ['Projectmanagement', 10], ['Secretariaat', 4], ['Duurzaamheid', 8]],
  reijn: [['Productie', 36], ['Logistiek', 16], ['Onderhoud', 9], ['Planning', 5]],
  haert: [['Verkoop', 18], ['Klantenservice', 13], ['Administratie', 7], ['Innovatie', 2]],
};

// Participation profile per company: chance of enrolment and of completion.
const PROFIEL: Record<string, { inschrijf: number; afrond: number }> = {
  driessen: { inschrijf: 0.9, afrond: 0.6 },
  ijk: { inschrijf: 0.75, afrond: 0.35 },
  jeij: { inschrijf: 0.85, afrond: 0.55 },
  reijn: { inschrijf: 0.55, afrond: 0.25 },
  haert: { inschrijf: 0.8, afrond: 0.45 },
};

interface Mw {
  naam: string;
  voorletter: string;
  achternaamVolledig: string;
  email: string;
  bedrijf: (typeof BEDRIJVEN)[number];
  afdeling: string;
  leidinggevende: string;
}

function maakMedewerkers(): Mw[] {
  const gebruikt = new Set<string>();
  const lijst: Mw[] = [];
  for (const b of BEDRIJVEN) {
    const domein = `${b.code}.example`;
    for (const [afd, aantal] of AFDELINGEN[b.code]) {
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
          afdeling: `${b.afdelingsprefix} - ${afd}`,
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
    const p = PROFIEL[m.bedrijf.code];
    const gebruiker = `${m.voorletter}. ${m.achternaamVolledig}`;
    // Edge case: some employees have no enrolment at all
    if (rnd() > p.inschrijf + 0.1) {
      zonderInschrijving++;
      return;
    }
    const email = metRommelInEmail(m.email, i);
    for (const cursus of DEMO_PROGRAMMA_CURSUSSEN) {
      if (rnd() < p.inschrijf) rijen.push(maakInschrijving(gebruiker, email, cursus, p.afrond));
    }
    if (rnd() < 0.3) rijen.push(maakInschrijving(gebruiker, email, DEMO_OVERIGE_CURSUS, 0.7));
  });

  // Edge case: Power UP users who are not in the HR list
  const extern = ['stagiair.een@stage.example', 'extern.adviseur@partner.example', 'oud.medewerker@driessen.example'];
  for (const email of extern) {
    rijen.push(maakInschrijving('X. Extern', email, DEMO_PROGRAMMA_CURSUSSEN[0], 0.5));
  }

  // Edge case: duplicate enrolment (same person + course, different dates)
  const dubbel = medewerkers[5];
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
  const onbekend = medewerkers[42];
  rijen.push({
    gebruiker: `${onbekend.voorletter}. ${onbekend.achternaamVolledig}`,
    email: onbekend.email,
    cursus: DEMO_PROGRAMMA_CURSUSSEN[3],
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
