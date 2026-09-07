import { describe, expect, it } from 'vitest';
import { linreg, mean, median, pearson, quantile, rollingMean, sd, welchT } from '@/lib/stats';

describe('descriptives', () => {
  it('ignores nulls', () => {
    expect(mean([1, null, 3])).toBe(2);
    expect(median([5, 1, null, 3])).toBe(3);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it('returns null when there is nothing to average', () => {
    expect(mean([null, undefined])).toBeNull();
    expect(sd([1])).toBeNull();
  });

  it('interpolates quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 6);
  });
});

describe('pearson', () => {
  it('recovers a perfect positive relationship', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(pearson(xs, xs).r).toBeCloseTo(1, 10);
  });

  it('recovers a perfect negative relationship', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(pearson(xs, [...xs].reverse()).r).toBeCloseTo(-1, 10);
  });

  it('refuses to report below the minimum sample', () => {
    expect(pearson([1, 2, 3], [1, 2, 3]).r).toBeNull();
  });

  it('uses pairwise-complete observations only', () => {
    const result = pearson([1, 2, null, 4, 5, 6, 7, 8, 9], [1, 2, 99, 4, 5, 6, 7, 8, 9]);
    expect(result.n).toBe(8);
    expect(result.r).toBeCloseTo(1, 10);
  });

  it('produces a small p-value for a strong relationship', () => {
    const xs = Array.from({ length: 40 }, (_, i) => i);
    const ys = xs.map((x) => 2 * x + (x % 3));
    const { p } = pearson(xs, ys);
    expect(p).not.toBeNull();
    expect(p!).toBeLessThan(0.001);
  });

  it('produces a large p-value for noise', () => {
    const xs = [1, 3, 2, 5, 4, 7, 6, 9, 8, 11];
    const ys = [4, 4, 5, 3, 5, 4, 5, 4, 5, 4];
    const { p } = pearson(xs, ys);
    expect(p!).toBeGreaterThan(0.2);
  });
});

describe('linreg', () => {
  it('finds the slope of a clean line', () => {
    const fit = linreg([0, 1, 2, 3], [1, 3, 5, 7])!;
    expect(fit.slope).toBeCloseTo(2, 10);
    expect(fit.intercept).toBeCloseTo(1, 10);
  });
});

describe('welchT', () => {
  it('is near zero for identical samples', () => {
    const a = [1, 2, 3, 4, 5];
    expect(Math.abs(welchT(a, a)!)).toBeLessThan(1e-9);
  });

  it('is large when the means are far apart', () => {
    expect(Math.abs(welchT([10, 11, 10, 12, 11], [1, 2, 1, 3, 2])!)).toBeGreaterThan(5);
  });
});

describe('rollingMean', () => {
  it('warms up before emitting a value', () => {
    expect(rollingMean([1, 2, 3, 4], 7)).toEqual([null, 1.5, 2, 2.5]);
  });

  it('skips gaps instead of interpolating them', () => {
    const out = rollingMean([1, null, null, null, null, null, null, 8], 3);
    expect(out[4]).toBeNull();
  });
});
