import { useEffect, useState } from 'react';
import type { AiSamenvatting as Samenvatting } from '../../ai/types';
import type { AiContext } from '../../core/aiContext';
import type { DashboardFilters } from '../../core/filters';
import { IS_DEMO } from '../../data';
import { useApp } from '../AppContext';

/** Renders the simple markup of the AI text (headings "## ", bullets "- ") without HTML injection. */
function Opmaak({ tekst }: { tekst: string }) {
  const blokken: React.ReactNode[] = [];
  let lijst: string[] = [];
  const sluitLijst = () => {
    if (lijst.length) {
      blokken.push(
        <ul key={`l${blokken.length}`}>
          {lijst.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>,
      );
      lijst = [];
    }
  };
  for (const regel of tekst.split('\n')) {
    if (regel.startsWith('- ')) {
      lijst.push(regel.slice(2));
      continue;
    }
    sluitLijst();
    if (regel.startsWith('## ')) blokken.push(<h3 key={blokken.length}>{regel.slice(3)}</h3>);
    else if (regel.trim()) blokken.push(<p key={blokken.length}>{regel}</p>);
  }
  sluitLijst();
  return <>{blokken}</>;
}

export function AiSamenvatting({ context, filters }: { context: AiContext; filters: DashboardFilters }) {
  const { ai } = useApp();
  const [resultaat, setResultaat] = useState<Samenvatting | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const contextJson = JSON.stringify(context, null, 2);

  // A summary belongs to one selection: clear it when the selection changes.
  useEffect(() => {
    setResultaat(null);
    setFout(null);
  }, [contextJson]);

  const vraag = async () => {
    setBezig(true);
    setFout(null);
    try {
      setResultaat(await ai.samenvatting({ context, filters }));
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'De AI-samenvatting is nu niet beschikbaar.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="kaart ai">
      <div className="kaart-kop">
        <h2>AI-samenvatting</h2>
        <button className="knop primair" onClick={vraag} disabled={bezig}>
          {bezig ? 'Bezig…' : resultaat ? 'Opnieuw genereren' : 'AI-samenvatting'}
        </button>
      </div>
      <p className="subtiel klein">
        Een korte analyse van de huidige filterselectie. Alleen geaggregeerde cijfers worden gebruikt; groepen kleiner dan{' '}
        {context.drempelKleineGroep} medewerkers worden samengevoegd of weggelaten.
        {IS_DEMO && ' In deze demo is de tekst gesimuleerd: er wordt geen echt AI-model aangeroepen.'}
      </p>
      {fout && <p className="fout">{fout}</p>}
      {resultaat && (
        <div className="ai-uitvoer">
          <div className="ai-markering">AI-gegenereerd — controleer de cijfers in het dashboard{resultaat.bron === 'mock' ? ' (gesimuleerd)' : ''}</div>
          <Opmaak tekst={resultaat.tekst} />
        </div>
      )}
      {IS_DEMO && (
        <details className="ai-context">
          <summary>Welke gegevens gaan naar het AI-model?</summary>
          <p className="subtiel klein">
            Dit is de exacte AI-context voor de huidige selectie. In fase 2/3 bouwt de API deze context zelf op (met dezelfde functie) uit de gegevens
            waar jouw rol recht op heeft, en stuurt alleen dit naar het model.
          </p>
          <pre>{contextJson}</pre>
        </details>
      )}
    </section>
  );
}
