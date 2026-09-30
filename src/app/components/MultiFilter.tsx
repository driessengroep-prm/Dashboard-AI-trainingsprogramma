import { useEffect, useId, useRef, useState } from 'react';

export interface Snelkeuze {
  label: string;
  waarden: string[];
}

interface Props {
  label: string;
  /** [value, label] pairs, optionally with a secondary line (e.g. the department). */
  opties: [string, string, string?][];
  waarden: string[];
  onChange: (waarden: string[]) => void;
  snelkeuzes?: Snelkeuze[];
  /** Shows a search box above the options (long lists). */
  zoekbaar?: boolean;
}

const normaliseer = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Rendering thousands of checkboxes is slow; the search narrows the list further. */
const MAX_ZICHTBAAR = 200;

/**
 * Dropdown with checkboxes: select one or more options. Nothing selected means "Alle".
 * Closes on Escape or a click outside.
 */
export function MultiFilter({ label, opties, waarden, onChange, snelkeuzes = [], zoekbaar = false }: Props) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const knopRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const gekozen = new Set(waarden);

  useEffect(() => {
    if (!open) {
      setZoek('');
      return;
    }
    const buiten = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const toets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        knopRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', buiten);
    document.addEventListener('keydown', toets);
    return () => {
      document.removeEventListener('mousedown', buiten);
      document.removeEventListener('keydown', toets);
    };
  }, [open]);

  const labels = opties.filter(([v]) => gekozen.has(v)).map(([, l]) => l);
  const z = normaliseer(zoek.trim());
  // Selected options first, so they stay visible while searching
  const zichtbaar = (z ? opties.filter(([, l, sub]) => normaliseer(`${l} ${sub ?? ''}`).includes(z)) : opties)
    .slice()
    .sort((a, b) => Number(gekozen.has(b[0])) - Number(gekozen.has(a[0])));
  const samenvatting = labels.length === 0 ? 'Alle' : labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;

  const wissel = (v: string) => {
    const n = new Set(gekozen);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    // Keep the option order
    onChange(opties.map(([o]) => o).filter((o) => n.has(o)));
  };

  return (
    <div className="filter multifilter" ref={ref}>
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={knopRef}
        type="button"
        className={labels.length ? 'multifilter-knop gekozen' : 'multifilter-knop'}
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-waarde`}
        onClick={() => setOpen((o) => !o)}
        title={labels.join(', ') || undefined}
      >
        <span id={`${id}-waarde`} className="multifilter-tekst">
          {samenvatting}
        </span>
        <span aria-hidden className="multifilter-pijl">
          ▾
        </span>
      </button>
      {open && (
        <div className="multifilter-paneel" role="group" aria-labelledby={`${id}-label`}>
          {(snelkeuzes.length > 0 || labels.length > 0) && (
            <div className="multifilter-acties">
              {snelkeuzes.map((s) => (
                <button key={s.label} type="button" className="knop-link" onClick={() => onChange(s.waarden)}>
                  {s.label}
                </button>
              ))}
              <button type="button" className="knop-link" disabled={labels.length === 0} onClick={() => onChange([])}>
                Alles wissen
              </button>
            </div>
          )}
          {zoekbaar && (
            <div className="multifilter-zoek">
              <input
                type="search"
                autoFocus
                placeholder="Zoeken…"
                aria-label={`Zoek in ${label.toLowerCase()}`}
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
              />
            </div>
          )}
          <ul>
            {zichtbaar.slice(0, MAX_ZICHTBAAR).map(([v, l, sub]) => (
              <li key={v}>
                <label>
                  <input type="checkbox" checked={gekozen.has(v)} onChange={() => wissel(v)} />
                  <span>
                    {l}
                    {sub && <span className="multifilter-sub">{sub}</span>}
                  </span>
                </label>
              </li>
            ))}
            {zichtbaar.length === 0 && <li className="subtiel">{zoek ? 'Geen resultaten' : 'Geen opties'}</li>}
            {zichtbaar.length > MAX_ZICHTBAAR && (
              <li className="subtiel">
                Nog {zichtbaar.length - MAX_ZICHTBAAR} meer… verfijn de zoekopdracht.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
