import { describe, expect, it } from 'vitest';
import { herkenProgrammaCursussen, isVerplicht, ontbrekendeProgrammaTrainingen, programmaTrainingVoor, weergaveNaam } from './programma';

describe('recognising programme trainings in the export', () => {
  it('ignores case, spacing, "&" vs "en", punctuation and additions', () => {
    expect(programmaTrainingVoor('AI & data essentials')?.naam).toBe('AI & data essentials');
    expect(programmaTrainingVoor('  AI & Data Essentials ')?.naam).toBe('AI & data essentials');
    expect(programmaTrainingVoor('AI en data essentials')?.naam).toBe('AI & data essentials');
    expect(programmaTrainingVoor('AI & data essentials (e-learning)')?.naam).toBe('AI & data essentials');
    expect(programmaTrainingVoor('AI verantwoord inzetten in je werk.')?.naam).toBe('AI verantwoord inzetten in je werk');
    expect(programmaTrainingVoor('Microsoft Copilot Chat')?.naam).toBe('Copilot chat');
  });

  it('recognises the course names of the real export (with course codes)', () => {
    expect(programmaTrainingVoor('AI & data essentials (2.01_AI_Essentials)')?.naam).toBe('AI & data essentials');
    expect(programmaTrainingVoor('AI verantwoord inzetten in je werk (2.1_AI_Verantw-Dries)')?.naam).toBe('AI verantwoord inzetten in je werk');
    expect(weergaveNaam('AI & data essentials (2.01_AI_Essentials)')).toBe('AI & data essentials');
    expect(weergaveNaam('BHV Herhaling')).toBe('BHV Herhaling');
  });

  it('does not match other courses', () => {
    expect(programmaTrainingVoor('BHV Herhaling')).toBeUndefined();
    expect(programmaTrainingVoor('Data')).toBeUndefined();
    expect(programmaTrainingVoor('Copilot')).toBeUndefined();
  });

  it('selects all programme trainings found and reports missing ones', () => {
    const export_ = ['AI & Data Essentials', 'BHV Herhaling', 'Copilot Chat'];
    expect(herkenProgrammaCursussen(export_)).toEqual(['AI & Data Essentials', 'Copilot Chat']);
    expect(ontbrekendeProgrammaTrainingen(export_)).toEqual(['AI verantwoord inzetten in je werk']);
  });

  it('marks mandatory trainings under their export name', () => {
    expect(isVerplicht('AI & Data Essentials')).toBe(true);
    expect(isVerplicht('AI verantwoord inzetten in je werk')).toBe(true);
    expect(isVerplicht('Copilot Chat')).toBe(false);
    expect(isVerplicht('BHV Herhaling')).toBe(false);
  });
});
