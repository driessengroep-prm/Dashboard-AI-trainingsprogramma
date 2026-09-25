import type { Rol } from '../../core/roles';
import { useApp } from '../AppContext';

const OPTIES: { label: string; rollen: Rol[] }[] = [
  { label: 'beheerder', rollen: ['beheerder'] },
  { label: 'groepsdirectie', rollen: ['groepsdirectie'] },
  { label: 'bedrijf_ijk', rollen: ['bedrijf_ijk'] },
  { label: 'bedrijf_driessen', rollen: ['bedrijf_driessen'] },
  { label: 'bedrijf_jeij', rollen: ['bedrijf_jeij'] },
  { label: 'bedrijf_reijn', rollen: ['bedrijf_reijn'] },
  { label: 'bedrijf_haert', rollen: ['bedrijf_haert'] },
  { label: 'bedrijf_ijk + bedrijf_jeij', rollen: ['bedrijf_ijk', 'bedrijf_jeij'] },
  { label: 'geen rol', rollen: [] },
];

export const STANDAARD_DEMO_ROLLEN: Rol[] = ['groepsdirectie'];

/** Demo-only role simulation. In phase 2/3 roles come from the Entra ID login. */
export function RolKiezer() {
  const { rollen, setRollen } = useApp();
  const huidig = OPTIES.findIndex((o) => o.rollen.join('|') === rollen.join('|'));
  return (
    <label className="rolkiezer">
      <span className="demo-label">DEMO</span>
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
