/**
 * Every estimator in this layer returns either a result carrying `ok: true` or
 * this. Rule three of the project: below its minimum sample a panel switches
 * itself off, and to write «faltan 14 días» it needs the count, not a `null`.
 */
export interface Insufficient {
  ok: false;
  /** Complete observations actually available. */
  n: number;
  /** Observations the estimator was told it needed. */
  minN: number;
  /** How many more complete observations would turn this into an estimate. */
  missing: number;
}

export const insufficient = (n: number, minN: number): Insufficient => ({
  ok: false,
  n,
  minN,
  missing: Math.max(0, minN - n),
});

/**
 * A coefficient with everything a panel needs to draw it honestly. The interval
 * is part of the estimate and not an optional extra, because a coefficient
 * without one invites exactly the reading the project is trying to avoid.
 */
export interface Estimate {
  coef: number;
  /** Standard error. Robust wherever this layer computes one. */
  se: number;
  t: number;
  /** Two-sided p-value. Uncorrected: families of tests go through `benjaminiHochberg`. */
  p: number;
  ciLow: number;
  ciHigh: number;
}

export type Num = number | null | undefined;

export const isNum = (v: Num): v is number => v != null && Number.isFinite(v);
