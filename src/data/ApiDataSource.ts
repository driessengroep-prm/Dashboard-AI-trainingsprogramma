import type { Rol } from '../core/roles';
import type { DashboardRegel } from '../core/types';
import { GeenToegangFout, UploadFout, type BeheerOverzicht, type DashboardData, type DataSource } from './types';

/**
 * Phase 2/3 data source. Roles come from the login (x-ms-client-principal) and are
 * enforced by the API, so the `rollen` argument is ignored here.
 *
 * Endpoints:
 *   GET  /api/dashboard            → DashboardData (role-filtered server-side)
 *   GET  /api/beheer               → BeheerOverzicht (beheerder)
 *   POST /api/beheer/upload        → multipart: powerup, hr (beheerder)
 *   PUT  /api/beheer/programma     → { cursussen: string[] } (beheerder)
 */
export class ApiDataSource implements DataSource {
  constructor(private readonly basis = '/api') {}

  private async vraag<T>(pad: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.basis}${pad}`, { credentials: 'same-origin', ...init });
    if (res.status === 401 || res.status === 403) throw new GeenToegangFout();
    if (!res.ok) {
      const tekst = await res.text().catch(() => '');
      throw new UploadFout(tekst || `Serverfout (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  async getDashboard(_rollen: readonly Rol[]): Promise<DashboardData> {
    const d = await this.vraag<DashboardData & { peildatum: string | null; regels: (DashboardRegel & { ingeschrevenOp: string | null })[] }>('/dashboard');
    return {
      ...d,
      peildatum: d.peildatum ? new Date(d.peildatum) : null,
      regels: d.regels.map((r) => ({ ...r, ingeschrevenOp: r.ingeschrevenOp ? new Date(r.ingeschrevenOp) : null })),
    };
  }

  private metDatum(b: BeheerOverzicht & { peildatum: string | Date | null }): BeheerOverzicht {
    return { ...b, peildatum: b.peildatum ? new Date(b.peildatum) : null };
  }

  async getBeheer(_rollen: readonly Rol[]): Promise<BeheerOverzicht | null> {
    const b = await this.vraag<(BeheerOverzicht & { peildatum: string | null }) | null>('/beheer');
    return b ? this.metDatum(b) : null;
  }

  async upload(_rollen: readonly Rol[], powerup: File, hr: File): Promise<BeheerOverzicht> {
    const form = new FormData();
    form.append('powerup', powerup);
    form.append('hr', hr);
    return this.metDatum(await this.vraag('/beheer/upload', { method: 'POST', body: form }));
  }

  async setProgrammaCursussen(_rollen: readonly Rol[], cursussen: string[]): Promise<BeheerOverzicht> {
    return this.metDatum(
      await this.vraag('/beheer/programma', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursussen }),
      }),
    );
  }
}
