/** Local offline build: real exports allowed, processed only in this browser. */
export function LokaalBanner() {
  return (
    <div className="demo-banner lokaal-banner" role="note">
      <strong>LOKAAL</strong> — gegevens worden alleen in deze browser verwerkt; niets wordt opgeslagen of verstuurd. Sluit het tabblad om ze te wissen.
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>DEMO</strong> — fictieve gegevens, niet voor echte exports
    </div>
  );
}
