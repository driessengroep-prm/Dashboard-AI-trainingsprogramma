import { DEMO_TOEGESTAAN_EMAIL_SUFFIX } from './config/instellingen';
import type { Tabel } from './types';

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/**
 * Counts e-mail addresses anywhere in the given tables that do NOT end in the
 * allowed demo suffix. Returns only a count so no address ends up in a message or log.
 */
export function telNietToegestaneEmails(tabellen: readonly Tabel[], suffix = DEMO_TOEGESTAAN_EMAIL_SUFFIX): number {
  let n = 0;
  for (const t of tabellen) {
    for (const rij of t) {
      for (const c of rij ?? []) {
        if (typeof c !== 'string' || !c.includes('@')) continue;
        for (const m of c.matchAll(EMAIL)) {
          if (!m[0].toLowerCase().endsWith(suffix)) n++;
        }
      }
    }
  }
  return n;
}
