import { describe, expect, it } from 'vitest';
import { medewerkerMatrix } from './aggregate';
import { bouwExport, exportBestandsnaam } from './export';
import { regel } from './testUtils';

const E = 'AI & data essentials (2.01_AI_Essentials)'; // mandatory, long export name
const V = 'AI verantwoord inzetten in je werk'; // mandatory
const C = 'Copilot chat'; // optional

const rs = [
  { ...regel('a@x.example', 'ijk', 'IJK - A', E, 'afgerond'), naam: 'Anna' },
  { ...regel('a@x.example', 'ijk', 'IJK - A', V, 'afgerond'), naam: 'Anna' },
  { ...regel('a@x.example', 'ijk', 'IJK - A', C, 'bezig', 40), naam: 'Anna' },
  { ...regel('b@x.example', 'reijn', 'RE - B', E, 'niet_gestart', null, false), naam: 'Bram' },
  { ...regel('b@x.example', 'reijn', 'RE - B', V, 'niet_gestart', null, false), naam: 'Bram' },
  { ...regel('b@x.example', 'reijn', 'RE - B', C, 'niet_gestart', null, false), naam: 'Bram' },
];

describe('Excel export of the employee × training table', () => {
  const t = bouwExport(medewerkerMatrix(rs), [E, V, C]);

  it('has fixed columns plus status and progress per training, with short names', () => {
    expect(t.kolommen).toEqual([
      'Medewerker',
      'Bedrijf',
      'Afdeling/team',
      'Totaalstatus',
      'Verplicht afgerond',
      'AI & data essentials – status',
      'AI & data essentials – voortgang',
      'AI verantwoord inzetten in je werk – status',
      'AI verantwoord inzetten in je werk – voortgang',
      'Copilot chat – status',
      'Copilot chat – voortgang',
    ]);
    expect(t.soorten).toHaveLength(t.kolommen.length);
  });

  it('contains one row per employee with the same statuses as the dashboard', () => {
    expect(t.rijen).toEqual([
      ['Anna', 'ijk B.V.', 'IJK - A', 'Bezig', 'Ja', 'Afgerond', 1, 'Afgerond', 1, 'Bezig', 0.4],
      ['Bram', 'reijn B.V.', 'RE - B', 'Niet gestart', 'Nee', 'Niet gestart', 0, 'Niet gestart', 0, 'Niet gestart', 0],
    ]);
  });

  it('only exports the selected trainings and never e-mail addresses', () => {
    const alleenC = bouwExport(medewerkerMatrix(rs.filter((r) => r.training === C)), [C]);
    expect(alleenC.rijen[0]).toEqual(['Anna', 'ijk B.V.', 'IJK - A', 'Bezig', '—', 'Bezig', 0.4]);
    expect(JSON.stringify(t)).not.toContain('@');
  });

  it('uses a dated file name', () => {
    expect(exportBestandsnaam(new Date('2026-10-01T12:00:00Z'))).toBe('medewerkers-x-training-2026-10-01.xlsx');
  });
});
