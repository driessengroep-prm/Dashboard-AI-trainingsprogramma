import type { DataSource } from './types';

/**
 * Build mode (VITE_APP_MODE):
 * - demo:   public GitHub Pages demo, bundled fictitious data, only `.example` addresses accepted
 * - lokaal: single offline HTML file for local testing with real exports; no bundled data,
 *           no network access (enforced by CSP), nothing stored
 * - api:    phase 2/3, data and roles come from the API
 */
const MODUS = import.meta.env.VITE_APP_MODE;
export const APP_MODE: 'demo' | 'lokaal' | 'api' = MODUS === 'api' ? 'api' : MODUS === 'lokaal' ? 'lokaal' : 'demo';
export const IS_DEMO = APP_MODE === 'demo';
export const IS_LOKAAL = APP_MODE === 'lokaal';
/** Data processed in the browser with a simulated role (demo and local build). */
export const IN_BROWSER = IS_DEMO || IS_LOKAAL;

/** Chooses the implementation based on the build variable VITE_APP_MODE. */
export async function maakDataSource(): Promise<DataSource> {
  if (IS_DEMO) {
    const [{ DemoDataSource }, { laadGebundeldeDemoData }] = await Promise.all([import('./DemoDataSource'), import('./gebundeldeDemoData')]);
    return new DemoDataSource({ gebundeld: laadGebundeldeDemoData, alleenFictief: true });
  }
  if (IS_LOKAAL) {
    const { DemoDataSource } = await import('./DemoDataSource');
    return new DemoDataSource({ alleenFictief: false });
  }
  const { ApiDataSource } = await import('./ApiDataSource');
  return new ApiDataSource();
}
