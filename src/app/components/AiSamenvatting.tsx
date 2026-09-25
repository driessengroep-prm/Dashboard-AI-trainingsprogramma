import { useEffect, useRef, useState } from 'react';
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

/**
 * "AI-samenvatting" button (top right of the dashboard). Clicking it opens a modal
 * dialog with the summary for the current filter selection.
 */
export function AiSamenvattingKnop({ context, filters }: { context: AiContext; filters: DashboardFilters }) {
  const { ai } = useApp();
  const dialoogRef = useRef<HTMLDialogElement>(null);
  const [resultaat, setResultaat] = useState<Samenvatting | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const contextJson = JSON.stringify(context, null, 2);
  const verzoekNr = useRef(0);

  // A summary belongs to one selection: discard it when the selection changes.
  useEffect(() => {
    verzoekNr.current++;
    setResultaat(null);
    setFout(null);
    setBezig(false);
  }, [contextJson]);

  const genereer = async () => {
    const nr = ++verzoekNr.current;
    setBezig(true);
    setFout(null);
    try {
      const r = await ai.samenvatting({ context, filters });
      if (nr === verzoekNr.current) setResultaat(r);
    } catch (e) {
      if (nr === verzoekNr.current) setFout(e instanceof Error ? e.message : 'De AI-samenvatting is nu niet beschikbaar.');
    } finally {
      if (nr === verzoekNr.current) setBezig(false);
    }
  };

  const open = () => {
    dialoogRef.current?.showModal();
    if (!resultaat && !bezig) void genereer();
  };

  const sluit = () => dialoogRef.current?.close();

  return (
    <>
      <button className="knop primair ai-knop" onClick={open} aria-haspopup="dialog">
        <span aria-hidden>✦</span> AI-samenvatting
      </button>
      <dialog
        ref={dialoogRef}
        className="ai-dialoog"
        aria-labelledby="ai-dialoog-titel"
        onClick={(e) => {
          // Click on the backdrop closes the dialog
          if (e.target === dialoogRef.current) sluit();
        }}
      >
        <div className="ai-dialoog-inhoud">
          <div className="kaart-kop">
            <h2 id="ai-dialoog-titel">AI-samenvatting</h2>
            <button className="sluit" onClick={sluit} aria-label="Sluiten">
              ×
            </button>
          </div>
          <p className="subtiel klein">
            Analyse van de huidige filterselectie: {selectieTekst(context)}. Alleen geaggregeerde cijfers worden gebruikt; groepen kleiner dan{' '}
            {context.drempelKleineGroep} medewerkers worden samengevoegd of weggelaten.
            {IS_DEMO && ' In deze demo is de tekst gesimuleerd: er wordt geen echt AI-model aangeroepen.'}
          </p>
          {bezig && <div className="laden">Samenvatting maken…</div>}
          {fout && <p className="fout">{fout}</p>}
          {resultaat && !bezig && (
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
          <div className="kaart-voet">
            <button className="knop" onClick={genereer} disabled={bezig}>
              Opnieuw genereren
            </button>
            <button className="knop primair" onClick={sluit}>
              Sluiten
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function selectieTekst(ctx: AiContext): string {
  const s = ctx.selectie;
  const delen = [
    s.bedrijven === 'alle' ? 'alle bedrijven' : s.bedrijven.join(', '),
    s.afdelingen !== 'alle' ? s.afdelingen.join(', ') : null,
    s.trainingen === 'alle' ? 'alle trainingen' : s.trainingen.join(', '),
    s.statussen !== 'alle' ? `status ${s.statussen.join(', ')}` : null,
  ];
  return delen.filter(Boolean).join(' · ');
}
