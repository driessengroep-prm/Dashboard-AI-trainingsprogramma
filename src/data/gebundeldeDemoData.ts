import powerupUrl from '../../testdata/fictief/getresponsive_Report_Voortgangsrapport_report.xlsx?url';
import hrUrl from '../../testdata/fictief/Lijst_FvB_20260901.xlsx?url';

/**
 * Loads the bundled fictitious exports (static assets of the demo build).
 * Only imported in demo mode, so other builds never contain the demo data.
 */
export async function laadGebundeldeDemoData(): Promise<{ powerup: ArrayBuffer; hr: ArrayBuffer }> {
  const [powerup, hr] = await Promise.all([fetch(powerupUrl), fetch(hrUrl)].map(async (p) => (await p).arrayBuffer()));
  return { powerup, hr };
}
