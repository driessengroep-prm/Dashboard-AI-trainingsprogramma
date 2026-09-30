import { medewerkerStatus } from './aggregate';
import type { DashboardRegel, Status } from './types';

/** Empty or missing arrays mean "no filter". */
export interface DashboardFilters {
  bedrijven?: string[];
  afdelingen?: string[];
  trainingen?: string[];
  /** Employees, as opaque ids from medewerkerId() (never e-mail addresses in URLs or requests). */
  medewerkers?: string[];
  /**
   * Filters EMPLOYEES on their overall status across the selected trainings
   * (see medewerkerStatus), not individual employee × training rows. All rows of a
   * matching employee are kept.
   */
  statussen?: Status[];
}

const actief = <T>(a?: T[]): a is T[] => !!a && a.length > 0;

function fnv1a(tekst: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const idCache = new Map<string, string>();

/**
 * Stable, opaque id for an employee key (e-mail). Used in filters and URLs so that no
 * e-mail address ends up in the browser history or in API requests. Two 32-bit FNV-1a
 * hashes with different seeds make collisions negligible for thousands of employees.
 */
export function medewerkerId(sleutel: string): string {
  let id = idCache.get(sleutel);
  if (!id) {
    id = fnv1a(sleutel, 0x811c9dc5).toString(36) + fnv1a(sleutel, 0x01234567).toString(36);
    idCache.set(sleutel, id);
  }
  return id;
}

/** Company, department, employee and training filters (row level). */
export function pasSelectieToe(regels: readonly DashboardRegel[], f: DashboardFilters): DashboardRegel[] {
  const mw = actief(f.medewerkers) ? new Set(f.medewerkers) : null;
  return regels.filter(
    (r) =>
      (!actief(f.bedrijven) || (r.bedrijfCode !== null && f.bedrijven.includes(r.bedrijfCode))) &&
      (!actief(f.afdelingen) || f.afdelingen.includes(r.afdeling)) &&
      (!mw || mw.has(medewerkerId(r.sleutel))) &&
      (!actief(f.trainingen) || f.trainingen.includes(r.training)),
  );
}

/** All filters: the selection first, then employees on their overall status within that selection. */
export function pasFiltersToe(regels: readonly DashboardRegel[], f: DashboardFilters): DashboardRegel[] {
  const selectie = pasSelectieToe(regels, f);
  if (!actief(f.statussen)) return selectie;
  const perMw = new Map<string, Status[]>();
  for (const r of selectie) {
    const lijst = perMw.get(r.sleutel);
    if (lijst) lijst.push(r.status);
    else perMw.set(r.sleutel, [r.status]);
  }
  const statussen = f.statussen;
  const gekozen = new Set([...perMw].filter(([, s]) => statussen.includes(medewerkerStatus(s))).map(([sleutel]) => sleutel));
  return selectie.filter((r) => gekozen.has(r.sleutel));
}
