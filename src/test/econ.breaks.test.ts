import { describe, expect, it } from 'vitest';
import {
  changePoints,
  cusum,
  type ChangePointsResult,
  type ChangePointSummary,
  type CusumResult,
  type CusumSummary,
} from '@/lib/econ';
import { gaussian } from './random';

const okCusum = (result: CusumResult): CusumSummary => {
  if (!result.ok) throw new Error(`expected a chart, got n=${result.n}`);
  return result;
};

const okBreaks = (result: ChangePointsResult): ChangePointSummary => {
  if (!result.ok) throw new Error(`expected a segmentation, got n=${result.n}`);
  return result;
};

/** Days `1987-01-01` onward, so a signal can be checked against a real date. */
const days = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(1987, 0, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

/** A stationary stretch, then a level shift of `size` at `at`. */
function step(n: number, at: number, size: number, noise = 1, seed = 3): number[] {
  const g = gaussian(seed);
  return Array.from({ length: n }, (_, i) => (i < at ? 0 : size) + noise * g());
}

describe('cusum — a shift it must find', () => {
  it('signals shortly after a two-sigma step up', () => {
    const values = step(160, 80, 2);
    const chart = okCusum(cusum(values, days(160), { k: 0.5, h: 5, reference: 80 }));
    const first = chart.signals.find((s) => s.side === 'high');
    expect(first).toBeDefined();
    expect(first!.index).toBeGreaterThanOrEqual(80);
    expect(first!.index).toBeLessThan(90);
  });

  it('signals on the low side for a step down', () => {
    const values = step(160, 80, -2);
    const chart = okCusum(cusum(values, days(160), { k: 0.5, h: 5, reference: 80 }));
    const first = chart.signals[0];
    expect(first.side).toBe('low');
    expect(first.index).toBeLessThan(90);
  });

  it('says nothing before the shift', () => {
    const values = step(160, 80, 2);
    const chart = okCusum(cusum(values, days(160), { k: 0.5, h: 5, reference: 80 }));
    expect(chart.signals.filter((s) => s.index < 80)).toEqual([]);
  });

  it('carries the date of every signal', () => {
    const calendar = days(160);
    const chart = okCusum(cusum(step(160, 80, 2), calendar, { k: 0.5, h: 5, reference: 80 }));
    for (const signal of chart.signals) expect(signal.day).toBe(calendar[signal.index]);
  });

  it('holds its peace on a series that never shifts', () => {
    const g = gaussian(9);
    const values = Array.from({ length: 200 }, () => g());
    const chart = okCusum(cusum(values, days(200), { k: 0.5, h: 6 }));
    expect(chart.signals).toEqual([]);
  });

  it('is slower to fire as the slack k grows', () => {
    const values = step(200, 100, 1.2);
    const early = okCusum(cusum(values, days(200), { k: 0.25, h: 5, reference: 100 }));
    const late = okCusum(cusum(values, days(200), { k: 1.0, h: 5, reference: 100 }));
    expect(early.signals[0].index).toBeLessThan(late.signals[0]?.index ?? Infinity);
  });

  it('is slower to fire as the decision interval h grows', () => {
    const values = step(200, 100, 1.5);
    const tight = okCusum(cusum(values, days(200), { k: 0.5, h: 3, reference: 100 }));
    const loose = okCusum(cusum(values, days(200), { k: 0.5, h: 10, reference: 100 }));
    expect(tight.signals[0].index).toBeLessThan(loose.signals[0].index);
  });
});

describe('cusum — bookkeeping', () => {
  it('keeps both accumulators non-negative and one point per day', () => {
    const values = step(120, 60, 2);
    const chart = okCusum(cusum(values, days(120), { reference: 60 }));
    expect(chart.points).toHaveLength(120);
    for (const point of chart.points) {
      expect(point.high).toBeGreaterThanOrEqual(0);
      expect(point.low).toBeGreaterThanOrEqual(0);
    }
  });

  it('restarts the accumulator after it fires, so one shift is not one long alarm', () => {
    const values = step(200, 60, 4);
    const chart = okCusum(cusum(values, days(200), { k: 0.5, h: 5, reference: 60 }));
    const firing = chart.points.find((p) => p.signal === 'high')!;
    expect(chart.points[firing.index + 1].high).toBeLessThan(firing.high);
  });

  it('reports the baseline it standardised against', () => {
    const values = step(120, 60, 2, 1);
    const chart = okCusum(cusum(values, days(120), { reference: 60 }));
    expect(chart.center).toBeCloseTo(values.slice(0, 60).reduce((s, v) => s + v, 0) / 60, 10);
    expect(chart.scale).toBeGreaterThan(0);
  });

  it('steps over holes instead of treating them as zero', () => {
    const values: (number | null)[] = step(120, 60, 3);
    values[10] = null;
    values[11] = null;
    const chart = okCusum(cusum(values, days(120), { reference: 60 }));
    expect(chart.points[10].z).toBeNull();
    expect(chart.points[10].high).toBe(chart.points[9].high);
    expect(chart.n).toBe(118);
  });

  it('switches itself off below the minimum sample', () => {
    const result = cusum(step(10, 5, 2), days(10), { minN: 30 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.missing).toBe(20);
  });

  it('refuses a series with no variation to standardise by', () => {
    expect(cusum(new Array(60).fill(4), days(60)).ok).toBe(false);
  });
});

describe('changePoints — a break at a known place', () => {
  it('finds one break and puts it where the level shifted', () => {
    const found = okBreaks(changePoints(step(120, 60, 5, 0.5), days(120)));
    expect(found.points).toHaveLength(1);
    expect(Math.abs(found.points[0].index - 60)).toBeLessThanOrEqual(2);
  });

  it('reports the mean on each side and the size of the shift', () => {
    const found = okBreaks(changePoints(step(120, 60, 5, 0.5), days(120)));
    const [breakPoint] = found.points;
    expect(breakPoint.before).toBeCloseTo(0, 0);
    expect(breakPoint.after).toBeCloseTo(5, 0);
    expect(breakPoint.delta).toBeCloseTo(breakPoint.after - breakPoint.before, 10);
  });

  it('dates the break', () => {
    const calendar = days(120);
    const found = okBreaks(changePoints(step(120, 60, 5, 0.5), calendar));
    expect(found.points[0].day).toBe(calendar[found.points[0].index]);
  });

  it('finds both breaks in a three-regime series', () => {
    const g = gaussian(19);
    const values = Array.from({ length: 240 }, (_, i) => {
      const level = i < 80 ? 0 : i < 160 ? 6 : 2;
      return level + 0.5 * g();
    });
    const found = okBreaks(changePoints(values, days(240)));
    expect(found.points).toHaveLength(2);
    const at = found.points.map((p) => p.index).sort((a, b) => a - b);
    expect(Math.abs(at[0] - 80)).toBeLessThanOrEqual(3);
    expect(Math.abs(at[1] - 160)).toBeLessThanOrEqual(3);
  });

  it('returns the breaks in chronological order', () => {
    const g = gaussian(29);
    const values = Array.from(
      { length: 240 },
      (_, i) => (i < 80 ? 0 : i < 160 ? 6 : 2) + 0.5 * g(),
    );
    const found = okBreaks(changePoints(values, days(240)));
    for (let i = 1; i < found.points.length; i++) {
      expect(found.points[i].index).toBeGreaterThan(found.points[i - 1].index);
    }
  });

  it('finds nothing in a series with no break', () => {
    const g = gaussian(37);
    const values = Array.from({ length: 200 }, () => 50 + 3 * g());
    expect(okBreaks(changePoints(values, days(200))).points).toEqual([]);
  });

  /**
   * A trend has no level shift in it, so segmentation approximates one with a
   * staircase — that is the model, not a defect, and the panel subtitle has to
   * say it looks for steps and not slopes. What it must never do is flap: every
   * step of an upward drift goes up.
   */
  it('approximates a trend with a staircase that only climbs', () => {
    const g = gaussian(47);
    const values = Array.from({ length: 200 }, (_, i) => i * 0.05 + 0.4 * g());
    const found = okBreaks(changePoints(values, days(200)));
    expect(found.points.length).toBeGreaterThan(0);
    for (const point of found.points) expect(point.delta).toBeGreaterThan(0);
  });
});

describe('changePoints — gaps and limits', () => {
  it('indexes the break in the original series, gaps included', () => {
    const values: (number | null)[] = step(120, 60, 5, 0.5);
    for (let i = 20; i < 30; i++) values[i] = null;
    const found = okBreaks(changePoints(values, days(120)));
    expect(found.points).toHaveLength(1);
    expect(Math.abs(found.points[0].index - 60)).toBeLessThanOrEqual(3);
    expect(found.n).toBe(110);
  });

  it('never splits off a segment shorter than minSegment', () => {
    const found = okBreaks(changePoints(step(120, 60, 5, 0.5), days(120), { minSegment: 20 }));
    const edges = [0, ...found.points.map((p) => p.index), 120];
    for (let i = 1; i < edges.length; i++)
      expect(edges[i] - edges[i - 1]).toBeGreaterThanOrEqual(20);
  });

  it('stops at maxPoints', () => {
    const g = gaussian(59);
    const values = Array.from({ length: 400 }, (_, i) => Math.floor(i / 50) * 4 + 0.4 * g());
    expect(okBreaks(changePoints(values, days(400), { maxPoints: 2 })).points).toHaveLength(2);
  });

  it('switches itself off below the minimum sample', () => {
    const result = changePoints(step(12, 6, 5), days(12), { minN: 40 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.n).toBe(12);
    expect(result.missing).toBe(28);
  });
});
