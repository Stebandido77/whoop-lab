type Num = number | null | undefined;

const clean = (xs: Num[]): number[] =>
  xs.filter((x): x is number => x != null && Number.isFinite(x));

export function mean(xs: Num[]): number | null {
  const v = clean(xs);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export function sd(xs: Num[]): number | null {
  const v = clean(xs);
  if (v.length < 2) return null;
  const m = mean(v)!;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

export function median(xs: Num[]): number | null {
  const v = clean(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
}

export function quantile(xs: Num[], q: number): number | null {
  const v = clean(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export interface Correlation {
  r: number | null;
  n: number;
  /** Two-sided p-value from the t approximation. Null when r is null. */
  p: number | null;
}

/**
 * Pearson correlation over pairwise-complete observations.
 * Returns `r: null` below `minN` pairs so thin panels can hide themselves
 * instead of showing a correlation built on six points.
 */
export function pearson(xs: Num[], ys: Num[], minN = 8): Correlation {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i];
    const y = ys[i];
    if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  const n = pairs.length;
  if (n < minN) return { r: null, n, p: null };
  const mx = mean(pairs.map((d) => d[0]))!;
  const my = mean(pairs.map((d) => d[1]))!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return { r: null, n, p: null };
  const r = sxy / Math.sqrt(sxx * syy);
  const t = Math.abs(r) * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
  return { r, n, p: 2 * (1 - studentCdf(t, n - 2)) };
}

/** Ordinary least squares slope/intercept, pairwise complete. */
export function linreg(xs: Num[], ys: Num[]): { slope: number; intercept: number } | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i];
    const y = ys[i];
    if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 3) return null;
  const mx = mean(pairs.map((d) => d[0]))!;
  const my = mean(pairs.map((d) => d[1]))!;
  let sxy = 0;
  let sxx = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** Welch's t statistic for two independent samples of unequal variance. */
export function welchT(a: Num[], b: Num[]): number | null {
  const va = clean(a);
  const vb = clean(b);
  if (va.length < 2 || vb.length < 2) return null;
  const se = Math.sqrt(sd(va)! ** 2 / va.length + sd(vb)! ** 2 / vb.length);
  return se > 0 ? (mean(va)! - mean(vb)!) / se : null;
}

/**
 * Trailing rolling mean. Emits `null` until at least 40% of the window has data,
 * so a gap in the export does not fabricate a smooth line.
 */
export function rollingMean(xs: Num[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(xs.length).fill(null);
  const need = Math.max(2, Math.floor(window * 0.4));
  for (let i = 0; i < xs.length; i++) {
    const acc: number[] = [];
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = xs[j];
      if (v != null && Number.isFinite(v)) acc.push(v);
    }
    if (acc.length >= need) out[i] = acc.reduce((s, x) => s + x, 0) / acc.length;
  }
  return out;
}

/** Trailing rolling standard deviation, same null policy as rollingMean. */
export function rollingSd(xs: Num[], window: number): (number | null)[] {
  return xs.map((_, i) => sd(xs.slice(Math.max(0, i - window + 1), i + 1)));
}

/** Student-t CDF via the regularized incomplete beta function. */
export function studentCdf(t: number, df: number): number {
  if (df <= 0) return 0.5;
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(x, df / 2, 0.5);
}

/**
 * Two-sided p-value for a t statistic. The one place in the project that turns
 * a t into a p, so the tail convention is decided once.
 */
export function tTest(t: number, df: number): number | null {
  if (!Number.isFinite(t) || df <= 0) return null;
  return Math.min(1, Math.max(0, 2 * (1 - studentCdf(Math.abs(t), df))));
}

/**
 * Inverse Student-t CDF by bisection. Confidence bands need a critical value
 * and there is no closed form; 80 halvings of a wide bracket land well inside
 * double precision, and a fit only needs one call.
 */
export function tQuantile(p: number, df: number): number | null {
  if (!(p > 0 && p < 1) || df <= 0) return null;
  let lo = -400;
  let hi = 400;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (studentCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Regularized incomplete beta I_x(a, b), Lentz continued fraction (NR 6.4). */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - (lgamma(a) + lgamma(b) - lgamma(a + b)),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betacf(x, a, b)) / a
    : 1 - (front * betacf(1 - x, b, a)) / b;
}

function betacf(x: number, a: number, b: number): number {
  const TINY = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-((a + m) * (a + b + m)) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

/** Lanczos approximation to log-gamma. */
function lgamma(z: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
