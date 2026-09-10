import { describe, expect, it } from 'vitest';
import { lombScargle, type Periodogram, type PeriodogramResult } from '@/lib/econ';
import { gaussian, lcg } from './random';

const ok = (result: PeriodogramResult): Periodogram => {
  if (!result.ok) throw new Error(`expected a periodogram, got n=${result.n}`);
  return result;
};

/** A sinusoid of known period, sampled once a day. */
function wave(n: number, period: number, amplitude = 1, noise = 0.4, seed = 5) {
  const g = gaussian(seed);
  const times = Array.from({ length: n }, (_, i) => i);
  const values = times.map((t) => amplitude * Math.sin((2 * Math.PI * t) / period) + noise * g());
  return { times, values };
}

describe('lombScargle — a period it must find', () => {
  it('recovers a weekly cycle', () => {
    const { times, values } = wave(240, 7);
    const spectrum = ok(lombScargle(times, values));
    expect(spectrum.peak).not.toBeNull();
    expect(Math.abs(spectrum.peak!.period - 7)).toBeLessThan(0.2);
  });

  it('recovers a monthly cycle', () => {
    const { times, values } = wave(365, 28);
    const spectrum = ok(lombScargle(times, values));
    expect(Math.abs(spectrum.peak!.period - 28)).toBeLessThan(1);
  });

  it('calls a real cycle significant', () => {
    const { times, values } = wave(240, 7);
    const spectrum = ok(lombScargle(times, values, { faProbability: 0.01 }));
    expect(spectrum.peak!.fap).toBeLessThan(1e-6);
    expect(spectrum.peak!.power).toBeGreaterThan(spectrum.faLevel);
  });

  it('puts most of a noiseless sinusoid into one peak', () => {
    const { times, values } = wave(200, 7, 1, 0);
    const spectrum = ok(lombScargle(times, values));
    expect(spectrum.peak!.power).toBeGreaterThan(values.length / 4);
  });

  /** The reason for Lomb–Scargle rather than an FFT: the export has holes. */
  it('still finds the cycle when a third of the days are missing', () => {
    const u = lcg(71);
    const { times, values } = wave(300, 7);
    const gapped = values.map((v) => (u() < 0.33 ? null : v));
    const spectrum = ok(lombScargle(times, gapped));
    expect(Math.abs(spectrum.peak!.period - 7)).toBeLessThan(0.25);
    expect(spectrum.n).toBeLessThan(260);
    expect(spectrum.peak!.fap).toBeLessThan(0.001);
  });

  it('finds the cycle on unevenly spaced observations', () => {
    const u = lcg(83);
    const times: number[] = [];
    let t = 0;
    while (times.length < 220) {
      t += 0.5 + 2 * u();
      times.push(t);
    }
    const values = times.map((time) => Math.sin((2 * Math.PI * time) / 7));
    const spectrum = ok(lombScargle(times, values));
    expect(Math.abs(spectrum.peak!.period - 7)).toBeLessThan(0.2);
  });
});

describe('lombScargle — a period it must not find', () => {
  it('does not call a peak in white noise significant', () => {
    const g = gaussian(101);
    const times = Array.from({ length: 200 }, (_, i) => i);
    const values = times.map(() => g());
    const spectrum = ok(lombScargle(times, values, { faProbability: 0.05 }));
    expect(spectrum.peak!.fap).toBeGreaterThan(0.05);
    expect(spectrum.peak!.power).toBeLessThan(spectrum.faLevel);
  });

  it('sets a higher bar as the false-alarm probability tightens', () => {
    const g = gaussian(103);
    const times = Array.from({ length: 200 }, (_, i) => i);
    const values = times.map(() => g());
    const loose = ok(lombScargle(times, values, { faProbability: 0.1 }));
    const strict = ok(lombScargle(times, values, { faProbability: 0.001 }));
    expect(strict.faLevel).toBeGreaterThan(loose.faLevel);
  });

  it('charges for every frequency it looked at', () => {
    const { times, values } = wave(240, 7);
    const spectrum = ok(lombScargle(times, values));
    expect(spectrum.independentFrequencies).toBeGreaterThan(1);
    // A single-frequency test has tail e⁻ᶻ; looking at M of them can only make
    // a peak of the same height less surprising, never more.
    const single = Math.exp(-spectrum.peak!.power);
    expect(spectrum.peak!.fap).toBeGreaterThanOrEqual(single);
  });
});

describe('lombScargle — the grid and the bookkeeping', () => {
  it('returns points in ascending period, with frequency as its reciprocal', () => {
    const { times, values } = wave(150, 7);
    const spectrum = ok(lombScargle(times, values));
    for (let i = 1; i < spectrum.points.length; i++) {
      expect(spectrum.points[i].period).toBeGreaterThan(spectrum.points[i - 1].period);
    }
    for (const point of spectrum.points) {
      expect(point.frequency).toBeCloseTo(1 / point.period, 10);
      expect(point.power).toBeGreaterThanOrEqual(0);
    }
  });

  it('honours the period window it was given', () => {
    const { times, values } = wave(200, 7);
    const spectrum = ok(lombScargle(times, values, { minPeriod: 3, maxPeriod: 20 }));
    for (const point of spectrum.points) {
      expect(point.period).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(point.period).toBeLessThanOrEqual(20 + 1e-9);
    }
  });

  it('never looks below the Nyquist period of daily sampling', () => {
    const { times, values } = wave(200, 7);
    const spectrum = ok(lombScargle(times, values));
    expect(Math.min(...spectrum.points.map((p) => p.period))).toBeGreaterThanOrEqual(2);
  });

  it('counts only the days that carried a value', () => {
    const { times, values } = wave(150, 7);
    const gapped: (number | null)[] = [...values];
    gapped[4] = null;
    gapped[9] = null;
    expect(ok(lombScargle(times, gapped)).n).toBe(148);
  });

  it('switches itself off below the minimum sample', () => {
    const { times, values } = wave(10, 7);
    const result = lombScargle(times, values, { minN: 40 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.missing).toBe(30);
  });

  it('refuses a flat series with no variance to explain', () => {
    const times = Array.from({ length: 90 }, (_, i) => i);
    expect(lombScargle(times, new Array(90).fill(3)).ok).toBe(false);
  });
});
