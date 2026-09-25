export function GeenToegang({ melding }: { melding?: string }) {
  return (
    <section className="kaart melding">
      <h2>Geen toegang</h2>
      <p>{melding ?? 'Je account heeft (nog) geen rol voor dit dashboard. Neem contact op met de beheerder als je toegang nodig hebt.'}</p>
    </section>
  );
}
