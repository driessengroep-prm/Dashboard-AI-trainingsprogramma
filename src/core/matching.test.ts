import { describe, expect, it } from 'vitest';
import { koppel } from './matching';
import { hr, pu } from './testUtils';

const PROG = ['AI Basis', 'Data'];

describe('koppel', () => {
  const medewerkers = [hr('a@d.example', 'driessen', 'Driessen - HR', 'Anna'), hr('b@i.example', 'ijk', 'IJK - Projecten', 'Bob')];

  it('creates one row per employee × programme training and counts employees without enrolment as niet_gestart', () => {
    const res = koppel({ hr: medewerkers, powerup: [pu('a@d.example', 'AI Basis', 'Voltooid')], programmaCursussen: PROG });
    expect(res.regels).toHaveLength(4);
    const anna = res.regels.filter((r) => r.sleutel === 'a@d.example');
    expect(anna.map((r) => [r.training, r.status, r.geregistreerd])).toEqual([
      ['AI Basis', 'afgerond', true],
      ['Data', 'niet_gestart', false], // not in Power UP yet → counts as niet gestart
    ]);
    expect(anna[0].naam).toBe('Anna'); // display name comes from HR
    expect(res.samenvatting).toMatchObject({ hrMedewerkers: 2, gematcht: 1, nietGeregistreerd: 1, regelsNietGeregistreerd: 3 });
  });

  it('keeps bezig with percentage', () => {
    const res = koppel({ hr: medewerkers, powerup: [pu('b@i.example', 'Data', 0.35)], programmaCursussen: PROG });
    expect(res.regels.find((r) => r.sleutel === 'b@i.example' && r.training === 'Data')).toMatchObject({ status: 'bezig', voortgang: 35 });
  });

  it('puts Power UP rows without HR match on the exception list, not on the dashboard', () => {
    const res = koppel({ hr: medewerkers, powerup: [pu('x@extern.example', 'AI Basis', 'Voltooid')], programmaCursussen: PROG });
    expect(res.regels.some((r) => r.sleutel === 'x@extern.example')).toBe(false);
    expect(res.uitzonderingen).toMatchObject([{ type: 'geen_hr_match', email: 'x@extern.example' }]);
  });

  it('uses the most recent duplicate enrolment and reports it', () => {
    const res = koppel({
      hr: medewerkers,
      powerup: [pu('a@d.example', 'Data', 0.9, '2026-08-01'), pu('a@d.example', 'Data', 'Niet gestart', '2026-01-01')],
      programmaCursussen: PROG,
    });
    expect(res.regels.find((r) => r.sleutel === 'a@d.example' && r.training === 'Data')?.status).toBe('bezig');
    expect(res.uitzonderingen.filter((u) => u.type === 'dubbele_inschrijving')).toHaveLength(1);
  });

  it('reports unknown status values', () => {
    const res = koppel({ hr: medewerkers, powerup: [pu('a@d.example', 'Data', 'In afwachting')], programmaCursussen: PROG });
    expect(res.uitzonderingen).toMatchObject([{ type: 'onbekende_status', cursus: 'Data' }]);
    expect(res.regels.find((r) => r.sleutel === 'a@d.example' && r.training === 'Data')).toMatchObject({ status: 'niet_gestart', geregistreerd: false });
  });

  it('ignores non-programme courses on the dashboard and reports new course names', () => {
    const res = koppel({
      hr: medewerkers,
      powerup: [pu('a@d.example', 'BHV', 'Voltooid'), pu('z@extern.example', 'BHV', 'Voltooid'), pu('a@d.example', 'Nieuw', 0.1)],
      programmaCursussen: PROG,
      bekendeCursussen: ['BHV'],
    });
    expect(res.regels.every((r) => PROG.includes(r.training))).toBe(true);
    expect(res.uitzonderingen).toHaveLength(0); // no exceptions for courses outside the programme
    expect(res.cursussen).toEqual(['BHV', 'Nieuw']);
    expect(res.nieuweCursussen).toEqual(['Nieuw']);
  });
});
