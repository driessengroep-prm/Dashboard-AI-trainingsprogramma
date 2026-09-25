import { IS_DEMO } from '../data';
import { ApiAiProvider } from './ApiAiProvider';
import { MockAiProvider } from './MockAiProvider';
import type { AiProvider } from './types';

/** The demo only ever uses the mock: no real AI call from GitHub Pages. */
export const maakAiProvider = (): AiProvider => (IS_DEMO ? new MockAiProvider() : new ApiAiProvider());
