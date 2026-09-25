/**
 * Mapping between company codes (used in roles, e.g. `bedrijf_ijk`) and the
 * "Werkgevernaam" as it appears in the HR export.
 */
export interface Bedrijf {
  code: string;
  werkgevernaam: string;
}

export const BEDRIJVEN: readonly Bedrijf[] = [
  { code: 'bloeij', werkgevernaam: 'Bloeij B.V.' },
  { code: 'driessen', werkgevernaam: 'Driessen B.V.' },
  { code: 'holding', werkgevernaam: 'Driessen Holding B.V.' },
  { code: 'haert', werkgevernaam: 'Haert B.V.' },
  { code: 'humancampus', werkgevernaam: 'Human Campus B.V.' },
  { code: 'ijk', werkgevernaam: 'IJK B.V.' },
  { code: 'ijkservices', werkgevernaam: 'IJK Services B.V.' },
  { code: 'jeij', werkgevernaam: 'Jeij B.V.' },
  { code: 'luun', werkgevernaam: 'Lüün B.V.' },
  { code: 'mensium', werkgevernaam: 'Mensium B.V.' },
  { code: 'reijn', werkgevernaam: 'Reijn B.V.' },
  { code: 'sprank', werkgevernaam: 'Sprank B.V.' },
  { code: 'talentscoutz', werkgevernaam: 'Talentscoutz B.V.' },
  { code: 'tsf', werkgevernaam: 'The Solutions Factory B.V.' },
];

// Case-, whitespace- and diacritics-insensitive ("Lüün" == "Luun")
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Returns the company code for a "Werkgevernaam", or undefined if unknown. */
export function bedrijfCodeVoor(werkgevernaam: string): string | undefined {
  const n = normalize(werkgevernaam);
  return BEDRIJVEN.find((b) => normalize(b.werkgevernaam) === n)?.code;
}

export function bedrijfVoorCode(code: string): Bedrijf | undefined {
  return BEDRIJVEN.find((b) => b.code === code);
}
