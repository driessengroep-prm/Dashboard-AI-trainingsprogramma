import type { AiContext, AiGroep } from '../core/aiContext';
import type { AiProvider, AiSamenvatting, AiVerzoek } from './types';

const fmt = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

function rangschik(groepen: AiGroep[]) {
  return [...groepen]
    .filter((g) => !g.samengevoegdeGroepen)
    .sort((a, b) => b.perStatus.afgerond.pct - a.perStatus.afgerond.pct || a.naam.localeCompare(b.naam, 'nl'));
}

/** Deterministic example text built from the same AI context the real model will receive. */
export function mockTekst(ctx: AiContext): string {
  if (!ctx.voldoendeData || !ctx.totaal) {
    return `De huidige selectie bevat minder dan ${ctx.drempelKleineGroep} medewerkers. Om herleidbaarheid te voorkomen wordt hiervoor geen samenvatting gemaakt. Verbreed de filters.`;
  }
  const t = ctx.totaal;
  const regels: string[] = [];
  regels.push('## Voortgang');
  const deelname = t.medewerkers ? (t.deelnemers / t.medewerkers) * 100 : 0;
  regels.push(
    `Van de ${t.medewerkers} medewerkers in deze selectie zijn er ${t.deelnemers} (${fmt(deelname)}%) actief in Power UP. ` +
      `Over ${ctx.perTraining.length} trainingen is ${fmt(t.perStatus.afgerond.pct)}% afgerond en ${fmt(t.perStatus.bezig.pct)}% in uitvoering` +
      (t.gemiddeldeVoortgangBezig !== null ? ` (gemiddeld ${fmt(t.gemiddeldeVoortgangBezig)}% voortgang)` : '') +
      `; ${fmt(t.perStatus.niet_gestart.pct)}% is nog niet gestart.`,
  );

  const groepen = ctx.perAfdeling.length > 1 ? ctx.perAfdeling : ctx.perBedrijf;
  const soort = ctx.perAfdeling.length > 1 ? 'afdelingen/teams' : 'bedrijven';
  const gerangschikt = rangschik(groepen);
  if (gerangschikt.length >= 2) {
    const top = gerangschikt.slice(0, 2);
    const achter = gerangschikt.slice(-2).reverse();
    regels.push('## Koplopers en achterblijvers');
    regels.push(`- Voorop (${soort}): ${top.map((g) => `${g.naam} (${fmt(g.perStatus.afgerond.pct)}% afgerond)`).join(', ')}.`);
    regels.push(`- Achter: ${achter.map((g) => `${g.naam} (${fmt(g.perStatus.afgerond.pct)}% afgerond, ${fmt(g.perStatus.niet_gestart.pct)}% niet gestart)`).join(', ')}.`);
  }

  regels.push('## Opvallend');
  const trainingen = [...ctx.perTraining].sort((a, b) => a.perStatus.afgerond.pct - b.perStatus.afgerond.pct);
  if (trainingen.length > 1) {
    const laag = trainingen[0];
    const hoog = trainingen[trainingen.length - 1];
    regels.push(`- "${laag.naam}" blijft achter met ${fmt(laag.perStatus.afgerond.pct)}% afgerond; "${hoog.naam}" loopt het best (${fmt(hoog.perStatus.afgerond.pct)}%).`);
  }
  const verplichtNietGestart = ctx.perTraining.filter((tr) => tr.verplicht).sort((a, b) => b.perStatus.niet_gestart.pct - a.perStatus.niet_gestart.pct)[0];
  if (verplichtNietGestart && verplichtNietGestart.perStatus.niet_gestart.pct > 0) {
    regels.push(`- Bij de verplichte training "${verplichtNietGestart.naam}" is ${fmt(verplichtNietGestart.perStatus.niet_gestart.pct)}% nog niet gestart.`);
  }
  const o = ctx.onderdrukking;
  if (o.afdelingenSamengevoegd || o.bedrijvenSamengevoegd || o.afdelingenWeggelaten) {
    regels.push(`- Kleine groepen (< ${ctx.drempelKleineGroep} medewerkers) zijn samengevoegd of weggelaten en worden niet afzonderlijk beoordeeld.`);
  }

  regels.push('## Suggesties');
  if (deelname < 85) {
    regels.push('- Vraag medewerkers die nog niet zijn ingelogd in Power UP om dat te doen, bijvoorbeeld via hun leidinggevende, met een concrete deadline voor de verplichte trainingen.');
  }
  if (t.perStatus.niet_gestart.pct >= 10) {
    regels.push('- Plan een gezamenlijk startmoment (bijv. een lunchsessie) om de verplichte trainingen samen op te starten.');
  }
  if (gerangschikt.length >= 2) {
    regels.push(`- Laat ${gerangschikt[0].naam} ervaringen delen met de achterblijvende teams.`);
  }
  if (regels[regels.length - 1] === '## Suggesties') {
    regels.push('- Houd het huidige tempo vast en evalueer de trainingen met de deelnemers.');
  }
  return regels.join('\n');
}

export class MockAiProvider implements AiProvider {
  constructor(private readonly vertragingMs = 600) {}

  async samenvatting({ context }: AiVerzoek): Promise<AiSamenvatting> {
    await new Promise((r) => setTimeout(r, this.vertragingMs));
    return { tekst: mockTekst(context), bron: 'mock', gegenereerdOp: new Date() };
  }
}
