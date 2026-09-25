import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { leesFictiefHr, leesFictiefPowerUp } from '../core/testUtils';

// Vite's ?url imports resolve to strings; serve the fictitious files through a mocked fetch.
vi.mock('../../testdata/fictief/getresponsive_Report_Voortgangsrapport_report.xlsx?url', () => ({ default: 'powerup.xlsx' }));
vi.mock('../../testdata/fictief/Lijst_FvB_20260901.xlsx?url', () => ({ default: 'hr.xlsx' }));

const { DemoDataSource } = await import('./DemoDataSource');
const { GeenToegangFout, UploadFout } = await import('./types');

function alsFile(bytes: Uint8Array, naam: string): File {
  return new File([bytes as BlobPart], naam);
}

async function werkboekMet(rijen: unknown[][], blad = 'Gebruikers'): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(blad);
  rijen.forEach((r) => ws.addRow(r));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const bytes = url === 'powerup.xlsx' ? leesFictiefPowerUp() : leesFictiefHr();
    return new Response(bytes as BodyInit);
  });
});

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
    const b = await new DemoDataSource().getBeheer(['beheerder']);
    const types = new Set(b.uitzonderingen.map((u) => u.type));
    expect(types).toEqual(new Set(['geen_hr_match', 'dubbele_inschrijving', 'onbekende_status']));
    expect(b.samenvatting.nietIngeschreven).toBeGreaterThan(0);
    expect(b.cursussen.filter((c) => c.inProgramma)).toHaveLength(4);
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
    const b = await ds.setProgrammaCursussen(['beheerder'], ['Data geletterdheid', 'BHV Herhaling']);
    expect(b.cursussen.filter((c) => c.inProgramma).map((c) => c.naam).sort()).toEqual(['BHV Herhaling', 'Data geletterdheid']);
    const d = await ds.getDashboard(['groepsdirectie']);
    expect(new Set(d.regels.map((r) => r.training))).toEqual(new Set(['BHV Herhaling', 'Data geletterdheid']));
  });
});
