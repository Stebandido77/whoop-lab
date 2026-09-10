/**
 * Language detection and persistence. Deliberately free of React and of the
 * store, so `src/state/store.ts` can import it without a cycle.
 */

export type Lang = 'es' | 'en';

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
];

const KEY = 'whoop-lab:lang';

const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en';

/**
 * Spanish stays the default: the project is written in Spanish and its docs are
 * in Spanish, so English is the deliberate opt-in that `navigator.language`
 * grants, not the fallback for everyone whose browser we fail to read.
 */
export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'es';
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  return tags.some((t) => t?.toLowerCase().startsWith('en')) ? 'en' : 'es';
}

/** A manual choice wins over the browser, and survives a reload. */
export function readStoredLang(): Lang | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isLang(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Private mode, or storage denied. The switcher still works for this session.
  }
}

export const initialLang = (): Lang => readStoredLang() ?? detectLang();
