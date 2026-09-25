/** Trainings of the AI & data programme. The beheerder can still adjust the selection after an upload. */
export interface ProgrammaTraining {
  naam: string;
  verplicht: boolean;
}

export const PROGRAMMA_TRAININGEN: readonly ProgrammaTraining[] = [
  { naam: 'AI & data essentials', verplicht: true },
  { naam: 'AI verantwoord inzetten in je werk', verplicht: true },
  { naam: 'Copilot chat', verplicht: false },
];

export const STANDAARD_PROGRAMMA_CURSUSSEN: readonly string[] = PROGRAMMA_TRAININGEN.map((t) => t.naam);

export const isVerplicht = (naam: string) => PROGRAMMA_TRAININGEN.some((t) => t.naam === naam && t.verplicht);
