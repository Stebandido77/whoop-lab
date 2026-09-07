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
  label: string;
  metric: keyof DayRecord;
  /** Metric to correlate against; defaults to same-day recovery. */
  against?: keyof DayRecord;
}

export interface DriverResult extends DriverSpec, Correlation {}

/**
 * The candidate drivers of recovery. `strainPrev` and `recoveryNext` exist on
 * the day record precisely so this table can express lags without shifting
 * arrays at call sites.
 */
export const RECOVERY_DRIVERS: DriverSpec[] = [
  { label: 'Horas de sueño', metric: 'sleepHours' },
  { label: 'Eficiencia del sueño', metric: 'sleepEfficiency' },
  { label: 'Consistencia horaria', metric: 'sleepConsistency' },
  { label: 'Deuda de sueño', metric: 'sleepDebt' },
  { label: '% REM', metric: 'remShare' },
  { label: '% sueño profundo', metric: 'deepShare' },
  { label: 'Strain del día anterior', metric: 'strainPrev' },
  { label: 'Minutos de entreno (ayer)', metric: 'workoutMinutes', against: 'recoveryNext' },
  { label: 'Frecuencia respiratoria', metric: 'respiratoryRate' },
  { label: 'Temperatura de piel', metric: 'skinTemp' },
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
