import { studentCdf, tQuantile } from '../stats';
import { insufficient, isNum, type Estimate, type Insufficient, type Num } from './types';

/** One estimated column. `p` is two-sided against t(df). */
export interface OlsTerm extends Estimate {
  name: string;
}

/**
 * Which sandwich to put around (XʹX)⁻¹.
 *
 * - `hc1` is robust to heteroskedasticity only. Right for a cross-section.
 * - `hac` is Newey–West with a Bartlett kernel: robust to heteroskedasticity
 *   *and* to residuals that carry over from one observation to the next.
 *
 * There is deliberately no default. Picking the wrong one does not fail, it
 * quietly reports intervals of the wrong width, so the caller has to say which
 * assumption it is willing to make.
 */
export type VarianceEstimator = 'hc1' | 'hac';

export interface OlsFit {
  ok: true;
  /**
   * Estimated terms in the order the columns were given, intercept first.
   * Columns dropped as collinear are *not* here — an aliased coefficient has no
   * value, and reporting a zero would read as «no effect».
   */
  terms: OlsTerm[];
  /** Names of the columns QR found to be linear combinations of the others. */
  dropped: string[];
  /** Complete observations used. */
  n: number;
  /** Parameters actually estimated: the rank of the design. */
  k: number;
  /** Residual degrees of freedom, `n − k`. */
  df: number;
  minN: number;
  r2: number;
  r2Adjusted: number;
  /** Residual standard error, √(SSR/df). */
  sigma: number;
  fitted: number[];
  residuals: number[];
  /** Robust covariance matrix of the terms, in term order. */
  vcov: number[][];
  /** Which sandwich produced `vcov` and every `se`. */
  vcovType: VarianceEstimator;
  /** Bartlett lag truncation actually used. Null for `hc1`. */
  bandwidth: number | null;
  /** (XʹX)⁻¹ in term order. Classical errors and prediction bands need it. */
  xtxInv: number[][];
  /** Confidence level behind `ciLow` and `ciHigh`. */
  level: number;
}

export type OlsResult = OlsFit | Insufficient;

export interface OlsOptions {
  /**
   * Which robust covariance estimator to use. Required on purpose: see
   * `VarianceEstimator`.
   */
  vcov: VarianceEstimator;
  /**
   * Bartlett lag truncation for `hac`. Defaults to the Newey–West rule of
   * thumb, `floor(4·(n/100)^(2/9))`. Ignored by `hc1`.
   */
  bandwidth?: number;
  /**
   * Time index of each row, same length and order as `y`. `hac` needs it to
   * know how far apart two observations are; without it, the rows that survive
   * listwise deletion are treated as consecutive, which over-weights pairs that
   * straddle a gap in the export. Must be non-decreasing.
   */
  times?: Num[];
  /** One name per column of `rows`. Defaults to `x1…xk`. */
  names?: string[];
  /** Prepend a constant column. On by default. */
  intercept?: boolean;
  interceptName?: string;
  /** Minimum complete observations. Defaults to `max(20, 5 · columns)`. */
  minN?: number;
  /** Confidence level for the reported interval. */
  level?: number;
}

/** Newey–West (1994) rule of thumb for the Bartlett lag truncation. */
export const neweyWestBandwidth = (n: number): number =>
  Math.max(0, Math.floor(4 * Math.pow(n / 100, 2 / 9)));

/**
 * A column whose remaining norm falls below this fraction of the largest
 * initial column norm is treated as a linear combination of the columns already
 * taken. Squared norms, so this is 10⁻⁶ in the units of the data.
 */
const RANK_TOLERANCE = 1e-12;

/**
 * Multivariate OLS by Householder QR with column pivoting, with HC1 robust
 * standard errors.
 *
 * QR and not the normal equations: the designs this project builds carry
 * weekday and month fixed effects, whose XʹX has a condition number that
 * squares whatever the design already had. Cholesky on that either fails or,
 * worse, succeeds and returns coefficients that are wrong in the third digit.
 * Pivoting also gives rank detection for free, which is what makes a full set
 * of dummies plus an intercept safe to pass in: the aliased column is dropped
 * and named instead of producing a singular solve.
 *
 * Rows with any missing value are dropped whole (listwise). The export has
 * holes and imputing them would invent the very covariance the model measures.
 */
export function ols(y: Num[], rows: Num[][], options: OlsOptions): OlsResult {
  const width = rows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
  const names = options.names ?? Array.from({ length: width }, (_, j) => `x${j + 1}`);
  const intercept = options.intercept ?? true;
  const level = options.level ?? 0.95;
  const columnNames = intercept ? [options.interceptName ?? 'const', ...names] : [...names];
  const minN = options.minN ?? Math.max(20, 5 * columnNames.length);

  // Listwise deletion. The time index rides along, because the surviving rows
  // are no longer evenly spaced and HAC has to know that.
  const designRows: number[][] = [];
  const target: number[] = [];
  const clock: number[] = [];
  for (let i = 0; i < Math.min(y.length, rows.length); i++) {
    const outcome = y[i];
    if (!isNum(outcome)) continue;
    const row = rows[i] ?? [];
    const values: number[] = intercept ? [1] : [];
    let complete = true;
    for (let j = 0; j < width; j++) {
      const v = row[j];
      if (!isNum(v)) {
        complete = false;
        break;
      }
      values.push(v);
    }
    if (!complete) continue;
    const stamp = options.times?.[i];
    designRows.push(values);
    target.push(outcome);
    clock.push(isNum(stamp) ? stamp : i);
  }

  const n = target.length;
  if (n < minN) return insufficient(n, minN);

  const columns = columnNames.map((_, j) => designRows.map((row) => row[j]));
  const { pivot, rank, r, qty } = qrPivot(columns, target);
  if (rank === 0 || n - rank < 1) return insufficient(n, Math.max(minN, rank + 2));

  // Coefficients in pivoted order, then back to the order the caller gave.
  const betaPivoted = backSolve(r, qty, rank);
  const retained = pivot.slice(0, rank);
  const order = [...retained].sort((a, b) => a - b);
  const slotOf = new Map(retained.map((original, slot) => [original, slot]));

  const design = order.map((original) => columns[original]);
  const fitted = new Array<number>(n).fill(0);
  const beta = order.map((original) => betaPivoted[slotOf.get(original)!]);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let a = 0; a < order.length; a++) acc += design[a][i] * beta[a];
    fitted[i] = acc;
  }
  const residuals = target.map((value, i) => value - fitted[i]);

  // (XʹX)⁻¹ = R⁻¹R⁻ᵀ, straight off the triangular factor.
  const rInv = invertUpper(r, rank);
  const xtxPivoted = symmetric(rank, (a, b) => {
    let acc = 0;
    for (let j = 0; j < rank; j++) acc += rInv[a][j] * rInv[b][j];
    return acc;
  });
  const xtxInv = reindex(xtxPivoted, order, slotOf);

  // The sandwich: (XʹX)⁻¹ Ω̂ (XʹX)⁻¹ · n/(n−k). Only Ω̂ differs between the two
  // estimators, and only in whether it looks past the diagonal in time.
  const vcovType = options.vcov;
  const bandwidth =
    vcovType === 'hac'
      ? Math.max(0, Math.min(n - 1, Math.floor(options.bandwidth ?? neweyWestBandwidth(n))))
      : null;
  const meat =
    bandwidth == null
      ? whiteMeat(design, residuals)
      : bartlettMeat(design, residuals, clock, bandwidth);
  const df = n - rank;
  const scale = n / df;
  const vcov = symmetric(order.length, (a, b) => {
    let acc = 0;
    for (let c = 0; c < order.length; c++) {
      for (let d = 0; d < order.length; d++) acc += xtxInv[a][c] * meat[c][d] * xtxInv[d][b];
    }
    return acc * scale;
  });

  const hasConstant = intercept && order[0] === 0;
  const ssr = residuals.reduce((s, u) => s + u * u, 0);
  const meanY = target.reduce((s, v) => s + v, 0) / n;
  const sst = hasConstant
    ? target.reduce((s, v) => s + (v - meanY) ** 2, 0)
    : target.reduce((s, v) => s + v * v, 0);
  const r2 = sst > 0 ? 1 - ssr / sst : 1;
  const dfTotal = n - (hasConstant ? 1 : 0);
  const r2Adjusted = dfTotal > df ? 1 - ((1 - r2) * dfTotal) / df : r2;

  const critical = tQuantile(1 - (1 - level) / 2, df) ?? 1.96;
  const terms: OlsTerm[] = order.map((original, a) => {
    const coef = beta[a];
    const se = Math.sqrt(Math.max(0, vcov[a][a]));
    const t = se > 0 ? coef / se : 0;
    return {
      name: columnNames[original],
      coef,
      se,
      t,
      p: se > 0 ? Math.min(1, Math.max(0, 2 * (1 - studentCdf(Math.abs(t), df)))) : 1,
      ciLow: coef - critical * se,
      ciHigh: coef + critical * se,
    };
  });

  return {
    ok: true,
    terms,
    dropped: pivot.slice(rank).map((original) => columnNames[original]),
    n,
    k: rank,
    df,
    minN,
    r2,
    r2Adjusted,
    sigma: Math.sqrt(ssr / df),
    fitted,
    residuals,
    vcov,
    vcovType,
    bandwidth,
    xtxInv,
    level,
  };
}

/**
 * Ω̂ for HC1: Σᵢ uᵢ² xᵢxᵢʹ. Each observation contributes only to itself, which
 * is exactly the assumption that fails on a daily series.
 */
function whiteMeat(design: number[][], residuals: number[]): number[][] {
  const n = residuals.length;
  return symmetric(design.length, (a, b) => {
    let acc = 0;
    for (let i = 0; i < n; i++) acc += residuals[i] * residuals[i] * design[a][i] * design[b][i];
    return acc;
  });
}

/**
 * Ω̂ for Newey–West: the long-run covariance of the scores xᵢuᵢ,
 *
 *   Ω̂ = Γ̂₀ + Σ_{ℓ=1}^{L} (1 − ℓ/(L+1)) (Γ̂_ℓ + Γ̂_ℓʹ)
 *
 * written here as one pass over every pair of observations closer together
 * than L in *time* rather than in array position. Writing it that way is what
 * lets a gap in the export be a gap: two days either side of a missing fortnight
 * are not neighbours, and pairing them would put correlation into Ω̂ that the
 * data never showed.
 *
 * The Bartlett weight is not decoration. Truncating the sum with equal weights
 * can produce a Ω̂ that is not positive semi-definite — and therefore a negative
 * variance — whereas the triangular taper cannot.
 *
 * Requires `clock` to be non-decreasing, which is what the loop's early exit
 * relies on. Rows arrive in day order everywhere in this project.
 */
function bartlettMeat(
  design: number[][],
  residuals: number[],
  clock: number[],
  bandwidth: number,
): number[][] {
  const width = design.length;
  const n = residuals.length;
  const window = bandwidth + 1;
  const out = Array.from({ length: width }, () => new Array<number>(width).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const distance = clock[j] - clock[i];
      if (distance > bandwidth) break;
      const cross = (1 - distance / window) * residuals[i] * residuals[j];
      if (cross === 0) continue;
      for (let a = 0; a < width; a++) {
        for (let b = a; b < width; b++) {
          out[a][b] +=
            i === j
              ? cross * design[a][i] * design[b][i]
              : cross * (design[a][i] * design[b][j] + design[a][j] * design[b][i]);
        }
      }
    }
  }
  for (let a = 0; a < width; a++) for (let b = 0; b < a; b++) out[a][b] = out[b][a];
  return out;
}

interface Qr {
  /** Original column index at each pivot position. */
  pivot: number[];
  rank: number;
  /** Upper-triangular factor, `rank × rank`, in pivoted order. */
  r: number[][];
  /** Qᵀy. Only the first `rank` entries take part in the solve. */
  qty: number[];
}

/**
 * Householder QR with Businger–Golub column pivoting. Column norms are
 * recomputed rather than downdated: downdating is faster and loses exactly the
 * precision the pivot decision depends on.
 */
function qrPivot(columns: number[][], y: number[]): Qr {
  const m = y.length;
  const width = columns.length;
  const a = columns.map((column) => column.slice());
  const qty = y.slice();
  const pivot = Array.from({ length: width }, (_, j) => j);
  const norm = (column: number[], from: number) => {
    let acc = 0;
    for (let i = from; i < m; i++) acc += column[i] * column[i];
    return acc;
  };
  const largest = Math.max(...a.map((column) => norm(column, 0)), Number.MIN_VALUE);
  const limit = Math.min(m, width);
  let rank = 0;

  for (let k = 0; k < limit; k++) {
    let best = k;
    let bestNorm = norm(a[k], k);
    for (let j = k + 1; j < width; j++) {
      const candidate = norm(a[j], k);
      if (candidate > bestNorm) {
        best = j;
        bestNorm = candidate;
      }
    }
    if (bestNorm <= RANK_TOLERANCE * largest) break;
    if (best !== k) {
      [a[k], a[best]] = [a[best], a[k]];
      [pivot[k], pivot[best]] = [pivot[best], pivot[k]];
    }

    const alpha = a[k][k] > 0 ? -Math.sqrt(bestNorm) : Math.sqrt(bestNorm);
    const v = new Array<number>(m).fill(0);
    for (let i = k; i < m; i++) v[i] = a[k][i];
    v[k] -= alpha;
    let vtv = 0;
    for (let i = k; i < m; i++) vtv += v[i] * v[i];
    if (vtv > 0) {
      for (let j = k; j < width; j++) {
        let dot = 0;
        for (let i = k; i < m; i++) dot += v[i] * a[j][i];
        const f = (2 * dot) / vtv;
        for (let i = k; i < m; i++) a[j][i] -= f * v[i];
      }
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i] * qty[i];
      const f = (2 * dot) / vtv;
      for (let i = k; i < m; i++) qty[i] -= f * v[i];
    }
    rank = k + 1;
  }

  const r = Array.from({ length: rank }, (_, i) =>
    Array.from({ length: rank }, (_, j) => (j >= i ? a[j][i] : 0)),
  );
  return { pivot, rank, r, qty };
}

/** Back substitution on an upper-triangular system. */
function backSolve(r: number[][], qty: number[], rank: number): number[] {
  const out = new Array<number>(rank).fill(0);
  for (let i = rank - 1; i >= 0; i--) {
    let acc = qty[i];
    for (let j = i + 1; j < rank; j++) acc -= r[i][j] * out[j];
    out[i] = acc / r[i][i];
  }
  return out;
}

function invertUpper(r: number[][], rank: number): number[][] {
  const inv = Array.from({ length: rank }, () => new Array<number>(rank).fill(0));
  for (let i = rank - 1; i >= 0; i--) {
    inv[i][i] = 1 / r[i][i];
    for (let j = i + 1; j < rank; j++) {
      let acc = 0;
      for (let k = i + 1; k <= j; k++) acc += r[i][k] * inv[k][j];
      inv[i][j] = -acc / r[i][i];
    }
  }
  return inv;
}

/** Build a symmetric matrix from a generator, computing each pair once. */
function symmetric(size: number, cell: (a: number, b: number) => number): number[][] {
  const out = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let a = 0; a < size; a++) {
    for (let b = a; b < size; b++) {
      const value = cell(a, b);
      out[a][b] = value;
      out[b][a] = value;
    }
  }
  return out;
}

/** Move a matrix out of pivoted order and into the order the caller gave. */
function reindex(matrix: number[][], order: number[], slotOf: Map<number, number>): number[][] {
  return order.map((rowOriginal) =>
    order.map((colOriginal) => matrix[slotOf.get(rowOriginal)!][slotOf.get(colOriginal)!]),
  );
}
