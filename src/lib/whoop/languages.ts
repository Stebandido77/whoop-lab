/**
 * Every language WHOOP is known to export in, and the header fragments that
 * identify each column in it.
 *
 * The export is localised end to end: a Spanish account gets `sueño.csv` and
 * `entrenamientos.csv` with all 26 cycle headers translated. Nothing in the file
 * announces the language, so the parser matches on fragments from every
 * registered language at once.
 *
 * **Adding a language is adding an entry to `LANGUAGES` and a sample header row
 * to `src/test/headerSamples.ts`. There is no logic to edit.** The matching
 * itself lives in `columns.ts` and never mentions a language by name.
 * `docs/formato-export-whoop.md` walks through it.
 */

/**
 * Every column the model knows about, **in precedence order**: `mapHeaders`
 * gives a header to the first field whose fragments accept it. Sleep-stage
 * durations come before the generic activity `duration` so that
 * "Asleep duration (min)" is never read as a workout length.
 *
 * This array is the source of truth for `FieldName`, so a field that is not
 * listed here does not exist, and every language pack has to account for all of
 * them.
 */
export const FIELD_ORDER = [
  'cycleStart',
  'cycleEnd',
  'recovery',
  'rhr',
  'hrv',
  'skinTemp',
  'spo2',
  'strain',
  'calories',
  'maxHr',
  'avgHr',
  'sleepOnset',
  'wakeOnset',
  'sleepPerformance',
  'respiratoryRate',
  'asleep',
  'inBed',
  'light',
  'deep',
  'rem',
  'awake',
  'sleepNeed',
  'sleepDebt',
  'sleepEfficiency',
  'sleepConsistency',
  'nap',
  'workoutStart',
  'workoutEnd',
  'duration',
  'activity',
  'activityStrain',
  'zone1',
  'zone2',
  'zone3',
  'zone4',
  'zone5',
  'distance',
  'altitudeGain',
  'question',
  'answeredYes',
  'notes',
] as const;

export type FieldName = (typeof FIELD_ORDER)[number];

/** The four files of an export, in the order `detectKind` tries them. */
export const KIND_ORDER = ['journal', 'workouts', 'cycles', 'sleeps'] as const;

export type CsvKind = (typeof KIND_ORDER)[number];

/**
 * A normalised piece of a header (see `normalizeHeader`: accents folded, lower
 * case, only letters and digits). A plain string has to appear somewhere in the
 * header; an array requires every one of its strings to appear, which is how
 * "Deep (SWS) duration (min)" is pinned without claiming every header that says
 * "duration".
 *
 * Prefer long fragments. The export repeats the same nouns across a dozen
 * columns, and a short one will quietly steal another field's header.
 */
export type Fragment = string | readonly string[];

export interface LanguagePack {
  /** Endonym, for docs and for the language list in the README. */
  name: string;
  /** Fragments of the *file name*, per export file. */
  files: Readonly<Record<CsvKind, readonly string[]>>;
  /**
   * Fragments of the *header*, per column. Every field must appear; use an
   * empty array for a column this language's export has never been seen to
   * carry, so that a gap is a deliberate, visible decision.
   */
  fields: Readonly<Record<FieldName, readonly Fragment[]>>;
  /**
   * Headers this language exports that the model deliberately does not read.
   * Listing them keeps `languages.test.ts` able to insist that every other
   * column is mapped.
   */
  ignored: readonly string[];
}

const en: LanguagePack = {
  name: 'English',
  files: {
    journal: ['journal'],
    workouts: ['workout'],
    cycles: ['physiological', 'cycle'],
    sleeps: ['sleep'],
  },
  fields: {
    cycleStart: ['cyclestart'],
    cycleEnd: ['cycleend'],
    recovery: ['recoveryscore'],
    rhr: ['restingheartrate'],
    hrv: ['heartratevariability'],
    skinTemp: ['skintemp'],
    spo2: ['bloodoxygen', 'spo2'],
    strain: ['daystrain'],
    calories: ['energyburned'],
    maxHr: ['maxhr'],
    avgHr: ['averagehr'],
    sleepOnset: ['sleeponset'],
    wakeOnset: ['wakeonset'],
    sleepPerformance: ['sleepperformance'],
    respiratoryRate: ['respiratoryrate'],
    asleep: ['asleepduration'],
    inBed: ['inbedduration'],
    light: ['lightsleepduration'],
    deep: [['deep', 'duration']],
    rem: ['remduration'],
    awake: ['awakeduration'],
    sleepNeed: ['sleepneed'],
    sleepDebt: ['sleepdebt'],
    sleepEfficiency: ['sleepefficiency'],
    sleepConsistency: ['sleepconsistency'],
    nap: ['nap'],
    workoutStart: ['workoutstart'],
    workoutEnd: ['workoutend'],
    duration: [['duration', 'min']],
    activity: ['activityname'],
    activityStrain: ['activitystrain'],
    zone1: ['hrzone1'],
    zone2: ['hrzone2'],
    zone3: ['hrzone3'],
    zone4: ['hrzone4'],
    zone5: ['hrzone5'],
    distance: ['distance'],
    altitudeGain: ['altitudegain'],
    question: ['questiontext'],
    answeredYes: ['answeredyes'],
    notes: ['notes'],
  },
  ignored: ['cycletimezone', 'gpsenabled'],
};

const es: LanguagePack = {
  name: 'Español',
  // A Spanish export translates only two of the four names: the cycles and
  // journal files keep their English ones. The `ciclo` and `diario` fragments
  // are here for the day WHOOP finishes the job; today the English pack is what
  // matches those two, which is why every language's fragments are tried for
  // every file.
  files: {
    journal: ['diario'],
    workouts: ['entrenamiento'],
    cycles: ['ciclo'],
    sleeps: ['sueno'],
  },
  fields: {
    cycleStart: ['horadeiniciodelciclo'],
    cycleEnd: ['horadefinalizaciondelciclo'],
    recovery: ['puntuacionderecuperacion'],
    rhr: ['frecuenciacardiacaenreposo'],
    hrv: ['variabilidaddelafrecuenciacardiaca'],
    skinTemp: ['tempcutanea'],
    spo2: ['oxigenoensangre'],
    strain: ['esfuerzodeldia'],
    calories: ['energiaquemada'],
    maxHr: ['fcmax'],
    avgHr: ['fcpromedio'],
    sleepOnset: ['iniciodelsueno'],
    wakeOnset: ['iniciodelavigilia'],
    sleepPerformance: ['calificaciondelsueno'],
    respiratoryRate: ['frecuenciarespiratoria'],
    // "Duración del sueño" (total) against "Duración de sueño ligero" (a stage):
    // the article is the only thing telling them apart, so both fragments carry it.
    asleep: ['duraciondelsueno'],
    inBed: ['tiempoenlacama'],
    light: ['duraciondesuenoligero'],
    deep: ['duraciondesuenoprofundo'],
    rem: ['duraciondesuenorem'],
    awake: ['tempodespierto'],
    sleepNeed: ['suenonecesario'],
    sleepDebt: ['deudadesueno'],
    sleepEfficiency: ['eficienciadelsueno'],
    sleepConsistency: ['regularidaddelsueno'],
    nap: ['siesta'],
    workoutStart: ['horadeiniciodelentrenamiento'],
    workoutEnd: ['horadefinalizaciondelentrenamiento'],
    duration: [['duracion', 'min']],
    activity: ['nombredelaactividad'],
    activityStrain: ['esfuerzodeactividad'],
    zone1: ['zonafc1'],
    zone2: ['zonafc2'],
    zone3: ['zonafc3'],
    zone4: ['zonafc4'],
    zone5: ['zonafc5'],
    // Unverified: the reference export has no GPS activities, so these two
    // columns have never been seen in Spanish. Wrong guesses only fail to match.
    distance: ['distancia'],
    altitudeGain: ['gananciadealtitud'],
    question: ['textodelapregunta'],
    answeredYes: ['respondiosi'],
    notes: ['notas'],
  },
  ignored: ['zonahorariadelciclo', 'gpshabilitado'],
};

/** The registry. One entry per language; nothing else needs to change. */
export const LANGUAGES = { en, es } satisfies Record<string, LanguagePack>;

export type LanguageCode = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export const LANGUAGE_LIST: LanguagePack[] = Object.values(LANGUAGES);
