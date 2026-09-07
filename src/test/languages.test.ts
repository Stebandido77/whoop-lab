import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { detectKind, mapHeaders, normalizeHeader } from '@/lib/whoop/columns';
import {
  FIELD_ORDER,
  KIND_ORDER,
  LANGUAGES,
  LANGUAGE_CODES,
  type CsvKind,
  type FieldName,
} from '@/lib/whoop/languages';
import { HEADER_SAMPLES } from './headerSamples';

/**
 * Replays the real header row of every registered language through the parser.
 *
 * The failure this guards against is silent: an unmapped column does not throw,
 * it produces a `DayRecord` with a null where a number should be, and a chart
 * that renders perfectly and is wrong. A language pack with a gap in it is
 * worse than no pack at all, because it looks supported.
 */

/** Columns without which the file is not worth reading. */
const REQUIRED: Record<CsvKind, FieldName[]> = {
  cycles: [
    'cycleStart',
    'recovery',
    'rhr',
    'hrv',
    'strain',
    'sleepOnset',
    'wakeOnset',
    'asleep',
    'sleepPerformance',
  ],
  sleeps: ['cycleStart', 'sleepOnset', 'wakeOnset', 'asleep', 'nap'],
  workouts: ['workoutStart', 'duration', 'activity', 'activityStrain'],
  journal: ['cycleStart', 'question', 'answeredYes'],
};

const headerFields = (line: string): string[] =>
  (Papa.parse<string[]>(line.trim()).data[0] ?? []).map((h) => h.trim());

it('tiene al menos un idioma registrado y una muestra por idioma', () => {
  expect(LANGUAGE_CODES.length).toBeGreaterThan(0);
  for (const code of LANGUAGE_CODES) expect(Object.keys(HEADER_SAMPLES[code])).toHaveLength(4);
});

describe.each(LANGUAGE_CODES)('idioma %s', (code) => {
  const pack = LANGUAGES[code];
  const isIgnored = (header: string) =>
    pack.ignored.some((fragment) => normalizeHeader(header).includes(fragment));

  it('declara fragmentos para cada campo conocido', () => {
    // The type already forces the keys; this catches a pack that lists the field
    // and then leaves it empty for a column the export actually has.
    expect(Object.keys(pack.fields).sort()).toEqual([...FIELD_ORDER].sort());
  });

  describe.each(KIND_ORDER)('%s', (kind) => {
    const sample = HEADER_SAMPLES[code][kind];
    const headers = headerFields(sample.header);

    it(`reconoce ${sample.file}`, () => {
      expect(detectKind(sample.file, headers)).toBe(kind);
    });

    it('reconoce el archivo aunque le cambien el nombre', () => {
      expect(detectKind('export.csv', headers)).toBe(kind);
    });

    it('no deja ninguna columna sin mapear', () => {
      const map = mapHeaders(headers);
      const claimed = new Set(Object.values(map));
      const unmapped = headers.filter((h) => !claimed.has(h) && !isIgnored(h));
      // Reported as a list so the failure names the exact headers to add.
      expect(unmapped).toEqual([]);
    });

    it('mapea las columnas sin las que el archivo no sirve', () => {
      const map = mapHeaders(headers);
      const missing = REQUIRED[kind].filter((field) => !map[field]);
      expect(missing).toEqual([]);
    });

    it('no le da dos campos a la misma columna', () => {
      const map = mapHeaders(headers);
      const used = Object.values(map);
      expect(new Set(used).size).toBe(used.length);
    });
  });
});

describe('el registro de idiomas no se pisa a sí mismo', () => {
  it('ningún fragmento de un idioma reclama un encabezado de otro', () => {
    // Every language's fragments are tried against every header, so a fragment
    // that is too short in one language corrupts the others. Walk all samples
    // against the union and check each header lands on the field its own
    // language assigns it.
    for (const code of LANGUAGE_CODES) {
      for (const kind of KIND_ORDER) {
        const sample = HEADER_SAMPLES[code][kind];
        const headers = headerFields(sample.header);
        const map = mapHeaders(headers);

        for (const [field, header] of Object.entries(map) as [FieldName, string][]) {
          const own = LANGUAGES[code].fields[field];
          const normalized = normalizeHeader(header);
          const matchesOwnLanguage = own.some((fragment) =>
            typeof fragment === 'string'
              ? normalized.includes(fragment)
              : fragment.every((part) => normalized.includes(part)),
          );
          expect(matchesOwnLanguage, `${code}/${kind}: "${header}" -> ${field}`).toBe(true);
        }
      }
    }
  });
});
