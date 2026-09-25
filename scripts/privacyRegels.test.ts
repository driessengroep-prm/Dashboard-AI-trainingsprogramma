import { describe, expect, it } from 'vitest';
import { gevondenGeheimen, nietToegestaneEmails, verbodenDatabestanden } from './privacyRegels';

describe('privacy rules', () => {
  it('allows data files only in testdata/fictief/', () => {
    expect(
      verbodenDatabestanden(['testdata/fictief/a.xlsx', 'data/echt.xlsx', 'export.CSV', 'oud.xls', 'src/app.ts', 'testdata/fictief/sub/b.csv']),
    ).toEqual(['data/echt.xlsx', 'export.CSV', 'oud.xls']);
  });

  it('flags e-mail addresses that do not end in .example', () => {
    expect(nietToegestaneEmails('a@ijk.example, B@Driessen.EXAMPLE.')).toEqual([]);
    expect(nietToegestaneEmails('x "jan@bedrijf.nl" y@z.example iemand@example.com')).toEqual(['jan@bedrijf.nl', 'iemand@example.com']);
    expect(nietToegestaneEmails('git@github.com')).toEqual([]);
  });

  it('detects secrets and Azure OpenAI endpoints', () => {
    const endpoint = ['https://mijn-resource', 'openai', 'azure', 'com/'].join('.');
    expect(gevondenGeheimen(endpoint)).toContain('Azure OpenAI-endpoint');
    expect(gevondenGeheimen(`const apiKey = "${'a1'.repeat(16)}"`)).toContain('API-key toewijzing');
    expect(gevondenGeheimen(`${'Account'}Key=${'x'.repeat(40)}`)).toContain('Azure Storage connection string');
    expect(gevondenGeheimen(`sk-${'A'.repeat(30)}`)).toContain('OpenAI-sleutel');
  });

  it('does not flag variable names or placeholders', () => {
    expect(gevondenGeheimen('AZURE_OPENAI_ENDPOINT=\nAZURE_OPENAI_API_VERSION=')).toEqual([]);
    expect(gevondenGeheimen('https://<resource>.openai.azure.com')).toEqual([]);
    expect(gevondenGeheimen('process.env.AZURE_OPENAI_ENDPOINT')).toEqual([]);
  });
});
