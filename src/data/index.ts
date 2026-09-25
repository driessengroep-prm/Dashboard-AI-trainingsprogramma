import type { DataSource } from './types';

export const APP_MODE: 'demo' | 'api' = import.meta.env.VITE_APP_MODE === 'api' ? 'api' : 'demo';
export const IS_DEMO = APP_MODE === 'demo';

/** Chooses the implementation based on the build variable VITE_APP_MODE. */
export async function maakDataSource(): Promise<DataSource> {
  if (IS_DEMO) {
    const { DemoDataSource } = await import('./DemoDataSource');
    return new DemoDataSource();
  }
  const { ApiDataSource } = await import('./ApiDataSource');
  return new ApiDataSource();
}
