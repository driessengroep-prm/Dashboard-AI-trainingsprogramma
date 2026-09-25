import { STATUSSEN, type DashboardRegel, type Status } from './types';

export type StatusTelling = Record<Status, number>;

export interface Groep {
  sleutel: string;
  label: string;
  /** Distinct employees in the group. */
  medewerkers: number;
  /** Number of employee × training combinations. */
  totaal: number;
  telling: StatusTelling;
}

export const legeTelling = (): StatusTelling => ({ afgerond: 0, bezig: 0, niet_gestart: 0, niet_ingeschreven: 0 });

export const pct = (deel: number, totaal: number) => (totaal === 0 ? 0 : Math.round((deel / totaal) * 1000) / 10);

export function telStatussen(regels: readonly DashboardRegel[]): StatusTelling {
  const t = legeTelling();
  for (const r of regels) t[r.status]++;
  return t;
}

export const aantalMedewerkers = (regels: readonly DashboardRegel[]) => new Set(regels.map((r) => r.sleutel)).size;

export function groepeer(
  regels: readonly DashboardRegel[],
  sleutelVan: (r: DashboardRegel) => string,
  labelVan: (r: DashboardRegel) => string = sleutelVan,
): Groep[] {
  const map = new Map<string, { label: string; mw: Set<string>; telling: StatusTelling; totaal: number }>();
  for (const r of regels) {
    const k = sleutelVan(r);
    let g = map.get(k);
    if (!g) map.set(k, (g = { label: labelVan(r), mw: new Set(), telling: legeTelling(), totaal: 0 }));
    g.mw.add(r.sleutel);
    g.telling[r.status]++;
    g.totaal++;
  }
  return [...map.entries()]
    .map(([sleutel, g]) => ({ sleutel, label: g.label, medewerkers: g.mw.size, totaal: g.totaal, telling: g.telling }))
    .sort((a, b) => a.label.localeCompare(b.label, 'nl'));
}

export const perBedrijf = (regels: readonly DashboardRegel[]) =>
  groepeer(regels, (r) => r.bedrijfCode ?? 'onbekend', (r) => r.werkgevernaam || 'Onbekend');

export const perAfdeling = (regels: readonly DashboardRegel[]) => groepeer(regels, (r) => r.afdeling);

export const perTraining = (regels: readonly DashboardRegel[]) => groepeer(regels, (r) => r.training);

export interface MatrixRij {
  sleutel: string;
  naam: string;
  werkgevernaam: string;
  afdeling: string;
  perTraining: Record<string, { status: Status; voortgang: number | null }>;
}

/** Employee × training matrix for the drill-down table. */
export function medewerkerMatrix(regels: readonly DashboardRegel[]): MatrixRij[] {
  const map = new Map<string, MatrixRij>();
  for (const r of regels) {
    let rij = map.get(r.sleutel);
    if (!rij) {
      map.set(r.sleutel, (rij = { sleutel: r.sleutel, naam: r.naam, werkgevernaam: r.werkgevernaam, afdeling: r.afdeling, perTraining: {} }));
    }
    rij.perTraining[r.training] = { status: r.status, voortgang: r.voortgang };
  }
  return [...map.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

export { STATUSSEN };
