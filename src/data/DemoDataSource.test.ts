import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { leesFictiefHr, leesFictiefPowerUp } from '../core/testUtils';
import { DemoDataSource as BrowserDataSource } from './DemoDataSource';
import { GeenToegangFout, UploadFout } from './types';

// Demo configuration: bundled fictitious data, only .example addresses accepted
class DemoDataSource extends BrowserDataSource {
  constructor() {
    super({ gebundeld: async () => ({ powerup: leesFictiefPowerUp(), hr: leesFictiefHr() }), alleenFictief: true });
  }
}

function alsFile(bytes: Uint8Array, naam: string): File {
  return new File([bytes as BlobPart], naam);
}

async function werkboekMet(rijen: unknown[][], blad = 'Gebruikers'): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(blad);
  rijen.forEach((r) => ws.addRow(r));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe('DemoDataSource', () => {
  it('loads the bundled data and filters on role', async () => {
    const ds = new DemoDataSource();
    const alle = await ds.getDashboard(['groepsdirectie']);
    const ijk = await ds.getDashboard(['bedrijf_ijk']);
    expect(alle.regels.length).toBeGreaterThan(1000);
    expect(ijk.regels.length).toBeGreaterThan(0);
    expect(ijk.regels.every((r) => r.bedrijfCode === 'ijk')).toBe(true);
  });

  it('denies access without role and beheer for non-beheerders', async () => {
    const ds = new DemoDataSource();
    await expect(ds.getDashboard([])).rejects.toBeInstanceOf(GeenToegangFout);
    await expect(ds.getBeheer(['groepsdirectie'])).rejects.toBeInstanceOf(GeenToegangFout);
  });

  it('shows the beheer summary with exceptions', async () => {
    const b = (await new DemoDataSource().getBeheer(['beheerder']))!;
    const types = new Set(b.uitzonderingen.map((u) => u.type));
    expect(types).toEqual(new Set(['geen_hr_match', 'dubbele_inschrijving', 'onbekende_status']));
    expect(b.samenvatting.nietGeregistreerd).toBeGreaterThan(0);
    // Only the three programme trainings exist in the export, all selected by default
    expect(b.cursussen.map((c) => [c.naam, c.inProgramma])).toEqual([
      ['AI & data essentials', true],
      ['AI verantwoord inzetten in je werk', true],
      ['Copilot chat', true],
    ]);
  });

  it('accepts the fictitious exports as upload', async () => {
    const ds = new DemoDataSource();
    const b = await ds.upload(['beheerder'], alsFile(leesFictiefPowerUp(), 'pu.xlsx'), alsFile(leesFictiefHr(), 'hr.xlsx'));
    expect(b.bron).toBe('upload');
    expect(b.samenvatting.gematcht).toBeGreaterThan(200);
  });

  it('refuses uploads with a non-.example e-mail address without echoing it', async () => {
    const ds = new DemoDataSource();
    const echt = await werkboekMet([['Gebruiker', 'E-mail', 'Cursus', 'Ingeschreven op', 'Status', 'Tijd'], ['J. Echt', 'jan@echtbedrijf.nl', 'X', null, 'Voltooid', '-']]);
    const err = await ds.upload(['beheerder'], alsFile(echt, 'pu.xlsx'), alsFile(leesFictiefHr(), 'hr.xlsx')).catch((e) => e);
    expect(err).toBeInstanceOf(UploadFout);
    expect(err.message).toMatch(/\.example/);
    expect(err.message).not.toContain('jan@echtbedrijf.nl');
  });

  it('refuses non-xlsx files', async () => {
    const ds = new DemoDataSource();
    await expect(ds.upload(['beheerder'], alsFile(new Uint8Array([1]), 'a.csv'), alsFile(leesFictiefHr(), 'hr.xlsx'))).rejects.toBeInstanceOf(UploadFout);
  });

  it('updates the programme courses', async () => {
    const ds = new DemoDataSource();
    const b = await ds.setProgrammaCursussen(['beheerder'], ['Copilot chat', 'AI & data essentials']);
    expect(b.cursussen.filter((c) => c.inProgramma).map((c) => c.naam).sort()).toEqual(['AI & data essentials', 'Copilot chat']);
    expect(b.cursussen.find((c) => c.naam === 'AI verantwoord inzetten in je werk')?.inProgramma).toBe(false);
    const d = await ds.getDashboard(['groepsdirectie']);
    expect(new Set(d.regels.map((r) => r.training))).toEqual(new Set(['AI & data essentials', 'Copilot chat']));
  });
});

describe('local offline build (no bundled data, real addresses allowed)', () => {
  const echteAdressen = async () => {
    const pu = await werkboekMet([
      ['Gebruiker', 'E-mail', 'Cursus', 'Ingeschreven op', 'Status', 'Tijd'],
      ['J. Jansen', 'jan@bedrijf.nl', 'Copilot chat', null, 'Afgerond', '-'],
    ]);
    const hr = await werkboekMet(
      [
        ['Naam', 'E-mail werk', 'Werkgevernaam', 'Org. eenheid omschrijving'],
        ['Jan Jansen', 'Jan@Bedrijf.nl', 'IJK B.V.', 'IJK - Directie'],
        ['Piet Pieters', 'piet@bedrijf.nl', 'IJK B.V.', 'IJK - Directie'],
      ],
      'DG MW in dienst',
    );
    return [alsFile(pu, 'pu.xlsx'), alsFile(hr, 'hr.xlsx')] as const;
  };

  it('starts empty until the first upload', async () => {
    const ds = new BrowserDataSource({ alleenFictief: false });
    expect(await ds.getDashboard(['beheerder'])).toMatchObject({ regels: [], geenDataset: true });
    expect(await ds.getBeheer(['beheerder'])).toBeNull();
    await expect(ds.setProgrammaCursussen(['beheerder'], ['Copilot chat'])).rejects.toBeInstanceOf(UploadFout);
  });

  it('accepts exports with real e-mail addresses', async () => {
    const ds = new BrowserDataSource({ alleenFictief: false });
    const [pu, hr] = await echteAdressen();
    const b = await ds.upload(['beheerder'], pu, hr);
    expect(b.samenvatting).toMatchObject({ hrMedewerkers: 2, gematcht: 1, nietGeregistreerd: 1 });
    const d = await ds.getDashboard(['bedrijf_ijk']);
    expect(d.regels.find((r) => r.naam === 'Jan Jansen' && r.training === 'Copilot chat')?.status).toBe('afgerond');
  });

  it('the demo configuration still refuses the same files', async () => {
    const [pu, hr] = await echteAdressen();
    await expect(new DemoDataSource().upload(['beheerder'], pu, hr)).rejects.toBeInstanceOf(UploadFout);
  });
});
