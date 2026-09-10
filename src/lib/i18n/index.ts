import { useStore } from '@/state/store';
import { en } from './en';
import { es, type Messages } from './es';
import type { Lang } from './core';

export type { Messages } from './es';
export * from './core';

const CATALOGUES: Record<Lang, Messages> = { es, en };

export const messagesFor = (lang: Lang): Messages => CATALOGUES[lang];

/**
 * The active catalogue. A hook rather than a module-level read so that switching
 * language re-renders every component that prints a word — which, since the
 * subtitles are the product, is nearly all of them.
 */
export function useMessages(): Messages {
  return CATALOGUES[useStore((s) => s.lang)];
}
