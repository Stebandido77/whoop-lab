import { describe, expect, it } from 'vitest';
import { ols, type OlsFit, type OlsResult } from '@/lib/econ';
import { gaussian } from './random';

const ok = (result: OlsResult): OlsFit => {
  if (!result.ok) throw new Error(`expected a fit, got n=${result.n} (needs ${result.minN})`);
  return result;
};

const coef = (fit: OlsFit, name: string): number => {
  const term = fit.terms.find((t) => t.name === name);
  if (!term) throw new Error(`no term named ${name} in ${fit.terms.map((t) => t.name).join(', ')}`);
  return term.coef;
};

const stderr = (fit: OlsFit, name: string): number => {
  const term = fit.terms.find((t) => t.name === name);
  if (!term) throw new Error(`no term named ${name}`);
  return term.se;
};

/** y = 2 + 3·x1 − 1.5·x2, with x2 correlated with x1 so the fit has to separate them. */
function knownDesign(n: number, noise: number, seed = 7) {
  const g = gaussian(seed);
  const rows: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = g();
    const x2 = 0.6 * x1 + g();
    rows.push([x1, x2]);
    y.push(2 + 3 * x1 - 1.5 * x2 + noise * g());
  }
  return { y, rows, names: ['x1', 'x2'] };
}

describe('ols — known coefficients', () => {
  it('recovers exact coefficients when the data are noiseless', () => {
    const { y, rows, names } = knownDesign(60, 0);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    expect(coef(fit, 'const')).toBeCloseTo(2, 8);
    expect(coef(fit, 'x1')).toBeCloseTo(3, 8);
    expect(coef(fit, 'x2')).toBeCloseTo(-1.5, 8);
    expect(fit.r2).toBeCloseTo(1, 10);
  });

  /**
   * Pinned to the reported standard error rather than to a fixed tolerance: an
   * absolute bound tighter than one SE would only be testing the seed.
   */
  it('recovers the coefficients through noise, within their own standard error', () => {
    const { y, rows, names } = knownDesign(400, 1);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    const truth: Record<string, number> = { const: 2, x1: 3, x2: -1.5 };
    for (const term of fit.terms) {
      expect(term.se).toBeLessThan(0.12);
      expect(Math.abs(term.coef - truth[term.name])).toBeLessThan(3 * term.se);
    }
  });

  it('covers the true coefficients with the 95% interval', () => {
    const { y, rows, names } = knownDesign(400, 1);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    const x1 = fit.terms.find((t) => t.name === 'x1')!;
    const x2 = fit.terms.find((t) => t.name === 'x2')!;
    expect(x1.ciLow).toBeLessThan(3);
    expect(x1.ciHigh).toBeGreaterThan(3);
    expect(x2.ciLow).toBeLessThan(-1.5);
    expect(x2.ciHigh).toBeGreaterThan(-1.5);
  });

  it('reports t and p consistently with the coefficient and its error', () => {
    const { y, rows, names } = knownDesign(400, 1);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    for (const term of fit.terms) {
      expect(term.t).toBeCloseTo(term.coef / term.se, 8);
    }
    expect(fit.terms.find((t) => t.name === 'x1')!.p).toBeLessThan(1e-6);
  });

  it('does not find an effect that is not there', () => {
    const g = gaussian(99);
    const y: number[] = [];
    const rows: number[][] = [];
    for (let i = 0; i < 300; i++) {
      rows.push([g()]);
      y.push(g());
    }
    const fit = ok(ols(y, rows, { vcov: 'hc1', names: ['noise'] }));
    expect(fit.terms.find((t) => t.name === 'noise')!.p).toBeGreaterThan(0.1);
    expect(fit.r2).toBeLessThan(0.05);
  });
});

describe('ols — bookkeeping', () => {
  it('reports n, k and the degrees of freedom', () => {
    const { y, rows, names } = knownDesign(50, 1);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    expect(fit.n).toBe(50);
    expect(fit.k).toBe(3);
    expect(fit.df).toBe(47);
  });

  it('drops rows with any missing value instead of imputing', () => {
    const { y, rows, names } = knownDesign(50, 0);
    const holes: (number | null)[] = [...y];
    holes[3] = null;
    const gappedRows: (number | null)[][] = rows.map((r) => [...r]);
    gappedRows[10] = [null, rows[10][1]];
    const fit = ok(ols(holes, gappedRows, { vcov: 'hc1', names }));
    expect(fit.n).toBe(48);
    expect(coef(fit, 'x1')).toBeCloseTo(3, 8);
  });

  it('penalises adding a useless regressor in the adjusted R²', () => {
    const g = gaussian(3);
    const { y, rows, names } = knownDesign(80, 1.5);
    const lean = ok(ols(y, rows, { vcov: 'hc1', names }));
    const padded = ok(
      ols(
        y,
        rows.map((r) => [...r, g()]),
        { vcov: 'hc1', names: [...names, 'junk'] },
      ),
    );
    expect(padded.r2).toBeGreaterThanOrEqual(lean.r2);
    expect(padded.r2Adjusted).toBeLessThan(lean.r2Adjusted);
  });

  it('switches itself off below the minimum sample and says how many are missing', () => {
    const { y, rows, names } = knownDesign(6, 1);
    const result = ols(y, rows, { vcov: 'hc1', names, minN: 20 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.n).toBe(6);
    expect(result.minN).toBe(20);
    expect(result.missing).toBe(14);
  });

  it('refuses to fit when there are fewer observations than parameters', () => {
    const { y, rows, names } = knownDesign(3, 0);
    expect(ols(y, rows, { vcov: 'hc1', names, minN: 1 }).ok).toBe(false);
  });
});

describe('ols — ill-conditioned designs', () => {
  /** Seven weekday dummies plus an intercept: the classic dummy trap. */
  it('drops a collinear column instead of returning garbage', () => {
    const g = gaussian(11);
    const y: number[] = [];
    const rows: number[][] = [];
    const names = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
    for (let i = 0; i < 140; i++) {
      const weekday = i % 7;
      rows.push(names.map((_, j) => (j === weekday ? 1 : 0)));
      y.push(10 + 2 * weekday + 0.3 * g());
    }
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    expect(fit.dropped).toHaveLength(1);
    expect(fit.terms).toHaveLength(names.length);
    for (const term of fit.terms) expect(Number.isFinite(term.coef)).toBe(true);
    expect(fit.r2).toBeGreaterThan(0.9);
  });

  /** QR is here precisely so that a near-collinear column does not blow up. */
  it('stays stable when two regressors are almost identical', () => {
    const g = gaussian(21);
    const y: number[] = [];
    const rows: number[][] = [];
    for (let i = 0; i < 200; i++) {
      const x1 = g();
      const x2 = x1 + 1e-7 * g();
      rows.push([x1, x2]);
      y.push(1 + x1 + x2 + 0.1 * g());
    }
    const fit = ok(ols(y, rows, { vcov: 'hc1', names: ['x1', 'x2'] }));
    for (const term of fit.terms) expect(Number.isFinite(term.coef)).toBe(true);
    expect(fit.fitted.every(Number.isFinite)).toBe(true);
    expect(fit.r2).toBeGreaterThan(0.9);
  });

  it('handles a design with no intercept', () => {
    const rows = [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12]];
    const y = rows.map((r) => 4 * r[0]);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names: ['x'], intercept: false, minN: 5 }));
    expect(fit.terms).toHaveLength(1);
    expect(coef(fit, 'x')).toBeCloseTo(4, 10);
  });
});

describe('ols — HC1 robust standard errors', () => {
  /**
   * Oracle for the simple-regression case, straight from the HC1 definition
   * with a 2×2 inverse. Different code path, same number.
   */
  function hc1Simple(xs: number[], ys: number[]): { intercept: number; slope: number } {
    const n = xs.length;
    const sx = xs.reduce((s, x) => s + x, 0);
    const sxx = xs.reduce((s, x) => s + x * x, 0);
    const det = n * sxx - sx * sx;
    const inv = [
      [sxx / det, -sx / det],
      [-sx / det, n / det],
    ];
    const mx = sx / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const slope =
      xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
      xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const intercept = my - slope * mx;
    const meat = [
      [0, 0],
      [0, 0],
    ];
    for (let i = 0; i < n; i++) {
      const u = ys[i] - (intercept + slope * xs[i]);
      const row = [1, xs[i]];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) meat[a][b] += u * u * row[a] * row[b];
    }
    const scale = n / (n - 2);
    const variance = [0, 0];
    for (let a = 0; a < 2; a++) {
      let acc = 0;
      for (let c = 0; c < 2; c++)
        for (let d = 0; d < 2; d++) acc += inv[a][c] * meat[c][d] * inv[d][a];
      variance[a] = acc * scale;
    }
    return { intercept: Math.sqrt(variance[0]), slope: Math.sqrt(variance[1]) };
  }

  it('matches the HC1 formula computed by hand', () => {
    const g = gaussian(5);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 120; i++) {
      const x = g();
      xs.push(x);
      // Deliberately heteroskedastic: this is what HC1 is for.
      ys.push(1.2 + 0.8 * x + (0.4 + Math.abs(x)) * g());
    }
    const fit = ok(
      ols(
        ys,
        xs.map((x) => [x]),
        { vcov: 'hc1', names: ['x'] },
      ),
    );
    const oracle = hc1Simple(xs, ys);
    expect(stderr(fit, 'const')).toBeCloseTo(oracle.intercept, 10);
    expect(stderr(fit, 'x')).toBeCloseTo(oracle.slope, 10);
  });

  it('differs from the classical error when the variance is not constant', () => {
    const g = gaussian(31);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = g();
      xs.push(x);
      ys.push(x * 0.5 + Math.abs(x) * 3 * g());
    }
    const fit = ok(
      ols(
        ys,
        xs.map((x) => [x]),
        { vcov: 'hc1', names: ['x'] },
      ),
    );
    const classical = Math.sqrt(
      fit.xtxInv[1][1] * (fit.residuals.reduce((s, u) => s + u * u, 0) / fit.df),
    );
    expect(Math.abs(stderr(fit, 'x') / classical - 1)).toBeGreaterThan(0.1);
  });

  it('exposes a covariance matrix that agrees with the reported errors', () => {
    const { y, rows, names } = knownDesign(200, 1);
    const fit = ok(ols(y, rows, { vcov: 'hc1', names }));
    fit.terms.forEach((term, i) => {
      expect(term.se).toBeCloseTo(Math.sqrt(fit.vcov[i][i]), 12);
    });
    expect(fit.vcov[0][1]).toBeCloseTo(fit.vcov[1][0], 12);
  });
});
