import { describe, expect, it } from 'vitest';
import { aantalMedewerkers, medewerkerStatus, telMedewerkerStatussen, medewerkerMatrix, pct, perAfdeling, perBedrijf, perTraining, telStatussen } from './aggregate';
import { pasFiltersToe, pasSelectieToe } from './filters';
import { koppel } from './matching';
import { HR_WERKBLAD, parseHr } from './parsing/hr';
import { POWERUP_WERKBLAD, parsePowerUp } from './parsing/powerup';
import { leesWerkblad } from './parsing/xlsx';
import { leesFictiefHr, leesFictiefPowerUp, regel } from './testUtils';
import { DEMO_PROGRAMMA_CURSUSSEN } from '../data/demoConfig';

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
    // T1/T2 are not mandatory trainings, so there is no "verplicht afgerond" figure
    expect(telMedewerkerStatussen(regels)).toEqual({ telling: { afgerond: 1, bezig: 1, niet_gestart: 2 }, medewerkers: 4, verplichtAfgerond: null });
    // Filtering to one training gives that training's status per employee
    expect(telMedewerkerStatussen(regels.filter((r) => r.training === 'T1')).telling).toEqual({ afgerond: 2, bezig: 0, niet_gestart: 2 });
  });

  it('counts employees who completed all mandatory trainings', () => {
    const E = 'AI & data essentials'; // mandatory
    const V = 'AI verantwoord inzetten in je werk'; // mandatory
    const C = 'Copilot chat'; // optional
    const rs = [
      // p: both mandatory done, Copilot not started → verplicht afgerond, overall bezig
      regel('p@x.example', 'ijk', 'A', E, 'afgerond'),
      regel('p@x.example', 'ijk', 'A', V, 'afgerond'),
      regel('p@x.example', 'ijk', 'A', C, 'niet_gestart'),
      // q: everything done
      regel('q@x.example', 'ijk', 'A', E, 'afgerond'),
      regel('q@x.example', 'ijk', 'A', V, 'afgerond'),
      regel('q@x.example', 'ijk', 'A', C, 'afgerond'),
      // r: one mandatory busy
      regel('r@x.example', 'ijk', 'A', E, 'afgerond'),
      regel('r@x.example', 'ijk', 'A', V, 'bezig', 40),
      regel('r@x.example', 'ijk', 'A', C, 'afgerond'),
    ];
    expect(telMedewerkerStatussen(rs)).toEqual({ medewerkers: 3, telling: { afgerond: 1, bezig: 2, niet_gestart: 0 }, verplichtAfgerond: 2 });
    // Only the optional training selected → no mandatory figure
    expect(telMedewerkerStatussen(rs.filter((r) => r.training === C)).verplichtAfgerond).toBeNull();
  });

  it('groups per company, department and training, counting employees', () => {
    const b = perBedrijf(regels);
    // ijk: a bezig, b and d not started; reijn: c completed everything
    expect(b.map((g) => [g.sleutel, g.medewerkers, g.telling])).toEqual([
      ['ijk', 3, { afgerond: 0, bezig: 1, niet_gestart: 2 }],
      ['reijn', 1, { afgerond: 1, bezig: 0, niet_gestart: 0 }],
    ]);
    expect(perAfdeling(regels).map((g) => g.label)).toEqual(['IJK - A', 'IJK - B', 'Reijn - C']);
    const t1 = perTraining(regels).find((g) => g.label === 'T1')!;
    expect(t1.telling).toEqual({ afgerond: 2, bezig: 0, niet_gestart: 2 });
    expect(t1.medewerkers).toBe(4);
    expect(t1).not.toHaveProperty('deelnemers');
  });

  it('counts every employee exactly once, whatever the number of rows', () => {
    const dubbel = [...regels, regel('a@x.example', 'ijk', 'IJK - A', 'T1', 'afgerond'), regel('a@x.example', 'ijk', 'IJK - A', 'T3', 'afgerond')];
    const t = telMedewerkerStatussen(dubbel);
    expect(t.medewerkers).toBe(4);
    expect(t.telling.afgerond + t.telling.bezig + t.telling.niet_gestart).toBe(4);
  });

  it('cards on the generated data: unique employees, statuses add up to the headcount', async () => {
    const hr = parseHr(await leesWerkblad(leesFictiefHr(), HR_WERKBLAD, 'E-mail werk'));
    const pu = parsePowerUp(await leesWerkblad(leesFictiefPowerUp(), POWERUP_WERKBLAD, 'E-mail'));
    // The export contains a duplicate enrolment and addresses with capitals/spaces
    const { regels: rs } = koppel({ hr: hr.medewerkers, powerup: pu, programmaCursussen: [...DEMO_PROGRAMMA_CURSUSSEN] });
    const t = telMedewerkerStatussen(rs);
    expect(rs.length).toBe(833 * 3); // one row per employee × training
    expect(t.medewerkers).toBe(833); // but each employee counted once
    expect(t.telling.afgerond + t.telling.bezig + t.telling.niet_gestart).toBe(833);
    expect(t.verplichtAfgerond).toBeGreaterThanOrEqual(t.telling.afgerond);
  });

  it('labels programme trainings with their short name, keyed by the export name', () => {
    const lang = 'AI & data essentials (2.01_AI_Essentials)';
    const g = perTraining([regel('a@x.example', 'ijk', 'A', lang, 'afgerond')]);
    expect(g.map((x) => [x.sleutel, x.label])).toEqual([[lang, 'AI & data essentials']]);
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
    // Status filter selects EMPLOYEES on their overall status and keeps all their rows:
    // a is bezig overall (one completed, one busy), c completed everything
    expect(pasFiltersToe(regels, { statussen: ['bezig'] }).map((r) => [r.sleutel, r.training, r.status])).toEqual([
      ['a@x.example', 'T1', 'afgerond'],
      ['a@x.example', 'T2', 'bezig'],
    ]);
    expect(new Set(pasFiltersToe(regels, { statussen: ['afgerond', 'bezig'] }).map((r) => r.sleutel))).toEqual(new Set(['a@x.example', 'c@x.example']));
    // Within a training selection the overall status is about those trainings only
    expect(pasFiltersToe(regels, { trainingen: ['T1'], statussen: ['afgerond'] }).map((r) => r.sleutel).sort()).toEqual(['a@x.example', 'c@x.example']);
    expect(pasFiltersToe(regels, { trainingen: ['T1'], statussen: ['bezig'] })).toHaveLength(0);
    expect(pasSelectieToe(regels, { statussen: ['bezig'] })).toHaveLength(8); // selection ignores the status filter
    // Multiple values per filter are combined with OR within the filter, AND between filters
    expect(pasFiltersToe(regels, { bedrijven: ['ijk', 'reijn'] })).toHaveLength(8);
    expect(pasFiltersToe(regels, { afdelingen: ['IJK - A', 'Reijn - C'], trainingen: ['T1', 'T2'] })).toHaveLength(4);
    expect(new Set(pasFiltersToe(regels, { statussen: ['afgerond', 'niet_gestart'] }).map((r) => r.sleutel))).toEqual(
      new Set(['b@x.example', 'c@x.example', 'd@x.example']),
    );
    expect(pasFiltersToe(regels, { bedrijven: [] })).toHaveLength(8);
  });
});
