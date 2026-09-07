/**
 * Header text -> field name.
 *
 * WHOOP has renamed export columns more than once, and the whole export is
 * localised: the file names and every header follow the account language. So
 * nothing here matches an exact string. Headers are normalised (accents folded,
 * lower case, letters and digits only) and compared against the fragments
 * registered for each language.
 *
 * This file is the *logic*; the vocabulary lives in `languages.ts`. Supporting a
 * new language means adding an entry there, never editing anything below.
 */
// The explicit `.ts` extension keeps `npm run fixture` working: that script runs
// under Node's type stripping, which does no extension resolution.
import {
  FIELD_ORDER,
  KIND_ORDER,
  LANGUAGE_LIST,
  type CsvKind,
  type FieldName,
  type Fragment,
} from './languages.ts';

// Re-exported so the rest of the codebase keeps importing its vocabulary from
// one place. Anything language-specific comes from `languages.ts` directly.
export { type CsvKind, type FieldName } from './languages.ts';

/**
 * Accents are folded rather than stripped, so `sueño` becomes `sueno` and not
 * `sueo`. That is what lets the Spanish fragments stay readable.
 */
export const normalizeHeader = (h: string): string =>
  h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** A fragment matches if it is contained in the header; an array needs all of its parts. */
const accepts = (header: string, fragment: Fragment): boolean =>
  typeof fragment === 'string'
    ? header.includes(fragment)
    : fragment.every((part) => header.includes(part));

const claims = (header: string, field: FieldName): boolean =>
  LANGUAGE_LIST.some((language) =>
    language.fields[field].some((fragment) => accepts(header, fragment)),
  );

export type HeaderMap = Partial<Record<FieldName, string>>;

/**
 * Assign each header to a field. Order matters twice over: `FIELD_ORDER` decides
 * which field gets first refusal on an ambiguous header, and a field that has
 * already been filled does not take a second one, so the leftmost matching
 * column wins.
 */
export function mapHeaders(headers: string[]): HeaderMap {
  const map: HeaderMap = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const field of FIELD_ORDER) {
      if (map[field]) continue;
      if (claims(normalized, field)) {
        map[field] = header;
        break;
      }
    }
  }
  return map;
}

/**
 * The column that only one of the four files has. Used as the fallback when the
 * file name is in a language we do not know, or when the person renamed it.
 */
const SIGNATURE: Record<CsvKind, FieldName> = {
  journal: 'question',
  workouts: 'activity',
  cycles: 'recovery',
  sleeps: 'sleepPerformance',
};

/**
 * Guess which of the four export files a CSV is. `KIND_ORDER` matters: cycles
 * carry a sleep summary too, so they have to be ruled out before sleeps.
 */
export function detectKind(fileName: string, headers: string[]): CsvKind | null {
  const name = normalizeHeader(fileName);
  const map = mapHeaders(headers);
  for (const kind of KIND_ORDER) {
    const byName = LANGUAGE_LIST.some((language) =>
      language.files[kind].some((fragment) => name.includes(fragment)),
    );
    if (byName || map[SIGNATURE[kind]]) return kind;
  }
  return null;
}
