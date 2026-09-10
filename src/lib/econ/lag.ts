import { studentCdf, tQuantile } from '../stats';
import { ols, type OlsFit, type VarianceEstimator } from './ols';
import { insufficient, type Estimate, type Insufficient, type Num } from './types';

export interface LagCoefficient extends Estimate {
  lag: number;
}

export interface DistributedLagFit {
  ok: true;
  /** One coefficient per lag, ascending. A lag QR dropped as collinear is absent. */
  lags: LagCoefficient[];
  /**
   * Σ βₖ: the response to a change in the driver held for the whole window.
   * Its standard error comes from the delta method, so the correlation between
   * neighbouring lags is inside the band.
   */
  cumulative: Estimate;
  n: number;
  k: number;
  df: number;
  minN: number;
  r2: number;
  r2Adjusted: number;
  level: number;
  /** The underlying fit, for the controls and the covariance matrix. */
  fit: OlsFit;
}

export type DistributedLagResult = DistributedLagFit | Insufficient;

export interface LagControl {
  name: string;
  /** Same length and alignment as `y`: the control is read at t, not lagged. */
  values: Num[];
}

export interface DistributedLagOptions {
  /** Outcome, one entry per day of the window. */
  y: Num[];
  /** Driver, aligned with `y`. */
  x: Num[];
  /** Longest lag to estimate, K. */
  maxLag: number;
  /** Shortest lag. Defaults to 1: today's strain lands after today's recovery. */
  minLag?: number;
  controls?: LagControl[];
  /**
   * Covariance estimator. Defaults to `hac`, unlike `ols`, which has no
   * default — see the note in the doc comment below.
   */
  vcov?: VarianceEstimator;
  /** Bartlett lag truncation. Defaults to the Newey–West rule of thumb. */
  bandwidth?: number;
  minN?: number;
  level?: number;
}

const lagName = (lag: number) => `lag${lag}`;

/**
 * Finite distributed lag model: y_t on x_{t−minLag} … x_{t−maxLag} plus whatever
 * controls the caller passes, estimated by the same QR/HC1 machinery as `ols`.
 *
 * The default window starts at lag 1 because of the project's day convention —
 * a recovery score is the number you saw in the morning, so the strain of the
 * same calendar day happened after it and cannot explain it.
 *
 * Two things are reported and both matter. The individual coefficients say
 * *when* the driver lands; the cumulative multiplier says *how much* in total,
 * which is the number to quote for a habit sustained over a week. Adding the
 * lag standard errors in quadrature would get the second one wrong: an
 * autocorrelated driver produces correlated coefficient estimates, so the
 * variance of the sum is 1ᵀV1 over the lag block, not the sum of the diagonal.
 * That is the delta method for g(β) = Σβₖ, whose gradient is a vector of ones.
 *
 * **This is the one estimator in the layer with a default `vcov`, and it is
 * `hac`.** `ols` refuses to choose because it cannot know what it is being
 * handed; this function knows exactly what it is being handed, which is a daily
 * time series regressed on its own recent past. In that design the residuals
 * are serially correlated more or less by construction — anything persistent
 * that is not in the model (a training block, a cold, a stretch of bad sleep)
 * lands in u_t and in u_{t+1} alike — and HC1 would then report bands that are
 * roughly a third too narrow. Choosing HC1 here has to be a deliberate act.
 *
 * The day index is passed through to `ols`, so that a fortnight with no data
 * breaks the Bartlett window instead of being silently closed up.
 */
export function distributedLag(options: DistributedLagOptions): DistributedLagResult {
  const { y, x, maxLag, controls = [], level = 0.95 } = options;
  const minLag = options.minLag ?? 1;
  if (!Number.isInteger(minLag) || !Number.isInteger(maxLag) || minLag < 0 || maxLag < minLag) {
    return insufficient(0, options.minN ?? 1);
  }

  const lags = Array.from({ length: maxLag - minLag + 1 }, (_, i) => minLag + i);
  const names = [...lags.map(lagName), ...controls.map((c) => c.name)];
  const length = Math.min(y.length, x.length);
  const rows: Num[][] = Array.from({ length }, (_, t) => [
    ...lags.map((lag) => (t - lag >= 0 ? x[t - lag] : null)),
    ...controls.map((control) => control.values[t]),
  ]);

  const fit = ols(y.slice(0, length), rows, {
    names,
    vcov: options.vcov ?? 'hac',
    bandwidth: options.bandwidth,
    times: Array.from({ length }, (_, t) => t),
    minN: options.minN,
    level,
  });
  if (!fit.ok) return fit;

  const slot = lags.map((lag) => fit.terms.findIndex((term) => term.name === lagName(lag)));
  const kept = lags.map((lag, i) => ({ lag, index: slot[i] })).filter((entry) => entry.index >= 0);
  if (!kept.length) return insufficient(fit.n, Math.max(fit.minN, fit.n + 1));

  const lagCoefficients: LagCoefficient[] = kept.map(({ lag, index }) => ({
    lag,
    ...stripName(fit.terms[index]),
  }));

  // Delta method: Var(Σβ) = 1ᵀ V 1 over the lag block of the robust covariance.
  let variance = 0;
  for (const a of kept) for (const b of kept) variance += fit.vcov[a.index][b.index];
  const coef = lagCoefficients.reduce((s, l) => s + l.coef, 0);
  const se = Math.sqrt(Math.max(0, variance));
  const t = se > 0 ? coef / se : 0;
  const critical = tQuantile(1 - (1 - level) / 2, fit.df) ?? 1.96;

  return {
    ok: true,
    lags: lagCoefficients,
    cumulative: {
      coef,
      se,
      t,
      p: se > 0 ? Math.min(1, Math.max(0, 2 * (1 - studentCdf(Math.abs(t), fit.df)))) : 1,
      ciLow: coef - critical * se,
      ciHigh: coef + critical * se,
    },
    n: fit.n,
    k: fit.k,
    df: fit.df,
    minN: fit.minN,
    r2: fit.r2,
    r2Adjusted: fit.r2Adjusted,
    level,
    fit,
  };
}

const stripName = ({ coef, se, t, p, ciLow, ciHigh }: Estimate): Estimate => ({
  coef,
  se,
  t,
  p,
  ciLow,
  ciHigh,
});
