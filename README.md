# Dashboard AI & data trainingsprogramma

Interne webtool van Driessen Groep. De tool combineert de **Power UP-export** (inschrijvingen en voortgang per training) met de **HR-export** ("Lijst FvB", bedrijf en afdeling/team per medewerker). Het resultaat is een dashboard voor stakeholders, met een AI-samenvatting van de geaggregeerde cijfers.

> **Demo:** https://driessengroep-prm.github.io/Dashboard-AI-trainingsprogramma/
>
> De demo bevat uitsluitend **fictieve gegevens**. Upload daar nooit echte exports.

Zie [`CLAUDE.md`](CLAUDE.md) voor de uitgangspunten, de fasering en de privacyregels.

## Lokaal starten

Vereist: Node.js 20 of hoger (CI gebruikt 22).

```bash
npm install
npm run dev            # start de demo op http://localhost:5173/Dashboard-AI-trainingsprogramma/
```

Overige commando's:

| Commando | Wat |
|---|---|
| `npm test` | Unit-tests (Vitest) |
| `npm run typecheck` | TypeScript-controle |
| `npm run build:demo` | Productiebuild in demo-modus naar `dist/` |
| `npm run preview` | De build lokaal bekijken |
| `npm run privacy-check` | Privacycheck op de repo en `dist/` (draai eerst `build:demo`) |
| `npm run testdata` | Fictieve testdata opnieuw genereren |
| `npm run build:lokaal` | Eén offline HTML-bestand om lokaal met echte exports te testen (zie hieronder) |

De buildvariabele `VITE_APP_MODE` bepaalt de databron: `demo` (standaard), `lokaal` (offline bestand voor echte exports) of `api` (fase 2/3). Zie `.env.example`.

## Lokaal testen met echte exports

Voor een eerste test met de echte exports, nog vóór fase 2 en 3, is er een lokale variant: één los HTML-bestand dat je offline opent.

```bash
npm run build:lokaal
# → dist-lokaal/dashboard-ai-trainingsprogramma-lokaal.html
```

Open het bestand door erop te dubbelklikken. Je start als `beheerder`: upload op de beheerpagina de Power UP-export en de HR-export ("Lijst FvB"), en het dashboard vult zich.

- **Geen demodata en geen `.example`-controle.** Echte exports worden geaccepteerd.
- **Niets verlaat je computer.** Een strikte Content-Security-Policy (`connect-src 'none'`) blokkeert technisch elk netwerkverzoek. De gegevens staan alleen in het geheugen van dat browsertabblad; sluiten wist ze.
- **De AI-samenvatting blijft gesimuleerd** (mock).
- **Het bestand zelf bevat geen gegevens** en mag dus gedeeld worden. De Excel-bestanden en schermafdrukken met echte gegevens natuurlijk niet.
- **Alleen voor testen.** Rollen worden hier nog nagebootst (rolkiezer "TEST"). Gebruik voor echte rechten per directeur de productieversie (fase 3).

`dist-lokaal/` staat in `.gitignore` en wordt nooit gepubliceerd.

## Testdata genereren

```bash
npm run testdata
```

Dit schrijft twee bestanden naar `testdata/fictief/`, met dezelfde structuur als de echte exports (werkbladnamen, titelregels en kolommen):

- `getresponsive_Report_Voortgangsrapport_report.xlsx`: werkblad "Gebruikers";
- `Lijst_FvB_20260901.xlsx`: werkblad "DG MW in dienst".

De bedrijven, de organisatorische eenheden (OE's) en het aantal medewerkers per OE volgen de echte structuur uit "Bedrijven en OE's – 2026": 833 medewerkers bij 14 bedrijven, vastgelegd in `scripts/data/organisatie-2026.ts`. Het bronbestand zelf staat niet in de repo. Namen, e-mailadressen en trainingsgegevens zijn fictief, en alle e-mailadressen eindigen op `.example`.

De trainingen zijn de drie programmatrainingen: "AI & data essentials" en "AI verantwoord inzetten in je werk" (allebei verplicht) en "Copilot chat". De generator is deterministisch en bevat bewust deze randgevallen:

- medewerkers die nog niet in Power UP staan (tellen als "niet gestart");
- Power UP-gebruikers die niet in de HR-lijst staan;
- hoofdletters en spaties in e-mailadressen;
- een dubbele inschrijving;
- een onbekende statuswaarde;
- OE's met minder dan 5 medewerkers.

Deze bestanden kun je in de demo op de beheerpagina uploaden.

## Wat de demo laat zien

- **Dashboard:**
  - het aantal medewerkers volgens de HR-lijst binnen de huidige filterselectie;
  - kerncijfers **per medewerker**, waarbij iedere medewerker één keer telt:
    - "Alles afgerond": alle trainingen in de selectie afgerond;
    - "Alles verplicht afgerond": alle verplichte trainingen afgerond;
    - "Bezig": gestart, maar nog niet alles afgerond;
    - "Niet gestart": nog niets gestart, ook wie nog niet in Power UP staat.

    De tabellen per bedrijf en per afdeling/team rekenen op dezelfde manier, met de kolommen "Alles afgerond" en "Verplicht afgerond";
  - overzichten per training, bedrijf en afdeling/team;
  - filters op bedrijf, afdeling/team, training en status. Per filter kun je meerdere opties tegelijk aanvinken, bijvoorbeeld "Alleen verplichte trainingen";
  - doorklikken naar een tabel met medewerker × training × status (met % voor "bezig").

  De filters staan in de URL, zodat je een selectie kunt delen.
- **Beheer** (alleen voor de rol `beheerder`):
  - beide exports uploaden;
  - een samenvatting van de koppeling;
  - aanvinken welke cursussen bij het programma horen;
  - de uitzonderingenlijst.
- **Rolkiezer (gemarkeerd als DEMO):** schakel tussen "Beheerder" (dashboard en beheerpagina) en "Gebruiker" (dashboard voor alle bedrijven, zonder beheerpagina). Alles wat je ziet, gaat via de rolfilterfunctie in `src/core/roles.ts`. Die ondersteunt ook de rollen per bedrijf (`bedrijf_…`) voor productie.
- **AI-samenvatting (gesimuleerd):** een knop rechtsboven op het dashboard opent een pop-up met een voorbeeldtekst, opgebouwd uit precies dezelfde AI-context die straks naar het model gaat. Onder "Welke gegevens gaan naar het AI-model?" zie je die context als JSON. Daarin staan alleen aantallen en percentages, en groepen van minder dan 5 medewerkers zijn samengevoegd of weggelaten.
- **Privacy in de demo:**
  - uploads worden alleen in de browser en in het geheugen verwerkt (geen localStorage of IndexedDB, geen netwerkverzoeken met data);
  - een bestand met een e-mailadres dat niet op `.example` eindigt, wordt geweigerd;
  - `noindex` en een `robots.txt` die alles uitsluit.

## Wat de demo (nog) niet laat zien

- **Server-side autorisatie.** In de demo wordt het rolfilter in de browser toegepast op gebundelde, fictieve data. Iedereen die de demo opent, kan technisch dus alle fictieve data inzien. In fase 2 filtert de API op basis van de login. Een gebruiker met `bedrijf_ijk` krijgt dan technisch nooit data van andere bedrijven binnen.
- **De echte AI.** Er wordt geen Azure OpenAI-model aangeroepen. Dat gebeurt vanaf fase 2, via `POST /api/ai/samenvatting` en uitsluitend server-side.
- **Opslag, audit-log en Entra ID-login.** Die komen in fase 2 en 3.

## Deploy en privacycheck

Elke push naar `main` draait `.github/workflows/pages.yml` in deze volgorde:

1. tests;
2. privacycheck op de repo;
3. build met `VITE_APP_MODE=demo`;
4. privacycheck op repo + `dist/`;
5. deploy naar GitHub Pages.

Faalt een van de stappen, dan wordt er niet gedeployed.

`scripts/privacy-check.ts` laat de build falen bij:

- `.xlsx`, `.xls` of `.csv` buiten `testdata/fictief/`;
- e-mailadressen die niet op `.example` eindigen in `dist/`, ook in de gebundelde `.xlsx`-bestanden. Twee bibliotheekteksten staan op een expliciete, gedocumenteerde uitzonderingslijst;
- iets dat lijkt op een API-key, connection string of Azure OpenAI-/Foundry-endpoint.

## Structuur

```
src/core/      gedeelde, geteste kernlogica (parsers, statusmapping, koppeling, rollen, aggregaties, AI-context)
src/data/      DataSource: DemoDataSource | ApiDataSource
src/ai/        AiProvider: MockAiProvider | ApiAiProvider
src/app/       React-UI (dashboard, beheer, rolkiezer)
api/           fase 2: Azure Functions (nog leeg, zie api/README.md)
scripts/       testdatagenerator en privacycheck
testdata/fictief/  gegenereerde fictieve exports
```
