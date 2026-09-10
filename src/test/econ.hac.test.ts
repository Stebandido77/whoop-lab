import { describe, expect, it } from 'vitest';
import { distributedLag, ols, type OlsFit, type OlsResult } from '@/lib/econ';
import { gaussian } from './random';

const ok = (result: OlsResult): OlsFit => {
  if (!result.ok) throw new Error(`expected a fit, got n=${result.n} (needs ${result.minN})`);
  return result;
};

const term = (fit: OlsFit, name: string) => {
  const found = fit.terms.find((t) => t.name === name);
  if (!found) throw new Error(`no term named ${name}`);
  return found;
};

const SLOPE = 0.5;

/**
 * The situation HAC exists for, and the one this project is actually in:
 *
 *   x_t = 0.8·x_{t−1} + e_t        a persistent regressor
 *   u_t = rho·u_{t−1} + v_t        errors that carry over from yesterday
 *   y_t = 2 + 0.5·x_t + u_t
 *
 * Both halves matter. Autocorrelated errors alone barely disturb the OLS
 * variance; it is the *product* of a persistent regressor and persistent errors
 * that makes HC1 understate, because then the score xᵢuᵢ is itself serially
 * correlated and its long-run variance is far bigger than its contemporaneous
 * one.
 */
function autocorrelatedWorld(n: number, rho: number, seed: number) {
  const g = gaussian(seed);
  const x: number[] = [];
  const y: number[] = [];
  let lastX = 0;
  let lastU = 0;
  for (let i = 0; i < n; i++) {
    lastX = 0.8 * lastX + g();
    lastU = rho * lastU + g();
    x.push(lastX);
    y.push(2 + SLOPE * lastX + lastU);
  }
  return { x, y, rows: x.map((v) => [v]) };
}

describe('ols — HAC standard errors', () => {
  it('is wider than HC1 when the errors carry over from one day to the next', () => {
    const { y, rows } = autocorrelatedWorld(400, 0.7, 11);
    const hc1 = ok(ols(y, rows, { names: ['x'], vcov: 'hc1' }));
    const hac = ok(ols(y, rows, { names: ['x'], vcov: 'hac' }));
    expect(term(hac, 'x').se).toBeGreaterThan(term(hc1, 'x').se * 1.3);
  });

  it('leaves the coefficients alone: only the variance changes', () => {
    const { y, rows } = autocorrelatedWorld(400, 0.7, 11);
    const hc1 = ok(ols(y, rows, { names: ['x'], vcov: 'hc1' }));
    const hac = ok(ols(y, rows, { names: ['x'], vcov: 'hac' }));
    expect(term(hac, 'x').coef).toBeCloseTo(term(hc1, 'x').coef, 12);
    expect(hac.r2).toBeCloseTo(hc1.r2, 12);
  });

  /**
   * At zero lags the Bartlett sum is just Γ̂₀, which is the HC1 meat. If these
   * two ever diverge, the kernel or the finite-sample scaling is wrong.
   */
  it('collapses to HC1 exactly at bandwidth zero', () => {
    const { y, rows } = autocorrelatedWorld(300, 0.7, 13);
    const hc1 = ok(ols(y, rows, { names: ['x'], vcov: 'hc1' }));
    const hac = ok(ols(y, rows, { names: ['x'], vcov: 'hac', bandwidth: 0 }));
    hc1.terms.forEach((t, i) => expect(hac.terms[i].se).toBeCloseTo(t.se, 12));
  });

  it('uses the Newey–West rule of thumb for the bandwidth', () => {
    const rule = (n: number) => Math.floor(4 * Math.pow(n / 100, 2 / 9));
    for (const n of [120, 250, 400, 800]) {
      const { y, rows } = autocorrelatedWorld(n, 0.5, 3);
      const fit = ok(ols(y, rows, { names: ['x'], vcov: 'hac' }));
      expect(fit.n).toBe(n);
      expect(fit.bandwidth).toBe(rule(n));
    }
  });

  it('reports which estimator produced the errors', () => {
    const { y, rows } = autocorrelatedWorld(200, 0.5, 5);
    expect(ok(ols(y, rows, { names: ['x'], vcov: 'hc1' })).vcovType).toBe('hc1');
    expect(ok(ols(y, rows, { names: ['x'], vcov: 'hc1' })).bandwidth).toBeNull();
    expect(ok(ols(y, rows, { names: ['x'], vcov: 'hac' })).vcovType).toBe('hac');
  });

  it('widens further as more lags are let in', () => {
    const { y, rows } = autocorrelatedWorld(500, 0.8, 17);
    const narrow = ok(ols(y, rows, { names: ['x'], vcov: 'hac', bandwidth: 1 }));
    const wide = ok(ols(y, rows, { names: ['x'], vcov: 'hac', bandwidth: 12 }));
    expect(term(wide, 'x').se).toBeGreaterThan(term(narrow, 'x').se);
  });

  /**
   * Oracle for the simple-regression case, straight from the Newey–West
   * definition with an explicit sum over lags and a 2×2 inverse.
   */
  it('matches the Newey–West formula computed by hand', () => {
    const { x, y, rows } = autocorrelatedWorld(220, 0.7, 23);
    const L = 5;
    const fit = ok(ols(y, rows, { names: ['x'], vcov: 'hac', bandwidth: L }));
    const n = x.length;

    const sx = x.reduce((s, v) => s + v, 0);
    const sxx = x.reduce((s, v) => s + v * v, 0);
    const det = n * sxx - sx * sx;
    const inv = [
      [sxx / det, -sx / det],
      [-sx / det, n / det],
    ];
    const intercept = term(fit, 'const').coef;
    const slope = term(fit, 'x').coef;
    const u = y.map((v, i) => v - (intercept + slope * x[i]));
    const design = x.map((v) => [1, v]);

    const omega = [
      [0, 0],
      [0, 0],
    ];
    for (let t = 0; t < n; t++) {
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) omega[a][b] += u[t] * u[t] * design[t][a] * design[t][b];
      }
    }
    for (let l = 1; l <= L; l++) {
      const w = 1 - l / (L + 1);
      for (let t = l; t < n; t++) {
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            omega[a][b] +=
              w *
              u[t] *
              u[t - l] *
              (design[t][a] * design[t - l][b] + design[t - l][a] * design[t][b]);
          }
        }
      }
    }

    const scale = n / (n - 2);
    const variance = [0, 0];
    for (let a = 0; a < 2; a++) {
      let acc = 0;
      for (let c = 0; c < 2; c++)
        for (let d = 0; d < 2; d++) acc += inv[a][c] * omega[c][d] * inv[d][a];
      variance[a] = acc * scale;
    }
    expect(term(fit, 'const').se).toBeCloseTo(Math.sqrt(variance[0]), 9);
    expect(term(fit, 'x').se).toBeCloseTo(Math.sqrt(variance[1]), 9);
  });

  it('does not pair days across a gap as if they were consecutive', () => {
    const { y, rows } = autocorrelatedWorld(300, 0.8, 29);
    const times = rows.map((_, i) => i);
    const dense = ok(ols(y, rows, { names: ['x'], vcov: 'hac', bandwidth: 6, times }));
    // Same rows, but the calendar says a month passed in the middle, so the
    // pairs that straddle it are no longer within the bandwidth.
    const split = times.map((t) => (t < 150 ? t : t + 30));
    const gapped = ok(ols(y, rows, { names: ['x'], vcov: 'hac', bandwidth: 6, times: split }));
    expect(term(gapped, 'x').se).not.toBeCloseTo(term(dense, 'x').se, 6);
  });
});

describe('ols — HAC coverage against HC1', () => {
  /**
   * The claim that matters is not "HAC is bigger" but "HAC is bigger by about
   * the right amount". Across independent replications of the same process, a
   * correct 95% interval covers the true slope about 95% of the time.
   */
  function coverage(replications: number, n: number, rho: number) {
    let hc1Hits = 0;
    let hacHits = 0;
    for (let r = 0; r < replications; r++) {
      const { y, rows } = autocorrelatedWorld(n, rho, 1000 + r * 7);
      const hc1 = ols(y, rows, { names: ['x'], vcov: 'hc1' });
      const hac = ols(y, rows, { names: ['x'], vcov: 'hac' });
      if (!hc1.ok || !hac.ok) throw new Error('fit failed');
      const a = term(hc1, 'x');
      const b = term(hac, 'x');
      if (a.ciLow <= SLOPE && a.ciHigh >= SLOPE) hc1Hits++;
      if (b.ciLow <= SLOPE && b.ciHigh >= SLOPE) hacHits++;
    }
    return { hc1: hc1Hits / replications, hac: hacHits / replications };
  }

  it('shows HC1 covering far less than the 95% it claims', () => {
    // Measured ≈ 70%. One interval in three misses the truth while the panel
    // would be printing «IC 95%».
    const { hc1 } = coverage(400, 300, 0.7);
    expect(hc1).toBeLessThan(0.8);
  });

  it('recovers most of the missing coverage with HAC', () => {
    // Measured ≈ 87% against ≈ 70%.
    const { hc1, hac } = coverage(400, 300, 0.7);
    expect(hac).toBeGreaterThan(hc1 + 0.1);
    expect(hac).toBeGreaterThan(0.84);
  });

  /**
   * Deliberately pinned: HAC does *not* reach nominal in a sample this size.
   * The estimator is consistent but biased down in finite samples, and raising
   * the bandwidth does not rescue it — measured 87,0% at L=5, 88,5% at L=20,
   * 86,9% at L=40. A panel that quotes «IC 95%» off a HAC fit is quoting
   * something closer to 88%, and §6.1 says so.
   */
  it('still falls short of nominal, which is why this is a floor and not a fix', () => {
    const { hac } = coverage(400, 300, 0.7);
    expect(hac).toBeLessThan(0.93);
  });

  /**
   * The difference that matters between a wrong estimator and a merely
   * imprecise one: more data fixes HAC and does nothing at all for HC1.
   */
  it('improves with sample size, where HC1 stays broken', () => {
    const small = coverage(600, 150, 0.7);
    const large = coverage(600, 600, 0.7);
    expect(large.hac).toBeGreaterThan(small.hac + 0.02);
    expect(Math.abs(large.hc1 - small.hc1)).toBeLessThan(0.05);
  });

  it('leaves both estimators near nominal when there is nothing to correct', () => {
    // rho = 0: iid errors, so HC1 is already right and HAC must not overreact.
    const { hc1, hac } = coverage(300, 300, 0);
    expect(hc1).toBeGreaterThan(0.92);
    expect(hac).toBeGreaterThan(0.9);
  });
});

describe('distributedLag — HAC by default', () => {
  function lagWorld(n: number, seed = 31) {
    const g = gaussian(seed);
    const strain: number[] = [];
    let last = 12;
    for (let i = 0; i < n; i++) {
      last = 0.6 * last + 0.4 * 12 + 3 * g();
      strain.push(last);
    }
    let u = 0;
    const recovery: (number | null)[] = strain.map((_, t) => {
      u = 0.7 * u + 4 * g();
      return t < 3 ? null : 60 - 1.2 * strain[t - 1] - 0.6 * strain[t - 2] + u;
    });
    return { strain, recovery };
  }

  it('uses HAC unless told otherwise', () => {
    const { strain, recovery } = lagWorld(400);
    const fit = distributedLag({ y: recovery, x: strain, maxLag: 4 });
    if (!fit.ok) throw new Error('expected a fit');
    expect(fit.fit.vcovType).toBe('hac');
    expect(fit.fit.bandwidth).toBe(Math.floor(4 * Math.pow(fit.n / 100, 2 / 9)));
  });

  it('can still be asked for HC1, and then the bands are narrower', () => {
    const { strain, recovery } = lagWorld(400);
    const hac = distributedLag({ y: recovery, x: strain, maxLag: 4 });
    const hc1 = distributedLag({ y: recovery, x: strain, maxLag: 4, vcov: 'hc1' });
    if (!hac.ok || !hc1.ok) throw new Error('expected fits');
    expect(hc1.fit.vcovType).toBe('hc1');
    expect(hac.cumulative.se).toBeGreaterThan(hc1.cumulative.se);
  });

  /**
   * Item the whole delta-method argument rests on: with a driver that is
   * autocorrelated with itself, the lag coefficients are strongly correlated,
   * so 1ᵀV1 and the quadrature of the diagonal are not close.
   */
  it('separates the full-matrix cumulative error from the diagonal-only one', () => {
    const { strain, recovery } = lagWorld(500);
    const fit = distributedLag({ y: recovery, x: strain, maxLag: 5 });
    if (!fit.ok) throw new Error('expected a fit');
    const diagonalOnly = Math.sqrt(fit.lags.reduce((s, l) => s + l.se * l.se, 0));
    const ratio = fit.cumulative.se / diagonalOnly;
    expect(Math.abs(ratio - 1)).toBeGreaterThan(0.1);

    // And the full matrix is what the covariance block actually says.
    const index = fit.lags.map((l) => fit.fit.terms.findIndex((t) => t.name === `lag${l.lag}`));
    let variance = 0;
    for (const a of index) for (const b of index) variance += fit.fit.vcov[a][b];
    expect(fit.cumulative.se).toBeCloseTo(Math.sqrt(variance), 12);
  });

  it('passes the day index through so a gap is not treated as consecutive', () => {
    const { strain, recovery } = lagWorld(300);
    const holed: (number | null)[] = [...recovery];
    for (let i = 100; i < 130; i++) holed[i] = null;
    const fit = distributedLag({ y: holed, x: strain, maxLag: 3 });
    if (!fit.ok) throw new Error('expected a fit');
    expect(fit.n).toBe(267);
    expect(fit.fit.vcovType).toBe('hac');
  });
});
