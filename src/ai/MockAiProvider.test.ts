import { describe, expect, it } from 'vitest';
import { buildAiContext } from '../core/aiContext';
import { afdeling } from '../core/testUtils';
import { MockAiProvider, mockTekst } from './MockAiProvider';

const regels = [
  ...afdeling('a', 'ijk', 'IJK - Projecten', 10, ['T1', 'T2'], 'afgerond'),
  ...afdeling('b', 'ijk', 'IJK - Uitvoering', 8, ['T1', 'T2'], 'niet_ingeschreven'),
];

describe('MockAiProvider', () => {
  it('is deterministic and based only on the context', async () => {
    const ctx = buildAiContext(regels);
    const a = await new MockAiProvider(0).samenvatting({ context: ctx, filters: {} });
    expect(a.bron).toBe('mock');
    expect(a.tekst).toBe(mockTekst(ctx));
    expect(a.tekst).toContain('## Voortgang');
    expect(a.tekst).toContain('IJK - Projecten');
    expect(a.tekst).not.toContain('@');
  });

  it('refuses a summary for a selection that is too small', () => {
    expect(mockTekst(buildAiContext(afdeling('x', 'ijk', 'IJK - Klein', 3, ['T1'])))).toMatch(/minder dan 5/);
  });
});
