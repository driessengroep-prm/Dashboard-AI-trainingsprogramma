import { describe, expect, it } from 'vitest';
import { aantalMedewerkers, medewerkerStatus, telMedewerkerStatussen, medewerkerMatrix, pct, perAfdeling, perBedrijf, perTraining, telStatussen } from './aggregate';
import { pasFiltersToe } from './filters';
import { regel } from './testUtils';

const regels = [
  regel('a@x.example', 'ijk', 'IJK - A', 'T1', 'afgerond'),
  regel('a@x.example', 'ijk', 'IJK - A', 'T2', 'bezig', 50),
  regel('b@x.example', 'ijk', 'IJK - B', 'T1', 'niet_gestart'),
  regel('b@x.example', 'ijk', 'IJK - B', 'T2', 'niet_gestart', null, false),
  regel('d@x.example', 'ijk', 'IJK - B', 'T1', 'niet_gestart', null, false),
  regel('d@x.example', 'ijk', 'IJK - B', 'T2', 'niet_gestart', null, false),
  regel('c@x.example', 'reijn', 'Reijn - C', 'T1', 'afgerond'),
  regel('c@x.example', 'reijn', 'Reijn - C', 'T2', 'afgerond'),
];

describe('aggregaties', () => {
  it('counts statuses and employees', () => {
    expect(telStatussen(regels)).toEqual({ afgerond: 3, bezig: 1, niet_gestart: 4 });
    expect(aantalMedewerkers(regels)).toBe(4);
    // d has no enrolment in Power UP but still counts as an employee (HR list)
  });

  it('derives one overall status per employee', () => {
    expect(medewerkerStatus(['afgerond', 'afgerond'])).toBe('afgerond');
    expect(medewerkerStatus(['niet_gestart', 'niet_gestart'])).toBe('niet_gestart');
    expect(medewerkerStatus(['afgerond', 'niet_gestart'])).toBe('bezig'); // started, not everything done
    expect(medewerkerStatus(['bezig', 'afgerond'])).toBe('bezig');
    // a: afgerond + bezig → bezig; b, d: nothing started; c: all completed
    expect(telMedewerkerStatussen(regels)).toEqual({ telling: { afgerond: 1, bezig: 1, niet_gestart: 2 }, medewerkers: 4 });
    // Filtering to one training gives that training's status per employee
    expect(telMedewerkerStatussen(regels.filter((r) => r.training === 'T1')).telling).toEqual({ afgerond: 2, bezig: 0, niet_gestart: 2 });
  });

  it('groups per company, department and training', () => {
    const b = perBedrijf(regels);
    expect(b.map((g) => [g.sleutel, g.medewerkers, g.totaal])).toEqual([
      ['ijk', 3, 6],
      ['reijn', 1, 2],
    ]);
    expect(perAfdeling(regels).map((g) => g.label)).toEqual(['IJK - A', 'IJK - B', 'Reijn - C']);
    const t1 = perTraining(regels).find((g) => g.label === 'T1')!;
    expect(t1.telling).toEqual({ afgerond: 2, bezig: 0, niet_gestart: 2 });
    expect(t1.medewerkers).toBe(4);
    expect(t1).not.toHaveProperty('deelnemers');
  });

  it('computes percentages rounded to one decimal', () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(0, 0)).toBe(0);
  });

  it('builds the employee × training matrix', () => {
    const m = medewerkerMatrix(regels);
    expect(m).toHaveLength(4);
    expect(m.find((r) => r.sleutel === 'a@x.example')?.perTraining.T2).toEqual({ status: 'bezig', voortgang: 50, geregistreerd: true });
  });

  it('applies dashboard filters', () => {
    expect(pasFiltersToe(regels, { bedrijven: ['reijn'] })).toHaveLength(2);
    expect(pasFiltersToe(regels, { afdelingen: ['IJK - B'], trainingen: ['T1'] })).toHaveLength(2);
    expect(pasFiltersToe(regels, { statussen: ['afgerond', 'bezig'] })).toHaveLength(4);
    expect(pasFiltersToe(regels, { bedrijven: [] })).toHaveLength(8);
  });
});
