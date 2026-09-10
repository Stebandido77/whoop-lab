import { describe, expect, it } from 'vitest';
import { COLUMNS, resolveSpans, type LayoutItem } from '@/components/panelLayout';
import { bindingVariable, describeVariables, forecastSwitchOn } from '@/lib/metrics';
import { buildDayRecords } from '@/lib/whoop/model';
import { generateDemoExport } from '@/lib/demo';
import type { DayRecord } from '@/lib/whoop/types';

const on = (desired: number): LayoutItem => ({ desired, off: false });
const off = (desired: number): LayoutItem => ({ desired, off: true });

/** Every row the resolver produces has to add up to exactly twelve. */
function rows(spans: number[]): number[][] {
  const out: number[][] = [];
  let row: number[] = [];
  let used = 0;
  spans.forEach((span, i) => {
    // Mirror the grid's own packing: a row closes when the next item cannot fit.
    if (used + span > COLUMNS) {
      out.push(row);
      row = [];
      used = 0;
    }
    row.push(i);
    used += span;
  });
  if (row.length) out.push(row);
  return out;
}

const widths = (items: LayoutItem[]) => {
  const spans = resolveSpans(items);
  return rows(spans).map((row) => row.reduce((sum, i) => sum + spans[i], 0));
};

describe('resolveSpans', () => {
  it('leaves a lone panel the full width whatever it asked for', () => {
    expect(resolveSpans([on(7)])).toEqual([12]);
    expect(resolveSpans([on(5)])).toEqual([12]);
    expect(resolveSpans([on(12)])).toEqual([12]);
  });

  it('leaves a row that already fills twelve alone', () => {
    expect(resolveSpans([on(7), on(5)])).toEqual([7, 5]);
    expect(resolveSpans([on(6), on(6)])).toEqual([6, 6]);
  });

  it('shares the slack of a short row among its members', () => {
    expect(resolveSpans([on(3), on(3), on(3)])).toEqual([4, 4, 4]);
    expect(resolveSpans([on(5), on(5)])).toEqual([6, 6]);
  });

  it('gives the live panel the whole row when its neighbour is switched off', () => {
    // The case from the bug report: a live span-5 beside an off span-7.
    expect(resolveSpans([off(7), on(5)])).toEqual([12, 12]);
    expect(resolveSpans([on(5), off(7)])).toEqual([12, 12]);
  });

  it('groups consecutive switched-off panels onto one row', () => {
    expect(resolveSpans([off(12), off(12)])).toEqual([6, 6]);
    expect(resolveSpans([off(6), off(6), off(6)])).toEqual([4, 4, 4]);
  });

  it('fills the last row of a group that does not divide evenly', () => {
    // Five off panels: four at a time, then the two left over widen to fill.
    expect(widths(Array.from({ length: 5 }, () => off(12)))).toEqual([12, 12]);
  });

  it('never leaves a hole, for any mixture of states', () => {
    const shapes = [3, 4, 5, 6, 7, 8, 12];
    for (let seed = 0; seed < 400; seed++) {
      const count = 1 + (seed % 9);
      const items: LayoutItem[] = Array.from({ length: count }, (_, i) => ({
        desired: shapes[(seed * 7 + i * 3) % shapes.length],
        off: ((seed >> i) & 1) === 1,
      }));
      for (const width of widths(items)) expect(width).toBe(COLUMNS);
    }
  });

  it('never changes the order of the panels', () => {
    const items = [on(6), off(6), on(3), on(3)];
    expect(resolveSpans(items)).toHaveLength(items.length);
  });

  it('keeps every span inside the grid', () => {
    for (const items of [[on(12), off(12), on(7)], [off(3)], [on(8), on(8), on(8)]]) {
      for (const span of resolveSpans(items)) {
        expect(span).toBeGreaterThanOrEqual(1);
        expect(span).toBeLessThanOrEqual(COLUMNS);
      }
    }
  });

  it('handles an empty grid', () => {
    expect(resolveSpans([])).toEqual([]);
  });
});

describe('forecastSwitchOn', () => {
  const today = new Date(2026, 8, 10); // 10 Sept 2026

  it('counts forward one day per missing day when the window has room', () => {
    const forecast = forecastSwitchOn({ missing: 20, minN: 60, range: 0, totalDays: 40, today });
    expect(forecast.kind).toBe('date');
    if (forecast.kind === 'date') expect(forecast.day).toBe('2026-09-30');
  });

  it('says the range is too short rather than naming a day that never comes', () => {
    // A 30-day window can never hold 60 complete days, however long you wait.
    expect(forecastSwitchOn({ missing: 4, minN: 60, range: 30, totalDays: 20, today }).kind).toBe(
      'range',
    );
  });

  it('says the window is full when a new day would push an old one out', () => {
    expect(forecastSwitchOn({ missing: 4, minN: 60, range: 90, totalDays: 90, today }).kind).toBe(
      'window',
    );
    expect(forecastSwitchOn({ missing: 4, minN: 60, range: 90, totalDays: 200, today }).kind).toBe(
      'window',
    );
  });

  it('counts forward on a window that is not full yet, which is the common case', () => {
    const forecast = forecastSwitchOn({ missing: 2, minN: 60, range: 90, totalDays: 58, today });
    expect(forecast.kind).toBe('date');
    if (forecast.kind === 'date') expect(forecast.day).toBe('2026-09-12');
  });

  it('crosses a month boundary as a calendar does', () => {
    const forecast = forecastSwitchOn({
      missing: 94,
      minN: 150,
      range: 0,
      totalDays: 56,
      today: new Date(2026, 8, 10),
    });
    if (forecast.kind === 'date') expect(forecast.day).toBe('2026-12-13');
  });
});

describe('describeVariables', () => {
  const days: DayRecord[] = buildDayRecords(generateDemoExport(120));

  it('reports coverage and shape for each variable asked for', () => {
    const [recovery] = describeVariables(days, ['recovery']);
    expect(recovery.id).toBe('recovery');
    expect(recovery.n + recovery.missing).toBe(days.length);
    expect(recovery.mean).toBeGreaterThan(0);
    expect(recovery.sd).toBeGreaterThan(0);
  });

  it('puts a variable in its display unit, not its stored one', () => {
    const withValue = days.find((d) => d.bedtime != null)!;
    const [bedtime] = describeVariables([withValue], ['bedtime']);
    // Stored as minutes past midnight, shown as hours.
    expect(bedtime.mean).toBeCloseTo(withValue.bedtime! / 60, 6);
  });

  it('counts a column of nulls as missing rather than as zeroes', () => {
    const blank = days.map((d) => ({ ...d, skinTemp: null }));
    const [skin] = describeVariables(blank, ['skinTemp']);
    expect(skin.n).toBe(0);
    expect(skin.missing).toBe(blank.length);
    expect(skin.mean).toBeNull();
  });
});

describe('bindingVariable', () => {
  const base: DayRecord[] = buildDayRecords(generateDemoExport(120));

  it('names the one column that is costing the rows', () => {
    const days = base.map((d, i) => ({ ...d, skinTemp: i < 10 ? d.skinTemp : null }));
    const binding = bindingVariable(days, ['recovery', 'sleepHours', 'skinTemp'], 60);
    expect(binding?.id).toBe('skinTemp');
    expect(binding?.without).toBeGreaterThan(binding!.current);
    expect(binding?.decisive).toBe(true);
  });

  it('says so when dropping the worst one still would not be enough', () => {
    const days = base.slice(0, 30).map((d, i) => ({ ...d, skinTemp: i < 2 ? d.skinTemp : null }));
    const binding = bindingVariable(days, ['recovery', 'sleepHours', 'skinTemp'], 150);
    expect(binding?.id).toBe('skinTemp');
    expect(binding?.decisive).toBe(false);
  });

  it('finds nothing when every variable is equally complete', () => {
    expect(bindingVariable(base, ['recovery', 'recovery'], 10)).toBeNull();
  });

  it('needs at least two variables to have a bottleneck at all', () => {
    expect(bindingVariable(base, ['recovery'], 10)).toBeNull();
    expect(bindingVariable(base, [], 10)).toBeNull();
  });
});
