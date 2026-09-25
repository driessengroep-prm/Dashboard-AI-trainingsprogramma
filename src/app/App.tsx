import { useEffect, useMemo, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { maakAiProvider } from '../ai';
import { magBeheren, type Rol } from '../core/roles';
import { IS_DEMO, maakDataSource } from '../data';
import type { DataSource } from '../data/types';
import { AppContext, type AppState } from './AppContext';
import { DemoBanner } from './components/DemoBanner';
import { RolKiezer, STANDAARD_DEMO_ROLLEN } from './components/RolKiezer';
import { Beheer } from './pages/Beheer';
import { Dashboard } from './pages/Dashboard';
import logo from './assets/logo-driessengroep-200x200.png';

export function App() {
  const [ds, setDs] = useState<DataSource | null>(null);
  // Demo: role comes from the role picker. Phase 2/3: roles come from the login and the API filters.
  const [rollen, setRollen] = useState<Rol[]>(IS_DEMO ? STANDAARD_DEMO_ROLLEN : []);
  const [versie, setVersie] = useState(0);
  const ai = useMemo(() => maakAiProvider(), []);

  useEffect(() => {
    maakDataSource().then(setDs);
  }, []);

  if (!ds) return <div className="laden">Laden…</div>;

  const state: AppState = { ds, ai, rollen, setRollen, versie, verhoogVersie: () => setVersie((v) => v + 1) };

  return (
    <AppContext.Provider value={state}>
      <HashRouter>
        {IS_DEMO && <DemoBanner />}
        <header className="kop">
          <div className="kop-inner">
            <div className="kop-titel">
              {/* The PNG has transparent padding; the wrapper crops it to the logo itself */}
              <span className="kop-logo">
                <img src={logo} alt="Driessen Groep" width={200} height={200} />
              </span>
              <span className="kop-naam">AI &amp; data trainingsprogramma</span>
            </div>
            <nav className="kop-nav" aria-label="Hoofdmenu">
              <NavLink to="/" end>
                Dashboard
              </NavLink>
              {/* Demo: always visible so the access rule can be tried out with the role picker */}
              {(IS_DEMO || magBeheren(rollen)) && <NavLink to="/beheer">Beheer</NavLink>}
            </nav>
            {IS_DEMO && <RolKiezer />}
          </div>
        </header>
        <main className="inhoud">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/beheer" element={<Beheer />} />
            <Route path="*" element={<p>Pagina niet gevonden.</p>} />
          </Routes>
        </main>
        <footer className="voet">
          Interne tool Driessen Groep{IS_DEMO ? ' · demo-omgeving met uitsluitend fictieve gegevens' : ''}
        </footer>
      </HashRouter>
    </AppContext.Provider>
  );
}
