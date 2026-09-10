import { describe, expect, it } from 'vitest';
import { benjaminiHochberg } from '@/lib/econ';

/**
 * The worked example from Benjamini & Hochberg (1995), §3: the p-values of the
 * Neuhaus et al. multiple-endpoint cardiac trial, printed in ascending order.
 * Bonferroni rejects three of them; the whole point of the paper is that the
 * step-up procedure rejects four.
 */
const PAPER = [
  0.0001, 0.0004, 0.0019, 0.0095, 0.0201, 0.0278, 0.0298, 0.0344, 0.0459, 0.324, 0.4262, 0.5719,
  0.6528, 0.759, 1.0,
];

/**
 * q₍ᵢ₎ = min over j ≥ i of (m/j)·p₍ⱼ₎, worked out by hand. Ranks 6 and 7 share a
 * value because the running minimum from the top pulls rank 6 down to rank 7's,
 * which is the monotonicity the procedure has to enforce.
 */
const PAPER_Q = [
  15 * 0.0001,
  (15 / 2) * 0.0004,
  (15 / 3) * 0.0019,
  (15 / 4) * 0.0095,
  (15 / 5) * 0.0201,
  (15 / 7) * 0.0298,
  (15 / 7) * 0.0298,
  (15 / 8) * 0.0344,
  (15 / 9) * 0.0459,
  (15 / 10) * 0.324,
  (15 / 11) * 0.4262,
  (15 / 12) * 0.5719,
  (15 / 13) * 0.6528,
  (15 / 14) * 0.759,
  1.0,
];

describe('benjaminiHochberg — the original paper', () => {
  it('reproduces the q-values of the paper example', () => {
    const out = benjaminiHochberg(PAPER);
    out.forEach((row, i) => {
      expect(row.q!).toBeCloseTo(PAPER_Q[i], 10);
    });
  });

  it('rejects the four hypotheses the paper rejects', () => {
    const out = benjaminiHochberg(PAPER, 0.05);
    expect(out.filter((row) => row.significant)).toHaveLength(4);
    expect(out.slice(0, 4).every((row) => row.significant)).toBe(true);
    expect(out.slice(4).some((row) => row.significant)).toBe(false);
  });

  it('is less conservative than Bonferroni on the same p-values', () => {
    const bonferroni = PAPER.filter((p) => p <= 0.05 / PAPER.length).length;
    const bh = benjaminiHochberg(PAPER, 0.05).filter((row) => row.significant).length;
    expect(bonferroni).toBe(3);
    expect(bh).toBe(4);
  });

  it('marks exactly the hypotheses whose q clears alpha', () => {
    const out = benjaminiHochberg(PAPER, 0.05);
    for (const row of out) expect(row.significant).toBe(row.q! <= 0.05);
  });

  it('reports the ascending rank each p-value took', () => {
    const out = benjaminiHochberg(PAPER);
    expect(out.map((row) => row.rank)).toEqual([...PAPER.keys()].map((i) => i + 1));
  });
});

describe('benjaminiHochberg — properties', () => {
  it('never reports a q below its own p', () => {
    for (const row of benjaminiHochberg(PAPER))
      expect(row.q!).toBeGreaterThanOrEqual(row.p! - 1e-12);
  });

  it('keeps q monotone in p', () => {
    const sorted = [...benjaminiHochberg(PAPER)].sort((a, b) => a.p! - b.p!);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].q!).toBeGreaterThanOrEqual(sorted[i - 1].q! - 1e-12);
    }
  });

  it('returns rows in the order they were given, not in rank order', () => {
    const shuffled = [0.5719, 0.0001, 1.0, 0.0095, 0.0004, 0.324, 0.0019];
    const out = benjaminiHochberg(shuffled);
    expect(out.map((row) => row.p)).toEqual(shuffled);
    expect(out[1].rank).toBe(1);
    expect(out[2].rank).toBe(7);
  });

  it('caps q at one', () => {
    const out = benjaminiHochberg([0.9, 0.95, 0.99, 1.0]);
    for (const row of out) expect(row.q!).toBeLessThanOrEqual(1);
  });

  it('leaves a single p-value untouched', () => {
    expect(benjaminiHochberg([0.03])[0].q).toBeCloseTo(0.03, 12);
  });

  it('finds nothing in a family of null results', () => {
    const out = benjaminiHochberg([0.2, 0.4, 0.6, 0.8, 0.35, 0.9]);
    expect(out.some((row) => row.significant)).toBe(false);
  });
});

describe('benjaminiHochberg — missing tests', () => {
  it('passes holes through without counting them in the family', () => {
    const out = benjaminiHochberg([0.01, null, 0.02]);
    expect(out[1].p).toBeNull();
    expect(out[1].q).toBeNull();
    expect(out[1].rank).toBeNull();
    expect(out[1].significant).toBe(false);
    // Family of two, not three: q = 2/1 · 0.01 = 0.02 for the smallest.
    expect(out[0].q!).toBeCloseTo(0.02, 12);
  });

  it('survives a family with nothing in it', () => {
    expect(benjaminiHochberg([null, null])).toHaveLength(2);
    expect(benjaminiHochberg([])).toEqual([]);
  });
});
