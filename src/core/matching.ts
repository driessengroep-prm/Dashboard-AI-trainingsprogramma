import { mapStatus } from './status';
import type { DashboardRegel, HrMedewerker, PowerUpRij, Uitzondering } from './types';

export interface KoppelInvoer {
  hr: HrMedewerker[];
  powerup: PowerUpRij[];
  /** Course names that belong to the programme (chosen by the beheerder). */
  programmaCursussen: string[];
  /**
   * Course names the beheerder has already seen (programme or not). Any other course
   * name found in the export is reported as new.
   */
  bekendeCursussen?: string[];
}

export interface KoppelSamenvatting {
  hrMedewerkers: number;
  /** HR employees with at least one programme enrolment in Power UP (= participants). */
  gematcht: number;
  /** HR employees without any programme enrolment in Power UP (counted as niet_gestart). */
  nietGeregistreerd: number;
  /** Employee × programme training combinations without enrolment in Power UP. */
  regelsNietGeregistreerd: number;
  uitzonderingen: number;
  nieuweCursussen: number;
}

export interface KoppelResultaat {
  regels: DashboardRegel[];
  uitzonderingen: Uitzondering[];
  /** All distinct course names found in the Power UP export, sorted. */
  cursussen: string[];
  nieuweCursussen: string[];
  samenvatting: KoppelSamenvatting;
}

const tijdVan = (r: PowerUpRij) => r.ingeschrevenOp?.getTime() ?? Number.NEGATIVE_INFINITY;

/**
 * Joins the HR list and the Power UP export on normalised e-mail address.
 * - Only programme courses end up on the dashboard.
 * - A Power UP row without HR match goes to the exception list.
 * - Duplicate enrolments: the most recent one counts and it is reported.
 * - An unknown status goes to the exception list (the combination then counts as not registered).
 * - HR employees without enrolment for a programme course (not logged in to Power UP yet)
 *   get status niet_gestart with `geregistreerd: false`.
 */
export function koppel(invoer: KoppelInvoer, bestaandeUitzonderingen: Uitzondering[] = []): KoppelResultaat {
  const programma = [...new Set(invoer.programmaCursussen)];
  const programmaSet = new Set(programma);
  const hrOpSleutel = new Map(invoer.hr.map((m) => [m.sleutel, m]));
  const uitzonderingen: Uitzondering[] = [...bestaandeUitzonderingen];

  const cursussen = [...new Set(invoer.powerup.map((r) => r.cursus).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'nl'),
  );
  const bekend = new Set([...(invoer.bekendeCursussen ?? []), ...programma]);
  const nieuweCursussen = cursussen.filter((c) => !bekend.has(c));

  // Latest enrolment per (employee, programme course)
  const laatste = new Map<string, PowerUpRij>();
  for (const r of invoer.powerup) {
    if (!programmaSet.has(r.cursus)) continue;
    if (!hrOpSleutel.has(r.sleutel)) {
      uitzonderingen.push({
        type: 'geen_hr_match',
        bron: 'powerup',
        rijnummer: r.rijnummer,
        email: r.sleutel,
        cursus: r.cursus,
        detail: 'E-mailadres niet gevonden in de HR-export; niet opgenomen in het dashboard.',
      });
      continue;
    }
    const key = `${r.sleutel}\u0000${r.cursus}`;
    const vorige = laatste.get(key);
    if (vorige) {
      const nieuwste = tijdVan(r) >= tijdVan(vorige) ? r : vorige;
      const oudste = nieuwste === r ? vorige : r;
      uitzonderingen.push({
        type: 'dubbele_inschrijving',
        bron: 'powerup',
        rijnummer: oudste.rijnummer,
        email: r.sleutel,
        cursus: r.cursus,
        detail: `Dubbele inschrijving; de meest recente (rij ${nieuwste.rijnummer}) telt.`,
      });
      laatste.set(key, nieuwste);
    } else {
      laatste.set(key, r);
    }
  }

  const regels: DashboardRegel[] = [];
  const metInschrijving = new Set<string>();
  let regelsNietGeregistreerd = 0;

  for (const m of invoer.hr) {
    for (const training of programma) {
      const r = laatste.get(`${m.sleutel}\u0000${training}`);
      const basis = {
        sleutel: m.sleutel,
        naam: m.naam,
        bedrijfCode: m.bedrijfCode,
        werkgevernaam: m.werkgevernaam,
        afdeling: m.afdeling,
        training,
      };
      const gemapt = r ? mapStatus(r.statusRuw) : null;
      if (r && !gemapt) {
        uitzonderingen.push({
          type: 'onbekende_status',
          bron: 'powerup',
          rijnummer: r.rijnummer,
          email: r.sleutel,
          cursus: r.cursus,
          detail: `Onbekende statuswaarde "${String(r.statusRuw ?? '')}"; telt in het dashboard als niet gestart.`,
        });
      }
      if (r && gemapt) {
        metInschrijving.add(m.sleutel);
        regels.push({ ...basis, status: gemapt.status, geregistreerd: true, voortgang: gemapt.voortgang, ingeschrevenOp: r.ingeschrevenOp, tijdMinuten: r.tijdMinuten });
      } else {
        regelsNietGeregistreerd++;
        regels.push({ ...basis, status: 'niet_gestart', geregistreerd: false, voortgang: null, ingeschrevenOp: null, tijdMinuten: null });
      }
    }
  }

  return {
    regels,
    uitzonderingen,
    cursussen,
    nieuweCursussen,
    samenvatting: {
      hrMedewerkers: invoer.hr.length,
      gematcht: metInschrijving.size,
      nietGeregistreerd: invoer.hr.length - metInschrijving.size,
      regelsNietGeregistreerd,
      uitzonderingen: uitzonderingen.length,
      nieuweCursussen: nieuweCursussen.length,
    },
  };
}
