import type { Cel, Tabel } from '../types';

export const normaliseerKop = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const normaliseerEmail = (s: string) => s.trim().toLowerCase();

export function celTekst(c: Cel | undefined): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return c.toISOString();
  return String(c).trim();
}

/**
 * Finds the header row dynamically: the first row that contains a cell equal to
 * `verplichteKop` (case/whitespace-insensitive). Returns -1 when not found.
 */
export function vindKoprij(tabel: Tabel, verplichteKop: string): number {
  const doel = normaliseerKop(verplichteKop);
  return tabel.findIndex((rij) => rij.some((c) => typeof c === 'string' && normaliseerKop(c) === doel));
}

export class ParseFout extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseFout';
  }
}

/**
 * Maps the requested column names to their index in the header row.
 * Only the requested columns are returned (data minimisation): other columns are never read.
 */
export function kolomIndices<K extends string>(
  kop: Cel[],
  kolommen: Record<K, { naam: string; verplicht: boolean }>,
): Record<K, number> {
  const posities = new Map<string, number>();
  kop.forEach((c, i) => {
    if (typeof c === 'string' && !posities.has(normaliseerKop(c))) posities.set(normaliseerKop(c), i);
  });
  const res = {} as Record<K, number>;
  const ontbrekend: string[] = [];
  for (const [key, def] of Object.entries(kolommen) as [K, { naam: string; verplicht: boolean }][]) {
    const idx = posities.get(normaliseerKop(def.naam)) ?? -1;
    if (idx < 0 && def.verplicht) ontbrekend.push(def.naam);
    res[key] = idx;
  }
  if (ontbrekend.length) {
    throw new ParseFout(`Verplichte kolom(men) ontbreken: ${ontbrekend.join(', ')}`);
  }
  return res;
}

export const isLegeRij = (rij: Cel[]) => rij.every((c) => celTekst(c) === '');
