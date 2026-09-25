export const STATUSSEN = ['afgerond', 'bezig', 'niet_gestart'] as const;
export type Status = (typeof STATUSSEN)[number];

export const STATUS_LABELS: Record<Status, string> = {
  afgerond: 'Afgerond',
  bezig: 'Bezig',
  niet_gestart: 'Niet gestart',
};

/** A single cell value after reading a worksheet. */
export type Cel = string | number | boolean | Date | null;
export type Tabel = Cel[][];

/** Employee as read from the HR export (only the columns we need). */
export interface HrMedewerker {
  /** Normalised work e-mail (trimmed, lower case) — the join key. */
  sleutel: string;
  naam: string;
  werkgevernaam: string;
  /** Company code from config/bedrijven.ts, or null when the employer is unknown. */
  bedrijfCode: string | null;
  /** "Org. eenheid omschrijving", shown as-is (including the company prefix). */
  afdeling: string;
}

/** Row as read from the Power UP export (only the columns we need). */
export interface PowerUpRij {
  /** 1-based row number in the worksheet, for traceability in the exception list. */
  rijnummer: number;
  /** Normalised e-mail (trimmed, lower case). */
  sleutel: string;
  cursus: string;
  ingeschrevenOp: Date | null;
  statusRuw: string | number | null;
  tijdMinuten: number | null;
}

export type UitzonderingType =
  | 'geen_hr_match'
  | 'onbekende_status'
  | 'dubbele_inschrijving'
  | 'hr_zonder_email'
  | 'hr_dubbel'
  | 'onbekend_bedrijf';

/** Item on the exception list. Contains personal data: visible to `beheerder` only. */
export interface Uitzondering {
  type: UitzonderingType;
  bron: 'powerup' | 'hr';
  rijnummer?: number;
  email?: string;
  cursus?: string;
  detail: string;
}

/** One cell of the employee × programme training matrix. */
export interface DashboardRegel {
  sleutel: string;
  naam: string;
  bedrijfCode: string | null;
  werkgevernaam: string;
  afdeling: string;
  training: string;
  status: Status;
  /**
   * False when the employee has no (valid) enrolment for this training in Power UP,
   * e.g. because they have not logged in yet. Such combinations count as `niet_gestart`.
   */
  geregistreerd: boolean;
  /** Progress in percent (0–100), only for status `bezig`. */
  voortgang: number | null;
  ingeschrevenOp: Date | null;
  tijdMinuten: number | null;
}
