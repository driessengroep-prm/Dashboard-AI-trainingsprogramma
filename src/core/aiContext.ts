import { STANDAARD_MIN_GROEPSGROOTTE } from './config/instellingen';
import { bedrijfVoorCode } from './config/bedrijven';
import { isVerplicht } from './config/programma';
import { groepeer, pct, telStatussen, type Groep, type StatusTelling } from './aggregate';
import { STATUSSEN, type DashboardRegel, type Status } from './types';

/**
 * The ONLY data that is sent to the AI model. Aggregates only: counts and
 * percentages per company, department, training and status. Never names,
 * e-mail addresses or rows per person.
 */
export type StatusVerdeling = Record<Status, { aantal: number; pct: number }>;

export interface AiGroep {
  naam: string;
  medewerkers: number;
  /** Employee × training combinations. */
  combinaties: number;
  perStatus: StatusVerdeling;
  /** Only on merged groups: how many original groups it contains. */
  samengevoegdeGroepen?: number;
  /** Only on trainings: whether the training is mandatory. */
  verplicht?: boolean;
}

export interface AiContext {
  versie: 1;
  peildatum: string | null;
  selectie: {
    bedrijven: string[] | 'alle';
    afdelingen: string[] | 'alle';
    trainingen: string[] | 'alle';
    statussen: Status[] | 'alle';
  };
  drempelKleineGroep: number;
  /** False when the whole selection is smaller than the threshold: then no figures are included. */
  voldoendeData: boolean;
  totaal: (AiGroep & { gemiddeldeVoortgangBezig: number | null }) | null;
  perTraining: AiGroep[];
  perBedrijf: AiGroep[];
  perAfdeling: (AiGroep & { bedrijf: string })[];
  onderdrukking: {
    bedrijvenSamengevoegd: number;
    afdelingenSamengevoegd: number;
    afdelingenWeggelaten: number;
  };
}

export interface AiSelectie {
  bedrijven?: string[];
  afdelingen?: string[];
  trainingen?: string[];
  statussen?: Status[];
}

export interface AiContextOpties {
  minGroep?: number;
  peildatum?: Date | null;
}

function verdeling(t: StatusTelling, totaal: number): StatusVerdeling {
  const v = {} as StatusVerdeling;
  for (const s of STATUSSEN) v[s] = { aantal: t[s], pct: pct(t[s], totaal) };
  return v;
}

const naarAi = (g: Groep, naam = g.label): AiGroep => ({
  naam,
  medewerkers: g.medewerkers,
  combinaties: g.totaal,
  perStatus: verdeling(g.telling, g.totaal),
});

function voegSamen(groepen: Groep[], label: string): Groep {
  const telling = { afgerond: 0, bezig: 0, niet_gestart: 0 };
  let medewerkers = 0;
  let totaal = 0;
  for (const g of groepen) {
    medewerkers += g.medewerkers; // groups are disjoint (each employee belongs to one company/department)
    totaal += g.totaal;
    for (const s of STATUSSEN) telling[s] += g.telling[s];
  }
  return { sleutel: label, label, medewerkers, totaal, telling };
}

/**
 * Small-group suppression. Groups below `min` are merged into one "overig" group.
 * If that merged group is itself still below `min`, the smallest regular group is
 * added to it as well, so that no small group can be derived by subtracting the
 * visible groups from a known total. If everything is small, nothing is shown.
 */
export function onderdrukKleineGroepen(
  groepen: Groep[],
  min: number,
  overigLabel: string,
): { zichtbaar: AiGroep[]; samengevoegd: number; weggelaten: number } {
  const klein = groepen.filter((g) => g.medewerkers < min);
  const groot = groepen.filter((g) => g.medewerkers >= min).sort((a, b) => a.medewerkers - b.medewerkers);
  if (klein.length === 0) return { zichtbaar: groot.map((g) => naarAi(g)), samengevoegd: 0, weggelaten: 0 };

  const inOverig = [...klein];
  while (inOverig.reduce((n, g) => n + g.medewerkers, 0) < min && groot.length > 0) {
    inOverig.push(groot.shift()!);
  }
  if (inOverig.reduce((n, g) => n + g.medewerkers, 0) < min) {
    return { zichtbaar: [], samengevoegd: 0, weggelaten: inOverig.length };
  }
  const overig = { ...naarAi(voegSamen(inOverig, overigLabel)), samengevoegdeGroepen: inOverig.length };
  return { zichtbaar: [...groot.map((g) => naarAi(g)), overig], samengevoegd: inOverig.length, weggelaten: 0 };
}

const sorteer = <T extends { naam: string }>(a: T[]) => a.sort((x, y) => x.naam.localeCompare(y.naam, 'nl'));
const ofAlle = <T>(a?: T[]) => (a && a.length ? [...a] : ('alle' as const));

/**
 * Builds the AI context from rows that have ALREADY been filtered on role and on
 * the user's current filter selection.
 */
export function buildAiContext(regels: readonly DashboardRegel[], selectie: AiSelectie = {}, opties: AiContextOpties = {}): AiContext {
  const min = opties.minGroep ?? STANDAARD_MIN_GROEPSGROOTTE;
  const basis: AiContext = {
    versie: 1,
    peildatum: opties.peildatum ? opties.peildatum.toISOString().slice(0, 10) : null,
    selectie: {
      // Company names instead of role codes, as shown in the dashboard
      bedrijven: ofAlle(selectie.bedrijven?.map((c) => bedrijfVoorCode(c)?.werkgevernaam ?? c)),
      afdelingen: ofAlle(selectie.afdelingen),
      trainingen: ofAlle(selectie.trainingen),
      statussen: ofAlle(selectie.statussen),
    },
    drempelKleineGroep: min,
    voldoendeData: false,
    totaal: null,
    perTraining: [],
    perBedrijf: [],
    perAfdeling: [],
    onderdrukking: { bedrijvenSamengevoegd: 0, afdelingenSamengevoegd: 0, afdelingenWeggelaten: 0 },
  };

  const alleMw = new Set(regels.map((r) => r.sleutel)).size;
  if (alleMw < min) return basis;

  const telling = telStatussen(regels);
  const bezig = regels.filter((r) => r.status === 'bezig' && r.voortgang !== null);
  const gemiddeldeVoortgangBezig = bezig.length
    ? Math.round((bezig.reduce((n, r) => n + (r.voortgang ?? 0), 0) / bezig.length) * 10) / 10
    : null;

  // Per training: every group spans the whole selection (>= min employees).
  const perTraining = groepeer(regels, (r) => r.training).map((g) => ({ ...naarAi(g), verplicht: isVerplicht(g.label) }));

  // Per company, with suppression.
  const bedrijfGroepen = groepeer(regels, (r) => r.bedrijfCode ?? 'onbekend', (r) => r.werkgevernaam || 'Onbekend');
  const bedrijven = onderdrukKleineGroepen(bedrijfGroepen, min, 'Overige bedrijven (samengevoegd)');
  const zichtbareBedrijven = new Set(bedrijven.zichtbaar.map((b) => b.naam));

  // Per department, suppressed WITHIN each visible company so that departments add up
  // to the company total and no small department can be derived by subtraction.
  const perAfdeling: AiContext['perAfdeling'] = [];
  let afdelingenSamengevoegd = 0;
  let afdelingenWeggelaten = 0;
  for (const b of bedrijfGroepen) {
    const eigen = regels.filter((r) => (r.bedrijfCode ?? 'onbekend') === b.sleutel);
    const afdGroepen = groepeer(eigen, (r) => r.afdeling);
    if (!zichtbareBedrijven.has(b.label)) {
      afdelingenWeggelaten += afdGroepen.length;
      continue;
    }
    const res = onderdrukKleineGroepen(afdGroepen, min, `${b.label} — overige afdelingen (samengevoegd)`);
    afdelingenSamengevoegd += res.samengevoegd;
    afdelingenWeggelaten += res.weggelaten;
    perAfdeling.push(...res.zichtbaar.map((a) => ({ ...a, bedrijf: b.label })));
  }

  return {
    ...basis,
    voldoendeData: true,
    totaal: {
      naam: 'Totaal selectie',
      medewerkers: alleMw,
      combinaties: regels.length,
      perStatus: verdeling(telling, regels.length),
      gemiddeldeVoortgangBezig,
    },
    perTraining: sorteer(perTraining),
    perBedrijf: sorteer(bedrijven.zichtbaar),
    perAfdeling: sorteer(perAfdeling),
    onderdrukking: {
      bedrijvenSamengevoegd: bedrijven.samengevoegd,
      afdelingenSamengevoegd,
      afdelingenWeggelaten,
    },
  };
}
