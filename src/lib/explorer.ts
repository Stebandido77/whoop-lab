import { get, set } from 'idb-keyval';
import {
  benjaminiHochberg,
  insufficient,
  ols,
  supportGaps,
  type Estimate,
  type Insufficient,
  type OlsFit,
  type SupportGaps,
} from './econ';
import { fieldSpec, isFieldId, laggedColumn, type FieldId } from './fields';
import type { DayRecord } from './whoop/types';

/** Days of lag a term may carry. Beyond a week the day-of-week controls stop lining up. */
export const MAX_LAG = 7;

/**
 * The guard, measured rather than asserted.
 *
 * Empirical coverage of a nominal 95% HAC interval, on a design of persistent
 * regressors (AR 0,8) with AR(0,5) errors, 1000 replicates per cell:
 *
 * | n/k  |  k=5  | k=10  |
 * | ---- | ----- | ----- |
 * |    4 | 80,4% | 83,2% |
 * |    6 | 80,2% | 83,6% |
 * |    8 | 82,7% | 86,5% |
 * |   12 | 86,1% | 84,9% |
 * |   20 | 89,4% | 89,0% |
 * |   30 | 86,4% | 89,5% |
 *
 * HAC never reaches 95% on a design like this — §6.1 of metricas.md documents
 * the ceiling at about 88–89% — so the question is not where it becomes correct
 * but where it stops getting worse. That is around a dozen observations per
 * parameter: below it the band is wrong about one time in five instead of one in
 * twenty, and above it another eight observations per parameter buy three points.
 *
 * The absolute floor is separate: under forty observations the Newey–West rule
 * gives a lag truncation of three and Ω̂ is assembled from a handful of residual
 * pairs, so the sandwich itself is barely estimated.
 */
export const OBSERVATIONS_PER_PARAMETER = 12;
export const ABSOLUTE_MIN_N = 40;

export interface TermSpec {
  field: FieldId;
  /** Days back. 0 is the same day. */
  lag: number;
}

export interface Specification {
  dependent: FieldId;
  /** What is being asked about. These are the coefficients the family counts. */
  regressors: TermSpec[];
  /** What is being held fixed. Adjustment, not hypotheses: outside the family. */
  controls: TermSpec[];
  weekdayFixedEffects: boolean;
  monthFixedEffects: boolean;
}

export const DEFAULT_SPECIFICATION: Specification = {
  dependent: 'recovery',
  regressors: [{ field: 'strain', lag: 1 }],
  controls: [{ field: 'sleepHours', lag: 0 }],
  weekdayFixedEffects: true,
  monthFixedEffects: false,
};

const termKey = (t: TermSpec) => `${t.field}@${t.lag}`;

/**
 * A term is illegal when it is the dependent variable at lag zero — that is `y`
 * on `y`, a perfect fit and no information — and redundant when the same field
 * and lag already appears, which is an exactly collinear column that QR would
 * drop anyway.
 */
export function normalizeSpecification(spec: Specification): Specification {
  const seen = new Set<string>();
  const keep = (terms: TermSpec[]) =>
    terms.filter((t) => {
      if (t.field === spec.dependent && t.lag === 0) return false;
      if (t.lag < 0 || t.lag > MAX_LAG) return false;
      const key = termKey(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const regressors = keep(spec.regressors);
  const controls = keep(spec.controls);
  return { ...spec, regressors, controls };
}

/**
 * Canonical identity of a specification.
 *
 * Re-running the same model must not enlarge the multiple-testing family: a
 * reader who flips back to a previous specification has not performed a new
 * search. Order inside each list does not change the model, so it does not
 * change the key either.
 */
export function specificationKey(spec: Specification): string {
  const normalized = normalizeSpecification(spec);
  const list = (terms: TermSpec[]) => terms.map(termKey).sort().join(',');
  return [
    normalized.dependent,
    list(normalized.regressors),
    list(normalized.controls),
    normalized.weekdayFixedEffects ? 'dow' : '',
    normalized.monthFixedEffects ? 'month' : '',
  ].join('|');
}

export const isRunnable = (spec: Specification): boolean =>
  normalizeSpecification(spec).regressors.length > 0;

/** One coefficient the panel is going to show as a finding. */
export interface FamilyTest {
  /** Which specification produced it. */
  spec: string;
  field: FieldId;
  lag: number;
  p: number | null;
}

export interface ExplorerTerm extends Estimate, TermSpec {
  role: 'regressor' | 'control';
  /** Benjamini–Hochberg q over every regressor run this session. Null for controls. */
  q: number | null;
}

export interface ExplorerFit {
  ok: true;
  key: string;
  terms: ExplorerTerm[];
  /** Terms QR found collinear and dropped, by field and lag. */
  dropped: TermSpec[];
  /** Fixed-effect columns actually estimated. They are parameters, not findings. */
  fixedEffects: number;
  fit: OlsFit;
  n: number;
  k: number;
  minN: number;
  /** Observations per estimated parameter. */
  density: number;
  /** Raw pairs of the first regressor against the dependent, for the binscatter. */
  scatter: { points: { x: number; y: number }[]; term: TermSpec };
  /** Empty stretches in the first regressor's support, over the rows actually used. */
  gaps: SupportGaps;
  /** Every regressor of this run, for the accumulated family. */
  tests: FamilyTest[];
  family: { specifications: number; tests: number };
}

export type ExplorerResult = ExplorerFit | Insufficient;

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Column {
  name: string;
  values: (number | null)[];
}

const weekdayColumns = (days: DayRecord[]): Column[] => {
  const present = WEEKDAY_ORDER.filter((w) => days.some((d) => d.weekday === w));
  return present.slice(1).map((w) => ({
    name: `dow_${w}`,
    values: days.map((d) => (d.weekday === w ? 1 : 0)),
  }));
};

const monthColumns = (days: DayRecord[]): Column[] => {
  const present = [...new Set(days.map((d) => d.date.getMonth()))].sort((a, b) => a - b);
  return present.slice(1).map((m) => ({
    name: `month_${m}`,
    values: days.map((d) => (d.date.getMonth() === m ? 1 : 0)),
  }));
};

/**
 * Fit one user-built specification.
 *
 * Always HAC: everything this builds is a daily series regressed on other daily
 * series, which is the design §6.2 argues can only be estimated with a
 * long-run variance. There is no switch for it, because the reason to want HC1
 * here would be that the interval came out narrower.
 *
 * `history` is every regressor tested in this session so far. The q-values come
 * out of Benjamini–Hochberg over that whole accumulated family plus the current
 * run — see `docs/metricas.md` §6.10 for why per-model correction would be no
 * correction at all.
 */
export function runSpecification(
  days: DayRecord[],
  raw: Specification,
  history: FamilyTest[] = [],
): ExplorerResult {
  const spec = normalizeSpecification(raw);
  const key = specificationKey(spec);
  if (!spec.regressors.length) return insufficient(days.length, ABSOLUTE_MIN_N);

  const dependent = laggedColumn(days, spec.dependent, 0);
  const named = [
    ...spec.regressors.map((t) => ({ term: t, role: 'regressor' as const })),
    ...spec.controls.map((t) => ({ term: t, role: 'control' as const })),
  ];
  const termColumns: Column[] = named.map(({ term }) => ({
    name: termKey(term),
    values: laggedColumn(days, term.field, term.lag),
  }));
  const design: Column[] = [
    ...termColumns,
    ...(spec.weekdayFixedEffects ? weekdayColumns(days) : []),
    ...(spec.monthFixedEffects ? monthColumns(days) : []),
  ];

  // The guard is on the parameters the design asks for, counted before QR gets a
  // chance to drop any. Counting after would let somebody buy sample room by
  // adding a collinear column, which is not a thing that should work.
  const parameters = design.length + 1;
  const minN = Math.max(ABSOLUTE_MIN_N, OBSERVATIONS_PER_PARAMETER * parameters);

  const fit = ols(
    dependent,
    days.map((_, i) => design.map((c) => c.values[i])),
    {
      names: design.map((c) => c.name),
      vcov: 'hac',
      times: days.map((_, i) => i),
      minN,
    },
  );
  if (!fit.ok) return fit;

  const indexOf = (name: string) => fit.terms.findIndex((t) => t.name === name);
  const present = named
    .map((entry) => ({ ...entry, index: indexOf(termKey(entry.term)) }))
    .filter((entry) => entry.index >= 0);
  const dropped = named
    .filter((entry) => indexOf(termKey(entry.term)) < 0)
    .map((entry) => entry.term);

  const tests: FamilyTest[] = present
    .filter((entry) => entry.role === 'regressor')
    .map((entry) => ({
      spec: key,
      field: entry.term.field,
      lag: entry.term.lag,
      p: fit.terms[entry.index].p,
    }));

  // The family: everything tested this session, with this run's own entries
  // replacing any earlier copy of the same specification.
  const family = [...history.filter((t) => t.spec !== key), ...tests];
  const adjusted = benjaminiHochberg(family.map((t) => t.p));
  const qByTest = new Map<string, number | null>(
    family.map((t, i) => [`${t.spec}|${t.field}@${t.lag}`, adjusted[i].q]),
  );

  const terms: ExplorerTerm[] = present.map((entry) => {
    const { coef, se, t, p, ciLow, ciHigh } = fit.terms[entry.index];
    return {
      field: entry.term.field,
      lag: entry.term.lag,
      role: entry.role,
      coef,
      se,
      t,
      p,
      ciLow,
      ciHigh,
      q: entry.role === 'regressor' ? (qByTest.get(`${key}|${termKey(entry.term)}`) ?? null) : null,
    };
  });

  // The binscatter shows the first regressor against the dependent, over exactly
  // the rows the model used — a cloud that included rows the fit dropped would
  // be describing a different sample than the coefficient above it.
  const primary = spec.regressors[0];
  const primaryColumn = laggedColumn(days, primary.field, primary.lag);
  const usable = design.map((c) => c.values);
  const points: { x: number; y: number }[] = [];
  const xs: (number | null)[] = [];
  for (let i = 0; i < days.length; i++) {
    const y = dependent[i];
    const x = primaryColumn[i];
    const complete = y != null && usable.every((col) => col[i] != null);
    if (!complete || x == null) continue;
    points.push({ x, y });
    xs.push(x);
  }

  return {
    ok: true,
    key,
    terms,
    dropped,
    fixedEffects: fit.k - 1 - present.length,
    fit,
    n: fit.n,
    k: fit.k,
    minN,
    density: fit.k > 0 ? fit.n / fit.k : 0,
    scatter: { points, term: primary },
    gaps: supportGaps(xs),
    tests,
    family: {
      specifications: new Set(family.map((t) => t.spec)).size,
      tests: family.length,
    },
  };
}

/* ------------------------------- presets ---------------------------------- */

export interface Preset {
  id: string;
  name: string;
  spec: Specification;
  savedAt: number;
}

const isTerm = (value: unknown): value is TermSpec => {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return isFieldId(t.field) && typeof t.lag === 'number' && t.lag >= 0 && t.lag <= MAX_LAG;
};

/**
 * Presets come back from IndexedDB, which is to say from a previous version of
 * this code. A field that has since been renamed out of the catalogue would
 * otherwise reach `ols` as a column of nulls and take the whole sample with it,
 * so anything that does not still typecheck by hand is dropped on the way in.
 */
export function parsePreset(value: unknown): Preset | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const spec = raw.spec as Record<string, unknown> | undefined;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || !spec) return null;
  if (!isFieldId(spec.dependent)) return null;
  const regressors = Array.isArray(spec.regressors) ? spec.regressors.filter(isTerm) : [];
  const controls = Array.isArray(spec.controls) ? spec.controls.filter(isTerm) : [];
  if (!regressors.length) return null;
  return {
    id: raw.id,
    name: raw.name.slice(0, 60),
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
    spec: normalizeSpecification({
      dependent: spec.dependent,
      regressors,
      controls,
      weekdayFixedEffects: spec.weekdayFixedEffects === true,
      monthFixedEffects: spec.monthFixedEffects === true,
    }),
  };
}

const PRESETS_KEY = 'whoop-lab:presets:v1';

/**
 * Presets live in the same IndexedDB as the export and are just as local: a
 * saved specification is a sentence about what somebody wanted to look at,
 * which is not something to hand to anybody.
 *
 * They are read and written here rather than in `lib/storage.ts` so that
 * nothing on the boot path imports this module. `storage.ts` is pulled into the
 * entry chunk by `App.tsx`; the explorer, its field catalogue and its estimator
 * belong to the Models tab and should not be downloaded by somebody who never
 * opens it.
 */
export async function loadPresets(): Promise<Preset[]> {
  const raw = await get<unknown>(PRESETS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parsePreset)
    .filter((p): p is Preset => p !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function savePresets(presets: Preset[]): Promise<void> {
  await set(PRESETS_KEY, presets);
}

export const presetId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** A short, stable description of a specification, for a preset name or a list row. */
export const describeSpecification = (spec: Specification): string => {
  const term = (t: TermSpec) => (t.lag ? `${t.field}−${t.lag}` : t.field);
  const normalized = normalizeSpecification(spec);
  const right = [
    ...normalized.regressors.map(term),
    ...normalized.controls.map(term),
    ...(normalized.weekdayFixedEffects ? ['dow'] : []),
    ...(normalized.monthFixedEffects ? ['month'] : []),
  ];
  return `${normalized.dependent} ~ ${right.join(' + ') || '1'}`;
};

export const unitOf = (id: FieldId) => fieldSpec(id).unit;
