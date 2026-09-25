import { bedrijfCodeVoor } from '../config/bedrijven';
import type { HrMedewerker, Tabel, Uitzondering } from '../types';
import { ParseFout, celTekst, isLegeRij, kolomIndices, normaliseerEmail, vindKoprij } from './tabel';

export const HR_WERKBLAD = 'DG MW in dienst';

// Data minimisation: only these columns are read. "Leidinggevende" is deliberately absent.
const KOLOMMEN = {
  naam: { naam: 'Naam', verplicht: true },
  email: { naam: 'E-mail werk', verplicht: true },
  werkgever: { naam: 'Werkgevernaam', verplicht: true },
  afdeling: { naam: 'Org. eenheid omschrijving', verplicht: true },
};

export interface HrResultaat {
  medewerkers: HrMedewerker[];
  uitzonderingen: Uitzondering[];
}

export function parseHr(tabel: Tabel): HrResultaat {
  const kopIdx = vindKoprij(tabel, 'E-mail werk');
  if (kopIdx < 0) throw new ParseFout('HR-export: geen koprij met kolom "E-mail werk" gevonden.');
  const k = kolomIndices(tabel[kopIdx], KOLOMMEN);
  const medewerkers: HrMedewerker[] = [];
  const uitzonderingen: Uitzondering[] = [];
  const gezien = new Set<string>();

  for (let i = kopIdx + 1; i < tabel.length; i++) {
    const rij = tabel[i] ?? [];
    if (isLegeRij(rij)) continue;
    const naam = celTekst(rij[k.naam]);
    const sleutel = normaliseerEmail(celTekst(rij[k.email]));
    const werkgevernaam = celTekst(rij[k.werkgever]);
    const afdeling = celTekst(rij[k.afdeling]);

    if (!sleutel) {
      uitzonderingen.push({ type: 'hr_zonder_email', bron: 'hr', rijnummer: i + 1, detail: `Medewerker zonder e-mailadres (${naam || 'naam onbekend'}).` });
      continue;
    }
    if (gezien.has(sleutel)) {
      uitzonderingen.push({ type: 'hr_dubbel', bron: 'hr', rijnummer: i + 1, email: sleutel, detail: 'E-mailadres komt meerdere keren voor in de HR-export; eerste regel gebruikt.' });
      continue;
    }
    gezien.add(sleutel);
    const bedrijfCode = bedrijfCodeVoor(werkgevernaam) ?? null;
    if (!bedrijfCode) {
      uitzonderingen.push({ type: 'onbekend_bedrijf', bron: 'hr', rijnummer: i + 1, email: sleutel, detail: `Onbekende werkgevernaam "${werkgevernaam}"; alleen zichtbaar voor groepsdirectie en beheerder.` });
    }
    medewerkers.push({ sleutel, naam, werkgevernaam, bedrijfCode, afdeling });
  }
  return { medewerkers, uitzonderingen };
}
