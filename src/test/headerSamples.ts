import type { CsvKind, LanguageCode } from '@/lib/whoop/languages';

/**
 * One real header row per file, per registered language.
 *
 * This is the evidence behind `languages.ts`. `languages.test.ts` replays every
 * sample through `detectKind` and `mapHeaders` and insists that not one column
 * is left unmapped, so a language pack cannot drift away from the export it
 * claims to read.
 *
 * `HEADER_SAMPLES` is typed as a total map over `LanguageCode`: registering a
 * language without pasting its header rows is a compile error, on purpose. It
 * is also the entire contribution — see `docs/formato-export-whoop.md`.
 *
 * Header rows only. Never a data row.
 */
export interface HeaderSample {
  /** The file name exactly as the export ships it. */
  file: string;
  /** The first line of that file, pasted verbatim. */
  header: string;
}

export const HEADER_SAMPLES: Record<LanguageCode, Record<CsvKind, HeaderSample>> = {
  en: {
    cycles: {
      file: 'physiological_cycles.csv',
      header:
        'Cycle start time,Cycle end time,Cycle timezone,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms),Skin temp (celsius),Blood oxygen %,Day Strain,Energy burned (cal),Max HR (bpm),Average HR (bpm),Sleep onset,Wake onset,Sleep performance %,Respiratory rate (rpm),Asleep duration (min),In bed duration (min),Light sleep duration (min),Deep (SWS) duration (min),REM duration (min),Awake duration (min),Sleep need (min),Sleep debt (min),Sleep efficiency %,Sleep consistency %',
    },
    // Reconstructed from the column reference in docs/formato-export-whoop.md:
    // the export this project was built against is Spanish, so we have no
    // verbatim English sleeps row. Replace it if you have one.
    sleeps: {
      file: 'sleeps.csv',
      header:
        'Cycle start time,Cycle end time,Cycle timezone,Sleep onset,Wake onset,Sleep performance %,Respiratory rate (rpm),Asleep duration (min),In bed duration (min),Light sleep duration (min),Deep (SWS) duration (min),REM duration (min),Awake duration (min),Sleep need (min),Sleep debt (min),Sleep efficiency %,Sleep consistency %,Nap',
    },
    workouts: {
      file: 'workouts.csv',
      header:
        'Cycle start time,Workout start time,Workout end time,Duration (min),Activity name,Activity Strain,Energy burned (cal),Max HR (bpm),Average HR (bpm),HR Zone 1 %,HR Zone 2 %,HR Zone 3 %,HR Zone 4 %,HR Zone 5 %,GPS Enabled,Distance (meters),Altitude Gain (meters)',
    },
    journal: {
      file: 'journal_entries.csv',
      header: 'Cycle start time,Cycle end time,Cycle timezone,Question text,Answered yes,Notes',
    },
  },

  // Verbatim from an export of 2026-09-07, account language Spanish.
  es: {
    cycles: {
      file: 'physiological_cycles.csv',
      header:
        'Hora de inicio del ciclo,Hora de finalización del ciclo,Zona horaria del ciclo,Puntuación de recuperación (%),Frecuencia cardíaca en reposo (lpm),Variabilidad de la frecuencia cardíaca (ms),Temp. cutánea (grados centígrados),Oxígeno en sangre %,Esfuerzo del día,Energía quemada (cal),FC máx. (lpm),FC promedio (lpm),Inicio del sueño,Inicio de la vigilia,Calificación del sueño (%),Frecuencia respiratoria (rpm),Duración del sueño (min),Tiempo en la cama (min),Duración de sueño ligero (min),Duración de sueño profundo (SWS) (min),Duración de sueño REM (min),Tempo despierto/a (min),Sueño necesario (min),Deuda de sueño (min),Eficiencia del sueño %,Regularidad del sueño %',
    },
    sleeps: {
      file: 'sueño.csv',
      header:
        'Hora de inicio del ciclo,Hora de finalización del ciclo,Zona horaria del ciclo,Inicio del sueño,Inicio de la vigilia,Calificación del sueño (%),Frecuencia respiratoria (rpm),Duración del sueño (min),Tiempo en la cama (min),Duración de sueño ligero (min),Duración de sueño profundo (SWS) (min),Duración de sueño REM (min),Tempo despierto/a (min),Sueño necesario (min),Deuda de sueño (min),Eficiencia del sueño %,Regularidad del sueño %,Siesta',
    },
    workouts: {
      file: 'entrenamientos.csv',
      header:
        'Hora de inicio del ciclo,Hora de finalización del ciclo,Zona horaria del ciclo,Hora de inicio del entrenamiento,Hora de finalización del entrenamiento,Duración (min),Nombre de la actividad,Esfuerzo de actividad,Energía quemada (cal),FC máx. (lpm),FC promedio (lpm),Zona FC 1%,Zona FC 2%,Zona FC 3%,Zona FC 4%,Zona FC 5%,GPS habilitado',
    },
    journal: {
      file: 'journal_entries.csv',
      header:
        'Hora de inicio del ciclo,Hora de finalización del ciclo,Zona horaria del ciclo,Texto de la pregunta,"Respondió ""Sí""",Notas',
    },
  },
};
