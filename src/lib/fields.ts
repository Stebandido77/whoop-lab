import type { DayRecord } from './whoop/types';

/**
 * The columns the model explorer is allowed to build a design matrix out of.
 *
 * A curated list and not `keyof DayRecord`, for two reasons. The rolling means
 * (`recovery7`, `hrv28`, `strain7`) are excluded because regressing a series on
 * its own moving average is a mechanical identity, not a finding: the left side
 * is inside the right side and the fit is guaranteed. `recoveryNext` and
 * `strainPrev` are excluded because the lag selector already expresses them, and
 * offering both invites the same variable twice in one design, which is exactly
 * collinear.
 */
export type FieldId =
  | 'recovery'
  | 'hrv'
  | 'hrvZ'
  | 'rhr'
  | 'skinTemp'
  | 'spo2'
  | 'respiratoryRate'
  | 'sleepHours'
  | 'sleepEfficiency'
  | 'sleepConsistency'
  | 'sleepPerformance'
  | 'sleepDebt'
  | 'sleepNeed'
  | 'deep'
  | 'rem'
  | 'light'
  | 'awake'
  | 'remShare'
  | 'deepShare'
  | 'bedtime'
  | 'wakeTime'
  | 'napMinutes'
  | 'strain'
  | 'acwr'
  | 'workoutMinutes'
  | 'workoutCount'
  | 'calories'
  | 'maxHr'
  | 'avgHr';

export type FieldGroup = 'recovery' | 'sleep' | 'training';

export interface FieldSpec {
  id: FieldId;
  group: FieldGroup;
  /**
   * Multiplier applied before the column enters the design, so the coefficient
   * reads in a unit somebody can act on. Bedtime in minutes gives a coefficient
   * of 0,004 that rounds to nothing; in hours it reads «per hour later to bed».
   */
  scale: number;
  /** Unit of the *scaled* column, for the coefficient row. */
  unit: 'pct' | 'ms' | 'bpm' | 'min' | 'h' | 'kcal' | 'count' | 'index' | 'sd' | 'deg';
}

const field = (id: FieldId, group: FieldGroup, unit: FieldSpec['unit'], scale = 1): FieldSpec => ({
  id,
  group,
  unit,
  scale,
});

export const FIELDS: FieldSpec[] = [
  field('recovery', 'recovery', 'pct'),
  field('hrv', 'recovery', 'ms'),
  field('hrvZ', 'recovery', 'sd'),
  field('rhr', 'recovery', 'bpm'),
  field('skinTemp', 'recovery', 'deg'),
  field('spo2', 'recovery', 'pct'),
  field('respiratoryRate', 'recovery', 'count'),

  field('sleepHours', 'sleep', 'h'),
  field('sleepEfficiency', 'sleep', 'pct'),
  field('sleepConsistency', 'sleep', 'pct'),
  field('sleepPerformance', 'sleep', 'pct'),
  field('sleepDebt', 'sleep', 'min'),
  field('sleepNeed', 'sleep', 'min'),
  field('deep', 'sleep', 'min'),
  field('rem', 'sleep', 'min'),
  field('light', 'sleep', 'min'),
  field('awake', 'sleep', 'min'),
  field('remShare', 'sleep', 'pct'),
  field('deepShare', 'sleep', 'pct'),
  field('bedtime', 'sleep', 'h', 1 / 60),
  field('wakeTime', 'sleep', 'h', 1 / 60),
  field('napMinutes', 'sleep', 'min'),

  field('strain', 'training', 'index'),
  field('acwr', 'training', 'index'),
  field('workoutMinutes', 'training', 'min'),
  field('workoutCount', 'training', 'count'),
  field('calories', 'training', 'kcal'),
  field('maxHr', 'training', 'bpm'),
  field('avgHr', 'training', 'bpm'),
];

export const FIELD_GROUPS: FieldGroup[] = ['recovery', 'sleep', 'training'];

const BY_ID = new Map(FIELDS.map((f) => [f.id, f]));

export const fieldSpec = (id: FieldId): FieldSpec => BY_ID.get(id)!;

export const isFieldId = (value: unknown): value is FieldId =>
  typeof value === 'string' && BY_ID.has(value as FieldId);

/**
 * One field as a column, shifted `lag` days back and put in its display unit.
 *
 * Index arithmetic is day arithmetic here: `buildDayRecords` materialises the
 * days with no data, so row `i − 1` really is the previous calendar day rather
 * than the previous row that happened to have a reading.
 */
export function laggedColumn(days: DayRecord[], id: FieldId, lag: number): (number | null)[] {
  const { scale } = fieldSpec(id);
  return days.map((_, i) => {
    const source = days[i - lag];
    if (!source) return null;
    const value = source[id] as number | null;
    return value == null || !Number.isFinite(value) ? null : value * scale;
  });
}
