import type { AiContext } from '../core/aiContext';
import type { DashboardFilters } from '../core/filters';

export interface AiVerzoek {
  /** Context built client-side; only used by the mock (and shown in the demo for transparency). */
  context: AiContext;
  /** Current filter selection. The API rebuilds the context server-side from these. */
  filters: DashboardFilters;
}

export interface AiSamenvatting {
  /** Plain text with simple markup: lines starting with "## " are headings, "- " are bullets. */
  tekst: string;
  bron: 'mock' | 'api';
  gegenereerdOp: Date;
}

export interface AiProvider {
  samenvatting(verzoek: AiVerzoek): Promise<AiSamenvatting>;
}
