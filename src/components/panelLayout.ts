import { createContext, useContext } from 'react';
import type { DayRecord } from '@/lib/whoop/types';

/**
 * The days the panels in a grid were built from.
 *
 * A switched-off panel wants to say what it *can* say about the variables it
 * would have used, and to do that it needs the rows. Threading `days` through
 * every `<Panel>` in seven views would be forty call sites carrying a prop that
 * matters in one state only, so the grid provides it instead.
 */
export const DaysContext = createContext<DayRecord[]>([]);

export const usePanelDays = (): DayRecord[] => useContext(DaysContext);

export const COLUMNS = 12;

export interface LayoutItem {
  /** Columns the panel asked for. */
  desired: number;
  off: boolean;
}

/**
 * Turn declared spans into spans that leave no hole, in any state.
 *
 * One invariant does all the work: **a row is always exactly twelve columns
 * wide.** Panels are packed in order into rows that fit, and whatever a row is
 * short gets handed back to its members. Every case the old hand-written grids
 * got wrong follows from it — a live panel stranded beside a switched-off one
 * ends up alone in its row and grows to fill it, because a run boundary closes
 * the row.
 *
 * A run of switched-off panels is re-declared narrow so several share a row:
 * their content is a progress bar and a short table now, not a chart. A lone one
 * still takes the full width, as a strip rather than a column of empty.
 *
 * Order is never changed. The sequence of panels is an argument the view is
 * making, and re-sorting it to pack better would rewrite that argument.
 */
export function resolveSpans(items: LayoutItem[]): number[] {
  const desired = items.map((item, i) => {
    if (!item.off) return item.desired;
    let run = 1;
    for (let j = i - 1; j >= 0 && items[j].off; j--) run++;
    for (let j = i + 1; j < items.length && items[j].off; j++) run++;
    return run === 1 ? COLUMNS : run === 2 ? 6 : 4;
  });

  const out = new Array<number>(items.length).fill(COLUMNS);
  let row: number[] = [];
  let used = 0;

  const close = () => {
    if (!row.length) return;
    const slack = COLUMNS - used;
    const each = Math.floor(slack / row.length);
    const extra = slack % row.length;
    row.forEach((index, position) => {
      out[index] = desired[index] + each + (position < extra ? 1 : 0);
    });
    row = [];
    used = 0;
  };

  items.forEach((_, index) => {
    const width = Math.min(COLUMNS, Math.max(1, desired[index]));
    // A run boundary closes the row: a switched-off panel must never share one
    // with a live panel, which is the case that left half the screen empty.
    if (used + width > COLUMNS || (row.length && items[row[0]].off !== items[index].off)) close();
    row.push(index);
    used += width;
  });
  close();

  return out;
}
