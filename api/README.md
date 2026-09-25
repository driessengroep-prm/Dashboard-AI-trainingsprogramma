# API (fase 2): Azure Functions

Deze map is nog leeg. In fase 2 komt hier een Azure Functions-app (Node/TypeScript). Die draait lokaal via de SWA CLI met Azurite en importeert de kernlogica uit `../src/core/`. De rolfilterfunctie, de koppellogica en de opbouw van de AI-context zijn dus identiek aan de demo.

## Rollen

De rollen komen uit de header `x-ms-client-principal` (Static Web Apps-authenticatie). Ze worden gevalideerd met `parseRollen()` uit `src/core/roles.ts`. Anoniem heeft nergens toegang. `/beheer/*` en `/api/beheer/*` vereisen de rol `beheerder`.

## Endpoints

| Methode en pad | Rol | Wat |
|---|---|---|
| `GET /api/dashboard` | elke rol met toegang | `DashboardData`: de regels na `filterOpRol()` op de server |
| `GET /api/beheer` | `beheerder` | Samenvatting van de koppeling, uitzonderingenlijst en cursussen |
| `POST /api/beheer/upload` | `beheerder` | Multipart met de velden `powerup` en `hr`. Alleen `.xlsx`, maximaal 10 MB, server-side geparsed. Vervangt de vorige dataset op persoonsniveau. |
| `PUT /api/beheer/programma` | `beheerder` | `{ "cursussen": string[] }`: welke cursussen bij het programma horen |
| `POST /api/ai/samenvatting` | elke rol met toegang | Zie hieronder |

Alle responses krijgen `Cache-Control: no-store`. Uploads en dashboardbezoeken komen in een audit-log: gebruikers-ID en tijdstip, zonder inhoud.

De clientkant staat al klaar in `src/data/ApiDataSource.ts` en `src/ai/ApiAiProvider.ts`.

## `POST /api/ai/samenvatting`

- **Request:** `{ "filters": DashboardFilters }`. De client stuurt **alleen de filterselectie**, nooit een eigen context of prompt.
- **Verwerking op de server:**
  1. Bepaal de rollen uit `x-ms-client-principal` en pas `filterOpRol()` toe.
  2. Pas `pasFiltersToe()` toe met de filters.
  3. Bouw de context met `buildAiContext()`: alleen aggregaten, groepen van minder dan 5 medewerkers onderdrukt.
  4. Laad de systeemprompt uit `src/core/prompts/samenvatting.md`.
  5. Roep het Foundry-model aan met de officiële `openai`-SDK in Azure-configuratie, of het actuele Foundry-SDK-pad. Controleer vooraf de actuele Microsoft-documentatie voor het juiste endpoint- en API-versieformaat.
- **Authenticatie:** via `@azure/identity`, met `DefaultAzureCredential`. Lokaal is dat `az login`, in productie de managed identity. Een API-key alleen als terugvaloptie, en dan uitsluitend via een omgevingsvariabele.
- **Configuratie:** alleen via omgevingsvariabelen (lokaal in `local.settings.json`, gitignored):
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_DEPLOYMENT`
  - `AZURE_OPENAI_API_VERSION`
- **Robuustheid:** timeout, beperkte `max_tokens` en nette foutafhandeling. Het dashboard blijft werken als de AI niet beschikbaar is.
- **Response:** `{ "tekst": string, "gegenereerdOp": string }`.
