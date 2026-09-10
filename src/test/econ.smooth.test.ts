import { describe, expect, it } from 'vitest';
import { binscatter, loess } from '@/lib/econ';
import { gaussian, lcg } from './random';

function linearCloud(n: number, slope = 2, noise = 5, seed = 23) {
  const u = lcg(seed);
  const g = gaussian(seed + 1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = u() * 100;
    xs.push(x);
    ys.push(slope * x + noise * g());
  }
  return { xs, ys };
}

describe('binscatter', () => {
  it('splits the cloud into equal-count quantile bins', () => {
    const { xs, ys } = linearCloud(500);
    const bins = binscatter(xs, ys, { bins: 10 });
    expect(bins).toHaveLength(10);
    for (const bin of bins) expect(bin.n).toBe(50);
    expect(bins.reduce((s, b) => s + b.n, 0)).toBe(500);
  });

  it('orders the bins by x and reports the mean inside each', () => {
    const { xs, ys } = linearCloud(500);
    const bins = binscatter(xs, ys, { bins: 10 });
    for (let i = 1; i < bins.length; i++) expect(bins[i].x).toBeGreaterThan(bins[i - 1].x);
    for (const bin of bins) {
      expect(bin.x).toBeGreaterThanOrEqual(bin.xLow);
      expect(bin.x).toBeLessThanOrEqual(bin.xHigh);
    }
  });

  it('traces a known linear relationship', () => {
    const { xs, ys } = linearCloud(2000, 2, 5);
    for (const bin of binscatter(xs, ys, { bins: 20 })) {
      // Each bin averages ~100 points, so its mean sits within a few SE of 2x.
      expect(Math.abs(bin.y - 2 * bin.x)).toBeLessThan(4 * bin.se);
    }
  });

  it('computes the standard error of the bin mean', () => {
    const { xs, ys } = linearCloud(500);
    const bins = binscatter(xs, ys, { bins: 10 });
    const sorted = xs.map((x, i) => ({ x, y: ys[i] })).sort((a, b) => a.x - b.x);
    const first = sorted.slice(0, 50).map((p) => p.y);
    const mean = first.reduce((s, v) => s + v, 0) / first.length;
    const variance = first.reduce((s, v) => s + (v - mean) ** 2, 0) / (first.length - 1);
    expect(bins[0].y).toBeCloseTo(mean, 10);
    expect(bins[0].se).toBeCloseTo(Math.sqrt(variance / first.length), 10);
  });

  it('carries a confidence interval around every bin', () => {
    const { xs, ys } = linearCloud(500);
    for (const bin of binscatter(xs, ys, { bins: 10 })) {
      expect(bin.ciLow).toBeLessThan(bin.y);
      expect(bin.ciHigh).toBeGreaterThan(bin.y);
      expect(bin.ciHigh - bin.y).toBeGreaterThan(bin.se);
    }
  });

  /** The reason to bin at all: a single slope would hide the curvature. */
  it('shows curvature that a straight line would flatten', () => {
    const u = lcg(77);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 800; i++) {
      const x = u() * 10;
      xs.push(x);
      ys.push((x - 5) ** 2);
    }
    const bins = binscatter(xs, ys, { bins: 10 });
    expect(bins[0].y).toBeGreaterThan(bins[4].y);
    expect(bins[9].y).toBeGreaterThan(bins[5].y);
  });

  it('uses pairwise-complete observations only', () => {
    const xs: (number | null)[] = [1, 2, null, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const ys: (number | null)[] = [1, 2, 3, null, 5, 6, 7, 8, 9, 10, 11, 12];
    const bins = binscatter(xs, ys, { bins: 2, minPerBin: 2 });
    expect(bins.reduce((s, b) => s + b.n, 0)).toBe(10);
  });

  it('drops a bin too thin to carry a standard error', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [1, 2, 3, 4, 5];
    expect(binscatter(xs, ys, { bins: 5, minPerBin: 3 })).toEqual([]);
  });

  it('returns nothing rather than a bin of one', () => {
    expect(binscatter([1], [1], { bins: 4 })).toEqual([]);
  });
});

describe('loess', () => {
  /** Local *linear* smoothing reproduces a global line exactly, at any bandwidth. */
  it('reproduces a straight line without bias', () => {
    const xs = Array.from({ length: 120 }, (_, i) => i * 0.5);
    const ys = xs.map((x) => 3 * x + 1);
    for (const bandwidth of [0.15, 0.4, 0.9]) {
      for (const point of loess(xs, ys, { bandwidth })) {
        expect(point.y).toBeCloseTo(3 * point.x + 1, 8);
      }
    }
  });

  it('recovers a known curve through noise', () => {
    const g = gaussian(31);
    const xs = Array.from({ length: 400 }, (_, i) => (i / 400) * 4 * Math.PI);
    const ys = xs.map((x) => Math.sin(x) + 0.2 * g());
    const curve = loess(xs, ys, { bandwidth: 0.12, points: 80 });
    const interior = curve.slice(6, -6);
    for (const point of interior) {
      expect(Math.abs(point.y - Math.sin(point.x))).toBeLessThan(0.15);
    }
  });

  it('smooths more as the bandwidth grows', () => {
    const g = gaussian(53);
    const xs = Array.from({ length: 300 }, (_, i) => i);
    const ys = xs.map((x) => x * 0.1 + 4 * g());
    // Curvature, not total variation: the trend contributes to the latter in
    // equal measure at every bandwidth and would swamp the comparison.
    const wiggle = (bandwidth: number) => {
      const curve = loess(xs, ys, { bandwidth, points: 100 });
      let total = 0;
      for (let i = 2; i < curve.length; i++) {
        total += Math.abs(curve[i].y - 2 * curve[i - 1].y + curve[i - 2].y);
      }
      return total;
    };
    expect(wiggle(0.8)).toBeLessThan(wiggle(0.15) / 2);
  });

  it('spans the observed range in ascending order', () => {
    const { xs, ys } = linearCloud(200);
    const curve = loess(xs, ys, { points: 40 });
    expect(curve).toHaveLength(40);
    expect(curve[0].x).toBeCloseTo(Math.min(...xs), 8);
    expect(curve[curve.length - 1].x).toBeCloseTo(Math.max(...xs), 8);
    for (let i = 1; i < curve.length; i++) expect(curve[i].x).toBeGreaterThan(curve[i - 1].x);
  });

  it('never returns a value outside the range of the data', () => {
    const g = gaussian(61);
    const xs = Array.from({ length: 200 }, (_, i) => i);
    const ys = xs.map(() => 10 + g());
    for (const point of loess(xs, ys, { bandwidth: 0.3 })) {
      expect(point.y).toBeGreaterThan(Math.min(...ys) - 1);
      expect(point.y).toBeLessThan(Math.max(...ys) + 1);
    }
  });

  it('gives up rather than smooth three points', () => {
    expect(loess([1, 2], [1, 2])).toEqual([]);
  });

  it('survives a column of identical x values', () => {
    const xs = [5, 5, 5, 5, 5, 5, 5, 5];
    const ys = [1, 2, 3, 4, 5, 6, 7, 8];
    const curve = loess(xs, ys);
    for (const point of curve) expect(Number.isFinite(point.y)).toBe(true);
  });
});
