import { isVerplicht, weergaveNaam } from './config/programma';
import { STATUSSEN, type DashboardRegel, type Status } from './types';

export type StatusTelling = Record<Status, number>;

/**
 * Aggregate of a set of rows, counted PER EMPLOYEE (each employee once). Used for the
 * cards, the group tables and the AI context, so all figures are consistent.
 */
export interface MedewerkerTelling {
  /** Distinct employees (HR list). */
  medewerkers: number;
  /** Employees per overall status across the trainings in the rows (sums to `medewerkers`). */
  telling: StatusTelling;
  /**
   * Employees who completed ALL mandatory trainings in the rows (overlaps with `telling`).
   * Null when the rows contain no mandatory training.
   */
  verplichtAfgerond: number | null;
}

export interface Groep extends MedewerkerTelling {
  sleutel: string;
  label: string;
}

export const legeTelling = (): StatusTelling => ({ afgerond: 0, bezig: 0, niet_gestart: 0 });

export const pct = (deel: number, totaal: number) => (totaal === 0 ? 0 : Math.round((deel / totaal) * 1000) / 10);

/** Counts per employee × training combination (not per employee). */
export function telStatussen(regels: readonly DashboardRegel[]): StatusTelling {
  const t = legeTelling();
  for (const r of regels) t[r.status]++;
  return t;
}

export const aantalMedewerkers = (regels: readonly DashboardRegel[]) => new Set(regels.map((r) => r.sleutel)).size;

/**
 * Overall status of ONE employee across the trainings in the selection:
 * - afgerond: every training completed
 * - niet_gestart: no training started yet (includes not yet registered in Power UP)
 * - bezig: at least one training started, but not everything completed
 */
export function medewerkerStatus(statussen: readonly Status[]): Status {
  if (statussen.length > 0 && statussen.every((s) => s === 'afgerond')) return 'afgerond';
  if (statussen.every((s) => s === 'niet_gestart')) return 'niet_gestart';
  return 'bezig';
}

/** Per-employee aggregate of the given rows. */
export function telMedewerkerStatussen(regels: readonly DashboardRegel[]): MedewerkerTelling {
  const perMw = new Map<string, { alle: Status[]; verplicht: Status[] }>();
  for (const r of regels) {
    let mw = perMw.get(r.sleutel);
    if (!mw) perMw.set(r.sleutel, (mw = { alle: [], verplicht: [] }));
    mw.alle.push(r.status);
    if (isVerplicht(r.training)) mw.verplicht.push(r.status);
  }
  const telling = legeTelling();
  let verplichtAfgerond = 0;
  let heeftVerplicht = false;
  for (const mw of perMw.values()) {
    telling[medewerkerStatus(mw.alle)]++;
    if (mw.verplicht.length > 0) {
      heeftVerplicht = true;
      if (mw.verplicht.every((s) => s === 'afgerond')) verplichtAfgerond++;
    }
  }
  return { medewerkers: perMw.size, telling, verplichtAfgerond: heeftVerplicht ? verplichtAfgerond : null };
}

export function groepeer(
  regels: readonly DashboardRegel[],
  sleutelVan: (r: DashboardRegel) => string,
  labelVan: (r: DashboardRegel) => string = sleutelVan,
): Groep[] {
  const map = new Map<string, { label: string; regels: DashboardRegel[] }>();
  for (const r of regels) {
    const k = sleutelVan(r);
    let g = map.get(k);
    if (!g) map.set(k, (g = { label: labelVan(r), regels: [] }));
    g.regels.push(r);
  }
  return [...map.entries()]
    .map(([sleutel, g]) => ({ sleutel, label: g.label, ...telMedewerkerStatussen(g.regels) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'nl'));
}

export const perBedrijf = (regels: readonly DashboardRegel[]) =>
  groepeer(regels, (r) => r.bedrijfCode ?? 'onbekend', (r) => r.werkgevernaam || 'Onbekend');

export const perAfdeling = (regels: readonly DashboardRegel[]) => groepeer(regels, (r) => r.afdeling);

export const perTraining = (regels: readonly DashboardRegel[]) => groepeer(regels, (r) => r.training, (r) => weergaveNaam(r.training));

export interface MatrixRij {
  sleutel: string;
  naam: string;
  werkgevernaam: string;
  afdeling: string;
  perTraining: Record<string, { status: Status; voortgang: number | null; geregistreerd: boolean }>;
}

/** Employee × training matrix for the drill-down table. */
export function medewerkerMatrix(regels: readonly DashboardRegel[]): MatrixRij[] {
  const map = new Map<string, MatrixRij>();
  for (const r of regels) {
    let rij = map.get(r.sleutel);
    if (!rij) {
      map.set(r.sleutel, (rij = { sleutel: r.sleutel, naam: r.naam, werkgevernaam: r.werkgevernaam, afdeling: r.afdeling, perTraining: {} }));
    }
    rij.perTraining[r.training] = { status: r.status, voortgang: r.voortgang, geregistreerd: r.geregistreerd };
  }
  return [...map.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

export { STATUSSEN };
