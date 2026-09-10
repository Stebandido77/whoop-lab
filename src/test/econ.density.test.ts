import { describe, expect, it } from 'vitest';
import {
  densityPeaks,
  histogram,
  interquartileRange,
  kernelDensity,
  silvermanBandwidth,
  silvermanModality,
  supportGaps,
} from '@/lib/econ';
import { gaussian, lcg } from './random';

/** A sample with the answer put in by hand: two humps `apart` standard deviations away. */
function mixture(perGroup: number, apart: number, seed = 7): number[] {
  const z = gaussian(seed);
  const out: number[] = [];
  for (let i = 0; i < perGroup; i++) out.push(z());
  for (let i = 0; i < perGroup; i++) out.push(apart + z());
  return out;
}

const normalSample = (n: number, seed = 11): number[] => {
  const z = gaussian(seed);
  return Array.from({ length: n }, () => 10 + 2 * z());
};

describe('histogram', () => {
  it('keeps every observation, including the one on the top edge', () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = histogram(values, { bins: 5 });
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(values.length);
    expect(bins[bins.length - 1].to).toBeCloseTo(10, 10);
  });

  it('integrates to one', () => {
    const bins = histogram(normalSample(500));
    const area = bins.reduce((s, b) => s + b.density * (b.to - b.from), 0);
    expect(area).toBeCloseTo(1, 6);
  });

  it('picks more bins for a wider sample, and stays inside its own limits', () => {
    expect(histogram(normalSample(2000)).length).toBeGreaterThan(histogram([1, 2, 3, 4]).length);
    for (const sample of [normalSample(50), normalSample(5000), mixture(2000, 8)]) {
      const count = histogram(sample).length;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(60);
    }
  });

  it('survives a constant series without dividing by zero', () => {
    const bins = histogram([3, 3, 3, 3]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(4);
  });
});

describe('silvermanBandwidth', () => {
  it('matches 0.9·σ·n^(−1/5) on a clean normal sample', () => {
    const n = 4000;
    const sample = normalSample(n, 3);
    // σ = 2 by construction; the IQR route gives the same scale for a normal.
    expect(silvermanBandwidth(sample)).toBeCloseTo(0.9 * 2 * Math.pow(n, -1 / 5), 1);
  });

  it('takes the IQR when a long tail inflates the standard deviation', () => {
    const base = normalSample(500, 23);
    const withOutliers = [...base, 400, 500, 600];
    // The outliers roughly double sd; the quartiles do not move.
    expect(silvermanBandwidth(withOutliers)).toBeLessThan(2 * silvermanBandwidth(base));
  });

  it('is driven by the standard deviation on a separated mixture, not the IQR', () => {
    // The guard is against heavy tails, not against bimodality: on two humps ten
    // apart the quartiles straddle the gap, so IQR/1.34 is the *larger* of the
    // two and sd wins. The rule of thumb therefore oversmooths a bimodal sample,
    // which is the whole reason the test below searches over bandwidths instead
    // of trusting this one.
    const sample = mixture(500, 10);
    const sd = 0.9 * Math.sqrt(1 + 25) * Math.pow(1000, -1 / 5);
    expect(silvermanBandwidth(sample)).toBeLessThan(sd);
    expect(silvermanBandwidth(sample)).toBeGreaterThan(0.5 * sd);
    // Even oversmoothed, humps that far apart still show as two.
    expect(densityPeaks(kernelDensity(sample).points)).toHaveLength(2);
  });

  it('is zero for a sample with no spread, rather than NaN', () => {
    expect(silvermanBandwidth([2, 2, 2])).toBe(0);
  });
});

describe('interquartileRange', () => {
  it('is the distance between the quartiles of a uniform grid', () => {
    const values = Array.from({ length: 101 }, (_, i) => i);
    expect(interquartileRange(values)).toBeCloseTo(50, 6);
  });
});

describe('kernelDensity', () => {
  it('integrates to one over the padded grid', () => {
    const { points } = kernelDensity(normalSample(800));
    const step = points[1].x - points[0].x;
    const area = points.reduce((s, p) => s + p.y * step, 0);
    expect(area).toBeCloseTo(1, 2);
  });

  it('puts its single peak at the mean of a normal sample', () => {
    const { points } = kernelDensity(normalSample(3000, 5));
    const peaks = densityPeaks(points);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].x).toBeCloseTo(10, 0);
  });

  it('finds both humps of a well-separated mixture', () => {
    const peaks = densityPeaks(kernelDensity(mixture(400, 8)).points);
    expect(peaks).toHaveLength(2);
    const xs = peaks.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 0);
    expect(xs[1]).toBeCloseTo(8, 0);
  });

  it('ranks peaks by height', () => {
    const z = gaussian(21);
    const sample = [
      ...Array.from({ length: 600 }, () => z()),
      ...Array.from({ length: 150 }, () => 10 + z()),
    ];
    const peaks = densityPeaks(kernelDensity(sample).points);
    expect(peaks).toHaveLength(2);
    const tallest = peaks.find((p) => p.rank === 0)!;
    expect(tallest.x).toBeCloseTo(0, 0);
  });

  it('loses the second mode as the bandwidth grows, and never regains it', () => {
    const sample = mixture(300, 4);
    let previous = Infinity;
    for (const bandwidth of [0.15, 0.3, 0.6, 1.2, 2.4, 4.8]) {
      const modes = densityPeaks(kernelDensity(sample, { bandwidth }).points).length;
      expect(modes).toBeLessThanOrEqual(previous);
      previous = modes;
    }
    expect(previous).toBe(1);
  });
});

describe('silvermanModality', () => {
  it('switches off below its minimum sample', () => {
    const result = silvermanModality(normalSample(30), { minN: 60 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.n).toBe(30);
      expect(result.missing).toBe(30);
    }
  });

  it('rejects unimodality on a clearly bimodal sample', () => {
    const result = silvermanModality(mixture(150, 6), { replicates: 120 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modes).toBe(2);
    expect(result.p).toBeLessThan(0.05);
    expect(result.separation).toBeGreaterThan(0.8);
    expect(result.antimode!.x).toBeGreaterThan(1);
    expect(result.antimode!.x).toBeLessThan(5);
  });

  it('does not reject unimodality on a normal sample', () => {
    const result = silvermanModality(normalSample(400, 17), { replicates: 120 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modes).toBe(1);
    expect(result.p).toBeGreaterThan(0.1);
    expect(result.separation).toBeNull();
  });

  it('does not reject on a skewed but unimodal sample', () => {
    // Exponential: one mode, a long right tail, and no symmetry to lean on.
    const u = lcg(29);
    const sample = Array.from({ length: 400 }, () => -Math.log(Math.max(1e-12, u())));
    const result = silvermanModality(sample, { replicates: 120 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.p).toBeGreaterThan(0.1);
  });

  it('needs a bigger critical bandwidth the further apart the humps are', () => {
    const near = silvermanModality(mixture(200, 3, 31), { replicates: 40 });
    const far = silvermanModality(mixture(200, 9, 31), { replicates: 40 });
    expect(near.ok && far.ok).toBe(true);
    if (!near.ok || !far.ok) return;
    expect(far.criticalBandwidth).toBeGreaterThan(near.criticalBandwidth);
  });

  it('gives the same answer twice for the same data', () => {
    const sample = mixture(120, 5, 41);
    const a = silvermanModality(sample, { replicates: 60 });
    const b = silvermanModality(sample, { replicates: 60 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.p).toBe(b.p);
      expect(a.criticalBandwidth).toBe(b.criticalBandwidth);
    }
  });

  it('never reports p = 0, because 200 draws cannot establish one', () => {
    const result = silvermanModality(mixture(300, 12, 47), { replicates: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.p).toBeGreaterThan(0);
  });
});

describe('supportGaps', () => {
  it('finds an empty band and reports the observations on both sides of it', () => {
    const values = [
      ...Array.from({ length: 40 }, (_, i) => 4 + i * 0.02),
      ...Array.from({ length: 40 }, (_, i) => 11 + i * 0.02),
    ];
    const { widest, gaps } = supportGaps(values);
    expect(gaps).toHaveLength(1);
    expect(widest!.from).toBeCloseTo(4.78, 6);
    expect(widest!.to).toBeCloseTo(11, 6);
    expect(widest!.share).toBeCloseTo(6.22 / 7.78, 6);
  });

  it('finds nothing in an evenly covered range', () => {
    const values = Array.from({ length: 200 }, (_, i) => i / 199);
    expect(supportGaps(values).gaps).toHaveLength(0);
  });

  it('respects minShare', () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12];
    expect(supportGaps(values, { minShare: 0.5 }).gaps).toHaveLength(0);
    expect(supportGaps(values, { minShare: 0.2 }).gaps).toHaveLength(1);
  });

  it('sorts by width so the widest comes first', () => {
    const { gaps, widest } = supportGaps([0, 1, 5, 6, 20], { minShare: 0.1 });
    expect(gaps.map((g) => g.width)).toEqual([...gaps.map((g) => g.width)].sort((a, b) => b - a));
    expect(widest).toBe(gaps[0]);
  });

  it('says nothing about a constant series instead of dividing by zero', () => {
    const result = supportGaps([5, 5, 5, 5]);
    expect(result.gaps).toHaveLength(0);
    expect(result.min).toBe(5);
  });

  it('ignores nulls rather than treating them as zero', () => {
    expect(supportGaps([0, null, 1, undefined, 2]).n).toBe(3);
  });
});
