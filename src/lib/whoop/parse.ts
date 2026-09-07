import Papa from 'papaparse';
import JSZip from 'jszip';
import { dayKey } from '@/lib/format';
import { detectKind, mapHeaders, type CsvKind, type HeaderMap } from './columns';
import { emptyExport, type WhoopExport } from './types';

type Row = Record<string, string>;

/**
 * WHOOP timestamps are local wall-clock strings. `new Date(string)` would drag
 * them through UTC and move nights across day boundaries, so we parse the parts
 * by hand and build a local Date.
 */
export function parseTimestamp(value: string | undefined | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (m) {
    let h = +m[4];
    const period = (m[7] ?? '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return new Date(+m[3], +m[1] - 1, +m[2], h, +m[5], +(m[6] ?? 0));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseNumber(value: string | undefined | null): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s === '-' || /^n\/?a$/i.test(s)) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export const parseBoolean = (value: string | undefined | null): boolean =>
  /^(true|yes|1|si|sí)$/i.test(String(value ?? '').trim());

/**
 * The calendar day a cycle belongs to: the morning you actually saw the score.
 * `Wake onset` is authoritative; without it we shift evening cycle starts to the
 * next day, because a WHOOP cycle opens when you fall asleep.
 */
export function cycleDay(row: Row, map: HeaderMap): string | null {
  const wake = parseTimestamp(map.wakeOnset ? row[map.wakeOnset] : null);
  if (wake) return dayKey(wake);
  const start = parseTimestamp(map.cycleStart ? row[map.cycleStart] : null);
  if (!start) return null;
  const d = new Date(start);
  if (start.getHours() >= 18) d.setDate(d.getDate() + 1);
  return dayKey(d);
}

const get = (row: Row, map: HeaderMap, field: keyof HeaderMap) =>
  map[field] ? row[map[field]!] : undefined;

export interface IngestResult {
  kind: CsvKind;
  rows: number;
}

/** Parse one CSV and merge it into `target`. Returns null if unrecognised. */
export function ingestCsv(
  fileName: string,
  text: string,
  target: WhoopExport,
): IngestResult | null {
  const parsed = Papa.parse<Row>(text.trim(), { header: true, skipEmptyLines: 'greedy' });
  const rows = parsed.data.filter((r) =>
    Object.values(r).some((v) => String(v ?? '').trim() !== ''),
  );
  if (!rows.length) return null;

  const headers = parsed.meta.fields ?? Object.keys(rows[0]);
  const kind = detectKind(fileName, headers);
  if (!kind) return null;
  const map = mapHeaders(headers);
  const num = (r: Row, f: keyof HeaderMap) => parseNumber(get(r, map, f));
  const ts = (r: Row, f: keyof HeaderMap) => parseTimestamp(get(r, map, f));

  if (kind === 'cycles') {
    target.cycles = rows
      .map((r) => ({
        day: cycleDay(r, map)!,
        start: ts(r, 'cycleStart'),
        end: ts(r, 'cycleEnd'),
        recovery: num(r, 'recovery'),
        rhr: num(r, 'rhr'),
        hrv: num(r, 'hrv'),
        skinTemp: num(r, 'skinTemp'),
        spo2: num(r, 'spo2'),
        strain: num(r, 'strain'),
        calories: num(r, 'calories'),
        maxHr: num(r, 'maxHr'),
        avgHr: num(r, 'avgHr'),
        sleepOnset: ts(r, 'sleepOnset'),
        wakeOnset: ts(r, 'wakeOnset'),
        sleepPerformance: num(r, 'sleepPerformance'),
        respiratoryRate: num(r, 'respiratoryRate'),
        asleep: num(r, 'asleep'),
        inBed: num(r, 'inBed'),
        light: num(r, 'light'),
        deep: num(r, 'deep'),
        rem: num(r, 'rem'),
        awake: num(r, 'awake'),
        sleepNeed: num(r, 'sleepNeed'),
        sleepDebt: num(r, 'sleepDebt'),
        sleepEfficiency: num(r, 'sleepEfficiency'),
        sleepConsistency: num(r, 'sleepConsistency'),
      }))
      .filter((r) => r.day);
  }

  if (kind === 'sleeps') {
    target.sleeps = rows
      .map((r) => ({
        day: cycleDay(r, map)!,
        isNap: parseBoolean(get(r, map, 'nap')),
        onset: ts(r, 'sleepOnset'),
        wake: ts(r, 'wakeOnset'),
        asleep: num(r, 'asleep'),
        inBed: num(r, 'inBed'),
        light: num(r, 'light'),
        deep: num(r, 'deep'),
        rem: num(r, 'rem'),
        awake: num(r, 'awake'),
        performance: num(r, 'sleepPerformance'),
        efficiency: num(r, 'sleepEfficiency'),
        sleepNeed: num(r, 'sleepNeed'),
        sleepDebt: num(r, 'sleepDebt'),
        consistency: num(r, 'sleepConsistency'),
        respiratoryRate: num(r, 'respiratoryRate'),
      }))
      .filter((r) => r.day);
  }

  if (kind === 'workouts') {
    target.workouts = rows
      .map((r) => {
        const start = ts(r, 'workoutStart');
        return {
          day: start ? dayKey(start) : cycleDay(r, map)!,
          start,
          end: ts(r, 'workoutEnd'),
          duration: num(r, 'duration'),
          activity: (get(r, map, 'activity') ?? 'Sin nombre').trim() || 'Sin nombre',
          strain: num(r, 'activityStrain'),
          calories: num(r, 'calories'),
          maxHr: num(r, 'maxHr'),
          avgHr: num(r, 'avgHr'),
          zones: [
            num(r, 'zone1'),
            num(r, 'zone2'),
            num(r, 'zone3'),
            num(r, 'zone4'),
            num(r, 'zone5'),
          ],
          distance: num(r, 'distance'),
          altitudeGain: num(r, 'altitudeGain'),
        };
      })
      .filter((r) => r.day);
  }

  if (kind === 'journal') {
    target.journal = rows
      .map((r) => ({
        day: cycleDay(r, map)!,
        question: (get(r, map, 'question') ?? '').trim(),
        yes: parseBoolean(get(r, map, 'answeredYes')),
        notes: (get(r, map, 'notes') ?? '').trim(),
      }))
      .filter((r) => r.day && r.question);
  }

  return { kind, rows: rows.length };
}

const isJunk = (name: string) =>
  name.includes('__MACOSX') || (name.split('/').pop() ?? '').startsWith('._');

/** Read a mixed list of `.zip` and `.csv` files into one export object. */
export async function readExportFiles(
  files: File[],
): Promise<{ data: WhoopExport; found: IngestResult[] }> {
  const data = emptyExport();
  const found: IngestResult[] = [];

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(
        (e) => !e.dir && /\.csv$/i.test(e.name) && !isJunk(e.name),
      );
      for (const entry of entries) {
        const result = ingestCsv(entry.name.split('/').pop()!, await entry.async('string'), data);
        if (result) found.push(result);
      }
    } else if (/\.csv$/i.test(file.name)) {
      const result = ingestCsv(file.name, await file.text(), data);
      if (result) found.push(result);
    }
  }

  return { data, found };
}
