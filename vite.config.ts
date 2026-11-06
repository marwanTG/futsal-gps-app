import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: dist/index.html carries all JS, CSS and fonts, so the app
// opens from disk with no network.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
