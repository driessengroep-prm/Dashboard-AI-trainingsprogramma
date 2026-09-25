// Test-only helpers (never imported by application code).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_HR_BESTAND, DEMO_POWERUP_BESTAND } from '../data/demoConfig';
import type { DashboardRegel, HrMedewerker, PowerUpRij, Status } from './types';

const FICTIEF = join(__dirname, '..', '..', 'testdata', 'fictief');
export const leesFictiefPowerUp = () => new Uint8Array(readFileSync(join(FICTIEF, DEMO_POWERUP_BESTAND)));
export const leesFictiefHr = () => new Uint8Array(readFileSync(join(FICTIEF, DEMO_HR_BESTAND)));

export const hr = (email: string, bedrijfCode: string | null, afdeling = 'Afd', naam = `Naam ${email}`): HrMedewerker => ({
  sleutel: email,
  naam,
  werkgevernaam: bedrijfCode ? `${bedrijfCode.toUpperCase()} B.V.` : 'Onbekend B.V.',
  bedrijfCode,
  afdeling,
});

let rijnr = 1;
export const pu = (email: string, cursus: string, statusRuw: string | number | null, datum?: string): PowerUpRij => ({
  rijnummer: ++rijnr,
  sleutel: email,
  cursus,
  ingeschrevenOp: datum ? new Date(datum) : null,
  statusRuw,
  tijdMinuten: null,
});

export function regel(
  sleutel: string,
  bedrijfCode: string,
  afdeling: string,
  training: string,
  status: Status,
  voortgang: number | null = null,
  geregistreerd = true,
): DashboardRegel {
  return {
    geregistreerd,
    sleutel,
    naam: `Persoon ${sleutel}`,
    bedrijfCode,
    werkgevernaam: `${bedrijfCode} B.V.`,
    afdeling,
    training,
    status,
    voortgang,
    ingeschrevenOp: null,
    tijdMinuten: null,
  };
}

/** Creates `n` employees in one department, each with one row per training. */
export function afdeling(
  prefix: string,
  bedrijfCode: string,
  afd: string,
  n: number,
  trainingen: string[],
  status: Status = 'afgerond',
  geregistreerd = true,
): DashboardRegel[] {
  const out: DashboardRegel[] = [];
  for (let i = 0; i < n; i++) {
    for (const t of trainingen) out.push(regel(`${prefix}${i}@${bedrijfCode}.example`, bedrijfCode, afd, t, status, null, geregistreerd));
  }
  return out;
}
