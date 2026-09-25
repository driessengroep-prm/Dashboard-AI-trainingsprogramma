import { describe, expect, it } from 'vitest';
import { buildAiContext, onderdrukKleineGroepen } from './aiContext';
import { groepeer } from './aggregate';
import { koppel } from './matching';
import { parseHr, HR_WERKBLAD } from './parsing/hr';
import { parsePowerUp, POWERUP_WERKBLAD } from './parsing/powerup';
import { leesWerkblad } from './parsing/xlsx';
import { filterOpRol } from './roles';
import { afdeling, leesFictiefHr, leesFictiefPowerUp } from './testUtils';
import { DEMO_PROGRAMMA_CURSUSSEN } from '../data/demoConfig';

const T = ['T1', 'T2'];

describe('buildAiContext', () => {
  const regels = [
    ...afdeling('a', 'ijk', 'IJK - Projecten', 10, T, 'afgerond'),
    ...afdeling('b', 'ijk', 'IJK - Uitvoering', 8, T, 'niet_gestart'),
    ...afdeling('c', 'ijk', 'IJK - Klein', 2, T, 'bezig'),
    ...afdeling('d', 'reijn', 'Reijn - Productie', 12, T, 'niet_ingeschreven'),
    ...afdeling('e', 'haert', 'Haert - Mini', 3, T, 'afgerond'),
  ];
  const ctx = buildAiContext(regels, { trainingen: [] });
  const json = JSON.stringify(ctx);

  it('contains no names or e-mail addresses', () => {
    expect(json).not.toContain('@');
    expect(json).not.toMatch(/Persoon/);
    for (const r of regels) {
      expect(json).not.toContain(r.naam);
      expect(json).not.toContain(r.sleutel);
    }
  });

  it('contains aggregate totals', () => {
    expect(ctx.voldoendeData).toBe(true);
    expect(ctx.totaal?.medewerkers).toBe(35);
    expect(ctx.totaal?.perStatus.afgerond).toEqual({ aantal: 26, pct: 37.1 });
    expect(ctx.perTraining.map((t) => t.naam)).toEqual(T);
  });

  it('suppresses groups smaller than the threshold', () => {
    const alleGroepen = [...ctx.perBedrijf, ...ctx.perAfdeling];
    expect(alleGroepen.every((g) => g.medewerkers >= 5)).toBe(true);
    expect(ctx.perAfdeling.map((a) => a.naam)).not.toContain('IJK - Klein');
    expect(ctx.perBedrijf.map((b) => b.naam)).not.toContain('haert B.V.');
    expect(json).not.toContain('Haert - Mini');
  });

  it('departments of a company add up to the company total (no derivation by subtraction)', () => {
    for (const b of ctx.perBedrijf) {
      const afd = ctx.perAfdeling.filter((a) => a.bedrijf === b.naam);
      if (afd.length) expect(afd.reduce((n, a) => n + a.medewerkers, 0)).toBe(b.medewerkers);
    }
    // IJK - Klein (2) is merged with the smallest regular department of IJK
    const overig = ctx.perAfdeling.find((a) => a.naam.startsWith('ijk B.V. — overige'));
    expect(overig?.medewerkers).toBe(10);
  });

  it('respects a configurable threshold', () => {
    const c = buildAiContext(regels, {}, { minGroep: 1 });
    expect(c.perAfdeling.map((a) => a.naam)).toContain('IJK - Klein');
    expect(c.perBedrijf).toHaveLength(3);
  });

  it('returns no figures when the whole selection is below the threshold', () => {
    const c = buildAiContext(afdeling('x', 'ijk', 'IJK - Klein', 4, T));
    expect(c.voldoendeData).toBe(false);
    expect(c.totaal).toBeNull();
    expect(c.perAfdeling).toEqual([]);
  });

  it('only contains companies the role may see', () => {
    const c = buildAiContext(filterOpRol(regels, ['bedrijf_ijk']));
    expect(c.perBedrijf.map((b) => b.naam)).toEqual(['ijk B.V.']);
    expect(JSON.stringify(c)).not.toMatch(/reijn|haert/i);
  });
});

describe('onderdrukKleineGroepen', () => {
  it('merges the smallest regular group when "overig" is still too small', () => {
    const groepen = groepeer(
      [...afdeling('a', 'x', 'A', 3, ['T']), ...afdeling('b', 'x', 'B', 6, ['T']), ...afdeling('c', 'x', 'C', 9, ['T'])],
      (r) => r.afdeling,
    );
    const res = onderdrukKleineGroepen(groepen, 5, 'overig');
    expect(res.zichtbaar.map((g) => [g.naam, g.medewerkers])).toEqual([
      ['C', 9],
      ['overig', 9],
    ]);
  });

  it('drops everything when all groups together are too small', () => {
    const groepen = groepeer(afdeling('a', 'x', 'A', 2, ['T']), (r) => r.afdeling);
    expect(onderdrukKleineGroepen(groepen, 5, 'overig')).toEqual({ zichtbaar: [], samengevoegd: 0, weggelaten: 1 });
  });
});

describe('AI context on the generated fictitious data', () => {
  it('contains no personal data and no small groups', async () => {
    const hr = parseHr(await leesWerkblad(leesFictiefHr(), HR_WERKBLAD, 'E-mail werk'));
    const pu = parsePowerUp(await leesWerkblad(leesFictiefPowerUp(), POWERUP_WERKBLAD, 'E-mail'));
    const { regels } = koppel({ hr: hr.medewerkers, powerup: pu, programmaCursussen: [...DEMO_PROGRAMMA_CURSUSSEN] });
    const ctx = buildAiContext(regels);
    const json = JSON.stringify(ctx);
    expect(json).not.toContain('@');
    for (const m of hr.medewerkers) expect(json).not.toContain(m.naam);
    expect([...ctx.perBedrijf, ...ctx.perAfdeling].every((g) => g.medewerkers >= 5)).toBe(true);
    expect(ctx.onderdrukking.afdelingenSamengevoegd).toBeGreaterThan(0);
  });
});
