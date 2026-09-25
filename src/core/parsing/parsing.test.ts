import { describe, expect, it } from 'vitest';
import { leesFictiefHr, leesFictiefPowerUp } from '../testUtils';
import type { Tabel } from '../types';
import { HR_WERKBLAD, parseHr } from './hr';
import { POWERUP_WERKBLAD, parseDatum, parsePowerUp } from './powerup';
import { ParseFout, vindKoprij } from './tabel';
import { leesWerkblad } from './xlsx';

describe('vindKoprij', () => {
  it('finds the first row containing the header cell, ignoring case and spaces', () => {
    const t: Tabel = [['Voortgangsrapport'], [], ['Gebruiker', ' e-mail ', 'Cursus'], ['x', 'E-mail']];
    expect(vindKoprij(t, 'E-mail')).toBe(2);
    expect(vindKoprij(t, 'Onbekend')).toBe(-1);
  });
});

describe('parsePowerUp', () => {
  const tabel: Tabel = [
    ['Voortgangsrapport'],
    ['Gegenereerd op 01-09-2026'],
    [],
    ['Gebruiker', 'E-mail', 'Cursus', 'Ingeschreven op', 'Status', 'Tijd'],
    ['A. Test', '  Anna.Test@Driessen.example ', 'Cursus A', new Date('2026-05-01'), 'Voltooid', '1d 2h 3m 4s'],
    [null, null, null, null, null, null],
    ['B. Test', 'bob@ijk.example', 'Cursus B', '15-06-2026', 0.5, '-'],
  ];

  it('finds the header dynamically and reads the rows', () => {
    const rijen = parsePowerUp(tabel);
    expect(rijen).toHaveLength(2);
    expect(rijen[0]).toMatchObject({ rijnummer: 5, sleutel: 'anna.test@driessen.example', cursus: 'Cursus A', statusRuw: 'Voltooid', tijdMinuten: 1563 });
    expect(rijen[1].ingeschrevenOp?.toISOString().slice(0, 10)).toBe('2026-06-15');
    expect(rijen[1].tijdMinuten).toBeNull();
  });

  it('does not read the "Gebruiker" column', () => {
    const rijen = parsePowerUp(tabel);
    expect(JSON.stringify(rijen)).not.toContain('A. Test');
  });

  it('throws a clear error without header row or required column', () => {
    expect(() => parsePowerUp([['iets'], ['anders']])).toThrow(ParseFout);
    expect(() => parsePowerUp([['E-mail', 'Cursus']])).toThrow(/Status/);
  });
});

describe('parseDatum', () => {
  it('handles Date, Excel serial and Dutch notation', () => {
    expect(parseDatum(new Date('2026-01-02'))?.toISOString().slice(0, 10)).toBe('2026-01-02');
    expect(parseDatum(46023)?.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(parseDatum('3-2-2026')?.toISOString().slice(0, 10)).toBe('2026-02-03');
    expect(parseDatum('geen datum')).toBeNull();
    expect(parseDatum(null)).toBeNull();
  });
});

describe('parseHr', () => {
  const tabel: Tabel = [
    ['Lijst FvB'],
    [],
    ['Personeelsnummer', 'Naam', 'E-mail werk', 'Werkgevernaam', 'Org. eenheid omschrijving', 'Leidinggevende'],
    [1, 'Anna Test', ' ANNA.TEST@driessen.example', 'Driessen B.V.', 'Driessen - HR', 'Geheime Baas'],
    [2, 'Zonder Mail', null, 'IJK B.V.', 'IJK - Projecten', 'Geheime Baas'],
    [3, 'Dubbel', 'anna.test@driessen.example', 'Driessen B.V.', 'Driessen - HR', 'Geheime Baas'],
    [4, 'Vreemd', 'v@vreemd.example', 'Vreemd B.V.', 'X - Y', 'Geheime Baas'],
  ];

  it('reads the required columns and normalises the key', () => {
    const { medewerkers } = parseHr(tabel);
    expect(medewerkers[0]).toEqual({
      sleutel: 'anna.test@driessen.example',
      naam: 'Anna Test',
      werkgevernaam: 'Driessen B.V.',
      bedrijfCode: 'driessen',
      afdeling: 'Driessen - HR',
    });
  });

  it('never reads the "Leidinggevende" column', () => {
    const res = parseHr(tabel);
    expect(JSON.stringify(res)).not.toContain('Geheime Baas');
  });

  it('reports missing e-mail, duplicates and unknown employers', () => {
    const { medewerkers, uitzonderingen } = parseHr(tabel);
    expect(medewerkers.map((m) => m.naam)).toEqual(['Anna Test', 'Vreemd']);
    expect(medewerkers[1].bedrijfCode).toBeNull();
    expect(uitzonderingen.map((u) => u.type).sort()).toEqual(['hr_dubbel', 'hr_zonder_email', 'onbekend_bedrijf']);
  });
});

describe('xlsx parsing of the generated fictitious exports', () => {
  it('reads the Power UP export', async () => {
    const tabel = await leesWerkblad(leesFictiefPowerUp(), POWERUP_WERKBLAD, 'E-mail');
    const rijen = parsePowerUp(tabel);
    expect(rijen.length).toBeGreaterThan(500);
    expect(rijen.every((r) => r.sleutel.endsWith('.example'))).toBe(true);
    expect(rijen.every((r) => r.sleutel === r.sleutel.trim().toLowerCase())).toBe(true);
    expect(rijen.some((r) => r.statusRuw === 'In afwachting')).toBe(true);
  });

  it('reads the HR export', async () => {
    const tabel = await leesWerkblad(leesFictiefHr(), HR_WERKBLAD, 'E-mail werk');
    const { medewerkers, uitzonderingen } = parseHr(tabel);
    expect(medewerkers.length).toBeGreaterThanOrEqual(280);
    expect(uitzonderingen).toHaveLength(0);
    expect(new Set(medewerkers.map((m) => m.bedrijfCode))).toEqual(new Set(['driessen', 'ijk', 'jeij', 'reijn', 'haert']));
  });

  it('rejects a file that is not a workbook', async () => {
    await expect(leesWerkblad(new TextEncoder().encode('geen excel'), 'Gebruikers', 'E-mail')).rejects.toThrow(ParseFout);
  });
});
