import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  aantalMedewerkers,
  medewerkerMatrix,
  pct,
  perAfdeling,
  perBedrijf,
  perTraining,
  telStatussen,
  type Groep,
} from '../../core/aggregate';
import { buildAiContext } from '../../core/aiContext';
import { isVerplicht } from '../../core/config/programma';
import { pasFiltersToe, type DashboardFilters } from '../../core/filters';
import { STATUSSEN, STATUS_LABELS, type DashboardRegel, type Status } from '../../core/types';
import { GeenToegangFout, type DashboardData } from '../../data/types';
import { useApp } from '../AppContext';
import { AiSamenvattingKnop } from '../components/AiSamenvatting';
import { GeenToegang } from '../components/GeenToegang';
import { Legenda, StatusBalk, fmt } from '../components/StatusBalk';

type FilterSleutel = 'bedrijf' | 'afdeling' | 'training' | 'status';

function uniek<T>(a: T[]): T[] {
  return [...new Set(a)];
}

export function Dashboard() {
  const { ds, rollen, versie } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fout, setFout] = useState<{ toegang: boolean; tekst: string } | null>(null);
  const [params, setParams] = useSearchParams();
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let actueel = true;
    setFout(null);
    ds.getDashboard(rollen)
      .then((d) => actueel && setData(d))
      .catch((e) => {
        if (!actueel) return;
        setData(null);
        setFout({ toegang: e instanceof GeenToegangFout, tekst: e instanceof Error ? e.message : 'Onbekende fout' });
      });
    return () => {
      actueel = false;
    };
  }, [ds, rollen, versie]);

  const regels = useMemo(() => data?.regels ?? [], [data]);

  // Filter options are derived from the role-filtered data only.
  const opties = useMemo(() => {
    const bedrijven = uniek(regels.map((r) => `${r.bedrijfCode ?? ''}\u0000${r.werkgevernaam}`))
      .map((s) => s.split('\u0000'))
      .filter(([code]) => code)
      .sort((a, b) => a[1].localeCompare(b[1], 'nl'));
    const bedrijf = params.get('bedrijf');
    const afdelingen = uniek(regels.filter((r) => !bedrijf || r.bedrijfCode === bedrijf).map((r) => r.afdeling)).sort((a, b) =>
      a.localeCompare(b, 'nl'),
    );
    return { bedrijven, afdelingen, trainingen: data?.programmaCursussen ?? [] };
  }, [regels, data, params]);

  const filters: DashboardFilters = useMemo(() => {
    const f = (k: FilterSleutel) => (params.get(k) ? [params.get(k)!] : []);
    return {
      bedrijven: f('bedrijf').filter((b) => opties.bedrijven.some(([c]) => c === b)),
      afdelingen: f('afdeling').filter((a) => opties.afdelingen.includes(a)),
      trainingen: f('training').filter((t) => opties.trainingen.includes(t)),
      statussen: f('status').filter((s): s is Status => (STATUSSEN as readonly string[]).includes(s)) as Status[],
    };
  }, [params, opties]);

  const gefilterd = useMemo(() => pasFiltersToe(regels, filters), [regels, filters]);

  const zet = (k: FilterSleutel, v: string | null, extra?: Partial<Record<FilterSleutel, string | null>>) => {
    const p = new URLSearchParams(params);
    for (const [kk, vv] of Object.entries({ [k]: v, ...extra })) {
      if (vv) p.set(kk, vv);
      else p.delete(kk);
    }
    setParams(p, { replace: true });
  };

  if (fout) return fout.toegang ? <GeenToegang /> : <p className="fout">{fout.tekst}</p>;
  if (!data) return <div className="laden">Gegevens laden…</div>;

  const telling = telStatussen(gefilterd);
  const totaal = gefilterd.length;
  const nFilters = Object.values(filters).filter((a) => a && a.length).length;

  const naarDetail = () => setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  return (
    <div className="dashboard">
      <div className="pagina-kop met-actie">
        <div>
          <h1>Dashboard AI &amp; data trainingsprogramma</h1>
          <p className="subtiel">
            Voortgang per medewerker en training
            {data.peildatum ? ` · gegevens van ${data.peildatum.toLocaleDateString('nl-NL')}` : ''}
          </p>
        </div>
        {regels.length > 0 && <AiSamenvattingKnop context={buildAiContext(gefilterd, filters, { peildatum: data.peildatum })} filters={filters} />}
      </div>

      <section className="filters kaart" aria-label="Filters">
        <Filter
          label="Bedrijf"
          waarde={params.get('bedrijf')}
          opties={opties.bedrijven.map(([c, n]) => [c, n])}
          onChange={(v) => zet('bedrijf', v, { afdeling: null })}
        />
        <Filter
          label="Afdeling/team"
          waarde={params.get('afdeling')}
          opties={opties.afdelingen.map((a) => [a, a])}
          onChange={(v) => zet('afdeling', v)}
        />
        <Filter label="Training" waarde={params.get('training')} opties={opties.trainingen.map((t) => [t, t])} onChange={(v) => zet('training', v)} />
        <Filter
          label="Status"
          waarde={params.get('status')}
          opties={STATUSSEN.map((s) => [s, STATUS_LABELS[s]])}
          onChange={(v) => zet('status', v)}
        />
        <button className="knop-link" disabled={nFilters === 0} onClick={() => setParams(new URLSearchParams(), { replace: true })}>
          Filters wissen
        </button>
      </section>

      {regels.length === 0 ? (
        <section className="kaart melding">
          {data.geenDataset ? (
            <>
              Er zijn nog geen gegevens geladen. Upload de Power UP-export en de HR-export op de <Link to="/beheer">beheerpagina</Link>.
            </>
          ) : (
            'Er zijn geen gegevens beschikbaar voor jouw rol.'
          )}
        </section>
      ) : (
        <>
          <section className="tegels" aria-label="Kerncijfers">
            <Tegel label="Medewerkers" waarde={String(aantalMedewerkers(gefilterd))} toelichting="volgens de HR-lijst" />
            {STATUSSEN.map((s) => (
              <Tegel
                key={s}
                status={s}
                label={STATUS_LABELS[s]}
                waarde={`${fmt(pct(telling[s], totaal))}%`}
                toelichting={`${telling[s]} van ${totaal} (medewerker × training)`}
              />
            ))}
          </section>

          <div className="raster-2">
            <GroepKaart
              titel="Per training"
              groepen={perTraining(gefilterd)}
              actief={params.get('training')}
              onKies={(g) => zet('training', g.sleutel)}
              badge={(g) => (isVerplicht(g.sleutel) ? 'verplicht' : null)}
            />
            <GroepKaart
              titel="Per bedrijf"
              groepen={perBedrijf(gefilterd)}
              actief={params.get('bedrijf')}
              onKies={(g) => g.sleutel !== 'onbekend' && zet('bedrijf', g.sleutel, { afdeling: null })}
            />
          </div>

          <GroepKaart
            titel="Per afdeling/team (OE)"
            toelichting="Klik op een afdeling/team om de medewerkers te zien. Tip: filter eerst op bedrijf."
            groepen={perAfdeling(gefilterd)}
            compact
            inklapbaar
            actief={params.get('afdeling')}
            onKies={(g) => {
              zet('afdeling', g.sleutel);
              naarDetail();
            }}
          />

          <section ref={detailRef} className="kaart">
            <MedewerkerTabel regels={gefilterd} trainingen={filters.trainingen?.length ? filters.trainingen : opties.trainingen} />
          </section>
        </>
      )}
    </div>
  );
}

function Filter(props: { label: string; waarde: string | null; opties: [string, string][]; onChange: (v: string | null) => void }) {
  return (
    <label className="filter">
      <span>{props.label}</span>
      <select value={props.waarde ?? ''} onChange={(e) => props.onChange(e.target.value || null)}>
        <option value="">Alle</option>
        {props.opties.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tegel({ label, waarde, toelichting, status }: { label: string; waarde: string; toelichting: string; status?: Status }) {
  return (
    <div className="tegel" style={status ? { borderTopColor: `var(--s-${status})` } : undefined}>
      <div className="tegel-label">
        {status && <span className={`stip s-${status}`} aria-hidden />}
        {label}
      </div>
      <div className="tegel-waarde">{waarde}</div>
      <div className="tegel-toelichting">{toelichting}</div>
    </div>
  );
}

function GroepKaart(props: {
  titel: string;
  toelichting?: string;
  groepen: Groep[];
  actief: string | null;
  onKies: (g: Groep) => void;
  badge?: (g: Groep) => string | null;
  /** Long lists: sortable and initially limited to COMPACT_AANTAL rows. */
  compact?: boolean;
  /** Collapsible card, initially collapsed. */
  inklapbaar?: boolean;
}) {
  const [open, setOpen] = useState(!props.inklapbaar);
  const [sortering, setSortering] = useState<Sortering>('naam');
  const [alles, setAlles] = useState(false);
  const gesorteerd = props.compact ? sorteerGroepen(props.groepen, sortering) : props.groepen;
  const zichtbaar = props.compact && !alles ? gesorteerd.slice(0, COMPACT_AANTAL) : gesorteerd;
  return (
    <section className="kaart">
      <div className="kaart-kop">
        {props.inklapbaar ? (
          <h2>
            <button className="uitklap" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <span className="chevron" aria-hidden>
                ▸
              </span>
              {props.titel}
              <span className="uitklap-aantal">({props.groepen.length})</span>
            </button>
          </h2>
        ) : (
          <h2>{props.titel}</h2>
        )}
        {open ? (
          <Legenda />
        ) : (
          <button className="knop-link klein-link" onClick={() => setOpen(true)}>
            Uitklappen
          </button>
        )}
      </div>
      {open && (
        <>
          {props.toelichting && <p className="subtiel klein">{props.toelichting}</p>}
          <div className="tabel-scroll">
            <table className="groeptabel">
              <thead>
                <tr>
                  <th scope="col">Naam</th>
                  <th scope="col" className="num" title="Medewerkers volgens de HR-lijst">
                    Mdw.
                  </th>
                  <th scope="col" className="balk-kolom">
                    Verdeling
                  </th>
                  <th scope="col" className="num">
                    Afgerond
                  </th>
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((g) => (
                  <tr key={g.sleutel} className={props.actief === g.sleutel ? 'actief' : undefined}>
                    <td>
                      <button className="knop-link" onClick={() => props.onKies(g)}>
                        {g.label}
                      </button>
                      {props.badge?.(g) && <span className="badge verplicht">{props.badge(g)}</span>}
                    </td>
                    <td className="num">{g.medewerkers}</td>
                    <td className="balk-kolom">
                      <StatusBalk telling={g.telling} totaal={g.totaal} />
                    </td>
                    <td className="num">{fmt(pct(g.telling.afgerond, g.totaal))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {props.compact && (
            <div className="kaart-voet">
              <label className="filter inline">
                <span>Sorteer</span>
                <select value={sortering} onChange={(e) => setSortering(e.target.value as Sortering)}>
                  <option value="naam">Op naam</option>
                  <option value="achter">Laagste % afgerond eerst</option>
                  <option value="voor">Hoogste % afgerond eerst</option>
                  <option value="grootte">Meeste medewerkers eerst</option>
                </select>
              </label>
              {props.groepen.length > COMPACT_AANTAL && (
                <button className="knop" onClick={() => setAlles((a) => !a)}>
                  {alles ? `Toon eerste ${COMPACT_AANTAL}` : `Toon alle ${props.groepen.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const COMPACT_AANTAL = 15;
type Sortering = 'naam' | 'achter' | 'voor' | 'grootte';

function sorteerGroepen(groepen: Groep[], s: Sortering): Groep[] {
  const afgerond = (g: Groep) => pct(g.telling.afgerond, g.totaal);
  const kopie = [...groepen];
  if (s === 'achter') kopie.sort((a, b) => afgerond(a) - afgerond(b) || b.medewerkers - a.medewerkers);
  if (s === 'voor') kopie.sort((a, b) => afgerond(b) - afgerond(a) || b.medewerkers - a.medewerkers);
  if (s === 'grootte') kopie.sort((a, b) => b.medewerkers - a.medewerkers || a.label.localeCompare(b.label, 'nl'));
  return kopie;
}

const PAGINA = 50;

function MedewerkerTabel({ regels, trainingen }: { regels: DashboardRegel[]; trainingen: string[] }) {
  const [zoek, setZoek] = useState('');
  const [aantal, setAantal] = useState(PAGINA);
  const matrix = useMemo(() => medewerkerMatrix(regels), [regels]);
  const z = zoek.trim().toLowerCase();
  const rijen = z ? matrix.filter((m) => m.naam.toLowerCase().includes(z) || m.afdeling.toLowerCase().includes(z)) : matrix;

  return (
    <>
      <div className="kaart-kop">
        <h2>Medewerkers × training</h2>
        <input
          className="zoek"
          type="search"
          placeholder="Zoek op naam of afdeling"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          aria-label="Zoek medewerker"
        />
      </div>
      <p className="subtiel klein">
        {rijen.length} medewerker{rijen.length === 1 ? '' : 's'} in de huidige selectie.
      </p>
      <div className="tabel-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Medewerker</th>
              <th scope="col">Bedrijf</th>
              <th scope="col">Afdeling/team</th>
              {trainingen.map((t) => (
                <th scope="col" key={t}>
                  {t}
                  {isVerplicht(t) && <span className="th-sub">verplicht</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.slice(0, aantal).map((m) => (
              <tr key={m.sleutel}>
                <td>{m.naam}</td>
                <td>{m.werkgevernaam}</td>
                <td>{m.afdeling}</td>
                {trainingen.map((t) => {
                  const c = m.perTraining[t];
                  return (
                    <td key={t}>
                      {c ? (
                        <span className="chip" title={c.geregistreerd ? undefined : 'Nog niet geregistreerd in Power UP'}>
                          <span className={`stip s-${c.status}`} aria-hidden />
                          {STATUS_LABELS[c.status]}
                          {c.status === 'bezig' && c.voortgang !== null ? ` · ${fmt(c.voortgang)}%` : ''}
                        </span>
                      ) : (
                        <span className="subtiel">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rijen.length > aantal && (
        <button className="knop" onClick={() => setAantal((a) => a + PAGINA)}>
          Toon meer ({rijen.length - aantal} resterend)
        </button>
      )}
    </>
  );
}
