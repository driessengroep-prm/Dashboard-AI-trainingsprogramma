import type { DashboardRegel, Status } from './types';

/** Empty or missing arrays mean "no filter". */
export interface DashboardFilters {
  bedrijven?: string[];
  afdelingen?: string[];
  trainingen?: string[];
  statussen?: Status[];
}

const actief = <T>(a?: T[]): a is T[] => !!a && a.length > 0;

export function pasFiltersToe(regels: readonly DashboardRegel[], f: DashboardFilters): DashboardRegel[] {
  return regels.filter(
    (r) =>
      (!actief(f.bedrijven) || (r.bedrijfCode !== null && f.bedrijven.includes(r.bedrijfCode))) &&
      (!actief(f.afdelingen) || f.afdelingen.includes(r.afdeling)) &&
      (!actief(f.trainingen) || f.trainingen.includes(r.training)) &&
      (!actief(f.statussen) || f.statussen.includes(r.status)),
  );
}
