/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * `src/lib/localData.ts` inlines every CSV under `data/` so `npm run dev` can
 * start with a real export. A production bundle that carried those bytes would
 * publish somebody's health history, so this plugin blanks the module during
 * `vite build`. It is the second of two guards; the first is the
 * `import.meta.env.DEV` branch in `src/App.tsx`.
 */
function stripLocalData(): Plugin {
  return {
    name: 'whoop-lab:strip-local-data',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      const path = id.split('?')[0].replace(/\\/g, '/');
      if (!path.endsWith('/src/lib/localData.ts')) return null;
      return 'export function readLocalData() {\n  return null;\n}\n';
    },
  };
}

// `base: './'` keeps asset paths relative so the same build works on
// GitHub Pages project sites, user sites and a plain static host.
export default defineConfig({
  base: './',
  plugins: [react(), stripLocalData()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
