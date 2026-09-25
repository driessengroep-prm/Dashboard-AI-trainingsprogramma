import { BEDRIJVEN } from '../../core/config/bedrijven';
import type { Rol } from '../../core/roles';
import { IS_DEMO } from '../../data';
import { useApp } from '../AppContext';

const OPTIES: { label: string; rollen: Rol[] }[] = [
  { label: 'beheerder', rollen: ['beheerder'] },
  { label: 'groepsdirectie', rollen: ['groepsdirectie'] },
  ...BEDRIJVEN.map((b) => ({ label: `bedrijf_${b.code} (${b.werkgevernaam})`, rollen: [`bedrijf_${b.code}` as Rol] })),
  { label: 'bedrijf_ijk + bedrijf_ijkservices', rollen: ['bedrijf_ijk', 'bedrijf_ijkservices'] },
  { label: 'geen rol', rollen: [] },
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
