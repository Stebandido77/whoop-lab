/**
 * Builds the anonymised test fixture in `src/test/fixtures/` from the real
 * export in `data/`.
 *
 *     npm run fixture
 *
 * Why this exists: the synthetic generator in `src/lib/demo.ts` produces data
 * with the right *relationships* but not the right *shape*. It never emits a
 * Spanish header, an empty in-progress cycle, a nap row, or a workout whose HR
 * zones are all zero. Those are exactly the things that break the parser, so
 * the regression tests need a file with the real shape — and a real export can
 * never be committed.
 *
 * What comes out is therefore not your data:
 *
 *  - every date is shifted into a fictional year, by a whole number of weeks so
 *    weekday patterns survive;
 *  - clock times get a few minutes of jitter, never enough to move a row to
 *    another day;
 *  - every physiological value gets noise and is clamped to a plausible range;
 *  - journal questions are cut down to a neutral allow-list, notes are dropped
 *    and a share of the answers is flipped.
 *
 * Structure is preserved on purpose: the day axis stays contiguous, sleep
 * stages keep their proportions (one noise factor per night, not per stage),
 * and the cycle-start key still joins the four files.
 *
 * Run it with Node 22.6+ — `npm run fixture` uses native type stripping, so the
 * only import from `src/` is `columns.ts`, which has no dependencies of its own.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import {
  detectKind,
  mapHeaders,
  normalizeHeader,
  type CsvKind,
  type FieldName,
  type HeaderMap,
} from '../src/lib/whoop/columns.ts';

const SOURCE_DIR = 'data';
const OUT_DIR = join('src', 'test', 'fixtures');
/** How many cycles to keep. The window is taken from the most recent ones. */
const CYCLES = 60;
/** Everything lands in this year. Far from any year WHOOP has existed. */
const TARGET_YEAR = 1987;
const SEED = 19870105;
/** Share of journal answers flipped, so the fixture is not your habit log. */
const FLIP_RATE = 0.12;

/**
 * Journal questions kept in the fixture. WHOOP's catalogue includes questions
 * about libido, menopause and relationship status; which ones a person has
 * enabled is itself sensitive, so only these neutral ones survive. Matched as
 * normalised substrings against both the English and the Spanish wording.
 */
const NEUTRAL_QUESTIONS = [
  'cafein',
  'caffeine',
  'alcohol',
  'estir',
  'stretch',
  'pantalla',
  'screen',
  'respiracion',
  'breathwork',
  'airelibre',
  'outdoor',
  'sunlight',
  'luzsolar',
  'diario',
  'journal',
  'agua',
  'water',
  'siesta',
  'nap',
  'meditacion',
  'meditat',
];

type Row = Record<string, string>;

// --- deterministic randomness -----------------------------------------------

/**
 * Randomness is addressed by key, not drawn from a stream.
 *
 * The four files overlap: a night's sleep summary appears in both
 * `physiological_cycles` and `sleeps`, and all four repeat the cycle-start
 * timestamp. A sequential PRNG would give those shared values different noise
 * in each file, and the fixture would stop being a coherent export. Keying the
 * draw on (row, field) instead means the same source value always gets the same
 * noise, wherever it appears — and re-running the script never churns the diff.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, only ever used to turn a key into a PRNG seed. */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const uniform = (key: string) => mulberry32(hash(`${SEED}:${key}`))();

/** Standard normal for a key, Box-Muller over two decorrelated draws. */
function gauss(key: string): number {
  const u = Math.max(1e-9, uniform(`${key}#u`));
  const v = uniform(`${key}#v`);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- timestamps --------------------------------------------------------------

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `YYYY-MM-DD[ HH:MM:SS]` -> local Date, or null if the shape is unfamiliar. */
function readTimestamp(value: string): { date: Date; hasTime: boolean } | null {
  const m = TIMESTAMP.exec(value.trim());
  if (!m) return null;
  return {
    date: new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)),
    hasTime: m[4] !== undefined,
  };
}

const writeTimestamp = (d: Date, hasTime: boolean) =>
  hasTime
    ? `${dayKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : dayKey(d);

/**
 * Move a timestamp by `offsetDays` and jitter the clock by a few minutes. The
 * jitter is keyed on the original text, so the same instant lands on the same
 * new instant in all four files and the cycle-start join key survives.
 *
 * The jitter is reverted if it would push the row onto another calendar day:
 * the whole model keys off `Wake onset`, so a row that crosses midnight would
 * silently change which day it belongs to.
 */
function shiftTimestamp(value: string, offsetDays: number): string {
  const parsed = readTimestamp(value);
  if (!parsed) return value;
  const { date, hasTime } = parsed;
  date.setDate(date.getDate() + offsetDays);
  if (!hasTime) return writeTimestamp(date, false);

  const before = dayKey(date);
  const minutes = Math.round(gauss(`ts:${value.trim()}`) * 6);
  const jittered = new Date(date.getTime() + minutes * 60_000);
  return writeTimestamp(dayKey(jittered) === before ? jittered : date, true);
}

// --- numeric noise -----------------------------------------------------------

interface Noise {
  /** Absolute standard deviation, in the column's own unit. */
  sd?: number;
  /** Relative standard deviation, as a fraction of the value. */
  rel?: number;
  min?: number;
  max?: number;
}

const NOISE: Partial<Record<FieldName, Noise>> = {
  recovery: { sd: 6, min: 1, max: 100 },
  rhr: { sd: 3, min: 30, max: 110 },
  hrv: { rel: 0.12, min: 4, max: 200 },
  skinTemp: { sd: 0.35, min: 30, max: 40 },
  spo2: { sd: 0.8, min: 85, max: 100 },
  strain: { sd: 1.1, min: 0, max: 21 },
  calories: { rel: 0.08, min: 0 },
  maxHr: { sd: 5, min: 60, max: 220 },
  avgHr: { sd: 4, min: 40, max: 200 },
  respiratoryRate: { sd: 0.6, min: 8, max: 30 },
  sleepPerformance: { sd: 5, min: 0, max: 100 },
  sleepEfficiency: { sd: 3, min: 0, max: 100 },
  sleepConsistency: { sd: 6, min: 0, max: 100 },
  sleepNeed: { rel: 0.05, min: 0 },
  sleepDebt: { rel: 0.15, min: 0 },
  duration: { rel: 0.08, min: 1 },
  activityStrain: { sd: 0.8, min: 0, max: 21 },
  zone1: { sd: 3, min: 0, max: 100 },
  zone2: { sd: 3, min: 0, max: 100 },
  zone3: { sd: 3, min: 0, max: 100 },
  zone4: { sd: 3, min: 0, max: 100 },
  zone5: { sd: 3, min: 0, max: 100 },
  distance: { rel: 0.08, min: 0 },
  altitudeGain: { rel: 0.12, min: 0 },
};

/**
 * Sleep-stage minutes. These share one noise factor per row so that the stages
 * still add up to roughly the time in bed; noising them independently would
 * produce a fixture whose stacked sleep chart is arithmetically impossible.
 */
const SLEEP_BLOCK: FieldName[] = ['asleep', 'inBed', 'light', 'deep', 'rem', 'awake'];

/** Keep the fixture looking like the export: same number of decimals. */
function formatLike(original: string, value: number): string {
  const dot = original.indexOf('.');
  const decimals = dot === -1 ? 0 : original.length - dot - 1;
  return value.toFixed(decimals);
}

function addNoise(original: string, noise: Noise, key: string, factor?: number): string {
  const n = Number(original);
  if (!Number.isFinite(n)) return original;
  const sd = noise.sd ?? (noise.rel ?? 0) * Math.abs(n);
  let out = factor != null ? n * factor : n + gauss(key) * sd;
  if (noise.min != null) out = Math.max(noise.min, out);
  if (noise.max != null) out = Math.min(noise.max, out);
  return formatLike(original, out);
}

// --- reading the export ------------------------------------------------------

function findCsvFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...findCsvFiles(path));
    else if (entry.toLowerCase().endsWith('.csv')) out.push(path);
  }
  return out;
}

interface SourceFile {
  path: string;
  name: string;
  kind: CsvKind;
  headers: string[];
  map: HeaderMap;
  rows: Row[];
}

function read(path: string): SourceFile | null {
  const name = path.split(/[\\/]/).pop()!;
  const parsed = Papa.parse<Row>(readFileSync(path, 'utf8').trim(), {
    header: true,
    skipEmptyLines: 'greedy',
  });
  const headers = parsed.meta.fields ?? [];
  const kind = detectKind(name, headers);
  if (!kind) return null;
  return { path, name, kind, headers, map: mapHeaders(headers), rows: parsed.data };
}

// --- the transform -----------------------------------------------------------

/**
 * Fields that, together with the cycle start, identify a row across files. The
 * main sleep of a night carries the same `Sleep onset` in `physiological_cycles`
 * and in `sleeps`, so both get the same key and therefore the same noise; a nap
 * has a different onset and gets its own.
 */
const IDENTITY: FieldName[] = ['workoutStart', 'sleepOnset', 'question'];

function rowKey(file: SourceFile, row: Row, index: number): string {
  const parts: string[] = [];
  for (const field of ['cycleStart', ...IDENTITY] as FieldName[]) {
    const header = file.map[field];
    if (header) parts.push(String(row[header] ?? '').trim());
  }
  return parts.filter(Boolean).join('|') || `${file.kind}#${index}`;
}

function anonymize(file: SourceFile, offsetDays: number): Row[] {
  const byHeader = new Map<string, FieldName>();
  for (const [field, header] of Object.entries(file.map)) byHeader.set(header, field as FieldName);

  return file.rows.map((row, index) => {
    const out: Row = {};
    const key = rowKey(file, row, index);
    // One factor per night keeps its sleep stages internally consistent.
    const sleepFactor = 1 + Math.max(-0.15, Math.min(0.15, gauss(`${key}|sleep`) * 0.06));

    for (const header of file.headers) {
      const value = String(row[header] ?? '');
      const field = byHeader.get(header);

      if (!value.trim()) {
        out[header] = value;
        continue;
      }
      if (readTimestamp(value)) {
        out[header] = shiftTimestamp(value, offsetDays);
        continue;
      }
      if (field && SLEEP_BLOCK.includes(field)) {
        out[header] = addNoise(value, { min: 0 }, key, sleepFactor);
        continue;
      }
      if (field && NOISE[field]) {
        out[header] = addNoise(value, NOISE[field], `${key}|${field}`);
        continue;
      }
      if (field === 'notes') {
        out[header] = '';
        continue;
      }
      if (field === 'answeredYes') {
        const yes = /^(true|yes|1|si)$/i.test(value.trim());
        out[header] = String(uniform(`${key}|flip`) < FLIP_RATE ? !yes : yes);
        continue;
      }
      out[header] = value;
    }
    return out;
  });
}

// --- main --------------------------------------------------------------------

function main(): void {
  if (!existsSync(SOURCE_DIR)) fail(`No existe ${SOURCE_DIR}/. Ver data/README.md.`);

  const files = findCsvFiles(SOURCE_DIR)
    .map(read)
    .filter((f): f is SourceFile => f !== null);

  if (!files.length)
    fail(`No encontré CSV reconocibles en ${SOURCE_DIR}/. Descomprime ahí tu export de WHOOP.`);

  const cycles = files.find((f) => f.kind === 'cycles');
  if (!cycles) fail('Falta physiological_cycles.csv en data/: sin ciclos no hay eje de días.');

  const startHeader = cycles.map.cycleStart;
  if (!startHeader) fail(`No reconocí la columna de inicio de ciclo en ${cycles.name}.`);

  // Rows come newest-first. Keep the most recent window and use the cycle-start
  // values as the join key for the other three files, so the fixture stays a
  // coherent slice instead of four unrelated samples.
  const kept = cycles.rows.slice(0, CYCLES);
  const window = new Set(kept.map((r) => String(r[startHeader] ?? '').trim()));
  cycles.rows = kept;

  for (const file of files) {
    if (file === cycles) continue;
    const header = file.map.cycleStart;
    if (header) file.rows = file.rows.filter((r) => window.has(String(r[header] ?? '').trim()));
    if (file.kind === 'journal') {
      const q = file.map.question;
      if (q)
        file.rows = file.rows.filter((r) =>
          NEUTRAL_QUESTIONS.some((n) => normalizeHeader(String(r[q] ?? '')).includes(n)),
        );
    }
  }

  // Shift by whole weeks so weekday structure survives the move to 1987.
  const starts = [...window].map((v) => readTimestamp(v)?.date).filter((d): d is Date => d != null);
  if (!starts.length) fail(`No pude leer ninguna fecha de ${startHeader} en ${cycles.name}.`);
  const earliest = starts.reduce((a, b) => (a < b ? a : b));
  const target = new Date(TARGET_YEAR, 0, 5);
  const offsetDays = Math.round((target.getTime() - earliest.getTime()) / (7 * 86_400_000)) * 7;

  mkdirSync(OUT_DIR, { recursive: true });

  for (const file of files) {
    if (!file.rows.length) {
      console.warn(`  ${file.name}: 0 filas en la ventana, no se escribe`);
      continue;
    }
    const rows = anonymize(file, offsetDays);
    const csv = Papa.unparse(rows, { columns: file.headers, newline: '\n' });
    writeFileSync(join(OUT_DIR, file.name), csv + '\n', 'utf8');
    console.log(
      `  ${file.name.padEnd(28)} ${String(rows.length).padStart(5)} filas (${file.kind})`,
    );
  }

  const shifted = new Date(earliest.getTime());
  shifted.setDate(shifted.getDate() + offsetDays);
  console.log(`\nEscrito en ${OUT_DIR}/`);
  console.log(`Fechas desplazadas ${offsetDays} días: ${dayKey(earliest)} -> ${dayKey(shifted)}`);
  console.log('El fixture es anónimo por construcción, pero míralo antes de commitearlo.');
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
