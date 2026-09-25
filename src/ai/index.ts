import { IN_BROWSER } from '../data';
import { ApiAiProvider } from './ApiAiProvider';
import { MockAiProvider } from './MockAiProvider';
import type { AiProvider } from './types';

/** The demo and the local build only ever use the mock: no real AI call from the browser. */
export const maakAiProvider = (): AiProvider => (IN_BROWSER ? new MockAiProvider() : new ApiAiProvider());
