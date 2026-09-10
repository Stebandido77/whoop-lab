import {
  benjaminiHochberg,
  changePoints,
  cusum,
  distributedLag,
  histogram,
  insufficient,
  kernelDensity,
  lombScargle,
  ols,
  ratio,
  silvermanModality,
  supportGaps,
  type ChangePointsResult,
  type CusumResult,
  type DensityPoint,
  type Estimate,
  type HistogramBin,
  type Insufficient,
  type LagCoefficient,
  type ModalityResult,
  type OlsFit,
  type PeriodogramResult,
  type RatioResult,
  type SupportGaps,
} from './econ';
import { mean, pearson, welchT, type Correlation } from './stats';
import type { DayRecord } from './whoop/types';

export const column = (days: DayRecord[], key: keyof DayRecord): (number | null)[] =>
  days.map((d) => d[key] as number | null);

export interface PeriodValue {
  value: number | null;
  delta: number | null;
}

/** Mean of a metric over the window, plus the change against the previous window. */
export function periodValue(
  days: DayRecord[],
  previous: DayRecord[],
  key: keyof DayRecord,
): PeriodValue {
  const value = mean(column(days, key));
  const before = mean(column(previous, key));
  return { value, delta: value != null && before != null ? value - before : null };
}

export interface DriverSpec {
  /** Key into `messages.recovery.drivers`; this layer holds no prose. */
  id: DriverId;
  metric: keyof DayRecord;
  /** Metric to correlate against; defaults to same-day recovery. */
  against?: keyof DayRecord;
}

export type DriverId =
  | 'sleepHours'
  | 'sleepEfficiency'
  | 'sleepConsistency'
  | 'sleepDebt'
  | 'remShare'
  | 'deepShare'
  | 'strainPrev'
  | 'workoutMinutes'
  | 'respiratoryRate'
  | 'skinTemp';

export interface DriverResult extends DriverSpec, Correlation {}

/**
 * The candidate drivers of recovery. `strainPrev` and `recoveryNext` exist on
 * the day record precisely so this table can express lags without shifting
 * arrays at call sites.
 */
export const RECOVERY_DRIVERS: DriverSpec[] = [
  { id: 'sleepHours', metric: 'sleepHours' },
  { id: 'sleepEfficiency', metric: 'sleepEfficiency' },
  { id: 'sleepConsistency', metric: 'sleepConsistency' },
  { id: 'sleepDebt', metric: 'sleepDebt' },
  { id: 'remShare', metric: 'remShare' },
  { id: 'deepShare', metric: 'deepShare' },
  { id: 'strainPrev', metric: 'strainPrev' },
  { id: 'workoutMinutes', metric: 'workoutMinutes', against: 'recoveryNext' },
  { id: 'respiratoryRate', metric: 'respiratoryRate' },
  { id: 'skinTemp', metric: 'skinTemp' },
];

export function computeDrivers(days: DayRecord[], specs = RECOVERY_DRIVERS): DriverResult[] {
  return specs
    .map((spec) => ({
      ...spec,
      ...pearson(column(days, spec.metric), column(days, spec.against ?? 'recovery')),
    }))
    .filter((d) => d.r != null)
    .sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!));
}

export interface HabitEffect {
  question: string;
  shortLabel: string;
  meanYes: number;
  meanNo: number;
  /** Percentage-point difference, yes minus no. */
  delta: number;
  t: number | null;
  nYes: number;
  nNo: number;
}

/**
 * WHOOP does not document which night a journal answer is scored against, so we
 * expose both alignments and let the reader pick the one that matches the app.
 */
export function habitEffects(
  days: DayRecord[],
  questions: string[],
  target: 'recovery' | 'recoveryNext',
  minGroup = 8,
): HabitEffect[] {
  const out: HabitEffect[] = [];
  for (const question of questions) {
    const yes: number[] = [];
    const no: number[] = [];
    for (const day of days) {
      const answer = day.journal[question];
      if (answer === undefined) continue;
      const value = day[target];
      if (value == null) continue;
      (answer ? yes : no).push(value);
    }
    if (yes.length < minGroup || no.length < minGroup) continue;
    const meanYes = mean(yes)!;
    const meanNo = mean(no)!;
    out.push({
      question,
      shortLabel: shortenQuestion(question),
      meanYes,
      meanNo,
      delta: meanYes - meanNo,
      t: welchT(yes, no),
      nYes: yes.length,
      nNo: no.length,
    });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function shortenQuestion(question: string, max = 34): string {
  const trimmed = question
    .replace(/^(Have you|Did you|Do you|Have|Did)\s+/i, '')
    .replace(/\?$/, '');
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export interface ActivitySummary {
  activity: string;
  sessions: number;
  minutes: number;
  meanStrain: number | null;
  meanHr: number | null;
  calories: number;
}

export function summarizeActivities(days: DayRecord[]): ActivitySummary[] {
  const map = new Map<
    string,
    { minutes: number; strain: number[]; hr: number[]; calories: number; sessions: number }
  >();
  for (const day of days) {
    for (const w of day.workouts) {
      const entry = map.get(w.activity) ?? {
        minutes: 0,
        strain: [],
        hr: [],
        calories: 0,
        sessions: 0,
      };
      entry.sessions += 1;
      entry.minutes += w.duration ?? 0;
      entry.calories += w.calories ?? 0;
      if (w.strain != null) entry.strain.push(w.strain);
      if (w.avgHr != null) entry.hr.push(w.avgHr);
      map.set(w.activity, entry);
    }
  }
  return [...map.entries()]
    .map(([activity, e]) => ({
      activity,
      sessions: e.sessions,
      minutes: e.minutes,
      meanStrain: mean(e.strain),
      meanHr: mean(e.hr),
      calories: e.calories,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Total minutes spent in each HR zone across the window. */
export function zoneMinutes(days: DayRecord[]): number[] {
  const totals = [0, 0, 0, 0, 0];
  for (const day of days) {
    for (const w of day.workouts) {
      w.zones.forEach((share, i) => {
        if (share != null && w.duration != null) totals[i] += (share / 100) * w.duration;
      });
    }
  }
  return totals;
}

/** Mean recovery per weekday, expressed as a deviation from the window mean. */
export function weekdayDeviation(
  days: DayRecord[],
): { weekday: number; mean: number; deviation: number; n: number }[] {
  const base = mean(column(days, 'recovery'));
  if (base == null) return [];
  return [1, 2, 3, 4, 5, 6, 0]
    .map((weekday) => {
      const values = days.filter((d) => d.weekday === weekday).map((d) => d.recovery);
      const m = mean(values);
      return m == null
        ? null
        : { weekday, mean: m, deviation: m - base, n: values.filter((v) => v != null).length };
    })
    .filter((x): x is { weekday: number; mean: number; deviation: number; n: number } => x != null);
}

/* ------------------------------------------------------------------ *
 * Modelos econométricos del rango
 *
 * Todo lo que las vistas de esta sección dibujan se calcula acá. Cada
 * función devuelve `… | Insufficient`, así que un panel sin datos
 * suficientes recibe el conteo que le falta y no una estimación frágil.
 * Las especificaciones y los supuestos están en docs/metricas.md §6.
 * ------------------------------------------------------------------ */

interface DesignColumn {
  name: string;
  values: (number | null)[];
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Weekday dummies with the first present day omitted. One category has to be
 * the reference or the set is collinear with the intercept — QR would drop a
 * column on its own, but which one it drops depends on the data, and a control
 * whose meaning shifts between ranges is worse than one we chose.
 */
function weekdayFixedEffects(days: DayRecord[]): DesignColumn[] {
  const present = WEEKDAY_ORDER.filter((w) => days.some((d) => d.weekday === w));
  return present.slice(1).map((w) => ({
    name: `dow_${w}`,
    values: days.map((d) => (d.weekday === w ? 1 : 0)),
  }));
}

/** Calendar-month dummies, same reference rule. Absorbs seasonality. */
function monthFixedEffects(days: DayRecord[]): DesignColumn[] {
  const present = [...new Set(days.map((d) => d.date.getMonth()))].sort((a, b) => a - b);
  return present.slice(1).map((m) => ({
    name: `month_${m}`,
    values: days.map((d) => (d.date.getMonth() === m ? 1 : 0)),
  }));
}

/** Bedtime as hours, so its coefficient reads «per hour later», not per minute. */
const bedtimeHours = (days: DayRecord[]): (number | null)[] =>
  days.map((d) => (d.bedtime == null ? null : d.bedtime / 60));

const dayClock = (days: DayRecord[]): number[] => days.map((_, i) => i);

/* ---------------------------- 1. IRF del strain ---------------------------- */

export interface StrainLag extends LagCoefficient {
  /** Benjamini–Hochberg q over the family of lags. */
  q: number | null;
}

export interface StrainIrf {
  ok: true;
  lags: StrainLag[];
  /** Σβₖ: puntos de recuperación por un punto de strain sostenido toda la ventana. */
  cumulative: Estimate;
  /**
   * Último rezago que de verdad cuesta recuperación: coeficiente negativo y
   * q de Benjamini–Hochberg por debajo de 0,05. Se exige el signo porque un
   * rezago positivo que separa de cero es un rebote, no la cola del golpe, y
   * se exige q y no p porque siete rezagos a la vez son una familia.
   */
  lastLagThatBites: number | null;
  n: number;
  minN: number;
  bandwidth: number | null;
  r2: number;
}

export type StrainIrfResult = StrainIrf | Insufficient;

/**
 * Recovery on the last K days of strain, controlling for sleep, weekday and
 * month. HAC errors by way of `distributedLag`'s default: this is a daily
 * series regressed on its own recent past, which is exactly the design where
 * HC1 reports bands about a third too narrow (§6.2).
 */
export function strainImpulseResponse(
  days: DayRecord[],
  options: { maxLag?: number; minN?: number } = {},
): StrainIrfResult {
  const { maxLag = 7, minN = 150 } = options;
  const fit = distributedLag({
    y: column(days, 'recovery'),
    x: column(days, 'strain'),
    maxLag,
    controls: [
      { name: 'sleepHours', values: column(days, 'sleepHours') },
      ...weekdayFixedEffects(days),
      ...monthFixedEffects(days),
    ],
    minN,
  });
  if (!fit.ok) return fit;

  const q = benjaminiHochberg(fit.lags.map((l) => l.p));
  const lags: StrainLag[] = fit.lags.map((lag, i) => ({ ...lag, q: q[i].q }));
  const biting = lags.filter((l) => l.coef < 0 && l.q != null && l.q <= 0.05);

  return {
    ok: true,
    lags,
    cumulative: fit.cumulative,
    lastLagThatBites: biting.length ? Math.max(...biting.map((l) => l.lag)) : null,
    n: fit.n,
    minN: fit.minN,
    bandwidth: fit.fit.bandwidth,
    r2: fit.r2,
  };
}

/* ------------------------- 2. Hábitos ajustados --------------------------- */

export interface AdjustedHabit extends Estimate {
  question: string;
  shortLabel: string;
  /** Benjamini–Hochberg q over the family of journal questions. */
  q: number | null;
  nYes: number;
  nNo: number;
}

export interface AdjustedHabits {
  ok: true;
  habits: AdjustedHabit[];
  /** Questions left out for lack of variation or too many unanswered days. */
  skipped: string[];
  fit: OlsFit;
  n: number;
  minN: number;
  /** Index of the controls inside `fit.terms`, for the elasticity card. */
  slots: { sleep: number; strain: number; bedtime: number };
}

export type AdjustedHabitsResult = AdjustedHabits | Insufficient;

export interface AdjustedHabitsOptions {
  target?: 'recovery' | 'recoveryNext';
  minN?: number;
  /** Answers needed in each group before a question earns a column. */
  minGroup?: number;
  /** Share of the window a question must be answered on to stay in. */
  minCoverage?: number;
}

/**
 * Every journal boolean at once, plus sleep hours, yesterday's strain, bedtime,
 * and weekday and month fixed effects.
 *
 * This is the panel the univariate table cannot be: alcohol arrives with the
 * weekend, with a late bedtime and with less sleep, and a difference of means
 * hands the whole joint effect to whichever variable you happened to ask about.
 * Here each coefficient is the effect of that habit among days that match on
 * everything else in the model.
 *
 * A question is dropped when it lacks variation, and — this one matters for
 * real exports — when it went unanswered on too much of the window. Listwise
 * deletion is per row, so one sparsely answered question can take the whole
 * sample down with it.
 */
export function adjustedHabitEffects(
  days: DayRecord[],
  questions: string[],
  options: AdjustedHabitsOptions = {},
): AdjustedHabitsResult {
  const { target = 'recovery', minN = 150, minGroup = 8, minCoverage = 0.6 } = options;
  const answerable = days.filter((d) => d[target] != null).length;

  const kept: { question: string; nYes: number; nNo: number }[] = [];
  const skipped: string[] = [];
  for (const question of questions) {
    let nYes = 0;
    let nNo = 0;
    for (const day of days) {
      if (day[target] == null) continue;
      const answer = day.journal[question];
      if (answer === true) nYes++;
      else if (answer === false) nNo++;
    }
    const covered = answerable > 0 ? (nYes + nNo) / answerable : 0;
    if (nYes >= minGroup && nNo >= minGroup && covered >= minCoverage) {
      kept.push({ question, nYes, nNo });
    } else skipped.push(question);
  }

  const habitColumns: DesignColumn[] = kept.map((k, i) => ({
    name: `habit_${i}`,
    values: days.map((d) => {
      const answer = d.journal[k.question];
      return answer === undefined ? null : answer ? 1 : 0;
    }),
  }));
  const controls: DesignColumn[] = [
    { name: 'sleepHours', values: column(days, 'sleepHours') },
    { name: 'strainPrev', values: column(days, 'strainPrev') },
    { name: 'bedtimeHours', values: bedtimeHours(days) },
    ...weekdayFixedEffects(days),
    ...monthFixedEffects(days),
  ];
  const design = [...habitColumns, ...controls];

  const fit = ols(
    column(days, target),
    days.map((_, i) => design.map((c) => c.values[i])),
    {
      names: design.map((c) => c.name),
      // Daily series: yesterday's unmodelled shock is in today's residual too.
      vcov: 'hac',
      times: dayClock(days),
      minN,
    },
  );
  if (!fit.ok) return fit;

  const slotOf = (name: string) => fit.terms.findIndex((t) => t.name === name);
  const rows = kept
    .map((k, i) => ({ ...k, index: slotOf(`habit_${i}`) }))
    .filter((r) => r.index >= 0);
  const q = benjaminiHochberg(rows.map((r) => fit.terms[r.index].p));

  return {
    ok: true,
    habits: rows
      .map((r, i) => ({
        question: r.question,
        shortLabel: shortenQuestion(r.question),
        ...stripTermName(fit.terms[r.index]),
        q: q[i].q,
        nYes: r.nYes,
        nNo: r.nNo,
      }))
      .sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef)),
    skipped,
    fit,
    n: fit.n,
    minN: fit.minN,
    slots: {
      sleep: slotOf('sleepHours'),
      strain: slotOf('strainPrev'),
      bedtime: slotOf('bedtimeHours'),
    },
  };
}

const stripTermName = ({ coef, se, t, p, ciLow, ciHigh }: Estimate): Estimate => ({
  coef,
  se,
  t,
  p,
  ciLow,
  ciHigh,
});

/* ----------------- 3. Elasticities and the substitution rate ---------------- */

export interface Elasticity extends Estimate {
  /** Key into `messages.overview.elasticity`. */
  id: ElasticityId;
  q: number | null;
}

export type ElasticityId = 'strain' | 'sleep' | 'bedtime';

export interface Elasticities {
  ok: true;
  terms: Elasticity[];
  /**
   * Extra sleep hours that offset one unit of strain, −β_strain/β_sleep, with
   * a delta-method interval. Unidentified when β_sleep covers zero.
   */
  substitution: RatioResult;
  n: number;
  minN: number;
}

export type ElasticitiesResult = Elasticities | Insufficient;

/**
 * Reads the three control coefficients out of the adjusted habits model and
 * turns them into the marginal statements a reader can act on, plus the rate
 * at which sleep buys back strain.
 */
export function recoveryElasticities(model: AdjustedHabitsResult): ElasticitiesResult {
  if (!model.ok) return model;
  const { fit, slots } = model;

  const spec = (
    [
      { id: 'strain', index: slots.strain },
      { id: 'sleep', index: slots.sleep },
      { id: 'bedtime', index: slots.bedtime },
    ] satisfies { id: ElasticityId; index: number }[]
  ).filter((s) => s.index >= 0);

  const q = benjaminiHochberg(spec.map((s) => fit.terms[s.index].p));

  return {
    ok: true,
    terms: spec.map((s, i) => ({
      id: s.id,
      ...stripTermName(fit.terms[s.index]),
      q: q[i].q,
    })),
    substitution: ratio(fit, slots.strain, slots.sleep, { negate: true }),
    n: model.n,
    minN: model.minN,
  };
}

/* --------------------------- 4. Dose and response -------------------------- */

export interface DoseResponse {
  ok: true;
  points: { x: number; y: number }[];
  /**
   * Stretches of the x axis with no observation at all.
   *
   * A curve drawn across one of those is interpolating between two clusters,
   * not describing a relationship, and the panel has to say so: every shape
   * that passes through both groups fits the data equally well there.
   */
  gaps: SupportGaps;
  n: number;
  minN: number;
}

export type DoseResponseResult = DoseResponse | Insufficient;

/**
 * Pairwise-complete points for a binscatter. No summary is computed here: the
 * bins and the LOESS curve are readings of these same points and belong to the
 * chart, the way `ScatterChart` fits its own line.
 */
export function doseResponse(
  days: DayRecord[],
  x: keyof DayRecord,
  y: keyof DayRecord,
  minN = 60,
): DoseResponseResult {
  const points: { x: number; y: number }[] = [];
  for (const day of days) {
    const a = day[x] as number | null;
    const b = day[y] as number | null;
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      points.push({ x: a, y: b });
    }
  }
  return points.length < minN
    ? insufficient(points.length, minN)
    : {
        ok: true,
        points,
        gaps: supportGaps(points.map((p) => p.x)),
        n: points.length,
        minN,
      };
}

/* --------------------- 7. Distribución del strain diario ------------------- */

export interface StrainDistribution {
  ok: true;
  bins: HistogramBin[];
  density: DensityPoint[];
  bandwidth: number;
  /** The modality test, or its own `Insufficient` when the window is too short. */
  modality: ModalityResult;
  mean: number | null;
  n: number;
  minN: number;
}

export type StrainDistributionResult = StrainDistribution | Insufficient;

/**
 * How the daily strain scores are spread out, as a histogram with the kernel
 * density over it and a test for whether there is more than one hump.
 *
 * This panel exists because of what it explains elsewhere. Somebody who trains
 * hard on some days and rests on the others does not have a strain distribution
 * with a middle; they have two groups. Every scatter with strain on the x axis
 * then shows two clouds and an empty band, which reads as a broken chart and is
 * in fact the most concrete thing the export has to say about how they train.
 *
 * The number of modes is reported at the drawn bandwidth and the *claim* of
 * bimodality comes from `silvermanModality`, which searches over bandwidths
 * instead of trusting one. Counting humps at a bandwidth of your choosing is
 * not a finding, it is a choice.
 */
export function strainDistribution(
  days: DayRecord[],
  options: { minN?: number; modalityMinN?: number } = {},
): StrainDistributionResult {
  const { minN = 30, modalityMinN = 60 } = options;
  const values = column(days, 'strain').filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length < minN) return insufficient(values.length, minN);

  const { points, bandwidth } = kernelDensity(values);
  return {
    ok: true,
    bins: histogram(values),
    density: points,
    bandwidth,
    modality: silvermanModality(values, { minN: modalityMinN }),
    mean: mean(values),
    n: values.length,
    minN,
  };
}

/* ------------------------- 5. Cambios de régimen -------------------------- */

/**
 * Level shifts in the 28-day HRV baseline.
 *
 * `minSegment` is 28 on purpose. The series is a 28-day rolling mean, so two
 * adjacent values share 27 of their 28 observations; allowing a segment shorter
 * than the window would let the smoother's own inertia be reported as a regime.
 */
export function hrvRegimeBreaks(days: DayRecord[], minN = 90): ChangePointsResult {
  return changePoints(
    column(days, 'hrv28'),
    days.map((d) => d.day),
    { minSegment: 28, maxPoints: 4, minN },
  );
}

/** Two-sided CUSUM on resting heart rate against the window's own baseline. */
export function rhrControlChart(days: DayRecord[], minN = 45): CusumResult {
  return cusum(
    column(days, 'rhr'),
    days.map((d) => d.day),
    { k: 0.5, h: 5, minN },
  );
}

/* -------------------------------- 6. Rhythms ------------------------------- */

export interface Rhythm {
  key: 'recovery' | 'hrv';
  spectrum: PeriodogramResult;
  /** BH-adjusted false-alarm probability of the peak, across the two series. */
  q: number | null;
  /** The weekly line, when the spectrum clears its own threshold there. */
  weeklyIsReal: boolean;
}

/**
 * Lomb–Scargle over recovery and HRV. Two series tested at once is a family, so
 * the peak false-alarm probabilities go through BH — even though each one is
 * already corrected across frequencies inside `lombScargle`.
 */
export function rhythms(days: DayRecord[], minN = 60): Rhythm[] {
  const specs: { key: 'recovery' | 'hrv' }[] = [{ key: 'recovery' }, { key: 'hrv' }];
  const spectra = specs.map((s) =>
    lombScargle(dayClock(days), column(days, s.key), { minN, faProbability: 0.05 }),
  );
  const q = benjaminiHochberg(spectra.map((s) => (s.ok && s.peak ? s.peak.fap : null)));
  return specs.map((s, i) => {
    const spectrum = spectra[i];
    const weekly =
      spectrum.ok &&
      spectrum.points
        .filter((p) => Math.abs(p.period - 7) < 0.35)
        .some((p) => p.power > spectrum.faLevel);
    return { ...s, spectrum, q: q[i].q, weeklyIsReal: weekly };
  });
}
