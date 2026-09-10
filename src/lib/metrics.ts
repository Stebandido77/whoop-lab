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
import { fieldSpec, type FieldId } from './fields';
import { addDays, dayKey } from './format';
import { mean, pearson, quantile, sd, welchT, type Correlation } from './stats';
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

/* ------------------------- 8. Reloj circadiano ---------------------------- */

export interface ClockQuartiles {
  /** Minutes past midnight, 0…1439. */
  q1: number;
  median: number;
  q3: number;
  n: number;
}

export interface ClockSession {
  day: string;
  /** Start of the session, minutes past midnight. */
  minuteOfDay: number;
  strain: number;
  duration: number | null;
  activity: string;
}

export interface ClockWakeHour {
  hour: number;
  /** Mean recovery of the mornings that woke in this hour. Null below `minPerHour`. */
  recovery: number | null;
  n: number;
}

export interface CircadianClock {
  ok: true;
  bedtime: ClockQuartiles;
  wake: ClockQuartiles;
  /**
   * Width of the arc from the median bedtime to the median wake.
   *
   * Deliberately **not** the median of the nightly durations: the two are
   * different numbers and only this one is what the arc draws. Calling it a
   * median sleep duration would be describing the picture with a statistic the
   * picture does not contain.
   */
  windowMinutes: number;
  sessions: ClockSession[];
  /** Activities by total strain, descending. The order is the colour order. */
  activities: { activity: string; sessions: number; strain: number }[];
  wakeHours: ClockWakeHour[];
  /** Mean recovery over the whole window: the reference the outer ring deviates from. */
  meanRecovery: number | null;
  /** Largest single-session strain, for scaling the marks. */
  maxStrain: number;
  n: number;
  minN: number;
}

export type CircadianClockResult = CircadianClock | Insufficient;

const quartilesOf = (values: (number | null)[]): ClockQuartiles | null => {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  const q1 = quantile(present, 0.25);
  const median = quantile(present, 0.5);
  const q3 = quantile(present, 0.75);
  if (q1 == null || median == null || q3 == null) return null;
  // Bedtimes are stored shifted past 24:00 so they sort across midnight; the
  // quantiles are taken on that scale and only then wrapped onto the clock face.
  const wrap = (v: number) => ((v % 1440) + 1440) % 1440;
  return { q1: wrap(q1), median: wrap(median), q3: wrap(q3), n: present.length };
};

/**
 * Everything the circadian clock draws: the sleep window, every workout at the
 * hour it started, and recovery by the hour of waking.
 *
 * Three readings of one axis — the hour of the day — that the rest of the
 * dashboard only ever shows as separate time series. What it can answer that a
 * line chart cannot is where the day's load actually sits: whether the training
 * clusters at one hour or is scattered, how wide the sleep window really is
 * rather than how variable its average was, and whether the mornings that start
 * early are the ones that score badly.
 *
 * Everything here comes off columns the export ships: `Sleep onset`,
 * `Wake onset`, the workout `Start time`, `Activity Strain` and the recovery
 * score. Nothing is modelled and nothing is imputed.
 */
export function circadianClock(
  days: DayRecord[],
  options: { minN?: number; minPerHour?: number } = {},
): CircadianClockResult {
  const { minN = 21, minPerHour = 5 } = options;

  const bedtime = quartilesOf(column(days, 'bedtime'));
  const wake = quartilesOf(column(days, 'wakeTime'));
  const nights = Math.min(bedtime?.n ?? 0, wake?.n ?? 0);
  if (!bedtime || !wake || nights < minN) return insufficient(nights, minN);

  const sessions: ClockSession[] = [];
  const totals = new Map<string, { sessions: number; strain: number }>();
  for (const day of days) {
    for (const workout of day.workouts) {
      if (!workout.start || workout.strain == null || !Number.isFinite(workout.strain)) continue;
      sessions.push({
        day: day.day,
        minuteOfDay: workout.start.getHours() * 60 + workout.start.getMinutes(),
        strain: workout.strain,
        duration: workout.duration,
        activity: workout.activity,
      });
      const entry = totals.get(workout.activity) ?? { sessions: 0, strain: 0 };
      entry.sessions += 1;
      entry.strain += workout.strain;
      totals.set(workout.activity, entry);
    }
  }

  const buckets = new Map<number, number[]>();
  for (const day of days) {
    if (day.wakeTime == null || day.recovery == null) continue;
    const hour = Math.floor((((day.wakeTime % 1440) + 1440) % 1440) / 60);
    const list = buckets.get(hour);
    if (list) list.push(day.recovery);
    else buckets.set(hour, [day.recovery]);
  }

  return {
    ok: true,
    bedtime,
    wake,
    // Wake is carried a day forward so the subtraction stays positive across midnight.
    windowMinutes:
      wake.median + 1440 - (bedtime.median < 720 ? bedtime.median + 1440 : bedtime.median),
    sessions,
    activities: [...totals.entries()]
      .map(([activity, e]) => ({ activity, ...e }))
      .sort((a, b) => b.strain - a.strain),
    wakeHours: [...buckets.entries()]
      .map(([hour, values]) => ({
        hour,
        // Rule three: below the minimum the cell has no value, not a value of zero.
        recovery: values.length >= minPerHour ? mean(values) : null,
        n: values.length,
      }))
      .sort((a, b) => a.hour - b.hour),
    meanRecovery: mean(column(days, 'recovery')),
    maxStrain: sessions.reduce((max, s) => Math.max(max, s.strain), 0),
    n: nights,
    minN,
  };
}

/* ------------------ 9. Carga por actividad y por semana -------------------- */

export interface ActivityWeekRow {
  activity: string;
  /** Strain accumulated that week, aligned with `weeks`. Null where there was no session. */
  cells: (number | null)[];
  sessions: number[];
  total: number;
}

export interface ActivityWeekLoad {
  ok: true;
  /** Monday of every week in the range, contiguous, as day keys. */
  weeks: string[];
  rows: ActivityWeekRow[];
  /** Largest weekly cell in the grid, for the colour scale. */
  max: number;
  /** Activities that did not fit the grid, and what they were worth. */
  hidden: { activities: number; strain: number };
  n: number;
  minN: number;
}

export type ActivityWeekLoadResult = ActivityWeekLoad | Insufficient;

/** Monday of the ISO week a date belongs to. */
const isoWeekStart = (date: Date): Date => {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((date.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Strain accumulated by activity and by ISO week.
 *
 * Which disciplines come and go is invisible in every other panel: the strain
 * series adds them all together, and the activity table flattens the whole range
 * into one mean. A block that stops in March and a block that starts in April
 * look identical in both, and look like a training block in this one.
 *
 * Weeks are contiguous, filled from the first Monday to the last, so a month off
 * reads as a month off and not as two adjacent weeks. A cell is `null` where the
 * activity had no session at all that week, which is a different statement from
 * a session that scored nothing.
 */
export function activityWeekLoad(
  days: DayRecord[],
  options: { minN?: number; maxRows?: number } = {},
): ActivityWeekLoadResult {
  const { minN = 28, maxRows = 12 } = options;
  if (days.length < minN) return insufficient(days.length, minN);

  const first = isoWeekStart(days[0].date);
  const last = isoWeekStart(days[days.length - 1].date);
  const weeks: string[] = [];
  const index = new Map<string, number>();
  for (let cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
    index.set(dayKey(cursor), weeks.length);
    weeks.push(dayKey(cursor));
  }

  const rows = new Map<string, { cells: (number | null)[]; sessions: number[]; total: number }>();
  for (const day of days) {
    const column = index.get(dayKey(isoWeekStart(day.date)));
    if (column == null) continue;
    for (const workout of day.workouts) {
      if (workout.strain == null || !Number.isFinite(workout.strain)) continue;
      const row = rows.get(workout.activity) ?? {
        cells: new Array<number | null>(weeks.length).fill(null),
        sessions: new Array<number>(weeks.length).fill(0),
        total: 0,
      };
      row.cells[column] = (row.cells[column] ?? 0) + workout.strain;
      row.sessions[column] += 1;
      row.total += workout.strain;
      rows.set(workout.activity, row);
    }
  }

  const ordered = [...rows.entries()]
    .map(([activity, row]) => ({ activity, ...row }))
    .sort((a, b) => b.total - a.total);
  const shown = ordered.slice(0, maxRows);
  const cut = ordered.slice(maxRows);

  return {
    ok: true,
    weeks,
    rows: shown,
    max: shown.reduce(
      (max, row) => row.cells.reduce((m: number, v) => Math.max(m, v ?? 0), max),
      0,
    ),
    hidden: {
      activities: cut.length,
      strain: cut.reduce((sum, row) => sum + row.total, 0),
    },
    n: days.length,
    minN,
  };
}

/* ------------- 10. Qué se puede decir cuando un panel está apagado --------- */

export interface VariableSummary {
  id: FieldId;
  /** Days in the range that carry a value. */
  n: number;
  /** Days in the range that do not. */
  missing: number;
  /** In the field's display unit, so it reads like the rest of the interface. */
  mean: number | null;
  sd: number | null;
}

/**
 * Mean, spread and coverage of the variables a panel would have used.
 *
 * A switched-off panel that only says «94 days short» is throwing away the
 * answer to a question the reader is entitled to: what *can* be said with what
 * is already there. These four numbers per variable are always available —
 * every one of them is defined on a single column with no minimum — so the
 * space the estimate would have taken says something true instead of nothing.
 */
export function describeVariables(days: DayRecord[], ids: FieldId[]): VariableSummary[] {
  return ids.map((id) => {
    const { scale } = fieldSpec(id);
    const values = days
      .map((d) => d[id] as number | null)
      .filter((v): v is number => v != null && Number.isFinite(v))
      .map((v) => v * scale);
    return {
      id,
      n: values.length,
      missing: days.length - values.length,
      mean: mean(values),
      sd: sd(values),
    };
  });
}

export interface BindingVariable {
  id: FieldId;
  /** Complete rows there would be if this one variable were not required. */
  without: number;
  /** Complete rows there are. */
  current: number;
  /** Dropping this one variable alone would be enough to switch the panel on. */
  decisive: boolean;
}

/**
 * The variable that costs the panel the most rows, when there is one.
 *
 * Listwise deletion means a single sparsely recorded column decides the sample
 * for everything: skin temperature arrived late in the export, and a model that
 * asks for it can sit at fifty rows while every other variable it uses has two
 * hundred. That is worth naming, because «wait three months» and «this one
 * column is the whole problem» are different situations and the count alone
 * cannot tell them apart.
 *
 * It is a diagnosis, not a suggestion. The panel asks for the variables it asks
 * for; what this says is where the waiting is actually going.
 */
export function bindingVariable(
  days: DayRecord[],
  ids: FieldId[],
  minN: number,
): BindingVariable | null {
  if (ids.length < 2) return null;

  const complete = (subset: FieldId[]) =>
    days.filter((d) =>
      subset.every((id) => {
        const v = d[id] as number | null;
        return v != null && Number.isFinite(v);
      }),
    ).length;

  const current = complete(ids);
  let best: BindingVariable | null = null;
  for (const id of ids) {
    const without = complete(ids.filter((other) => other !== id));
    if (without <= current) continue;
    if (!best || without > best.without) {
      best = { id, without, current, decisive: without >= minN };
    }
  }
  return best;
}

export type SwitchOnForecast =
  /** Waiting works: this is the day it happens, at one complete day per day. */
  | { kind: 'date'; missing: number; day: string }
  /** The selected window is shorter than the model's minimum. Waiting cannot fix that. */
  | { kind: 'range'; minN: number }
  /** The window is already full, so a new day pushes an old one out. */
  | { kind: 'window' };

/**
 * When a switched-off panel would switch on.
 *
 * The naive answer — today plus the number of missing days — is wrong in two
 * situations that are easy to be in, and printing a date that will never arrive
 * is worse than printing nothing.
 *
 * The window is a rolling one. If it is shorter than the model's minimum, no
 * amount of waiting gets there and the honest instruction is to widen the range.
 * If it is already full, tomorrow adds a day at the front and drops one off the
 * back, so the count moves for reasons that have nothing to do with waiting.
 * Only when the window still has room does one more day mean one more row.
 *
 * Even then it assumes every day from here on carries a complete record for
 * this panel, which is the optimistic case; the copy says so.
 */
export function forecastSwitchOn(options: {
  missing: number;
  minN: number;
  range: number;
  totalDays: number;
  today?: Date;
}): SwitchOnForecast {
  const { missing, minN, range, totalDays, today = new Date() } = options;
  if (range !== 0 && minN > range) return { kind: 'range', minN };
  if (range !== 0 && totalDays >= range) return { kind: 'window' };
  return { kind: 'date', missing, day: dayKey(addDays(today, missing)) };
}
