import type { Cel, PowerUpRij, Tabel } from '../types';
import { parseTijd } from '../status';
import { ParseFout, celTekst, isLegeRij, kolomIndices, normaliseerEmail, vindKoprij } from './tabel';

export const POWERUP_WERKBLAD = 'Gebruikers';

// "Gebruiker" (short name) is intentionally not read: it is never used for matching.
const KOLOMMEN = {
  email: { naam: 'E-mail', verplicht: true },
  cursus: { naam: 'Cursus', verplicht: true },
  ingeschrevenOp: { naam: 'Ingeschreven op', verplicht: false },
  status: { naam: 'Status', verplicht: true },
  tijd: { naam: 'Tijd', verplicht: false },
};

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function parseDatum(c: Cel): Date | null {
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? null : c;
  if (typeof c === 'number' && c > 0) return new Date(EXCEL_EPOCH + Math.round(c * 86400000));
  if (typeof c === 'string') {
    const nl = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(c.trim());
    if (nl) {
      const [, d, m, y, hh, mm] = nl;
      return new Date(Date.UTC(+y, +m - 1, +d, hh ? +hh : 0, mm ? +mm : 0));
    }
    const iso = Date.parse(c);
    if (!Number.isNaN(iso)) return new Date(iso);
  }
  return null;
}

export function parsePowerUp(tabel: Tabel): PowerUpRij[] {
  const kopIdx = vindKoprij(tabel, 'E-mail');
  if (kopIdx < 0) throw new ParseFout('Power UP-export: geen koprij met kolom "E-mail" gevonden.');
  const k = kolomIndices(tabel[kopIdx], KOLOMMEN);
  const rijen: PowerUpRij[] = [];
  for (let i = kopIdx + 1; i < tabel.length; i++) {
    const rij = tabel[i] ?? [];
    if (isLegeRij(rij)) continue;
    const email = celTekst(rij[k.email]);
    const cursus = celTekst(rij[k.cursus]);
    if (!email && !cursus) continue;
    const statusCel = rij[k.status];
    rijen.push({
      rijnummer: i + 1,
      sleutel: normaliseerEmail(email),
      cursus,
      ingeschrevenOp: k.ingeschrevenOp >= 0 ? parseDatum(rij[k.ingeschrevenOp] ?? null) : null,
      statusRuw:
        typeof statusCel === 'number' || typeof statusCel === 'string' ? statusCel : statusCel == null ? null : celTekst(statusCel),
      tijdMinuten: k.tijd >= 0 ? parseTijd(celTekst(rij[k.tijd]) || null) : null,
    });
  }
  return rijen;
}
