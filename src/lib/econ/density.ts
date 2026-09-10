import { quantile } from '../stats';
import { insufficient, isNum, type Insufficient, type Num } from './types';

/* ------------------------------ histogram --------------------------------- */

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  /** Count normalised so the bars integrate to one, comparable with a density. */
  density: number;
}

export interface HistogramOptions {
  /** Equal-width bins. Defaults to the Freedman–Diaconis rule. */
  bins?: number;
}

const finite = (values: Num[]): number[] => values.filter(isNum);

export const interquartileRange = (values: Num[]): number => {
  const data = finite(values);
  const q3 = quantile(data, 0.75);
  const q1 = quantile(data, 0.25);
  return q3 != null && q1 != null ? q3 - q1 : 0;
};

const standardDeviation = (values: number[]): number => {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
};

/**
 * Equal-width histogram.
 *
 * Freedman–Diaconis (2·IQR·n^(−1/3) wide) rather than Sturges for the default
 * bin count: Sturges assumes normality and visibly under-bins anything with two
 * humps, which is the shape this panel exists to show. The IQR keeps the rule
 * from being dragged around by one very hard day.
 */
export function histogram(values: Num[], options: HistogramOptions = {}): HistogramBin[] {
  const data = finite(values);
  const n = data.length;
  if (!n) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  if (!(max > min)) return [{ from: min, to: min, count: n, density: 0 }];

  const width = 2 * interquartileRange(data) * Math.pow(n, -1 / 3);
  const suggested = width > 0 ? Math.ceil((max - min) / width) : Math.ceil(Math.sqrt(n));
  const bins = Math.max(4, Math.min(60, options.bins ?? suggested));

  const step = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of data) {
    // The top edge belongs to the last bin rather than to a bin of its own.
    const index = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[index]++;
  }

  return counts.map((count, i) => ({
    from: min + i * step,
    to: min + (i + 1) * step,
    count,
    density: count / (n * step),
  }));
}

/* --------------------------- kernel density ------------------------------- */

export interface DensityPoint {
  x: number;
  y: number;
}

export interface KernelDensity {
  points: DensityPoint[];
  bandwidth: number;
}

/**
 * Silverman's rule of thumb, `0.9 · min(sd, IQR/1.34) · n^(−1/5)`.
 *
 * The `min` with the scaled IQR is what keeps it usable here: on a bimodal
 * sample the standard deviation is inflated by the distance between the humps,
 * and a bandwidth chosen from it would smooth away exactly the structure we are
 * looking for.
 */
export function silvermanBandwidth(values: Num[]): number {
  const data = finite(values);
  const n = data.length;
  if (n < 2) return 0;
  const spread = Math.min(standardDeviation(data), interquartileRange(data) / 1.34) || 0;
  return spread > 0 ? 0.9 * spread * Math.pow(n, -1 / 5) : 0;
}

/**
 * A grid the kernel density estimate is evaluated on, and the binned counts of
 * the sample over it.
 *
 * Binning once and convolving is what makes the modality test affordable: the
 * bootstrap below evaluates a few hundred densities, and evaluating each one
 * directly against every observation would be tens of millions of `exp` calls.
 * Linear binning splits each observation between its two neighbouring grid
 * points, which keeps the discretisation error at O(Δ²) instead of O(Δ).
 */
interface Grid {
  from: number;
  step: number;
  points: number;
}

const makeGrid = (data: number[], pad: number, points: number): Grid => {
  const min = Math.min(...data) - pad;
  const max = Math.max(...data) + pad;
  const span = max > min ? max - min : 1;
  return { from: min, step: span / (points - 1), points };
};

const linearBinning = (data: number[], grid: Grid): Float64Array => {
  const counts = new Float64Array(grid.points);
  for (const v of data) {
    const pos = (v - grid.from) / grid.step;
    const lo = Math.floor(pos);
    if (lo < -1 || lo > grid.points - 1) continue;
    const frac = pos - lo;
    if (lo >= 0) counts[lo] += 1 - frac;
    if (lo + 1 < grid.points) counts[lo + 1] += frac;
  }
  return counts;
};

/** Gaussian kernel truncated at four bandwidths, where it is below 1e-4 of its peak. */
const convolve = (counts: Float64Array, grid: Grid, bandwidth: number): Float64Array => {
  const out = new Float64Array(grid.points);
  const reach = Math.max(1, Math.ceil((4 * bandwidth) / grid.step));
  const weights = new Float64Array(reach + 1);
  for (let j = 0; j <= reach; j++) {
    weights[j] = Math.exp(-0.5 * ((j * grid.step) / bandwidth) ** 2);
  }
  for (let i = 0; i < grid.points; i++) {
    const c = counts[i];
    if (c === 0) continue;
    const lo = Math.max(0, i - reach);
    const hi = Math.min(grid.points - 1, i + reach);
    for (let j = lo; j <= hi; j++) out[j] += c * weights[Math.abs(j - i)];
  }
  const total = counts.reduce((s, c) => s + c, 0);
  const scale = 1 / (total * bandwidth * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < grid.points; i++) out[i] *= scale;
  return out;
};

const GRID_POINTS = 512;

/**
 * Gaussian kernel density estimate on an evenly spaced grid.
 *
 * The grid is padded by three bandwidths on each side so the curve is allowed
 * to come down to zero outside the data. Cutting it at the extreme observations
 * would leave a step there, and a step reads as a peak to anything counting
 * local maxima.
 */
export function kernelDensity(
  values: Num[],
  options: { bandwidth?: number; points?: number } = {},
): KernelDensity {
  const data = finite(values);
  const bandwidth = options.bandwidth ?? silvermanBandwidth(data);
  const points = options.points ?? GRID_POINTS;
  if (data.length < 2 || !(bandwidth > 0)) return { points: [], bandwidth };

  const grid = makeGrid(data, 3 * bandwidth, points);
  const density = convolve(linearBinning(data, grid), grid, bandwidth);
  return {
    points: Array.from(density, (y, i) => ({ x: grid.from + i * grid.step, y })),
    bandwidth,
  };
}

export interface DensityPeak extends DensityPoint {
  /** Rank by height, 0 being the tallest. */
  rank: number;
}

/**
 * Local maxima of a density evaluated on a grid.
 *
 * A peak has to clear a thousandth of the tallest one to be counted. That is
 * not a smoothing choice — the bandwidth already made those — it only discards
 * the numerically flat tails, where floating point noise on values around 1e-18
 * would otherwise register as structure.
 */
export function densityPeaks(points: DensityPoint[]): DensityPeak[] {
  if (points.length < 3) return [];
  const highest = points.reduce((max, p) => Math.max(max, p.y), 0);
  const floor = highest * 1e-3;

  const found: DensityPoint[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].y <= floor) continue;
    if (points[i].y <= points[i - 1].y) continue;
    // Walk across a plateau; it is one maximum, not one per grid point.
    let j = i;
    while (j + 1 < points.length && points[j + 1].y === points[i].y) j++;
    if (j + 1 < points.length && points[j + 1].y < points[i].y) {
      found.push({ x: (points[i].x + points[j].x) / 2, y: points[i].y });
    }
    i = j;
  }

  const order = [...found].sort((a, b) => b.y - a.y);
  return found.map((p) => ({ ...p, rank: order.indexOf(p) }));
}

const countModes = (density: Float64Array, step: number, from: number): number =>
  densityPeaks(Array.from(density, (y, i) => ({ x: from + i * step, y }))).length;

/* ------------------------- modality: Silverman ---------------------------- */

export interface Modality {
  ok: true;
  /** Modes of the density at the rule-of-thumb bandwidth, which is what is drawn. */
  modes: number;
  peaks: DensityPeak[];
  /** Deepest point between the two tallest peaks, when there are two. */
  antimode: DensityPoint | null;
  /**
   * Depth of that valley as a share of the shorter of the two peaks it divides.
   * 0 is no valley at all, 1 is a valley that reaches zero.
   */
  separation: number | null;
  /** Smallest bandwidth whose density still has more than one mode. */
  criticalBandwidth: number;
  ruleOfThumbBandwidth: number;
  /** Bootstrap p-value for H₀: the distribution has one mode. */
  p: number;
  replicates: number;
  n: number;
  minN: number;
}

export type ModalityResult = Modality | Insufficient;

export interface ModalityOptions {
  minN?: number;
  /** Smoothed-bootstrap replicates. */
  replicates?: number;
  points?: number;
}

/**
 * Deterministic noise for the bootstrap, seeded from the sample itself.
 *
 * A panel whose p-value changes on every re-render is a panel nobody can quote,
 * and a screenshot of one is a screenshot of a number that no longer exists. The
 * seed is a hash of the data, so the same window always produces the same answer
 * and a different window is free to produce a different one.
 */
function seededNormals(data: number[]): () => number {
  let seed = 2166136261 >>> 0;
  for (const v of data) {
    const bits = Math.round(v * 1e6) >>> 0;
    seed = Math.imul(seed ^ bits, 16777619) >>> 0;
  }
  let spare: number | null = null;
  const uniform = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const normal = () => {
    if (spare != null) {
      const held = spare;
      spare = null;
      return held;
    }
    const a = Math.max(1e-12, uniform());
    const b = uniform();
    const radius = Math.sqrt(-2 * Math.log(a));
    spare = radius * Math.sin(2 * Math.PI * b);
    return radius * Math.cos(2 * Math.PI * b);
  };
  return Object.assign(normal, { uniform });
}

/**
 * Silverman's critical-bandwidth test for unimodality, with the smoothed
 * bootstrap that calibrates it.
 *
 * Counting humps in a kernel density is not a finding, it is a bandwidth
 * choice: widen it far enough and everything has one mode, narrow it far enough
 * and everything has a hundred. This test takes the choice away. For a Gaussian
 * kernel the number of modes is non-increasing in the bandwidth, so there is a
 * single **critical bandwidth** h₁ — the smallest one at which the second mode
 * survives. A big h₁ means the data insist on two humps even under heavy
 * smoothing.
 *
 * «Big» compared with what is the question the bootstrap answers. Under the
 * null the sample comes from the unimodal density estimated at h₁ itself, so we
 * resample from it and ask how often a sample that really is unimodal needs a
 * bandwidth that large. The rescaling
 *
 *     y = x̄ + (x* − x̄ + h·ε) / √(1 + h²/σ²)
 *
 * keeps the bootstrap variance equal to the sample variance; without it the
 * added kernel noise inflates the spread and the test loses most of its power.
 *
 * Reported as a p-value for a hypothesis about **shape**, not about strain. It
 * says the distribution has more than one hump; it does not say the two humps
 * are rest days and training days, which is a reading of the data, not a result.
 */
export function silvermanModality(values: Num[], options: ModalityOptions = {}): ModalityResult {
  const { minN = 60, replicates = 200, points = GRID_POINTS } = options;
  const data = finite(values);
  const n = data.length;
  if (n < minN) return insufficient(n, minN);

  const ruleOfThumb = silvermanBandwidth(data);
  const sd = standardDeviation(data);
  if (!(ruleOfThumb > 0) || !(sd > 0)) return insufficient(n, minN);

  const drawn = kernelDensity(data, { bandwidth: ruleOfThumb, points });
  const peaks = densityPeaks(drawn.points);

  // The valley between the two tallest peaks, and how deep it is relative to
  // the shorter of them. This is descriptive: it says how separated, the
  // p-value says whether separated at all.
  let antimode: DensityPoint | null = null;
  let separation: number | null = null;
  const tallest = [...peaks].sort((a, b) => b.y - a.y).slice(0, 2);
  if (tallest.length === 2) {
    const [left, right] = [...tallest].sort((a, b) => a.x - b.x);
    const between = drawn.points.filter((p) => p.x > left.x && p.x < right.x);
    if (between.length) {
      antimode = between.reduce((low, p) => (p.y < low.y ? p : low));
      const shorter = Math.min(left.y, right.y);
      separation = shorter > 0 ? 1 - antimode.y / shorter : null;
    }
  }

  // Bisection for the critical bandwidth. Mode count is monotone in h for a
  // Gaussian kernel, which is the theorem that makes a bisection legitimate here.
  const grid = makeGrid(data, 3 * Math.max(ruleOfThumb, sd), points);
  const modesAt = (sample: number[], h: number) =>
    countModes(convolve(linearBinning(sample, grid), grid, h), grid.step, grid.from);

  let lo = ruleOfThumb / 64;
  let hi = Math.max(ruleOfThumb, sd) * 4;
  if (modesAt(data, hi) > 1) hi *= 4;
  if (modesAt(data, hi) > 1) {
    // Even gross oversmoothing leaves two humps: nothing left to bisect for.
    return {
      ok: true,
      modes: peaks.length,
      peaks,
      antimode,
      separation,
      criticalBandwidth: hi,
      ruleOfThumbBandwidth: ruleOfThumb,
      p: 0,
      replicates: 0,
      n,
      minN,
    };
  }
  for (let i = 0; i < 40 && hi - lo > 1e-4 * ruleOfThumb; i++) {
    const mid = (lo + hi) / 2;
    if (modesAt(data, mid) > 1) lo = mid;
    else hi = mid;
  }
  const critical = hi;

  const mean = data.reduce((s, v) => s + v, 0) / n;
  const shrink = 1 / Math.sqrt(1 + (critical * critical) / (sd * sd));
  const normal = seededNormals(data) as (() => number) & { uniform: () => number };

  let exceed = 0;
  const sample = new Array<number>(n);
  for (let b = 0; b < replicates; b++) {
    for (let i = 0; i < n; i++) {
      const drawnValue = data[Math.min(n - 1, Math.floor(normal.uniform() * n))];
      sample[i] = mean + (drawnValue - mean + critical * normal()) * shrink;
    }
    if (modesAt(sample, critical) > 1) exceed++;
  }

  return {
    ok: true,
    modes: peaks.length,
    peaks,
    antimode,
    separation,
    criticalBandwidth: critical,
    ruleOfThumbBandwidth: ruleOfThumb,
    // Add-one smoothing: a bootstrap that never exceeded is evidence for a small
    // p, not proof of zero, and printing «p = 0» from 200 draws would be a lie.
    p: (exceed + 1) / (replicates + 1),
    replicates,
    n,
    minN,
  };
}

/* ---------------------------- support gaps -------------------------------- */

export interface SupportGap {
  /** Largest observation below the gap. */
  from: number;
  /** Smallest observation above it. */
  to: number;
  width: number;
  /** Width as a share of the observed range. */
  share: number;
}

export interface SupportGaps {
  gaps: SupportGap[];
  /** The widest one, or null. */
  widest: SupportGap | null;
  min: number;
  max: number;
  n: number;
}

/**
 * Stretches of a variable's range where nothing was ever observed.
 *
 * The reason a panel cares: a slope fitted across an empty band is not
 * describing a relationship over that band, it is drawing a line between two
 * clusters. Every functional form that passes through both group means fits
 * equally well, and the data cannot choose between them. Whether the answer is
 * still useful depends on the question, but the reader has to be told that the
 * middle of the x axis is an extrapolation and not a measurement.
 *
 * `minShare` is the fraction of the observed range an empty interval has to
 * span before it is worth saying so. A tenth is small enough to catch a real
 * split and large enough not to fire on the ordinary sparseness of a tail.
 */
export function supportGaps(values: Num[], options: { minShare?: number } = {}): SupportGaps {
  const { minShare = 0.1 } = options;
  const data = finite(values).sort((a, b) => a - b);
  const n = data.length;
  if (n < 2) return { gaps: [], widest: null, min: NaN, max: NaN, n };

  const min = data[0];
  const max = data[n - 1];
  const range = max - min;
  if (!(range > 0)) return { gaps: [], widest: null, min, max, n };

  const gaps: SupportGap[] = [];
  for (let i = 1; i < n; i++) {
    const width = data[i] - data[i - 1];
    const share = width / range;
    if (share >= minShare) {
      gaps.push({ from: data[i - 1], to: data[i], width, share });
    }
  }
  gaps.sort((a, b) => b.width - a.width);
  return { gaps, widest: gaps[0] ?? null, min, max, n };
}
