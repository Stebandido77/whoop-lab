import { dayKey, fromDayKey } from '@/lib/format';
import { mean, rollingMean, rollingSd, sd } from '@/lib/stats';
import type { DayRecord, WhoopExport, WorkoutRow } from './types';

const ROLL_SHORT = 7;
const ROLL_LONG = 28;

interface Draft extends Partial<DayRecord> {
  day: string;
  workouts: WorkoutRow[];
  journal: Record<string, boolean>;
  onset?: Date | null;
  wake?: Date | null;
}

/**
 * Join the four export files into one row per calendar day and precompute every
 * derived metric. Missing days are materialised as empty records so that rolling
 * windows and the calendar heatmap stay on a real time axis.
 */
export function buildDayRecords(data: WhoopExport): DayRecord[] {
  const byDay = new Map<string, Draft>();
  const touch = (day: string): Draft => {
    let d = byDay.get(day);
    if (!d) {
      d = { day, workouts: [], journal: {} };
      byDay.set(day, d);
    }
    return d;
  };

  for (const c of data.cycles) {
    Object.assign(touch(c.day), {
      recovery: c.recovery,
      hrv: c.hrv,
      rhr: c.rhr,
      skinTemp: c.skinTemp,
      spo2: c.spo2,
      respiratoryRate: c.respiratoryRate,
      strain: c.strain,
      calories: c.calories,
      maxHr: c.maxHr,
      avgHr: c.avgHr,
      asleep: c.asleep,
      inBed: c.inBed,
      light: c.light,
      deep: c.deep,
      rem: c.rem,
      awake: c.awake,
      sleepNeed: c.sleepNeed,
      sleepDebt: c.sleepDebt,
      sleepEfficiency: c.sleepEfficiency,
      sleepConsistency: c.sleepConsistency,
      sleepPerformance: c.sleepPerformance,
      onset: c.sleepOnset,
      wake: c.wakeOnset,
    });
  }

  for (const s of data.sleeps) {
    const d = touch(s.day);
    if (s.isNap) {
      d.napMinutes = (d.napMinutes ?? 0) + (s.asleep ?? 0);
      continue;
    }
    // Only used as a fallback when physiological_cycles.csv is missing.
    if (d.asleep == null) {
      Object.assign(d, {
        asleep: s.asleep,
        inBed: s.inBed,
        light: s.light,
        deep: s.deep,
        rem: s.rem,
        awake: s.awake,
        sleepPerformance: s.performance,
        sleepEfficiency: s.efficiency,
        sleepNeed: s.sleepNeed,
        sleepDebt: s.sleepDebt,
        sleepConsistency: s.consistency,
        respiratoryRate: s.respiratoryRate,
        onset: s.onset,
        wake: s.wake,
      });
    }
  }

  for (const w of data.workouts) touch(w.day).workouts.push(w);
  for (const j of data.journal) touch(j.day).journal[j.question] = j.yes;

  const keys = [...byDay.keys()].sort();
  if (!keys.length) return [];

  const out: DayRecord[] = [];
  const last = fromDayKey(keys[keys.length - 1]);
  for (let cur = fromDayKey(keys[0]); cur <= last; cur = addDays(cur, 1)) {
    const key = dayKey(cur);
    out.push(finalize(byDay.get(key) ?? { day: key, workouts: [], journal: {} }, cur));
  }

  attachWindows(out);
  return out;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function finalize(draft: Draft, date: Date): DayRecord {
  const asleep = draft.asleep ?? null;
  const onset = draft.onset ?? null;
  const wake = draft.wake ?? null;

  let bedtime: number | null = onset ? onset.getHours() * 60 + onset.getMinutes() : null;
  // Shift after-midnight bedtimes past 24:00 so the axis stays monotonic.
  if (bedtime != null && bedtime < 720) bedtime += 1440;
  const wakeTime = wake ? wake.getHours() * 60 + wake.getMinutes() : null;

  return {
    day: draft.day,
    date,
    weekday: date.getDay(),
    recovery: draft.recovery ?? null,
    hrv: draft.hrv ?? null,
    rhr: draft.rhr ?? null,
    skinTemp: draft.skinTemp ?? null,
    spo2: draft.spo2 ?? null,
    respiratoryRate: draft.respiratoryRate ?? null,
    strain: draft.strain ?? null,
    calories: draft.calories ?? null,
    maxHr: draft.maxHr ?? null,
    avgHr: draft.avgHr ?? null,
    asleep,
    inBed: draft.inBed ?? null,
    light: draft.light ?? null,
    deep: draft.deep ?? null,
    rem: draft.rem ?? null,
    awake: draft.awake ?? null,
    sleepNeed: draft.sleepNeed ?? null,
    sleepDebt: draft.sleepDebt ?? null,
    sleepEfficiency: draft.sleepEfficiency ?? null,
    sleepConsistency: draft.sleepConsistency ?? null,
    sleepPerformance: draft.sleepPerformance ?? null,
    napMinutes: draft.napMinutes ?? null,
    workouts: draft.workouts,
    journal: draft.journal,
    sleepHours: asleep != null ? asleep / 60 : null,
    remShare: draft.rem != null && asleep ? (100 * draft.rem) / asleep : null,
    deepShare: draft.deep != null && asleep ? (100 * draft.deep) / asleep : null,
    bedtime,
    wakeTime,
    wakeTimeAdjusted: wakeTime != null ? wakeTime + 1440 : null,
    workoutMinutes: draft.workouts.reduce((s, w) => s + (w.duration ?? 0), 0),
    workoutCount: draft.workouts.length,
    recovery7: null,
    recovery28: null,
    hrv7: null,
    hrv28: null,
    hrvZ: null,
    rhr7: null,
    rhr28: null,
    strain7: null,
    strain28: null,
    remShare7: null,
    deepShare7: null,
    acwr: null,
    recoveryNext: null,
    strainPrev: null,
  };
}

function attachWindows(days: DayRecord[]): void {
  const pick = (k: keyof DayRecord) => days.map((d) => d[k] as number | null);

  const recovery7 = rollingMean(pick('recovery'), ROLL_SHORT);
  const recovery28 = rollingMean(pick('recovery'), ROLL_LONG);
  const hrv7 = rollingMean(pick('hrv'), ROLL_SHORT);
  const hrv28 = rollingMean(pick('hrv'), ROLL_LONG);
  const hrvSd28 = rollingSd(pick('hrv'), ROLL_LONG);
  const rhr7 = rollingMean(pick('rhr'), ROLL_SHORT);
  const rhr28 = rollingMean(pick('rhr'), ROLL_LONG);
  const strain7 = rollingMean(pick('strain'), ROLL_SHORT);
  const strain28 = rollingMean(pick('strain'), ROLL_LONG);
  const remShare7 = rollingMean(pick('remShare'), ROLL_SHORT);
  const deepShare7 = rollingMean(pick('deepShare'), ROLL_SHORT);

  days.forEach((d, i) => {
    d.recovery7 = recovery7[i];
    d.recovery28 = recovery28[i];
    d.hrv7 = hrv7[i];
    d.hrv28 = hrv28[i];
    d.hrvZ =
      d.hrv != null && hrv28[i] != null && hrvSd28[i] ? (d.hrv - hrv28[i]!) / hrvSd28[i]! : null;
    d.rhr7 = rhr7[i];
    d.rhr28 = rhr28[i];
    d.strain7 = strain7[i];
    d.strain28 = strain28[i];
    d.remShare7 = remShare7[i];
    d.deepShare7 = deepShare7[i];
    d.acwr = strain7[i] != null && strain28[i] ? strain7[i]! / strain28[i]! : null;
    d.recoveryNext = days[i + 1]?.recovery ?? null;
    d.strainPrev = days[i - 1]?.strain ?? null;
  });
}

/** Distinct journal questions, most answered first. */
export function journalQuestions(data: WhoopExport): string[] {
  const counts = new Map<string, number>();
  for (const j of data.journal) counts.set(j.question, (counts.get(j.question) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([q]) => q);
}

export interface WeekBucket {
  day: string;
  count: number;
  [metric: string]: number | string | null;
}

/** Collapse days into ISO weeks (Monday start), averaging the given metrics. */
export function byWeek(days: DayRecord[], metrics: (keyof DayRecord)[]): WeekBucket[] {
  const buckets = new Map<string, DayRecord[]>();
  for (const d of days) {
    const monday = addDays(d.date, -((d.date.getDay() + 6) % 7));
    const key = dayKey(monday);
    const list = buckets.get(key);
    if (list) list.push(d);
    else buckets.set(key, [d]);
  }
  return [...buckets.entries()].map(([day, rows]) => {
    const bucket: WeekBucket = { day, count: rows.length };
    for (const m of metrics) bucket[m as string] = mean(rows.map((r) => r[m] as number | null));
    return bucket;
  });
}

/** Standard deviation of bedtime, the most legible consistency number we have. */
export const bedtimeVariability = (days: DayRecord[]) => sd(days.map((d) => d.bedtime));
