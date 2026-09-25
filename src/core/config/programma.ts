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

/**
 * Normalises a course name for comparison: case, diacritics, "&" vs "en",
 * punctuation and whitespace are ignored.
 */
export function normaliseerTraining(naam: string): string {
  return naam
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The programme training a course name from the export refers to: an exact match after
 * normalisation, or a name that contains the programme name as whole words
 * (e.g. "AI & Data Essentials (e-learning)").
 */
export function programmaTrainingVoor(cursus: string): ProgrammaTraining | undefined {
  const n = ` ${normaliseerTraining(cursus)} `;
  return PROGRAMMA_TRAININGEN.find((t) => n.includes(` ${normaliseerTraining(t.naam)} `));
}

/** Course names from the export that belong to the programme (selected automatically after an upload). */
export const herkenProgrammaCursussen = (cursussen: readonly string[]): string[] => cursussen.filter((c) => programmaTrainingVoor(c) !== undefined);

/** Programme trainings that do not occur in the export at all. */
export const ontbrekendeProgrammaTrainingen = (cursussen: readonly string[]): string[] =>
  PROGRAMMA_TRAININGEN.filter((t) => !cursussen.some((c) => programmaTrainingVoor(c) === t)).map((t) => t.naam);

export const isVerplicht = (naam: string) => programmaTrainingVoor(naam)?.verplicht ?? false;
