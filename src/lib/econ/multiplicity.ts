import { isNum, type Num } from './types';

export interface AdjustedTest {
  /** The p-value as given. Null when the test could not be run. */
  p: number | null;
  /** Benjamini–Hochberg q-value: the FDR you would accept by calling this one real. */
  q: number | null;
  /** Position in the ascending ordering of the family, 1-based. */
  rank: number | null;
  /** `q ≤ alpha`. Always false for a test that was not run. */
  significant: boolean;
}

/**
 * Benjamini–Hochberg step-up correction, returning q-values in the order the
 * p-values were given.
 *
 * Why every family of tests in this project goes through here: the habits panel
 * evaluates fifteen journal questions at once, and at p < 0,05 one false
 * positive among fifteen independent nulls is the expected outcome, not bad
 * luck. Controlling the family-wise error rate with Bonferroni would be honest
 * but so conservative that a real effect never survives; controlling the false
 * discovery rate instead answers the question a reader actually has, which is
 * "of the ones flagged, what share are noise?".
 *
 *   q₍ᵢ₎ = min over j ≥ i of (m/j) · p₍ⱼ₎, capped at 1
 *
 * The running minimum from the top is what enforces monotonicity: without it a
 * larger p-value could come back with a smaller q.
 *
 * Missing p-values pass through as null and are not counted in m — a test that
 * could not be run is not a test that came out null.
 */
export function benjaminiHochberg(pValues: Num[], alpha = 0.05): AdjustedTest[] {
  const present = pValues
    .map((p, index) => ({ p, index }))
    .filter((entry): entry is { p: number; index: number } => isNum(entry.p))
    .sort((a, b) => a.p - b.p);

  const m = present.length;
  const out: AdjustedTest[] = pValues.map(() => ({
    p: null,
    q: null,
    rank: null,
    significant: false,
  }));

  let running = 1;
  for (let j = m - 1; j >= 0; j--) {
    running = Math.min(running, (m / (j + 1)) * present[j].p);
    const q = Math.min(1, Math.max(0, running));
    out[present[j].index] = {
      p: present[j].p,
      q,
      rank: j + 1,
      significant: q <= alpha,
    };
  }
  return out;
}
