import { studentCdf, tQuantile } from '../stats';
import type { OlsFit } from './ols';
import type { Estimate } from './types';

export interface Weight {
  /** Index into `fit.terms`. */
  index: number;
  weight: number;
}

const inference = (coef: number, variance: number, df: number, level: number): Estimate => {
  const se = Math.sqrt(Math.max(0, variance));
  const t = se > 0 ? coef / se : 0;
  const critical = tQuantile(1 - (1 - level) / 2, df) ?? 1.96;
  return {
    coef,
    se,
    t,
    p: se > 0 ? Math.min(1, Math.max(0, 2 * (1 - studentCdf(Math.abs(t), df)))) : 1,
    ciLow: coef - critical * se,
    ciHigh: coef + critical * se,
  };
};

/**
 * Any weighted sum of coefficients, with the standard error the covariance
 * matrix implies:
 *
 *   Var(wʹβ) = wʹ V w
 *
 * The off-diagonal terms are the whole point. Two coefficients estimated from
 * the same design are almost never independent, so adding their standard errors
 * in quadrature answers a question nobody asked. `distributedLag` uses the same
 * identity for its cumulative multiplier, with w a vector of ones.
 */
export function linearCombination(fit: OlsFit, weights: Weight[], level = fit.level): Estimate {
  let coef = 0;
  let variance = 0;
  for (const { index, weight } of weights) {
    coef += weight * (fit.terms[index]?.coef ?? 0);
    for (const other of weights) {
      variance += weight * other.weight * (fit.vcov[index]?.[other.index] ?? 0);
    }
  }
  return inference(coef, variance, fit.df, level);
}

export interface IdentifiedRatio extends Estimate {
  identified: true;
}

/**
 * Why the ratio could not be formed. A code and its operand rather than a
 * sentence: `econ/` estimates, it does not write prose, and the sentence has to
 * exist in every language the interface speaks.
 */
export type RatioProblem =
  { code: 'missing-term' } | { code: 'denominator-covers-zero'; name: string };

export interface UnidentifiedRatio {
  identified: false;
  problem: RatioProblem;
}

export type RatioResult = IdentifiedRatio | UnidentifiedRatio;

export interface RatioOptions {
  /** Report `−numerator/denominator`. Trade-off ratios are usually negated. */
  negate?: boolean;
  level?: number;
}

/**
 * The ratio of two coefficients, with a delta-method standard error.
 *
 * For g(β) = ±βₐ/β_b the gradient is (±1/β_b, ∓βₐ/β_b²), so
 *
 *   Var(g) = (∂g/∂βₐ)² V_aa + (∂g/∂β_b)² V_bb + 2 (∂g/∂βₐ)(∂g/∂β_b) V_ab
 *
 * and again the covariance term matters: numerator and denominator come from
 * the same fit.
 *
 * **It refuses when the denominator's own interval covers zero, and that
 * refusal is not conservatism.** A ratio whose denominator might be zero has no
 * finite confidence bound — the honest confidence set is the whole line, or two
 * disjoint rays (this is the Fieller problem). The delta method would still
 * happily return a small symmetric band, because it only ever looks at a local
 * linearisation, and that band would be a fabrication. There is no sample size
 * that rescues it; the quantity is simply not identified.
 */
export function ratio(
  fit: OlsFit,
  numerator: number,
  denominator: number,
  options: RatioOptions = {},
): RatioResult {
  const { negate = false, level = fit.level } = options;
  const top = fit.terms[numerator];
  const bottom = fit.terms[denominator];
  if (!top || !bottom) {
    return { identified: false, problem: { code: 'missing-term' } };
  }
  if (bottom.ciLow <= 0 && bottom.ciHigh >= 0) {
    return {
      identified: false,
      problem: { code: 'denominator-covers-zero', name: bottom.name },
    };
  }

  const sign = negate ? -1 : 1;
  const a = top.coef;
  const b = bottom.coef;
  const dNumerator = sign / b;
  const dDenominator = (-sign * a) / (b * b);
  const variance =
    dNumerator * dNumerator * fit.vcov[numerator][numerator] +
    dDenominator * dDenominator * fit.vcov[denominator][denominator] +
    2 * dNumerator * dDenominator * fit.vcov[numerator][denominator];

  return { identified: true, ...inference((sign * a) / b, variance, fit.df, level) };
}
