/**
 * Mapping between company codes (used in roles, e.g. `bedrijf_ijk`) and the
 * "Werkgevernaam" as it appears in the HR export.
 */
export interface Bedrijf {
  code: string;
  werkgevernaam: string;
  /** Prefix used in "Org. eenheid omschrijving", e.g. "IJK - Projecten". */
  afdelingsprefix: string;
}

export const BEDRIJVEN: readonly Bedrijf[] = [
  { code: 'driessen', werkgevernaam: 'Driessen B.V.', afdelingsprefix: 'Driessen' },
  { code: 'ijk', werkgevernaam: 'IJK B.V.', afdelingsprefix: 'IJK' },
  { code: 'jeij', werkgevernaam: 'Jeij B.V.', afdelingsprefix: 'Jeij' },
  { code: 'reijn', werkgevernaam: 'Reijn B.V.', afdelingsprefix: 'Reijn' },
  { code: 'haert', werkgevernaam: 'Haert B.V.', afdelingsprefix: 'Haert' },
];

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Returns the company code for a "Werkgevernaam", or undefined if unknown. */
export function bedrijfCodeVoor(werkgevernaam: string): string | undefined {
  const n = normalize(werkgevernaam);
  return BEDRIJVEN.find((b) => normalize(b.werkgevernaam) === n)?.code;
}

export function bedrijfVoorCode(code: string): Bedrijf | undefined {
  return BEDRIJVEN.find((b) => b.code === code);
}
