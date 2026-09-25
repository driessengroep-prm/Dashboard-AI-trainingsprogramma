import { describe, expect, it } from 'vitest';
import { telNietToegestaneEmails } from './demoGuard';
import { leesAlleTabellen } from './parsing/xlsx';
import { leesFictiefHr, leesFictiefPowerUp } from './testUtils';

describe('demo upload guard', () => {
  it('accepts only .example addresses', () => {
    expect(telNietToegestaneEmails([[['a@ijk.example', ' B@Driessen.EXAMPLE ', 'geen mail', 3]]])).toBe(0);
  });

  it('counts any address that does not end in .example, in any cell', () => {
    expect(telNietToegestaneEmails([[['a@ijk.example'], [null, 'echt@bedrijf.nl']], [['x', 'Contact: jan@voorbeeld.com; b@c.example']]])).toBe(2);
    expect(telNietToegestaneEmails([[['iemand@example.com']]])).toBe(1);
  });

  it('the generated fictitious exports pass the guard', async () => {
    for (const bestand of [leesFictiefPowerUp(), leesFictiefHr()]) {
      expect(telNietToegestaneEmails(await leesAlleTabellen(bestand))).toBe(0);
    }
  });
});
