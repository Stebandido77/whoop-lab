import { insufficient, isNum, type Insufficient, type Num } from './types';

export interface PeriodogramPoint {
  /** Period in the units of `times` — days, for a daily series. */
  period: number;
  frequency: number;
  /** Scargle-normalised power. Exponential with mean 1 under white noise. */
  power: number;
}

export interface PeriodogramPeak {
  period: number;
  power: number;
  /** Probability of seeing a peak this tall in white noise, over the whole grid. */
  fap: number;
}

export interface Periodogram {
  ok: true;
  /** The spectrum, ascending in period. */
  points: PeriodogramPoint[];
  peak: PeriodogramPeak | null;
  /** Power a peak has to clear to be called real at `faProbability`. */
  faLevel: number;
  faProbability: number;
  /** Independent frequencies the false-alarm calculation charges for. */
  independentFrequencies: number;
  n: number;
  minN: number;
}

export type PeriodogramResult = Periodogram | Insufficient;

export interface LombScargleOptions {
  /** Shortest period to look for. Defaults to 2, the Nyquist limit of daily data. */
  minPeriod?: number;
  /** Longest period. Defaults to half the observed span: one cycle is not evidence. */
  maxPeriod?: number;
  /** Grid points per independent frequency. */
  oversample?: number;
  /** False-alarm probability behind `faLevel`. */
  faProbability?: number;
  minN?: number;
}

/**
 * Normalised Lomb–Scargle periodogram.
 *
 *   P(ω) = 1/(2σ²) · [ (Σ dᵢ cos ω(tᵢ−τ))² / Σ cos²ω(tᵢ−τ)
 *                    + (Σ dᵢ sin ω(tᵢ−τ))² / Σ sin²ω(tᵢ−τ) ]
 *
 * with d = y − ȳ and the time offset τ fixed by tan 2ωτ = Σ sin 2ωtᵢ / Σ cos 2ωtᵢ.
 * That offset is what makes the estimator equivalent to least-squares fitting a
 * sinusoid at each frequency, and it is why this works on gappy, unevenly
 * spaced data where an FFT would need the holes filled in — and filling them in
 * is precisely how you manufacture a weekly cycle that is not there.
 *
 * The normalisation is Scargle's: under white noise the power at a frequency is
 * exponentially distributed with mean 1, so `Pr(P > z) = e^⁻ᶻ` and the
 * false-alarm probability over M independent frequencies is `1 − (1 − e^⁻ᶻ)^M`.
 * M comes from Horne & Baliunas rather than from the grid size, so oversampling
 * the grid buys resolution without quietly inflating the significance.
 *
 * Only the mean is removed. A series with a trend in it will leak power into
 * the long periods; detrend before asking this what cycles are in your HRV.
 */
export function lombScargle(
  times: Num[],
  values: Num[],
  options: LombScargleOptions = {},
): PeriodogramResult {
  const { oversample = 5, faProbability = 0.05, minN = 30 } = options;

  const t: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < Math.min(times.length, values.length); i++) {
    const time = times[i];
    const value = values[i];
    if (isNum(time) && isNum(value)) {
      t.push(time);
      y.push(value);
    }
  }
  const n = t.length;
  if (n < minN) return insufficient(n, minN);

  const mean = y.reduce((s, v) => s + v, 0) / n;
  const deviation = y.map((v) => v - mean);
  const variance = deviation.reduce((s, d) => s + d * d, 0) / (n - 1);
  if (!(variance > 0)) return insufficient(n, Math.max(minN, n + 1));

  const span = Math.max(...t) - Math.min(...t);
  if (!(span > 0)) return insufficient(n, Math.max(minN, n + 1));
  const minPeriod = Math.max(options.minPeriod ?? 2, 1e-9);
  const maxPeriod = Math.min(options.maxPeriod ?? span / 2, span);
  if (!(maxPeriod > minPeriod)) return insufficient(n, Math.max(minN, n + 1));

  // Uniform in frequency: that is where the resolution 1/span is uniform.
  const loFrequency = 1 / maxPeriod;
  const hiFrequency = 1 / minPeriod;
  const step = 1 / (span * oversample);
  const count = Math.max(2, Math.ceil((hiFrequency - loFrequency) / step) + 1);

  const points: PeriodogramPoint[] = [];
  for (let i = 0; i < count; i++) {
    const frequency = loFrequency + i * step;
    if (frequency > hiFrequency + 1e-12) break;
    const omega = 2 * Math.PI * frequency;

    let sin2 = 0;
    let cos2 = 0;
    for (const time of t) {
      sin2 += Math.sin(2 * omega * time);
      cos2 += Math.cos(2 * omega * time);
    }
    const tau = Math.atan2(sin2, cos2) / (2 * omega);

    let cosSum = 0;
    let sinSum = 0;
    let cosSquares = 0;
    let sinSquares = 0;
    for (let j = 0; j < n; j++) {
      const angle = omega * (t[j] - tau);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      cosSum += deviation[j] * c;
      sinSum += deviation[j] * s;
      cosSquares += c * c;
      sinSquares += s * s;
    }
    const power =
      ((cosSquares > 1e-12 ? (cosSum * cosSum) / cosSquares : 0) +
        (sinSquares > 1e-12 ? (sinSum * sinSum) / sinSquares : 0)) /
      (2 * variance);
    points.push({ period: 1 / frequency, frequency, power: Math.max(0, power) });
  }

  points.sort((a, b) => a.period - b.period);
  const independentFrequencies = horneBaliunas(n);
  const best = points.reduce<PeriodogramPoint | null>(
    (top, point) => (top == null || point.power > top.power ? point : top),
    null,
  );

  return {
    ok: true,
    points,
    peak: best && {
      period: best.period,
      power: best.power,
      fap: falseAlarm(best.power, independentFrequencies),
    },
    faLevel: powerForFalseAlarm(faProbability, independentFrequencies),
    faProbability,
    independentFrequencies,
    n,
    minN,
  };
}

/**
 * Horne & Baliunas (1986) empirical count of independent frequencies in a
 * record of N points. Using the grid size instead would make a finer grid look
 * like more evidence, which is backwards.
 */
const horneBaliunas = (n: number): number =>
  Math.max(1, Math.round(-6.362 + 1.193 * n + 0.00098 * n * n));

/** `1 − (1 − e^⁻ᶻ)^M`, computed so that a tall peak does not round to zero. */
function falseAlarm(power: number, m: number): number {
  const tail = Math.exp(-power);
  if (tail < 1e-8) return Math.min(1, m * tail);
  return 1 - Math.pow(1 - tail, m);
}

/** The inverse: the power a peak needs to clear the given false-alarm rate. */
function powerForFalseAlarm(fap: number, m: number): number {
  const clamped = Math.min(1 - 1e-15, Math.max(1e-15, fap));
  return -Math.log(1 - Math.pow(1 - clamped, 1 / m));
}
