import { create } from 'zustand';
import { buildDayRecords, journalQuestions } from '@/lib/whoop/model';
import { emptyExport, type DayRecord, type WhoopExport } from '@/lib/whoop/types';
import { setFormatLocale } from '@/lib/format';
import { initialLang, storeLang, type Lang } from '@/lib/i18n/core';
import type { FamilyTest } from '@/lib/explorer';
import { clearExport, saveExport } from '@/lib/storage';

export type RangeDays = 30 | 90 | 180 | 365 | 0;
export type TabId = 'overview' | 'recovery' | 'sleep' | 'training' | 'habits' | 'models' | 'data';

/**
 * Where the loaded export came from. Only the header caption depends on it, but
 * the person needs to know: reading a chart built from synthetic data, or from
 * a folder on disk, is a different act than reading one built from their own
 * upload.
 */
export type ExportSource = 'file' | 'demo' | 'local';

/** Ids only. The labels live in the message catalogue, keyed by these. */
export const RANGES: RangeDays[] = [30, 90, 180, 365, 0];
export const TABS: TabId[] = [
  'overview',
  'recovery',
  'sleep',
  'training',
  'habits',
  'models',
  'data',
];

/** `0` is the open-ended range, so it cannot be a numeric key. */
export const RANGE_KEYS = {
  30: 'd30',
  90: 'd90',
  180: 'd180',
  365: 'd365',
  0: 'all',
} as const satisfies Record<RangeDays, string>;

interface State {
  raw: WhoopExport;
  allDays: DayRecord[];
  questions: string[];
  range: RangeDays;
  tab: TabId;
  source: ExportSource;
  lang: Lang;
  loaded: boolean;
  /**
   * Every regressor the model explorer has tested this session.
   *
   * It lives in the store and not in the view because it has to outlive the
   * view: the whole point is that the twentieth specification is corrected
   * against the first nineteen, including the ones the reader has navigated away
   * from. Session-scoped on purpose — a reload starts a fresh count, which makes
   * the number a floor on how much searching happened rather than a claim about
   * it. See `docs/metricas.md` §6.10.
   */
  modelFamily: FamilyTest[];
  setExport: (data: WhoopExport, options?: { source?: ExportSource; persist?: boolean }) => void;
  setRange: (range: RangeDays) => void;
  setTab: (tab: TabId) => void;
  setLang: (lang: Lang) => void;
  recordModelRun: (key: string, tests: FamilyTest[]) => void;
  clearModelFamily: () => void;
  reset: () => void;
}

const startingLang = initialLang();
setFormatLocale(startingLang);

export const useStore = create<State>((set) => ({
  raw: emptyExport(),
  allDays: [],
  questions: [],
  range: 365,
  tab: 'overview',
  source: 'file',
  lang: startingLang,
  loaded: false,
  modelFamily: [],
  setExport: (data, options) => {
    if (options?.persist) void saveExport(data);
    set({
      raw: data,
      allDays: buildDayRecords(data),
      questions: journalQuestions(data),
      source: options?.source ?? 'file',
      loaded: true,
    });
  },
  setRange: (range) => set({ range }),
  setTab: (tab) => set({ tab }),
  /**
   * The number locale moves before the state does, so the re-render this
   * triggers already formats with the new decimal separator. Formatters are
   * called from render and read the locale at call time; see `lib/format.ts`.
   */
  setLang: (lang) => {
    setFormatLocale(lang);
    storeLang(lang);
    document.documentElement.lang = lang;
    set({ lang });
  },
  /**
   * Unload whatever is on screen and go back to the import screen. The cached
   * export is cleared only when that is what is being unloaded: a demo link or
   * a folder in `data/` has no business deleting somebody's stored import.
   */
  /**
   * Re-running a specification replaces its tests rather than adding to them.
   *
   * The identity check is load-bearing, not an optimisation: the explorer's fit
   * depends on the family and the family is written from an effect after that
   * fit, so returning a fresh array for an unchanged family would re-run the
   * regression forever.
   */
  recordModelRun: (key, tests) =>
    set((state) => {
      const next = [...state.modelFamily.filter((t) => t.spec !== key), ...tests];
      const unchanged =
        next.length === state.modelFamily.length &&
        next.every((t, i) => {
          const previous = state.modelFamily[i];
          return (
            previous.spec === t.spec &&
            previous.field === t.field &&
            previous.lag === t.lag &&
            previous.p === t.p
          );
        });
      return unchanged ? {} : { modelFamily: next };
    }),
  clearModelFamily: () => set({ modelFamily: [] }),
  reset: () => {
    if (useStore.getState().source === 'file') void clearExport();
    set({
      raw: emptyExport(),
      allDays: [],
      questions: [],
      source: 'file',
      loaded: false,
      tab: 'overview',
      // A different export is a different question; the old search does not
      // apply to it.
      modelFamily: [],
    });
  },
}));

export interface Window {
  /** Days inside the selected range. */
  days: DayRecord[];
  /** The equally long window immediately before it, for period-over-period deltas. */
  previous: DayRecord[];
}

export function selectWindow(allDays: DayRecord[], range: RangeDays): Window {
  if (!range || range >= allDays.length) return { days: allDays, previous: [] };
  return {
    days: allDays.slice(-range),
    previous: allDays.slice(Math.max(0, allDays.length - 2 * range), allDays.length - range),
  };
}
