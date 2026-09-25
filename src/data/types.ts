import type { KoppelSamenvatting } from '../core/matching';
import type { Rol } from '../core/roles';
import type { DashboardRegel, Uitzondering } from '../core/types';

export interface DashboardData {
  /** Rows already filtered on the user's role. */
  regels: DashboardRegel[];
  programmaCursussen: string[];
  peildatum: Date | null;
  /** True when no data set has been loaded yet (local build before the first upload). */
  geenDataset?: boolean;
}

export interface CursusInfo {
  naam: string;
  inProgramma: boolean;
  nieuw: boolean;
}

export interface BeheerOverzicht {
  samenvatting: KoppelSamenvatting;
  /** Contains personal data — beheerder only. */
  uitzonderingen: Uitzondering[];
  cursussen: CursusInfo[];
  /** Programme trainings that were not found in the Power UP export. */
  nietGevonden: string[];
  bestanden: { powerup: string; hr: string };
  bron: 'gebundeld' | 'upload';
  peildatum: Date | null;
}

export class GeenToegangFout extends Error {
  constructor(message = 'Je hebt geen rechten voor deze gegevens.') {
    super(message);
    this.name = 'GeenToegangFout';
  }
}

/** User-facing upload error. Never contains personal data. */
export class UploadFout extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadFout';
  }
}

/**
 * Data source abstraction. `DemoDataSource` processes everything in the browser;
 * `ApiDataSource` (phase 2/3) calls the API, which applies the same role filter
 * server-side. The `rollen` argument is only used by the demo; the API derives
 * roles from the login instead.
 */
export interface DataSource {
  getDashboard(rollen: readonly Rol[]): Promise<DashboardData>;
  /** Null when no data set has been loaded yet. */
  getBeheer(rollen: readonly Rol[]): Promise<BeheerOverzicht | null>;
  upload(rollen: readonly Rol[], powerup: File, hr: File): Promise<BeheerOverzicht>;
  setProgrammaCursussen(rollen: readonly Rol[], cursussen: string[]): Promise<BeheerOverzicht>;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
