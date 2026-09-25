import { telNietToegestaneEmails } from '../core/demoGuard';
import { koppel, type KoppelResultaat } from '../core/matching';
import { HR_WERKBLAD, parseHr, type HrResultaat } from '../core/parsing/hr';
import { POWERUP_WERKBLAD, parsePowerUp } from '../core/parsing/powerup';
import { ParseFout } from '../core/parsing/tabel';
import { leesAlleTabellen, leesWerkblad } from '../core/parsing/xlsx';
import { filterOpRol, heeftToegang, magBeheren, type Rol } from '../core/roles';
import type { PowerUpRij } from '../core/types';
import { DEMO_HR_BESTAND, DEMO_POWERUP_BESTAND, DEMO_PROGRAMMA_CURSUSSEN } from './demoConfig';
import {
  GeenToegangFout,
  MAX_UPLOAD_BYTES,
  UploadFout,
  type BeheerOverzicht,
  type DashboardData,
  type DataSource,
} from './types';
import powerupUrl from '../../testdata/fictief/getresponsive_Report_Voortgangsrapport_report.xlsx?url';
import hrUrl from '../../testdata/fictief/Lijst_FvB_20260901.xlsx?url';

interface Staat {
  hr: HrResultaat;
  powerup: PowerUpRij[];
  programma: string[];
  bekend: string[];
  bestanden: { powerup: string; hr: string };
  bron: 'gebundeld' | 'upload';
  peildatum: Date | null;
  resultaat: KoppelResultaat;
}

type Bytes = ArrayBuffer | Uint8Array;

async function verwerk(powerupBytes: Bytes, hrBytes: Bytes) {
  const [puTabel, hrTabel] = await Promise.all([
    leesWerkblad(powerupBytes, POWERUP_WERKBLAD, 'E-mail'),
    leesWerkblad(hrBytes, HR_WERKBLAD, 'E-mail werk'),
  ]);
  return { powerup: parsePowerUp(puTabel), hr: parseHr(hrTabel) };
}

const bereken = (s: Omit<Staat, 'resultaat'>): Staat => ({
  ...s,
  resultaat: koppel({ hr: s.hr.medewerkers, powerup: s.powerup, programmaCursussen: s.programma, bekendeCursussen: s.bekend }, s.hr.uitzonderingen),
});

/**
 * Demo data source: bundled fictitious data plus uploads processed in the browser.
 * Everything lives in memory only — no localStorage, no IndexedDB, no network requests with data.
 */
export class DemoDataSource implements DataSource {
  private staat: Promise<Staat> | null = null;

  private laad(): Promise<Staat> {
    if (!this.staat) {
      this.staat = (async () => {
        // Static assets that are part of the build (fictitious data only)
        const [pu, hr] = await Promise.all([fetch(powerupUrl), fetch(hrUrl)].map(async (p) => (await p).arrayBuffer()));
        const data = await verwerk(pu, hr);
        return bereken({
          ...data,
          programma: [...DEMO_PROGRAMMA_CURSUSSEN],
          bekend: [...DEMO_PROGRAMMA_CURSUSSEN],
          bestanden: { powerup: DEMO_POWERUP_BESTAND, hr: DEMO_HR_BESTAND },
          bron: 'gebundeld',
          peildatum: new Date(Date.UTC(2026, 8, 1)),
        });
      })();
      this.staat.catch(() => (this.staat = null));
    }
    return this.staat;
  }

  async getDashboard(rollen: readonly Rol[]): Promise<DashboardData> {
    if (!heeftToegang(rollen)) throw new GeenToegangFout();
    const s = await this.laad();
    return {
      regels: filterOpRol(s.resultaat.regels, rollen),
      programmaCursussen: s.programma,
      peildatum: s.peildatum,
    };
  }

  async getBeheer(rollen: readonly Rol[]): Promise<BeheerOverzicht> {
    if (!magBeheren(rollen)) throw new GeenToegangFout('Alleen de beheerder heeft toegang tot het beheerdersportaal.');
    return this.overzicht(await this.laad());
  }

  async upload(rollen: readonly Rol[], powerup: File, hr: File): Promise<BeheerOverzicht> {
    if (!magBeheren(rollen)) throw new GeenToegangFout();
    for (const f of [powerup, hr]) {
      if (!f.name.toLowerCase().endsWith('.xlsx')) throw new UploadFout(`"${f.name}" is geen .xlsx-bestand.`);
      if (f.size > MAX_UPLOAD_BYTES) throw new UploadFout(`"${f.name}" is groter dan 10 MB.`);
    }
    const [puBytes, hrBytes] = await Promise.all([powerup.arrayBuffer(), hr.arrayBuffer()]);

    // Demo guard: refuse as soon as one e-mail address does not end in .example
    for (const [f, bytes] of [[powerup, puBytes], [hr, hrBytes]] as const) {
      let aantal: number;
      try {
        aantal = telNietToegestaneEmails(await leesAlleTabellen(bytes));
      } catch (e) {
        throw new UploadFout(e instanceof ParseFout ? `${f.name}: ${e.message}` : `"${f.name}" kon niet worden gelezen.`);
      }
      if (aantal > 0) {
        throw new UploadFout(
          `"${f.name}" is geweigerd: het bevat ${aantal} e-mailadres(sen) die niet op ".example" eindigen. ` +
            'Deze demo accepteert uitsluitend fictieve gegevens. Upload hier nooit echte exports.',
        );
      }
    }

    let data: Awaited<ReturnType<typeof verwerk>>;
    try {
      data = await verwerk(puBytes, hrBytes);
    } catch (e) {
      throw new UploadFout(e instanceof ParseFout ? e.message : 'De bestanden konden niet worden verwerkt.');
    }
    const vorige = await this.laad().catch(() => null);
    const gevonden = new Set(data.powerup.map((r) => r.cursus));
    const programma = (vorige?.programma ?? [...DEMO_PROGRAMMA_CURSUSSEN]).filter((c) => gevonden.has(c));
    const nieuw = bereken({
      ...data,
      programma,
      bekend: vorige?.bekend ?? [...DEMO_PROGRAMMA_CURSUSSEN],
      bestanden: { powerup: powerup.name, hr: hr.name },
      bron: 'upload',
      peildatum: new Date(),
    });
    this.staat = Promise.resolve(nieuw);
    return this.overzicht(nieuw);
  }

  async setProgrammaCursussen(rollen: readonly Rol[], cursussen: string[]): Promise<BeheerOverzicht> {
    if (!magBeheren(rollen)) throw new GeenToegangFout();
    const s = await this.laad();
    const gevonden = new Set(s.resultaat.cursussen);
    const nieuw = bereken({
      ...s,
      programma: cursussen.filter((c) => gevonden.has(c)),
      // Once the beheerder has made a choice, all current course names count as known
      bekend: [...new Set([...s.bekend, ...s.resultaat.cursussen])],
    });
    this.staat = Promise.resolve(nieuw);
    return this.overzicht(nieuw);
  }

  private overzicht(s: Staat): BeheerOverzicht {
    const nieuw = new Set(s.resultaat.nieuweCursussen);
    return {
      samenvatting: s.resultaat.samenvatting,
      uitzonderingen: s.resultaat.uitzonderingen,
      cursussen: s.resultaat.cursussen.map((naam) => ({ naam, inProgramma: s.programma.includes(naam), nieuw: nieuw.has(naam) })),
      bestanden: s.bestanden,
      bron: s.bron,
      peildatum: s.peildatum,
    };
  }
}
