import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { UitzonderingType } from '../../core/types';
import { isVerplicht } from '../../core/config/programma';
import { magBeheren } from '../../core/roles';
import { IS_DEMO } from '../../data';
import { GeenToegangFout, type BeheerOverzicht } from '../../data/types';
import { useApp } from '../AppContext';
import { GeenToegang } from '../components/GeenToegang';

const TYPE_LABELS: Record<UitzonderingType, string> = {
  geen_hr_match: 'Niet in HR-lijst',
  onbekende_status: 'Onbekende status',
  dubbele_inschrijving: 'Dubbele inschrijving',
  hr_zonder_email: 'HR zonder e-mail',
  hr_dubbel: 'Dubbel in HR-lijst',
  onbekend_bedrijf: 'Onbekend bedrijf',
};

export function Beheer() {
  const { ds, rollen, versie, verhoogVersie } = useApp();
  const [overzicht, setOverzicht] = useState<BeheerOverzicht | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!magBeheren(rollen)) return;
    let actueel = true;
    ds.getBeheer(rollen)
      .then((o) => actueel && setOverzicht(o))
      .catch((e) => actueel && setFout(e instanceof GeenToegangFout ? 'geen-toegang' : e instanceof Error ? e.message : 'Onbekende fout'));
    return () => {
      actueel = false;
    };
  }, [ds, rollen, versie]);

  if (!magBeheren(rollen) || fout === 'geen-toegang') {
    return (
      <GeenToegang
        melding={
          IS_DEMO
            ? 'Alleen de beheerder heeft toegang tot het beheerdersportaal. Kies in deze demo rechtsboven de gesimuleerde rol "beheerder".'
            : 'Alleen de beheerder heeft toegang tot het beheerdersportaal.'
        }
      />
    );
  }
  if (fout) return <p className="fout">{fout}</p>;
  if (!overzicht) return <div className="laden">Laden…</div>;

  const bijgewerkt = (o: BeheerOverzicht) => {
    setOverzicht(o);
    verhoogVersie();
  };

  return (
    <div className="beheer">
      <div className="pagina-kop">
        <h1>Beheer</h1>
        <p className="subtiel">
          Huidige dataset: {overzicht.bron === 'gebundeld' ? 'gebundelde fictieve demodata' : 'geüploade bestanden'} ({overzicht.bestanden.powerup},{' '}
          {overzicht.bestanden.hr})
          {overzicht.peildatum
            ? overzicht.bron === 'gebundeld'
              ? ` · peildatum ${overzicht.peildatum.toLocaleDateString('nl-NL')}`
              : ` · verwerkt op ${overzicht.peildatum.toLocaleString('nl-NL')}`
            : ''}
        </p>
      </div>

      <Upload onKlaar={bijgewerkt} />

      <section className="tegels" aria-label="Samenvatting koppeling">
        <Tegel label="HR-medewerkers" waarde={overzicht.samenvatting.hrMedewerkers} />
        <Tegel label="Deelnemers (gematcht)" waarde={overzicht.samenvatting.gematcht} toelichting="met minstens één inschrijving in Power UP" />
        <Tegel label="Nog niet in Power UP" waarde={overzicht.samenvatting.nietGeregistreerd} toelichting="tellen in het dashboard als niet gestart" />
        <Tegel label="Uitzonderingen" waarde={overzicht.samenvatting.uitzonderingen} />
        <Tegel label="Nieuwe cursusnamen" waarde={overzicht.samenvatting.nieuweCursussen} />
      </section>

      <Cursussen overzicht={overzicht} onKlaar={bijgewerkt} />
      <Uitzonderingen overzicht={overzicht} />
    </div>
  );
}

function Tegel({ label, waarde, toelichting }: { label: string; waarde: number; toelichting?: string }) {
  return (
    <div className="tegel">
      <div className="tegel-label">{label}</div>
      <div className="tegel-waarde">{waarde}</div>
      {toelichting && <div className="tegel-toelichting">{toelichting}</div>}
    </div>
  );
}

function Upload({ onKlaar }: { onKlaar: (o: BeheerOverzicht) => void }) {
  const { ds, rollen } = useApp();
  const [powerup, setPowerup] = useState<File | null>(null);
  const [hr, setHr] = useState<File | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    if (!powerup || !hr) return;
    setBezig(true);
    setMelding(null);
    try {
      onKlaar(await ds.upload(rollen, powerup, hr));
      setMelding({ ok: true, tekst: 'Bestanden verwerkt. Het dashboard gebruikt nu deze gegevens.' });
      setPowerup(null);
      setHr(null);
      setFormKey((k) => k + 1);
    } catch (err) {
      setMelding({ ok: false, tekst: err instanceof Error ? err.message : 'Uploaden mislukt.' });
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="kaart">
      <h2>Exports uploaden</h2>
      <form key={formKey} className="upload" onSubmit={verstuur}>
        <label>
          <span>Power UP-export (voortgangsrapport, .xlsx)</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setPowerup(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          <span>HR-export (Lijst FvB, .xlsx)</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setHr(e.target.files?.[0] ?? null)} />
        </label>
        <button className="knop primair" type="submit" disabled={!powerup || !hr || bezig}>
          {bezig ? 'Verwerken…' : 'Verwerken'}
        </button>
      </form>
      {melding && (
        <p className={melding.ok ? 'succes' : 'fout'} role={melding.ok ? 'status' : 'alert'}>
          {melding.tekst}
        </p>
      )}
    </section>
  );
}

function Cursussen({ overzicht, onKlaar }: { overzicht: BeheerOverzicht; onKlaar: (o: BeheerOverzicht) => void }) {
  const { ds, rollen } = useApp();
  const [keuze, setKeuze] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    setKeuze(new Set(overzicht.cursussen.filter((c) => c.inProgramma).map((c) => c.naam)));
  }, [overzicht]);

  const gewijzigd = overzicht.cursussen.some((c) => c.inProgramma !== keuze.has(c.naam));

  const opslaan = async () => {
    setBezig(true);
    try {
      onKlaar(await ds.setProgrammaCursussen(rollen, [...keuze]));
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="kaart">
      <div className="kaart-kop">
        <h2>Cursussen in het programma</h2>
        <button className="knop primair" disabled={!gewijzigd || bezig} onClick={opslaan}>
          Opslaan
        </button>
      </div>
      <p className="subtiel klein">Vink aan welke gevonden cursusnamen bij het AI &amp; data trainingsprogramma horen. Alleen die trainingen komen in het dashboard.</p>
      <ul className="cursuslijst">
        {overzicht.cursussen.map((c) => (
          <li key={c.naam}>
            <label>
              <input
                type="checkbox"
                checked={keuze.has(c.naam)}
                onChange={(e) => {
                  const n = new Set(keuze);
                  if (e.target.checked) n.add(c.naam);
                  else n.delete(c.naam);
                  setKeuze(n);
                }}
              />
              {c.naam}
              {isVerplicht(c.naam) && <span className="badge verplicht">verplicht</span>}
              {c.nieuw && <span className="badge">nieuw</span>}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Uitzonderingen({ overzicht }: { overzicht: BeheerOverzicht }) {
  const [type, setType] = useState<UitzonderingType | ''>('');
  const telling = useMemo(() => {
    const t = new Map<UitzonderingType, number>();
    for (const u of overzicht.uitzonderingen) t.set(u.type, (t.get(u.type) ?? 0) + 1);
    return t;
  }, [overzicht]);
  const lijst = type ? overzicht.uitzonderingen.filter((u) => u.type === type) : overzicht.uitzonderingen;

  return (
    <section className="kaart">
      <div className="kaart-kop">
        <h2>Uitzonderingenlijst</h2>
        <label className="filter inline">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as UitzonderingType | '')}>
            <option value="">Alle ({overzicht.uitzonderingen.length})</option>
            {[...telling.entries()].map(([t, n]) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]} ({n})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="subtiel klein">Bevat persoonsgegevens en is alleen zichtbaar voor de beheerder.</p>
      {lijst.length === 0 ? (
        <p>Geen uitzonderingen.</p>
      ) : (
        <div className="tabel-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Bron</th>
                <th scope="col" className="num">
                  Rij
                </th>
                <th scope="col">E-mail</th>
                <th scope="col">Cursus</th>
                <th scope="col">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              {lijst.map((u, i) => (
                <tr key={i}>
                  <td>{TYPE_LABELS[u.type]}</td>
                  <td>{u.bron === 'hr' ? 'HR' : 'Power UP'}</td>
                  <td className="num">{u.rijnummer ?? '—'}</td>
                  <td>{u.email ?? '—'}</td>
                  <td>{u.cursus ?? '—'}</td>
                  <td>{u.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
