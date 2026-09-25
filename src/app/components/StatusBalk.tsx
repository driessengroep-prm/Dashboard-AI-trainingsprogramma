import { pct, type StatusTelling } from '../../core/aggregate';
import { STATUSSEN, STATUS_LABELS } from '../../core/types';

const fmt = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

/** 100% stacked bar of the four statuses, with a native tooltip per segment. */
export function StatusBalk({ telling, totaal }: { telling: StatusTelling; totaal: number }) {
  return (
    <div className="statusbalk" role="img" aria-label={STATUSSEN.map((s) => `${STATUS_LABELS[s]} ${fmt(pct(telling[s], totaal))}%`).join(', ')}>
      {STATUSSEN.filter((s) => telling[s] > 0).map((s) => (
        <span
          key={s}
          className={`segment s-${s}`}
          style={{ flexGrow: telling[s] }}
          title={`${STATUS_LABELS[s]}: ${telling[s]} (${fmt(pct(telling[s], totaal))}%)`}
        />
      ))}
    </div>
  );
}

export function Legenda() {
  return (
    <ul className="legenda" aria-label="Legenda">
      {STATUSSEN.map((s) => (
        <li key={s}>
          <span className={`stip s-${s}`} aria-hidden />
          {STATUS_LABELS[s]}
        </li>
      ))}
    </ul>
  );
}

export { fmt };
