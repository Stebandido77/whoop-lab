import { insufficient, isNum, type Insufficient, type Num } from './types';

export type CusumSide = 'high' | 'low';

export interface CusumPoint {
  index: number;
  day: string;
  /** The standardised observation. Null on a day with no data. */
  z: number | null;
  /** Upper accumulator C⁺. */
  high: number;
  /** Lower accumulator C⁻, reported positive. */
  low: number;
  signal: CusumSide | null;
}

export interface CusumSignal {
  index: number;
  day: string;
  side: CusumSide;
  /** The accumulator at the moment it crossed h. */
  value: number;
}

export interface CusumSummary {
  ok: true;
  points: CusumPoint[];
  signals: CusumSignal[];
  /** Days with data. */
  n: number;
  minN: number;
  k: number;
  h: number;
  /** Mean of the reference window, subtracted before accumulating. */
  center: number;
  /** Standard deviation of the reference window. */
  scale: number;
  /** How many leading days defined the baseline. */
  reference: number;
}

export type CusumResult = CusumSummary | Insufficient;

export interface CusumOptions {
  /**
   * Slack, in standard deviations. Shifts smaller than k are absorbed instead
   * of accumulated; k = ½ the shift you care about is the usual choice.
   */
  k?: number;
  /** Decision interval, in standard deviations. */
  h?: number;
  /**
   * Leading days that define the in-control baseline. Defaults to the whole
   * series, which asks «which days are unlike the period as a whole?»; set it
   * to a known-good stretch to ask «has anything changed since then?».
   */
  reference?: number;
  minN?: number;
}

/**
 * Two-sided tabular CUSUM on a standardised series.
 *
 *   C⁺ᵢ = max(0, C⁺ᵢ₋₁ + zᵢ − k)      C⁻ᵢ = max(0, C⁻ᵢ₋₁ − zᵢ − k)
 *
 * A rolling mean answers «where is the level now»; CUSUM answers «when did it
 * change», which is a different question and the one worth asking of a series
 * where the daily value is mostly noise. By accumulating small excursions it
 * catches a half-sigma drift that no single day would ever flag, and it dates
 * the crossing instead of leaving the reader to eyeball a smoothed line.
 *
 * Both accumulators reset after firing. Without that, one genuine shift leaves
 * the chart saturated for months and every later day looks like a new alarm.
 *
 * Days with no data pass through: the accumulators carry forward unchanged
 * rather than being fed a zero, which would count a gap as evidence of control.
 */
export function cusum(values: Num[], days: string[], options: CusumOptions = {}): CusumResult {
  const { k = 0.5, h = 5, minN = 21 } = options;
  const observed = values.filter(isNum);
  const n = observed.length;
  if (n < minN) return insufficient(n, minN);

  const reference = Math.min(options.reference ?? values.length, values.length);
  const baseline = values.slice(0, reference).filter(isNum);
  if (baseline.length < 2) return insufficient(baseline.length, Math.max(minN, 2));

  const center = baseline.reduce((s, v) => s + v, 0) / baseline.length;
  const scale = Math.sqrt(
    baseline.reduce((s, v) => s + (v - center) ** 2, 0) / (baseline.length - 1),
  );
  if (!(scale > 0)) return insufficient(n, Math.max(minN, n + 1));

  const points: CusumPoint[] = [];
  const signals: CusumSignal[] = [];
  let high = 0;
  let low = 0;

  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const day = days[i] ?? '';
    if (!isNum(raw)) {
      points.push({ index: i, day, z: null, high, low, signal: null });
      continue;
    }
    const z = (raw - center) / scale;
    high = Math.max(0, high + z - k);
    low = Math.max(0, low - z - k);

    let signal: CusumSide | null = null;
    if (high > h) {
      signal = 'high';
      signals.push({ index: i, day, side: 'high', value: high });
    } else if (low > h) {
      signal = 'low';
      signals.push({ index: i, day, side: 'low', value: low });
    }
    points.push({ index: i, day, z, high, low, signal });
    if (signal === 'high') high = 0;
    if (signal === 'low') low = 0;
  }

  return { ok: true, points, signals, n, minN, k, h, center, scale, reference };
}

export interface ChangePoint {
  /** Index in the original series of the first day of the new regime. */
  index: number;
  day: string;
  /** Mean of the segment before the break. */
  before: number;
  /** Mean of the segment after it. */
  after: number;
  delta: number;
  /** Observations in the segment that was split. */
  n: number;
  /** How much BIC improved by splitting. Bigger is stronger evidence. */
  bicGain: number;
}

export interface ChangePointSummary {
  ok: true;
  points: ChangePoint[];
  n: number;
  minN: number;
  minSegment: number;
}

export type ChangePointsResult = ChangePointSummary | Insufficient;

export interface ChangePointOptions {
  /** Shortest run of observed days either side of a break. */
  minSegment?: number;
  maxPoints?: number;
  minN?: number;
}

interface Observed {
  index: number;
  value: number;
}

/**
 * Mean-shift detection by binary segmentation with a BIC stopping rule.
 *
 * The recursion is the standard one: over a segment, find the split that
 * minimises the pooled sum of squares of the two halves, keep it if BIC
 * improves, then recurse into both halves. It runs on the observed days only
 * and reports positions back in the original index, so a stretch with no data
 * neither hides a break nor invents one.
 *
 * The penalty charges two parameters per break — the new mean *and* the
 * location — because the split point is itself estimated from the data. Only
 * charging for the mean makes the criterion far too easy to satisfy and a
 * stationary series comes back sliced into a dozen spurious regimes.
 *
 * Segmentation reports level shifts. A slow trend has no level shift in it, and
 * this will approximate one with a short staircase; read it as «something
 * changed around here», not as a date.
 */
export function changePoints(
  values: Num[],
  days: string[],
  options: ChangePointOptions = {},
): ChangePointsResult {
  const { minSegment = 10, maxPoints = 6, minN = 30 } = options;
  const observed: Observed[] = [];
  values.forEach((value, index) => {
    if (isNum(value)) observed.push({ index, value });
  });
  const n = observed.length;
  if (n < Math.max(minN, 2 * minSegment)) return insufficient(n, Math.max(minN, 2 * minSegment));

  // Prefix sums make the sum of squares of any run an O(1) lookup, which turns
  // the search over split points from O(n²) into O(n) per segment.
  const sum = new Float64Array(n + 1);
  const sumSquares = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    sum[i + 1] = sum[i] + observed[i].value;
    sumSquares[i + 1] = sumSquares[i] + observed[i].value * observed[i].value;
  }
  const mean = (from: number, to: number) => (sum[to] - sum[from]) / (to - from);
  const sse = (from: number, to: number) => {
    const size = to - from;
    if (size <= 0) return 0;
    const total = sum[to] - sum[from];
    return Math.max(0, sumSquares[to] - sumSquares[from] - (total * total) / size);
  };

  const found: ChangePoint[] = [];
  const search = (from: number, to: number) => {
    if (found.length >= maxPoints) return;
    const size = to - from;
    if (size < 2 * minSegment) return;

    const whole = sse(from, to);
    if (!(whole > 0)) return;

    let bestSplit = -1;
    let bestSse = Infinity;
    for (let split = from + minSegment; split <= to - minSegment; split++) {
      const candidate = sse(from, split) + sse(split, to);
      if (candidate < bestSse) {
        bestSse = candidate;
        bestSplit = split;
      }
    }
    if (bestSplit < 0 || !(bestSse > 0)) return;

    // BIC(split) − BIC(whole) = n·ln(SSEsplit/SSEwhole) + 2·ln(n). Keep it if negative.
    const bicGain = -(size * Math.log(bestSse / whole) + 2 * Math.log(size));
    if (bicGain <= 0) return;

    found.push({
      index: observed[bestSplit].index,
      day: days[observed[bestSplit].index] ?? '',
      before: mean(from, bestSplit),
      after: mean(bestSplit, to),
      delta: mean(bestSplit, to) - mean(from, bestSplit),
      n: size,
      bicGain,
    });
    search(from, bestSplit);
    search(bestSplit, to);
  };
  search(0, n);

  return {
    ok: true,
    points: found.sort((a, b) => a.index - b.index),
    n,
    minN: Math.max(minN, 2 * minSegment),
    minSegment,
  };
}
