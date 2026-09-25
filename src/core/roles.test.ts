import { describe, expect, it } from 'vitest';
import { bedrijfToegang, filterOpRol, heeftToegang, magBeheren, parseRollen } from './roles';
import { regel } from './testUtils';

const regels = [
  regel('a@ijk.example', 'ijk', 'IJK - Projecten', 'T', 'afgerond'),
  regel('b@driessen.example', 'driessen', 'Driessen - HR', 'T', 'bezig'),
  regel('c@reijn.example', 'reijn', 'Reijn - Productie', 'T', 'niet_gestart'),
  { ...regel('d@onbekend.example', 'x', 'X', 'T', 'afgerond'), bedrijfCode: null },
];

describe('rolfilter', () => {
  it('bedrijf_ijk never receives data from other companies', () => {
    const zicht = filterOpRol(regels, ['bedrijf_ijk']);
    expect(zicht.length).toBe(1);
    expect(zicht.every((r) => r.bedrijfCode === 'ijk')).toBe(true);
    expect(JSON.stringify(zicht)).not.toMatch(/driessen|reijn|onbekend/);
  });

  it('supports multiple company roles at once', () => {
    expect(filterOpRol(regels, ['bedrijf_ijk', 'bedrijf_reijn']).map((r) => r.bedrijfCode).sort()).toEqual(['ijk', 'reijn']);
  });

  it('groepsdirectie and beheerder see everything, including unknown employers', () => {
    expect(filterOpRol(regels, ['groepsdirectie'])).toHaveLength(4);
    expect(filterOpRol(regels, ['beheerder'])).toHaveLength(4);
  });

  it('no role sees nothing', () => {
    expect(filterOpRol(regels, [])).toEqual([]);
    expect(heeftToegang([])).toBe(false);
  });

  it('only beheerder may manage', () => {
    expect(magBeheren(['beheerder'])).toBe(true);
    expect(magBeheren(['groepsdirectie', 'bedrijf_ijk'])).toBe(false);
  });

  it('parseRollen drops unknown roles', () => {
    expect(parseRollen(['Bedrijf_IJK', 'bedrijf_onbekend', 'admin', 'anonymous', 'authenticated'])).toEqual(['bedrijf_ijk']);
    const t = bedrijfToegang(parseRollen(['bedrijf_haert']));
    expect(t.alle).toBe(false);
  });
});
