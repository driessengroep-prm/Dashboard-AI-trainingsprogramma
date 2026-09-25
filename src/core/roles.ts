import { BEDRIJVEN } from './config/bedrijven';

export type Rol = 'beheerder' | 'groepsdirectie' | `bedrijf_${string}`;

const BEDRIJF_PREFIX = 'bedrijf_';

/**
 * Keeps only recognised roles. In phase 2/3 the raw roles come from the
 * `x-ms-client-principal` header; in the demo from the role picker.
 */
export function parseRollen(ruw: readonly string[]): Rol[] {
  const geldig = new Set<string>(['beheerder', 'groepsdirectie', ...BEDRIJVEN.map((b) => BEDRIJF_PREFIX + b.code)]);
  return [...new Set(ruw.map((r) => r.trim().toLowerCase()).filter((r) => geldig.has(r)))] as Rol[];
}

export type BedrijfToegang = { alle: true } | { alle: false; codes: ReadonlySet<string> };

export function bedrijfToegang(rollen: readonly Rol[]): BedrijfToegang {
  if (rollen.includes('beheerder') || rollen.includes('groepsdirectie')) return { alle: true };
  const codes = new Set(
    rollen.filter((r) => r.startsWith(BEDRIJF_PREFIX)).map((r) => r.slice(BEDRIJF_PREFIX.length)),
  );
  return { alle: false, codes };
}

export const heeftToegang = (rollen: readonly Rol[]) => {
  const t = bedrijfToegang(rollen);
  return t.alle || t.codes.size > 0;
};

export const magBeheren = (rollen: readonly Rol[]) => rollen.includes('beheerder');

/**
 * The single role filter used by both the demo (browser) and the API (phase 2/3).
 * Rows with an unknown company (bedrijfCode null) are only visible to roles with access to all companies.
 */
export function filterOpRol<T extends { bedrijfCode: string | null }>(items: readonly T[], rollen: readonly Rol[]): T[] {
  const t = bedrijfToegang(rollen);
  if (t.alle) return [...items];
  return items.filter((i) => i.bedrijfCode !== null && t.codes.has(i.bedrijfCode));
}
