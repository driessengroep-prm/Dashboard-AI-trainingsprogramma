import { describe, expect, it } from 'vitest';
import { mapStatus, parseTijd } from './status';

describe('mapStatus', () => {
  it('maps the text values', () => {
    expect(mapStatus('Voltooid')).toEqual({ status: 'afgerond', voortgang: null });
    expect(mapStatus(' voltooid ')).toEqual({ status: 'afgerond', voortgang: null });
    expect(mapStatus('Niet gestart')).toEqual({ status: 'niet_gestart', voortgang: null });
  });

  it('maps numbers between 0 and 1 to bezig with a percentage', () => {
    expect(mapStatus(0.4)).toEqual({ status: 'bezig', voortgang: 40 });
    expect(mapStatus(0.125)).toEqual({ status: 'bezig', voortgang: 12.5 });
    expect(mapStatus(0)).toEqual({ status: 'bezig', voortgang: 0 });
    expect(mapStatus('0,75')).toEqual({ status: 'bezig', voortgang: 75 });
    expect(mapStatus('60%')).toEqual({ status: 'bezig', voortgang: 60 });
  });

  it('maps exactly 1 to afgerond', () => {
    expect(mapStatus(1)).toEqual({ status: 'afgerond', voortgang: null });
    expect(mapStatus('100%')).toEqual({ status: 'afgerond', voortgang: null });
  });

  it('returns null for anything else', () => {
    expect(mapStatus('In afwachting')).toBeNull();
    expect(mapStatus(1.5)).toBeNull();
    expect(mapStatus(-0.2)).toBeNull();
    expect(mapStatus('')).toBeNull();
    expect(mapStatus(null)).toBeNull();
  });
});

describe('parseTijd', () => {
  it('converts the Power UP time format to minutes', () => {
    expect(parseTijd('42d 3h 56m 54s')).toBe(42 * 1440 + 3 * 60 + 57);
    expect(parseTijd('0d 0h 5m 0s')).toBe(5);
    expect(parseTijd('2h 30m')).toBe(150);
  });

  it('returns null for "-" and garbage', () => {
    expect(parseTijd('-')).toBeNull();
    expect(parseTijd('')).toBeNull();
    expect(parseTijd(null)).toBeNull();
    expect(parseTijd('onbekend')).toBeNull();
  });
});
