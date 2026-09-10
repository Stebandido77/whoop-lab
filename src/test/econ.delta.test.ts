import { describe, expect, it } from 'vitest';
import { linearCombination, ols, ratio, type OlsFit } from '@/lib/econ';
import { gaussian } from './random';

/** y = 5 + 3·x1 − 1.5·x2 + noise, so −β₂/β₁ is exactly 0.5. */
function world(n: number, noise: number, seed: number) {
  const g = gaussian(seed);
  const rows: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = g();
    const x2 = 0.4 * x1 + g();
    rows.push([x1, x2]);
    y.push(5 + 3 * x1 - 1.5 * x2 + noise * g());
  }
  return { y, rows, names: ['x1', 'x2'] };
}

const fitOf = (n: number, noise: number, seed: number): OlsFit => {
  const { y, rows, names } = world(n, noise, seed);
  const result = ols(y, rows, { names, vcov: 'hc1' });
  if (!result.ok) throw new Error('expected a fit');
  return result;
};

const indexOf = (fit: OlsFit, name: string) => fit.terms.findIndex((t) => t.name === name);

describe('linearCombination', () => {
  it('reproduces a single coefficient when the weights pick one out', () => {
    const fit = fitOf(300, 1, 5);
    const i = indexOf(fit, 'x1');
    const single = linearCombination(fit, [{ index: i, weight: 1 }]);
    expect(single.coef).toBeCloseTo(fit.terms[i].coef, 12);
    expect(single.se).toBeCloseTo(fit.terms[i].se, 12);
    expect(single.ciLow).toBeCloseTo(fit.terms[i].ciLow, 10);
  });

  it('adds the covariances, not just the variances', () => {
    const fit = fitOf(300, 1, 5);
    const a = indexOf(fit, 'x1');
    const b = indexOf(fit, 'x2');
    const sum = linearCombination(fit, [
      { index: a, weight: 1 },
      { index: b, weight: 1 },
    ]);
    expect(sum.coef).toBeCloseTo(fit.terms[a].coef + fit.terms[b].coef, 12);
    const naive = Math.hypot(fit.terms[a].se, fit.terms[b].se);
    expect(sum.se).not.toBeCloseTo(naive, 6);
    const exact = Math.sqrt(fit.vcov[a][a] + fit.vcov[b][b] + 2 * fit.vcov[a][b]);
    expect(sum.se).toBeCloseTo(exact, 12);
  });

  it('scales with the weights', () => {
    const fit = fitOf(300, 1, 5);
    const i = indexOf(fit, 'x1');
    const doubled = linearCombination(fit, [{ index: i, weight: 2 }]);
    expect(doubled.coef).toBeCloseTo(2 * fit.terms[i].coef, 12);
    expect(doubled.se).toBeCloseTo(2 * fit.terms[i].se, 12);
  });
});

describe('ratio — the delta method', () => {
  it('recovers a known ratio of coefficients', () => {
    const fit = fitOf(600, 1, 9);
    const result = ratio(fit, indexOf(fit, 'x2'), indexOf(fit, 'x1'), { negate: true });
    if (!result.identified) throw new Error('expected an identified ratio');
    expect(Math.abs(result.coef - 0.5)).toBeLessThan(3 * result.se);
  });

  /**
   * The delta method claims the sampling SD of the ratio. The way to check that
   * is to go and measure the sampling SD: across independent replications, the
   * spread of the estimates has to match the standard error it reports.
   */
  it('reports a standard error that matches the spread across replications', () => {
    const estimates: number[] = [];
    const errors: number[] = [];
    for (let r = 0; r < 300; r++) {
      const fit = fitOf(400, 1, 500 + r * 13);
      const result = ratio(fit, indexOf(fit, 'x2'), indexOf(fit, 'x1'), { negate: true });
      if (!result.identified) continue;
      estimates.push(result.coef);
      errors.push(result.se);
    }
    expect(estimates.length).toBeGreaterThan(280);
    const mean = estimates.reduce((s, v) => s + v, 0) / estimates.length;
    const spread = Math.sqrt(
      estimates.reduce((s, v) => s + (v - mean) ** 2, 0) / (estimates.length - 1),
    );
    const claimed = errors.reduce((s, v) => s + v, 0) / errors.length;
    expect(Math.abs(claimed / spread - 1)).toBeLessThan(0.2);
  });

  it('agrees with a numerically differentiated gradient', () => {
    const fit = fitOf(400, 1, 21);
    const a = indexOf(fit, 'x2');
    const b = indexOf(fit, 'x1');
    const result = ratio(fit, a, b, { negate: true });
    if (!result.identified) throw new Error('expected an identified ratio');

    const g = (num: number, den: number) => -num / den;
    const step = 1e-6;
    const num = fit.terms[a].coef;
    const den = fit.terms[b].coef;
    const dNum = (g(num + step, den) - g(num - step, den)) / (2 * step);
    const dDen = (g(num, den + step) - g(num, den - step)) / (2 * step);
    const variance =
      dNum * dNum * fit.vcov[a][a] +
      dDen * dDen * fit.vcov[b][b] +
      2 * dNum * dDen * fit.vcov[a][b];
    expect(result.se).toBeCloseTo(Math.sqrt(variance), 8);
  });

  it('carries a symmetric interval around the ratio', () => {
    const fit = fitOf(400, 1, 33);
    const result = ratio(fit, indexOf(fit, 'x2'), indexOf(fit, 'x1'), { negate: true });
    if (!result.identified) throw new Error('expected an identified ratio');
    expect(result.coef - result.ciLow).toBeCloseTo(result.ciHigh - result.coef, 10);
    expect(result.ciLow).toBeLessThan(result.coef);
  });

  /**
   * Where the delta method stops being usable. When the denominator's own
   * interval covers zero the ratio has no finite bound at all — the true
   * confidence set is the whole line, or two disjoint rays — and a symmetric
   * ±1,96·SE band around it would be a fabrication.
   */
  it('refuses exactly when the denominator’s own interval covers zero', () => {
    // x1 carries no effect, so across seeds its interval usually — but not
    // always — covers zero. The contract is the equivalence, not the luck of
    // one draw, so check it on every draw and confirm the refusal path is hit.
    let refusals = 0;
    for (let seed = 0; seed < 40; seed++) {
      const g = gaussian(700 + seed * 11);
      const rows: number[][] = [];
      const y: number[] = [];
      for (let i = 0; i < 300; i++) {
        rows.push([g(), g()]);
        y.push(5 - 1.5 * rows[i][1] + 3 * g());
      }
      const fit = ols(y, rows, { names: ['x1', 'x2'], vcov: 'hc1' });
      if (!fit.ok) throw new Error('expected a fit');
      const denominator = fit.terms[indexOf(fit, 'x1')];
      const coversZero = denominator.ciLow <= 0 && denominator.ciHigh >= 0;
      const result = ratio(fit, indexOf(fit, 'x2'), indexOf(fit, 'x1'), { negate: true });
      expect(result.identified).toBe(!coversZero);
      if (!result.identified) {
        refusals++;
        expect(result.problem).toEqual({ code: 'denominator-covers-zero', name: 'x1' });
      }
    }
    expect(refusals).toBeGreaterThan(30);
  });

  it('refuses a term that was dropped as collinear', () => {
    const fit = fitOf(300, 1, 5);
    expect(ratio(fit, 0, -1).identified).toBe(false);
    expect(ratio(fit, 99, 1).identified).toBe(false);
  });
});
