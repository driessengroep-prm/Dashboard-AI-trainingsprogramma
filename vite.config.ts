/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/
  base: '/Dashboard-AI-trainingsprogramma/',
  plugins: [react()],
  build: {
    sourcemap: false,
    // exceljs (~940 kB) is loaded as a separate chunk, only by the demo data source
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
