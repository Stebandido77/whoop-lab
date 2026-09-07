import { create } from 'zustand';
import { buildDayRecords, journalQuestions } from '@/lib/whoop/model';
import { emptyExport, type DayRecord, type WhoopExport } from '@/lib/whoop/types';
import { clearExport, saveExport } from '@/lib/storage';

export type RangeDays = 30 | 90 | 180 | 365 | 0;
export type TabId = 'overview' | 'recovery' | 'sleep' | 'training' | 'habits' | 'data';

export const RANGES: { value: RangeDays; label: string }[] = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '1a' },
  { value: 0, label: 'Todo' },
];

export const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'recovery', label: 'Recuperación' },
  { id: 'sleep', label: 'Sueño' },
  { id: 'training', label: 'Entrenamiento' },
  { id: 'habits', label: 'Hábitos' },
  { id: 'data', label: 'Datos' },
];

interface State {
  raw: WhoopExport;
  allDays: DayRecord[];
  questions: string[];
  range: RangeDays;
  tab: TabId;
  isDemo: boolean;
  loaded: boolean;
  setExport: (data: WhoopExport, options?: { demo?: boolean; persist?: boolean }) => void;
  setRange: (range: RangeDays) => void;
  setTab: (tab: TabId) => void;
  reset: () => void;
}

export const useStore = create<State>((set) => ({
  raw: emptyExport(),
  allDays: [],
  questions: [],
  range: 365,
  tab: 'overview',
  isDemo: false,
  loaded: false,
  setExport: (data, options) => {
    if (options?.persist) void saveExport(data);
    set({
      raw: data,
      allDays: buildDayRecords(data),
      questions: journalQuestions(data),
      isDemo: options?.demo ?? false,
      loaded: true,
    });
  },
  setRange: (range) => set({ range }),
  setTab: (tab) => set({ tab }),
  reset: () => {
    void clearExport();
    set({
      raw: emptyExport(),
      allDays: [],
      questions: [],
      isDemo: false,
      loaded: false,
      tab: 'overview',
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
