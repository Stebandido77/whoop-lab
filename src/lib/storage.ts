import { del, get, set } from 'idb-keyval';
import type { WhoopExport } from './whoop/types';

const KEY = 'whoop-lab:export:v1';

const DATE_FIELDS = new Set(['start', 'end', 'sleepOnset', 'wakeOnset', 'onset', 'wake']);

/**
 * IndexedDB rather than localStorage: a multi-year journal is comfortably past
 * the 5 MB localStorage budget, and structured clone keeps Dates intact for
 * browsers that support it. The revive pass covers the ones that don't.
 */
export async function saveExport(data: WhoopExport): Promise<void> {
  await set(KEY, data);
}

export async function loadExport(): Promise<WhoopExport | null> {
  const raw = await get<WhoopExport>(KEY);
  if (!raw?.cycles) return null;
  const lists = [raw.cycles, raw.sleeps, raw.workouts] as unknown as Record<string, unknown>[][];
  for (const list of lists) {
    for (const row of list) {
      for (const field of Object.keys(row)) {
        if (DATE_FIELDS.has(field) && typeof row[field] === 'string') {
          row[field] = new Date(row[field] as string);
        }
      }
    }
  }
  return raw;
}

export const clearExport = () => del(KEY);
