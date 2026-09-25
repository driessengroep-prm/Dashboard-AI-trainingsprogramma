import { createContext, useContext } from 'react';
import type { AiProvider } from '../ai/types';
import type { Rol } from '../core/roles';
import type { DataSource } from '../data/types';

export interface AppState {
  ds: DataSource;
  ai: AiProvider;
  rollen: Rol[];
  setRollen: (r: Rol[]) => void;
  /** Incremented after uploads / programme changes so pages reload their data. */
  versie: number;
  verhoogVersie: () => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext ontbreekt');
  return ctx;
}
