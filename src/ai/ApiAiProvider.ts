import type { AiProvider, AiSamenvatting, AiVerzoek } from './types';

/**
 * Phase 2/3: calls POST /api/ai/samenvatting. Only the filter selection is sent; the
 * API rebuilds the AI context server-side from role-filtered data (same core function)
 * and calls the Foundry model. The frontend never talks to Azure OpenAI directly.
 */
export class ApiAiProvider implements AiProvider {
  constructor(private readonly url = '/api/ai/samenvatting', private readonly timeoutMs = 30_000) {}

  async samenvatting({ filters }: AiVerzoek): Promise<AiSamenvatting> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`AI-samenvatting niet beschikbaar (${res.status}).`);
      const data = (await res.json()) as { tekst: string; gegenereerdOp?: string };
      return { tekst: data.tekst, bron: 'api', gegenereerdOp: data.gegenereerdOp ? new Date(data.gegenereerdOp) : new Date() };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw new Error('De AI-samenvatting duurde te lang. Probeer het later opnieuw.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
