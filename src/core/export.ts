import { medewerkerStatus, type MatrixRij } from './aggregate';
import { isVerplicht, weergaveNaam } from './config/programma';
import { STATUS_LABELS, type Status } from './types';

/** One cell of the export: text, a fraction (0–1, shown as percentage) or empty. */
export type ExportCel = string | number | null;

export interface ExportTabel {
  kolommen: string[];
  /** Per column: how it should be formatted. */
  soorten: ('tekst' | 'status' | 'percentage')[];
  rijen: ExportCel[][];
}

const TOTAAL_LABELS: Record<Status, string> = {
  afgerond: 'Alles afgerond',
  bezig: 'Bezig',
  niet_gestart: 'Niet gestart',
};

/**
 * Builds the "Medewerkers × training" export from exactly the rows shown in the dashboard
 * (already filtered on role and on the user's filters). No e-mail addresses (data minimisation).
 */
export function bouwExport(rijen: readonly MatrixRij[], trainingen: readonly string[]): ExportTabel {
  const kolommen = ['Medewerker', 'Bedrijf', 'Afdeling/team', 'Totaalstatus', 'Verplicht afgerond'];
  const soorten: ExportTabel['soorten'] = ['tekst', 'tekst', 'tekst', 'status', 'tekst'];
  for (const t of trainingen) {
    const naam = weergaveNaam(t);
    kolommen.push(`${naam} – status`, `${naam} – voortgang`);
    soorten.push('status', 'percentage');
  }
  const verplicht = trainingen.filter(isVerplicht);

  const data = rijen.map((m) => {
    const statussen = trainingen.map((t) => m.perTraining[t]?.status).filter((s): s is Status => !!s);
    const verplichtStatussen = verplicht.map((t) => m.perTraining[t]?.status).filter((s): s is Status => !!s);
    const rij: ExportCel[] = [
      m.naam,
      m.werkgevernaam,
      m.afdeling,
      statussen.length ? TOTAAL_LABELS[medewerkerStatus(statussen)] : null,
      verplichtStatussen.length === 0 ? '—' : verplichtStatussen.every((s) => s === 'afgerond') ? 'Ja' : 'Nee',
    ];
    for (const t of trainingen) {
      const c = m.perTraining[t];
      rij.push(c ? STATUS_LABELS[c.status] : null);
      // Progress as a fraction: 1 for completed, 0 for not started, the percentage for in progress
      rij.push(!c ? null : c.status === 'afgerond' ? 1 : c.status === 'niet_gestart' ? 0 : c.voortgang === null ? null : c.voortgang / 100);
    }
    return rij;
  });
  return { kolommen, soorten, rijen: data };
}

/** Safe file name with the date, e.g. "medewerkers-x-training-2026-10-01.xlsx". */
export const exportBestandsnaam = (datum: Date) => `medewerkers-x-training-${datum.toISOString().slice(0, 10)}.xlsx`;
