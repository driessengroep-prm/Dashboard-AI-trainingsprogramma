import type { Status } from './types';

export interface StatusResultaat {
  status: Status;
  voortgang: number | null;
}

function alsGetal(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = v.trim().replace(',', '.');
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(s);
  if (pct) return Number(pct[1]) / 100;
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return null;
}

/**
 * Maps a Power UP "Status" value to a tool status.
 * - "Voltooid"/"Afgerond" → afgerond; "Niet gestart" → niet_gestart; "Bezig" → bezig
 * - number 1 → afgerond; number in [0, 1) → bezig with progress × 100 %
 * - anything else → null (goes to the exception list)
 */
export function mapStatus(ruw: string | number | null): StatusResultaat | null {
  if (ruw === null) return null;
  if (typeof ruw === 'string') {
    const s = ruw.trim().toLowerCase();
    if (s === 'voltooid' || s === 'afgerond') return { status: 'afgerond', voortgang: null };
    if (s === 'niet gestart') return { status: 'niet_gestart', voortgang: null };
    if (s === 'bezig') return { status: 'bezig', voortgang: null };
  }
  const n = alsGetal(ruw);
  if (n === null) return null;
  if (n === 1) return { status: 'afgerond', voortgang: null };
  if (n >= 0 && n < 1) return { status: 'bezig', voortgang: Math.round(n * 1000) / 10 };
  return null;
}

/** Parses "42d 3h 56m 54s" to whole minutes; "-" or empty → null. */
export function parseTijd(ruw: string | number | null): number | null {
  if (ruw === null) return null;
  const s = String(ruw).trim();
  if (s === '' || s === '-') return null;
  const m = /^(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(s);
  if (!m || m.slice(1).every((x) => x === undefined)) return null;
  const [d, h, min, sec] = m.slice(1).map((x) => Number(x ?? 0));
  return Math.round(d * 1440 + h * 60 + min + sec / 60);
}
