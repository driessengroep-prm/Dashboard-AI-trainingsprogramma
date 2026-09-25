/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local offline build: one self-contained HTML file (see scripts/maak-lokaal-html.ts)
const LOKAAL = process.env.VITE_APP_MODE === 'lokaal';

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/; the local file uses relative paths
  base: LOKAAL ? './' : '/Dashboard-AI-trainingsprogramma/',
  plugins: [react()],
  build: {
    sourcemap: false,
    outDir: LOKAAL ? 'dist-lokaal' : 'dist',
    // exceljs (~940 kB) is loaded as a separate chunk, only by the browser data source
    chunkSizeWarningLimit: LOKAAL ? 3000 : 1200,
    // Local build: inline all assets and keep everything in one JS bundle (file:// cannot load modules)
    assetsInlineLimit: LOKAAL ? 100_000_000 : undefined,
    rolldownOptions: LOKAAL ? { output: { codeSplitting: false } } : undefined,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
