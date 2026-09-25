import { medewerkerStatus } from './aggregate';
import type { DashboardRegel, Status } from './types';

/** Empty or missing arrays mean "no filter". */
export interface DashboardFilters {
  bedrijven?: string[];
  afdelingen?: string[];
  trainingen?: string[];
  /**
   * Filters EMPLOYEES on their overall status across the selected trainings
   * (see medewerkerStatus), not individual employee × training rows. All rows of a
   * matching employee are kept.
   */
  statussen?: Status[];
}

const actief = <T>(a?: T[]): a is T[] => !!a && a.length > 0;

/** Company, department and training filters (row level). */
export function pasSelectieToe(regels: readonly DashboardRegel[], f: DashboardFilters): DashboardRegel[] {
  return regels.filter(
    (r) =>
      (!actief(f.bedrijven) || (r.bedrijfCode !== null && f.bedrijven.includes(r.bedrijfCode))) &&
      (!actief(f.afdelingen) || f.afdelingen.includes(r.afdeling)) &&
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
