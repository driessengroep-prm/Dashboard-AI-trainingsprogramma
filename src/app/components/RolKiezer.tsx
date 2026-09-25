import type { Rol } from '../../core/roles';
import { IS_DEMO } from '../../data';
import { useApp } from '../AppContext';

// "Gebruiker" sees the dashboard for all companies without the admin page (role groepsdirectie).
// Company-specific roles (bedrijf_<code>) remain supported by the core for production.
const OPTIES: { label: string; rollen: Rol[] }[] = [
  { label: 'Beheerder', rollen: ['beheerder'] },
  { label: 'Gebruiker', rollen: ['groepsdirectie'] },
];

export const STANDAARD_DEMO_ROLLEN: Rol[] = ['groepsdirectie'];

/** Demo-only role simulation. In phase 2/3 roles come from the Entra ID login. */
export function RolKiezer() {
  const { rollen, setRollen } = useApp();
  const huidig = OPTIES.findIndex((o) => o.rollen.join('|') === rollen.join('|'));
  return (
    <label className="rolkiezer">
      <span className="demo-label">{IS_DEMO ? 'DEMO' : 'TEST'}</span>
      <span>Gesimuleerde rol</span>
      <select value={huidig} onChange={(e) => setRollen(OPTIES[Number(e.target.value)].rollen)}>
        {OPTIES.map((o, i) => (
          <option key={o.label} value={i}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
