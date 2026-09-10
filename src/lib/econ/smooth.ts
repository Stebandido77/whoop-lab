import { tQuantile } from '../stats';
import { isNum, type Num } from './types';

export interface BinPoint {
  /** Mean of x inside the bin. */
  x: number;
  /** Mean of y inside the bin. */
  y: number;
  /** Standard error of the bin mean of y. */
  se: number;
  ciLow: number;
  ciHigh: number;
  n: number;
  /** Smallest and largest x that fell in the bin. */
  xLow: number;
  xHigh: number;
}

export interface BinscatterOptions {
  /** Number of quantile groups. */
  bins?: number;
  /** Bins thinner than this are dropped: a mean of two has no usable error. */
  minPerBin?: number;
  level?: number;
}

interface Pair {
  x: number;
  y: number;
}

const pairs = (xs: Num[], ys: Num[]): Pair[] => {
  const out: Pair[] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i];
    const y = ys[i];
    if (isNum(x) && isNum(y)) out.push({ x, y });
  }
  return out;
};

/**
 * Binscatter: group x into equal-count quantile bins and report the mean of
 * both variables inside each, with the standard error of the bin mean.
 *
 * What it buys over a raw scatter is readability without a functional form. Two
 * years of daily data is 700 overlapping dots in which the eye finds whatever
 * it expects; twenty bin means with error bars show the shape of the
 * conditional mean and — this is the part a fitted line hides — show where the
 * shape stops being a line.
 *
 * Bins are equal-count by rank rather than equal-width by value, so each error
 * bar carries the same weight of evidence. The cost is that a driver with heavy
 * ties (a boolean, a rounded count) will split identical x values across
 * neighbouring bins; those variables belong in a group comparison, not here.
 */
export function binscatter(xs: Num[], ys: Num[], options: BinscatterOptions = {}): BinPoint[] {
  const { bins = 20, minPerBin = 3, level = 0.95 } = options;
  const data = pairs(xs, ys).sort((a, b) => a.x - b.x);
  const n = data.length;
  if (n < minPerBin || bins < 1) return [];

  const out: BinPoint[] = [];
  for (let b = 0; b < bins; b++) {
    const from = Math.floor((b * n) / bins);
    const to = Math.floor(((b + 1) * n) / bins);
    const slice = data.slice(from, to);
    if (slice.length < Math.max(2, minPerBin)) continue;

    const size = slice.length;
    const meanX = slice.reduce((s, p) => s + p.x, 0) / size;
    const meanY = slice.reduce((s, p) => s + p.y, 0) / size;
    const variance = slice.reduce((s, p) => s + (p.y - meanY) ** 2, 0) / (size - 1);
    const se = Math.sqrt(variance / size);
    const critical = tQuantile(1 - (1 - level) / 2, size - 1) ?? 1.96;
    out.push({
      x: meanX,
      y: meanY,
      se,
      ciLow: meanY - critical * se,
      ciHigh: meanY + critical * se,
      n: size,
      xLow: slice[0].x,
      xHigh: slice[size - 1].x,
    });
  }
  return out;
}

export interface SmoothPoint {
  x: number;
  y: number;
}

export interface LoessOptions {
  /** Fraction of the sample in each local neighbourhood. */
  bandwidth?: number;
  /** How many x values to evaluate the curve at. */
  points?: number;
}

/**
 * Degree-1 LOESS: at each grid point, a linear fit of the nearest `bandwidth`
 * fraction of the data, weighted by the tricube kernel.
 *
 * Degree 1 rather than degree 0 because a local *mean* is biased wherever the
 * curve has slope — most visibly at the two ends, exactly where a reader looks
 * for "is it still going up?". A local line has no such bias: it reproduces a
 * straight relationship exactly, at any bandwidth.
 *
 * The bandwidth is the whole editorial decision. Small enough and the curve
 * traces the noise; large enough and it becomes the OLS line. It is a parameter
 * and not a constant so the panel can say which one it used.
 */
export function loess(xs: Num[], ys: Num[], options: LoessOptions = {}): SmoothPoint[] {
  const { bandwidth = 0.3, points = 60 } = options;
  const data = pairs(xs, ys).sort((a, b) => a.x - b.x);
  const n = data.length;
  if (n < 3) return [];

  const span = Math.max(2, Math.min(n, Math.round(bandwidth * n)));
  const minX = data[0].x;
  const maxX = data[n - 1].x;
  const grid =
    maxX > minX
      ? Array.from({ length: points }, (_, i) => minX + ((maxX - minX) * i) / (points - 1))
      : [minX];

  return grid.map((x0) => {
    // The `span` nearest neighbours, and the distance to the furthest of them.
    const distances = data
      .map((p, i) => ({ i, d: Math.abs(p.x - x0) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, span);
    const width = distances[distances.length - 1].d;

    let sw = 0;
    let swx = 0;
    let swy = 0;
    let swxx = 0;
    let swxy = 0;
    for (const { i, d } of distances) {
      const w = width > 0 ? (1 - (d / width) ** 3) ** 3 : 1;
      if (w <= 0) continue;
      const { x, y } = data[i];
      sw += w;
      swx += w * x;
      swy += w * y;
      swxx += w * x * x;
      swxy += w * x * y;
    }
    if (sw <= 0) return { x: x0, y: data[distances[0].i].y };

    const meanX = swx / sw;
    const meanY = swy / sw;
    const sxx = swxx - sw * meanX * meanX;
    const sxy = swxy - sw * meanX * meanY;
    // No spread in x inside the window: fall back to the weighted mean.
    const slope = Math.abs(sxx) > 1e-12 * Math.max(1, Math.abs(swxx)) ? sxy / sxx : 0;
    return { x: x0, y: meanY + slope * (x0 - meanX) };
  });
}
