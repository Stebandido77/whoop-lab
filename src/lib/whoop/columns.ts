/**
 * WHOOP has renamed export columns more than once and the header text differs
 * between locales and membership tiers. Matching on a normalised substring is
 * far more durable than matching exact strings.
 */
export const normalizeHeader = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export type FieldName =
  | 'cycleStart'
  | 'cycleEnd'
  | 'recovery'
  | 'rhr'
  | 'hrv'
  | 'skinTemp'
  | 'spo2'
  | 'strain'
  | 'calories'
  | 'maxHr'
  | 'avgHr'
  | 'sleepOnset'
  | 'wakeOnset'
  | 'sleepPerformance'
  | 'respiratoryRate'
  | 'asleep'
  | 'inBed'
  | 'light'
  | 'deep'
  | 'rem'
  | 'awake'
  | 'sleepNeed'
  | 'sleepDebt'
  | 'sleepEfficiency'
  | 'sleepConsistency'
  | 'nap'
  | 'workoutStart'
  | 'workoutEnd'
  | 'duration'
  | 'activity'
  | 'activityStrain'
  | 'zone1'
  | 'zone2'
  | 'zone3'
  | 'zone4'
  | 'zone5'
  | 'distance'
  | 'altitudeGain'
  | 'question'
  | 'answeredYes'
  | 'notes';

type Matcher = (h: string) => boolean;

/**
 * Order matters: the first matcher that accepts a header claims it. Sleep-stage
 * durations are listed before the generic workout `duration` so that
 * "Asleep duration (min)" is never mistaken for a workout length.
 */
export const FIELD_MATCHERS: [FieldName, Matcher][] = [
  ['cycleStart', (h) => h.includes('cyclestart')],
  ['cycleEnd', (h) => h.includes('cycleend')],
  ['recovery', (h) => h.includes('recoveryscore')],
  ['rhr', (h) => h.includes('restingheartrate')],
  ['hrv', (h) => h.includes('heartratevariability')],
  ['skinTemp', (h) => h.includes('skintemp')],
  ['spo2', (h) => h.includes('bloodoxygen') || h.includes('spo2')],
  ['strain', (h) => h.includes('daystrain')],
  ['calories', (h) => h.includes('energyburned')],
  ['maxHr', (h) => h.includes('maxhr')],
  ['avgHr', (h) => h.includes('averagehr')],
  ['sleepOnset', (h) => h.includes('sleeponset')],
  ['wakeOnset', (h) => h.includes('wakeonset')],
  ['sleepPerformance', (h) => h.includes('sleepperformance')],
  ['respiratoryRate', (h) => h.includes('respiratoryrate')],
  ['asleep', (h) => h.includes('asleepduration')],
  ['inBed', (h) => h.includes('inbedduration')],
  ['light', (h) => h.includes('lightsleepduration')],
  ['deep', (h) => h.includes('deep') && h.includes('duration')],
  ['rem', (h) => h.includes('remduration')],
  ['awake', (h) => h.includes('awakeduration')],
  ['sleepNeed', (h) => h.includes('sleepneed')],
  ['sleepDebt', (h) => h.includes('sleepdebt')],
  ['sleepEfficiency', (h) => h.includes('sleepefficiency')],
  ['sleepConsistency', (h) => h.includes('sleepconsistency')],
  ['nap', (h) => h === 'nap' || h.startsWith('nap')],
  ['workoutStart', (h) => h.includes('workoutstart')],
  ['workoutEnd', (h) => h.includes('workoutend')],
  ['duration', (h) => h.includes('duration') && h.includes('min')],
  ['activity', (h) => h.includes('activityname')],
  ['activityStrain', (h) => h.includes('activitystrain')],
  ['zone1', (h) => h.includes('hrzone1')],
  ['zone2', (h) => h.includes('hrzone2')],
  ['zone3', (h) => h.includes('hrzone3')],
  ['zone4', (h) => h.includes('hrzone4')],
  ['zone5', (h) => h.includes('hrzone5')],
  ['distance', (h) => h.includes('distance')],
  ['altitudeGain', (h) => h.includes('altitudegain')],
  ['question', (h) => h.includes('questiontext')],
  ['answeredYes', (h) => h.includes('answeredyes')],
  ['notes', (h) => h === 'notes'],
];

export type HeaderMap = Partial<Record<FieldName, string>>;

export function mapHeaders(headers: string[]): HeaderMap {
  const map: HeaderMap = {};
  for (const header of headers) {
    const n = normalizeHeader(header);
    for (const [field, match] of FIELD_MATCHERS) {
      if (map[field]) continue;
      if (match(n)) {
        map[field] = header;
        break;
      }
    }
  }
  return map;
}

export type CsvKind = 'cycles' | 'sleeps' | 'workouts' | 'journal';

/** Guess which of the four export files a CSV is, from its name and headers. */
export function detectKind(fileName: string, headers: string[]): CsvKind | null {
  const n = normalizeHeader(fileName);
  const norm = headers.map(normalizeHeader);
  const has = (t: string) => norm.some((h) => h.includes(t));
  if (n.includes('journal') || has('questiontext')) return 'journal';
  if (n.includes('workout') || has('activityname')) return 'workouts';
  if (n.includes('physiological') || n.includes('cycle') || has('recoveryscore')) return 'cycles';
  if (n.includes('sleep') || has('sleepperformance')) return 'sleeps';
  return null;
}
