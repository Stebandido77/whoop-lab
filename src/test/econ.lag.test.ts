import { describe, expect, it } from 'vitest';
import { distributedLag, type DistributedLagFit, type DistributedLagResult } from '@/lib/econ';
import { gaussian } from './random';

const ok = (result: DistributedLagResult): DistributedLagFit => {
  if (!result.ok) throw new Error(`expected a fit, got n=${result.n} (needs ${result.minN})`);
  return result;
};

/**
 * The shape this estimator exists for: an autocorrelated driver whose effect on
 * the outcome is spread over three days. True lag weights −1.2, −0.6, −0.2, so
 * the cumulative multiplier is −2.0 and the fourth lag is genuinely zero.
 */
const WEIGHTS = [-1.2, -0.6, -0.2];
const CUMULATIVE = WEIGHTS.reduce((s, w) => s + w, 0);

function lagWorld(n: number, noise = 5, seed = 13) {
  const g = gaussian(seed);
  const strain: number[] = [];
  let previous = 12;
  for (let i = 0; i < n; i++) {
    previous = 0.6 * previous + 0.4 * 12 + 3 * g();
    strain.push(previous);
  }
  const recovery: (number | null)[] = strain.map((_, t) => {
    if (t < WEIGHTS.length) return null;
    let value = 60 + noise * g();
    WEIGHTS.forEach((w, k) => {
      value += w * strain[t - (k + 1)];
    });
    return value;
  });
  return { strain, recovery };
}

describe('distributedLag — known lag weights', () => {
  it('recovers each lag weight within its own standard error', () => {
    const { strain, recovery } = lagWorld(600);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 4 }));
    expect(fit.lags.map((l) => l.lag)).toEqual([1, 2, 3, 4]);
    WEIGHTS.forEach((truth, i) => {
      expect(Math.abs(fit.lags[i].coef - truth)).toBeLessThan(3 * fit.lags[i].se);
    });
  });

  it('leaves the lag that carries no effect indistinguishable from zero', () => {
    const { strain, recovery } = lagWorld(600);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 4 }));
    const empty = fit.lags[3];
    expect(empty.ciLow).toBeLessThan(0);
    expect(empty.ciHigh).toBeGreaterThan(0);
    expect(empty.p).toBeGreaterThan(0.05);
  });

  it('finds the real lags significant', () => {
    const { strain, recovery } = lagWorld(600);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 4 }));
    expect(fit.lags[0].p).toBeLessThan(0.001);
    expect(fit.lags[1].p).toBeLessThan(0.01);
  });

  it('recovers the cumulative multiplier', () => {
    const { strain, recovery } = lagWorld(600);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 4 }));
    expect(Math.abs(fit.cumulative.coef - CUMULATIVE)).toBeLessThan(3 * fit.cumulative.se);
    expect(fit.cumulative.ciLow).toBeLessThan(CUMULATIVE);
    expect(fit.cumulative.ciHigh).toBeGreaterThan(CUMULATIVE);
  });

  it('sums to the cumulative coefficient exactly', () => {
    const { strain, recovery } = lagWorld(400);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 5 }));
    const total = fit.lags.reduce((s, l) => s + l.coef, 0);
    expect(fit.cumulative.coef).toBeCloseTo(total, 10);
  });
});

describe('distributedLag — delta method', () => {
  /**
   * The whole point of the delta method here: the lag coefficients of an
   * autocorrelated driver are correlated with each other, so adding their
   * variances in quadrature gives the wrong band. If these two ever agree, the
   * covariance terms have been dropped.
   */
  it('uses the covariances, not just the diagonal', () => {
    const { strain, recovery } = lagWorld(600);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 4 }));
    const naive = Math.sqrt(fit.lags.reduce((s, l) => s + l.se * l.se, 0));
    expect(Math.abs(fit.cumulative.se / naive - 1)).toBeGreaterThan(0.05);
  });

  it('matches 1ᵀV1 over the lag block of the covariance matrix', () => {
    const { strain, recovery } = lagWorld(400);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 3 }));
    const names = fit.lags.map((l) => `lag${l.lag}`);
    const index = names.map((name) => fit.fit.terms.findIndex((t) => t.name === name));
    let variance = 0;
    for (const a of index) for (const b of index) variance += fit.fit.vcov[a][b];
    expect(fit.cumulative.se).toBeCloseTo(Math.sqrt(variance), 12);
  });

  it('brackets the cumulative estimate symmetrically', () => {
    const { strain, recovery } = lagWorld(400);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 3 }));
    const half = fit.cumulative.ciHigh - fit.cumulative.coef;
    expect(fit.cumulative.coef - fit.cumulative.ciLow).toBeCloseTo(half, 10);
    expect(half).toBeGreaterThan(fit.cumulative.se);
  });
});

describe('distributedLag — controls and alignment', () => {
  it('regresses the outcome on the driver at t−1, not at t', () => {
    // Effect lives entirely at lag 1; a contemporaneous fit would find nothing.
    const g = gaussian(41);
    const x = Array.from({ length: 300 }, () => 10 + 3 * g());
    const y = x.map((_, t) => (t === 0 ? null : 50 - 2 * x[t - 1] + 0.5 * g()));
    const fit = ok(distributedLag({ y, x, maxLag: 2 }));
    expect(fit.lags[0].coef).toBeCloseTo(-2, 1);
    expect(Math.abs(fit.lags[1].coef)).toBeLessThan(0.2);
  });

  it('can include the contemporaneous term when asked', () => {
    const g = gaussian(43);
    const x = Array.from({ length: 300 }, () => 10 + 3 * g());
    const y = x.map((v, t) => (t === 0 ? null : 50 - 2 * v + 0.5 * g()));
    const fit = ok(distributedLag({ y, x, maxLag: 2, minLag: 0 }));
    expect(fit.lags.map((l) => l.lag)).toEqual([0, 1, 2]);
    expect(fit.lags[0].coef).toBeCloseTo(-2, 1);
  });

  it('holds the controls fixed and reports them', () => {
    const g = gaussian(17);
    const n = 400;
    const sleep = Array.from({ length: n }, () => 7 + g());
    const strain = sleep.map((h) => 20 - 1.5 * h + 2 * g());
    const y = strain.map((_, t) =>
      t < 1 ? null : 40 + 3 * sleep[t] - 1.0 * strain[t - 1] + 2 * g(),
    );
    const controlled = ok(
      distributedLag({
        y,
        x: strain,
        maxLag: 1,
        controls: [{ name: 'sueño', values: sleep }],
      }),
    );
    expect(Math.abs(controlled.lags[0].coef - -1)).toBeLessThan(3 * controlled.lags[0].se);
    const sleepTerm = controlled.fit.terms.find((t) => t.name === 'sueño')!;
    expect(Math.abs(sleepTerm.coef - 3)).toBeLessThan(3 * sleepTerm.se);

    // Without the control, the omitted variable pulls the lag coefficient away.
    const naive = ok(distributedLag({ y, x: strain, maxLag: 1 }));
    expect(Math.abs(naive.lags[0].coef - -1)).toBeGreaterThan(
      Math.abs(controlled.lags[0].coef - -1),
    );
  });
});

describe('distributedLag — sample discipline', () => {
  it('loses the first K days to the lag window and says so in n', () => {
    const { strain, recovery } = lagWorld(200);
    const fit = ok(distributedLag({ y: recovery, x: strain, maxLag: 4 }));
    expect(fit.n).toBe(196);
  });

  it('switches itself off below the minimum sample', () => {
    const { strain, recovery } = lagWorld(30);
    const result = distributedLag({ y: recovery, x: strain, maxLag: 4, minN: 120 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.n).toBe(26);
    expect(result.missing).toBe(94);
  });

  it('rejects a lag window that is not a window', () => {
    const { strain, recovery } = lagWorld(200);
    expect(distributedLag({ y: recovery, x: strain, maxLag: 0, minLag: 3 }).ok).toBe(false);
  });

  it('drops days where the driver has a hole rather than filling it', () => {
    const { strain, recovery } = lagWorld(200);
    const gapped: (number | null)[] = [...strain];
    gapped[50] = null;
    const fit = ok(distributedLag({ y: recovery, x: gapped, maxLag: 3 }));
    // The hole is a regressor on the three days that follow it, and only those.
    expect(fit.n).toBe(197 - 3);
  });
});
