# CLAUDE.md — Dashboard AI & data trainingsprogramma

## Doel van het project

Een interne webtool voor Driessen Groep die twee exportbestanden combineert:

1. **Power UP-export** (e-learningsysteem van Get Responsive): wie is ingeschreven voor welke training uit het AI & data trainingsprogramma, en wat is de status.
2. **HR-export** ("Lijst FvB"): welke medewerker werkt bij welk bedrijf en in welke afdeling/team.

Een **beheerder** uploadt beide bestanden in een beheerdersportaal. Het resultaat is een **dashboard** voor stakeholders (o.a. directeuren van de groepsbedrijven). Daarin is per medewerker te zien welke training is afgerond, nog bezig is of niet gestart is. Er zijn uitsluitend drie statussen: `afgerond`, `bezig` en `niet_gestart`. Een medewerker die nog niet in Power UP staat (nog niet ingelogd), telt als `niet_gestart`. Het dashboard is te filteren op bedrijf, afdeling/team en training.

Daarnaast komt er een **AI-samenvatting**: een Azure OpenAI-model uit de eigen Azure AI Foundry van Driessen schrijft een korte analyse van de getoonde (geaggregeerde) cijfers.

## Fasering

| Fase | Wat | Waar | Data |
|---|---|---|---|
| **1 — Demo** | Volledige frontend + gedeelde kernlogica. Rollen worden nagebootst. De AI-samenvatting is gesimuleerd (mock). | GitHub Pages (publiek) | Alleen fictief |
| **2 — Lokaal met API** | Azure Functions-API met server-side rolfiltering, opslag (Azurite) en een echte koppeling met het Foundry-model | Lokaal (SWA CLI) | Alleen fictief |
| **3 — Productie** | Azure Static Web Apps met Entra ID, Blob Storage en Foundry via managed identity | Intern subdomein van driessengroep.nl | Echt |

**De code moet vanaf fase 1 zo opgezet zijn dat fase 2 en 3 een kwestie van "aansluiten" zijn, niet van herbouwen.**

## Architectuurprincipes

- **Gedeelde kern (`src/core/`).** Pure TypeScript, zonder UI en zonder afhankelijkheid van browser of server. Bevat:
  - het parsen van beide exports;
  - de statusmapping;
  - de koppellogica;
  - het filteren op rol;
  - aggregaties;
  - de opbouw van de AI-context.

  In fase 1 draait deze code in de browser, vanaf fase 2 in de API. De logica blijft dus identiek en is volledig unit-getest.
- **Databron achter een interface (`src/data/`).** Er is een interface `DataSource` met twee implementaties:
  - `DemoDataSource`: gebundelde fictieve data plus uploads die in de browser worden verwerkt, alleen in het geheugen;
  - `ApiDataSource`: roept de API aan (fase 2/3).

  Welke gebruikt wordt, bepaalt de buildvariabele `VITE_APP_MODE` (`demo` | `lokaal` | `api`). `lokaal` is een offline HTML-bestand (`npm run build:lokaal`) om echte exports lokaal in de browser te testen: geen gebundelde data, geen `.example`-controle, netwerk geblokkeerd via CSP, niets opgeslagen. Dat bestand wordt nooit gecommit of gepubliceerd.
- **AI achter een interface (`src/ai/`).** Er is een interface `AiProvider` met twee implementaties:
  - `MockAiProvider`: deterministische voorbeeldtekst, opgebouwd uit dezelfde AI-context;
  - `ApiAiProvider`: roept `POST /api/ai/samenvatting` aan, en die API spreekt het Foundry-model aan.

  **De frontend praat nooit direct met Azure OpenAI.**
- **Rollen.** In fase 1 kiest een rolkiezer (duidelijk gemarkeerd als DEMO) de gesimuleerde rol. Vanaf fase 2 komt de rol uit de login (`x-ms-client-principal`) en filtert de API. De filterfunctie in `src/core/` is in beide gevallen dezelfde.

## Harde regels: privacy en security

### Altijd

- **Nooit echte data in de repo of in een build.** Geen `.xlsx`, `.xls` of `.csv` committen. De enige uitzondering is `testdata/fictief/`, en alleen als die bestanden met het generatorscript zijn gemaakt.
- **Fictieve e-maildomeinen.** Testdata gebruikt uitsluitend domeinen die eindigen op `.example` (bijv. `@driessen.example`).
- **Geen persoonsgegevens in logs of in foutmeldingen.** De enige uitzondering is de uitzonderingslijst voor de rol `beheerder`.
- **Dataminimalisatie.** Lees alleen de benodigde kolommen in. De kolom "Leidinggevende" uit de HR-export wordt **niet** ingelezen.
- **Dependencies.** Gebruik `exceljs` voor Excel. Gebruik niet het oude `xlsx`-pakket van npm, want dat heeft bekende kwetsbaarheden. Houd dependencies minimaal.
- **Geen geheimen in code of repo.** Geen API-keys, endpoints met keys of connection strings. Lokaal staan ze in `.env.local` of `local.settings.json` (gitignored). Maak alleen `*.example`-varianten zonder waarden.

### Specifiek voor de demo op GitHub Pages (fase 1)

- **Alles is publiek.** Een GitHub Pages-site is openbaar, ook als de repo private is. De build bevat daarom uitsluitend fictieve data.
- **Duidelijke markering.** Toon op elke pagina een duidelijke banner: "DEMO — fictieve gegevens, niet voor echte exports".
- **Uploadbewaking.** De demo-upload weigert een bestand zodra er ook maar één e-mailadres in staat dat niet eindigt op `.example`. Toon dan een duidelijke melding dat de demo alleen fictieve data accepteert.
- **Niets bewaren of versturen.** Uploads worden alleen in de browser verwerkt en alleen in het geheugen gehouden. Geen localStorage, geen IndexedDB en geen netwerkverzoeken met data.
- **Niet indexeren.** Voeg `<meta name="robots" content="noindex, nofollow">` en een `robots.txt` toe die alles uitsluit.
- **Geautomatiseerde privacycheck in CI.** Het script `scripts/privacy-check.ts` laat de build falen als:
  - er een `.xlsx`, `.xls` of `.csv` buiten `testdata/fictief/` in de repo staat;
  - de build-output (`dist/`) een e-mailadres bevat dat niet op `.example` eindigt;
  - er iets in de code staat dat op een API-key of een Azure OpenAI-endpoint lijkt.
- **Geen echte AI-aanroep in de demo.** In de demo wordt alleen `MockAiProvider` gebruikt.

### Specifiek voor de API en productie (fase 2/3)

- **Autorisatie gebeurt in de API.** Een gebruiker met `bedrijf_ijk` krijgt technisch nooit data van andere bedrijven binnen.
- **Anonieme toegang.** Anoniem heeft nergens toegang. `/beheer/*` en `/api/beheer/*` vereisen de rol `beheerder`.
- **Headers.** Stel een strikte Content-Security-Policy in, plus `nosniff` en `Referrer-Policy: no-referrer`. API-responses krijgen `Cache-Control: no-store`.
- **Uploads.** Alleen `.xlsx`, maximaal 10 MB, en server-side geparsed.
- **Bewaartermijn.** Een nieuwe upload vervangt de vorige dataset op persoonsniveau. Historie wordt alleen geaggregeerd bewaard.
- **Audit-log.** Leg uploads en dashboardbezoeken vast: gebruikers-ID en tijdstip, zonder inhoud.

## AI-samenvatting (Azure OpenAI via de eigen Foundry)

**Aanname, bevestig die in plan mode.** De AI-functie is een knop "AI-samenvatting" op het dashboard. Die geeft een korte Nederlandstalige analyse van de huidige filterselectie:

- de voortgang;
- welke afdelingen/teams achterlopen of juist voorop lopen;
- opvallende patronen;
- 2–3 suggesties.

Een vrije vraag-en-antwoordfunctie valt buiten scope, tenzij anders besloten.

**Regels:**

- **Alleen geaggregeerde data naar het model.** Dat zijn aantallen en percentages per bedrijf, afdeling, training en status. Nooit namen, e-mailadressen of rijen per persoon.
- **Kleine groepen onderdrukken.** Groepen kleiner dan 5 medewerkers worden samengevoegd tot "overig" of weggelaten, om herleidbaarheid te voorkomen. De drempel is configureerbaar.
- **Volgt de rechten van de gebruiker.** De AI-context wordt opgebouwd uit data die al op rol is gefilterd. Een directeur van IJK krijgt dus nooit een samenvatting waarin andere bedrijven zitten.
- **Transparant en testbaar.** De AI-context wordt gebouwd door één functie in `src/core/aiContext.ts`. Die is unit-getest, met een test die afdwingt dat er geen e-mailadressen of namen in zitten. De systeemprompt staat als bestand in de repo (`src/core/prompts/samenvatting.md`).
- **Markering.** AI-output wordt in de UI gemarkeerd als "AI-gegenereerd — controleer de cijfers in het dashboard".
- **Aanroep alleen server-side (fase 2/3):**
  - Gebruik de officiële `openai` npm-SDK met Azure-configuratie, of het actuele Foundry-SDK-pad. **Controleer de actuele Microsoft-documentatie** voor het juiste endpoint- en API-versieformaat.
  - Authenticeer bij voorkeur via `@azure/identity`: lokaal met `DefaultAzureCredential` / `az login`, in productie met managed identity. Een API-key alleen als terugvaloptie, en dan uitsluitend via een omgevingsvariabele.
  - Endpoint en deploymentnaam komen uit omgevingsvariabelen (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`). Hardcode ze nergens.
  - Stel een timeout in, beperk de maximale output en vang fouten netjes af. Het dashboard moet gewoon blijven werken als de AI niet beschikbaar is.

## Rollen

| Rol | Rechten |
|---|---|
| `beheerder` | Uploaden, uitzonderingslijst zien, trainingen aan het programma koppelen, alles inzien |
| `groepsdirectie` | Dashboard en AI-samenvatting voor alle bedrijven |
| `bedrijf_<code>` (bijv. `bedrijf_ijk`, `bedrijf_driessen`, `bedrijf_holding`; zie `src/core/config/bedrijven.ts` voor alle 14 bedrijven) | Alleen het eigen bedrijf; meerdere bedrijfsrollen tegelijk mogelijk |
| (geen rol) | Ziet niets, behalve een melding over ontbrekende rechten |

De koppeling tussen bedrijfscode en "Werkgevernaam" staat in `src/core/config/bedrijven.ts`.

## Inputformaten

### Power UP-export (`getresponsive_Report_Voortgangsrapport_report.xlsx`)

- Het werkblad heet "Gebruikers" en begint met titelregels. **Zoek de koprij dynamisch:** dat is de eerste rij met een cel "E-mail".
- Kolommen: `Gebruiker`, `E-mail`, `Cursus`, `Ingeschreven op`, `Status`, `Tijd`.
- `Gebruiker` is een verkorte naam en wordt **niet** gebruikt om te koppelen.

**Statusmapping:**

| Waarde in `Status` | Status in de tool |
|---|---|
| `"Voltooid"` of `"Afgerond"` | `afgerond` |
| `"Niet gestart"` | `niet_gestart` |
| `"Bezig"` | `bezig` (zonder percentage) |
| Getal tussen 0 en 1 | `bezig`, met voortgang = getal × 100 (%) |
| Getal gelijk aan 1 | `afgerond` |
| Iets anders | Uitzonderingslijst |

**Kolom `Tijd`:** formaat `42d 3h 56m 54s`, of `-`. Optioneel omrekenen naar minuten.

### HR-export (`Lijst_FvB_<datum>.xlsx`)

- Werkblad "DG MW in dienst". Zoek de koprij dynamisch.
- In te lezen kolommen: `Naam`, `E-mail werk`, `Werkgevernaam`, `Org. eenheid omschrijving`.
- `Org. eenheid omschrijving` heeft een bedrijfsprefix (bijv. `IJK - ...`). Toon die zoals hij in de bron staat.

## Koppellogica

- **Sleutel:** e-mailadres, getrimd en in kleine letters.
- **Weergavenaam:** `Naam` uit de HR-export.
- **HR-medewerker zonder inschrijving** voor een programmatraining krijgt voor die training `niet_gestart`. Die medewerker is nog niet ingelogd in Power UP.
- **Medewerkers:** het aantal medewerkers komt uit de HR-export. Alle percentages worden berekend over medewerkers × programmatrainingen.
- **Programmatrainingen:** standaard (`src/core/config/programma.ts`):
  - "AI & data essentials" (verplicht);
  - "AI verantwoord inzetten in je werk" (verplicht);
  - "Copilot chat" (niet verplicht).

  De beheerder kan de selectie aanpassen. Nieuwe cursusnamen worden gemeld.
- **Power UP-rij zonder HR-match** gaat naar de uitzonderingslijst, niet naar het dashboard.
- **Dubbele inschrijving:** de meest recente telt, en het wordt gemeld.

## Structuur (richtlijn)

```
/
├── CLAUDE.md
├── README.md
├── .github/workflows/pages.yml     # test → privacycheck → build (demo) → deploy
├── .env.example
├── src/
│   ├── core/                       # gedeelde, geteste kernlogica
│   │   ├── parsing/                # powerup.ts, hr.ts
│   │   ├── matching.ts
│   │   ├── roles.ts                # rolfilter
│   │   ├── aggregate.ts
│   │   ├── aiContext.ts
│   │   ├── prompts/samenvatting.md
│   │   └── config/bedrijven.ts
│   ├── data/                       # DataSource: demo | api
│   ├── ai/                         # AiProvider: mock | api
│   └── app/                        # React UI: Dashboard, Beheer, rolkiezer (demo)
├── api/                            # fase 2: Azure Functions (importeert src/core)
├── scripts/
│   ├── genereer-testdata.ts
│   └── privacy-check.ts
└── testdata/fictief/
```

## Techniek

- React + TypeScript + Vite. Zet de `base` op `/Dashboard-AI-trainingsprogramma/` voor GitHub Pages.
- Vitest voor tests.
- GitHub Pages via GitHub Actions (Pages-bron: "GitHub Actions"). Er wordt alleen gedeployed als de tests en de privacycheck slagen.
- Vanaf fase 2: Azure Functions (Node/TypeScript), SWA CLI, Azurite. In fase 3 komen daar Azure Static Web Apps (Standard) met Entra ID bij.

## Werkafspraken

- **Repository:** `driessengroep-prm/Dashboard-AI-trainingsprogramma`. Push rechtstreeks naar `main`.
- **Elke push naar `main` deployt de demo naar GitHub Pages.** Push daarom alleen als de tests lokaal slagen.
- **Controleer vóór de eerste push de zichtbaarheid van de repo** (`gh repo view --json visibility`) en meld die aan de gebruiker. Verander de zichtbaarheid **nooit** zelf. GitHub Pages vanuit een private repo vereist een betaald GitHub-plan (Team of Enterprise). Lukt het activeren van Pages niet, stop dan en meld het.
- Code en commentaar in het Engels. UI-teksten, README en commitberichten in het Nederlands.
- Werk in kleine, logische commits en draai na elke stap de tests.
- Vraag bij twijfel over privacy of scope eerst om bevestiging.
- Richt geen Azure-resources in, tenzij de gebruiker daar expliciet om vraagt.
