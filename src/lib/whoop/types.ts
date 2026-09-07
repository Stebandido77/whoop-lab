/** One row of `physiological_cycles.csv`, normalised. */
export interface CycleRow {
  day: string;
  start: Date | null;
  end: Date | null;
  recovery: number | null;
  rhr: number | null;
  hrv: number | null;
  skinTemp: number | null;
  spo2: number | null;
  strain: number | null;
  calories: number | null;
  maxHr: number | null;
  avgHr: number | null;
  sleepOnset: Date | null;
  wakeOnset: Date | null;
  sleepPerformance: number | null;
  respiratoryRate: number | null;
  asleep: number | null;
  inBed: number | null;
  light: number | null;
  deep: number | null;
  rem: number | null;
  awake: number | null;
  sleepNeed: number | null;
  sleepDebt: number | null;
  sleepEfficiency: number | null;
  sleepConsistency: number | null;
}

/** One row of `sleeps.csv`. Naps are folded into the day record separately. */
export interface SleepRow {
  day: string;
  isNap: boolean;
  onset: Date | null;
  wake: Date | null;
  asleep: number | null;
  inBed: number | null;
  light: number | null;
  deep: number | null;
  rem: number | null;
  awake: number | null;
  performance: number | null;
  efficiency: number | null;
  sleepNeed: number | null;
  sleepDebt: number | null;
  consistency: number | null;
  respiratoryRate: number | null;
}

/** One row of `workouts.csv`. Strength Trainer sessions are absent from the export. */
export interface WorkoutRow {
  day: string;
  start: Date | null;
  end: Date | null;
  duration: number | null;
  activity: string;
  strain: number | null;
  calories: number | null;
  maxHr: number | null;
  avgHr: number | null;
  /** Percent of the session spent in HR zones 1..5. */
  zones: (number | null)[];
  distance: number | null;
  altitudeGain: number | null;
}

/** One row of `journal_entries.csv`. */
export interface JournalRow {
  day: string;
  question: string;
  yes: boolean;
  notes: string;
}

export interface WhoopExport {
  cycles: CycleRow[];
  sleeps: SleepRow[];
  workouts: WorkoutRow[];
  journal: JournalRow[];
}

export const emptyExport = (): WhoopExport => ({
  cycles: [],
  sleeps: [],
  workouts: [],
  journal: [],
});

export type FileKind = keyof WhoopExport;

/**
 * One physiological day, with every source joined and every derived metric
 * precomputed. Views only ever read this.
 */
export interface DayRecord {
  day: string;
  date: Date;
  weekday: number;

  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  skinTemp: number | null;
  spo2: number | null;
  respiratoryRate: number | null;

  strain: number | null;
  calories: number | null;
  maxHr: number | null;
  avgHr: number | null;

  asleep: number | null;
  inBed: number | null;
  light: number | null;
  deep: number | null;
  rem: number | null;
  awake: number | null;
  sleepNeed: number | null;
  sleepDebt: number | null;
  sleepEfficiency: number | null;
  sleepConsistency: number | null;
  sleepPerformance: number | null;
  napMinutes: number | null;

  workouts: WorkoutRow[];
  journal: Record<string, boolean>;

  // derived
  sleepHours: number | null;
  remShare: number | null;
  deepShare: number | null;
  /** Minutes past midnight, shifted into 720..2160 so 00:30 sorts after 23:00. */
  bedtime: number | null;
  wakeTime: number | null;
  /** `wakeTime + 1440`, so bedtime and wake sit on one continuous axis. */
  wakeTimeAdjusted: number | null;
  workoutMinutes: number;
  workoutCount: number;

  recovery7: number | null;
  recovery28: number | null;
  hrv7: number | null;
  hrv28: number | null;
  hrvZ: number | null;
  rhr7: number | null;
  rhr28: number | null;
  strain7: number | null;
  strain28: number | null;
  remShare7: number | null;
  deepShare7: number | null;
  /** Acute:chronic workload ratio (7d strain / 28d strain). */
  acwr: number | null;

  /** Next day's recovery, for lag analysis. */
  recoveryNext: number | null;
  /** Previous day's strain, the natural predictor of today's recovery. */
  strainPrev: number | null;
}
