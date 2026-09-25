/**
 * Rules for the automated privacy check (see scripts/privacy-check.ts).
 * Kept separate so they can be unit-tested.
 */

export const TOEGESTANE_DATA_MAP = 'testdata/fictief/';
const DATA_EXTENSIES = /\.(xlsx|xls|csv)$/i;

/** Data files (.xlsx/.xls/.csv) are only allowed inside testdata/fictief/. */
export function verbodenDatabestanden(paden: readonly string[]): string[] {
  return paden.filter((p) => DATA_EXTENSIES.test(p) && !p.replace(/\\/g, '/').startsWith(TOEGESTANE_DATA_MAP));
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/**
 * Addresses that are part of third-party library code in the bundle, not personal data
 * from any export. Every entry must be justified here.
 */
export const TOEGESTANE_BIBLIOTHEEK_EMAILS: ReadonlySet<string> = new Set([
  'git@github.com', // git SSH URL inside a dependency
  'fedor@indutny.com', // author notice of bn.js/elliptic (bundled by exceljs)
]);

/** E-mail addresses that do not end in `.example` and are not an allowed library string. */
export function nietToegestaneEmails(tekst: string): string[] {
  const res: string[] = [];
  for (const m of tekst.matchAll(EMAIL)) {
    const e = m[0].toLowerCase().replace(/\.+$/, '');
    if (!e.endsWith('.example') && !TOEGESTANE_BIBLIOTHEEK_EMAILS.has(e)) res.push(e);
  }
  return res;
}

/**
 * Patterns that look like secrets or Azure OpenAI endpoints. Written so that this
 * source file does not match itself (escaped dots / character classes).
 */
export const GEHEIM_PATRONEN: readonly { naam: string; patroon: RegExp }[] = [
  { naam: 'Azure OpenAI-endpoint', patroon: /[a-z0-9-]+\.openai\.azure\.com/i },
  { naam: 'Azure AI Services/Foundry-endpoint', patroon: /[a-z0-9-]+\.(?:cognitiveservices|services\.ai)\.azure\.com/i },
  { naam: 'Azure Storage connection string', patroon: /Account[K]ey=[A-Za-z0-9+/=]{20,}/ },
  { naam: 'Connection string', patroon: /DefaultEndpoints[P]rotocol=/ },
  { naam: 'API-key toewijzing', patroon: /\b(?:api[-_]?key|apikey|subscription[-_]?key|client[-_]?secret)\b\s*["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=]{16,}["']/i },
  { naam: 'Ocp-Apim/api-key header met waarde', patroon: /["'](?:api-key|Ocp-Apim-Subscription-Key)["']\s*:\s*["'][A-Za-z0-9]{16,}["']/i },
  { naam: 'OpenAI-sleutel', patroon: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { naam: 'Private key', patroon: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE [K]EY-----/ },
  { naam: 'GitHub-token', patroon: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
];

export function gevondenGeheimen(tekst: string): string[] {
  return GEHEIM_PATRONEN.filter((g) => g.patroon.test(tekst)).map((g) => g.naam);
}
