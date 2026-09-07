import { ingestCsv } from '@/lib/whoop/parse';
import { emptyExport, type WhoopExport } from '@/lib/whoop/types';

/**
 * Dev-only reader for the uncompressed export in `data/`.
 *
 * This module must never reach a production bundle: it inlines the CSVs as
 * source text, so shipping it would publish somebody's health history. Two
 * independent guards keep it out.
 *
 *  1. The only import of this file is behind `import.meta.env.DEV` in
 *     `src/App.tsx`. Vite replaces that with the literal `false` in a build, so
 *     the branch and the dynamic import are dead code before Rollup runs.
 *  2. `stripLocalData` in `vite.config.ts` replaces this module's contents with
 *     an empty stub during `vite build`, in case guard 1 ever regresses.
 *
 * If you touch either guard, re-run the check in docs/arquitectura.md
 * ("Desarrollo con datos reales") before committing.
 */
const CSV_FILES = import.meta.glob<string>('/data/**/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface LocalData {
  data: WhoopExport;
  /** File names that were recognised, for the dev-server log. */
  files: string[];
}

/**
 * Parse every CSV found under `data/` with the same `ingestCsv` the drop zone
 * uses. Returns null when the folder holds nothing recognisable, which is the
 * signal to fall back to the normal import flow.
 */
export function readLocalData(): LocalData | null {
  const data = emptyExport();
  const files: string[] = [];

  for (const [path, text] of Object.entries(CSV_FILES)) {
    const name = path.split('/').pop() ?? path;
    if (ingestCsv(name, text, data)) files.push(name);
  }

  return files.length ? { data, files } : null;
}
