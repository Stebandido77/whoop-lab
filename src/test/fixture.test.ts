import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ingestCsv } from '@/lib/whoop/parse';
import { buildDayRecords } from '@/lib/whoop/model';
import { dayKey, fromDayKey } from '@/lib/format';
import { emptyExport, type DayRecord } from '@/lib/whoop/types';
import type { CsvKind } from '@/lib/whoop/columns';

/**
 * The full pipeline over an anonymised copy of a real export
 * (`npm run fixture`, see scripts/make-fixture.ts).
 *
 * `parse.test.ts` checks the parser against hand-written rows, which is where
 * the precise assertions live. This file exists for the things a hand-written
 * row never reproduces: Spanish file names and headers, an in-progress cycle
 * with half its columns empty, naps mixed into the sleep file, workouts with
 * every HR zone at zero, and 59 days of it in a row. Those are what actually
 * break the parser, and they break it quietly — the charts still render, with
 * the wrong numbers.
 */
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

function loadFixture() {
  const data = emptyExport();
  const kinds: CsvKind[] = [];
  for (const name of readdirSync(FIXTURE_DIR).filter((f) => f.toLowerCase().endsWith('.csv'))) {
    const result = ingestCsv(name, readFileSync(join(FIXTURE_DIR, name), 'utf8'), data);
    if (result) kinds.push(result.kind);
  }
  return { data, kinds, days: buildDayRecords(data) };
}

/** Every numeric leaf of a day record, including the nested workout rows. */
function numbers(day: DayRecord): [string, number][] {
  const out: [string, number][] = [];
  for (const [key, value] of Object.entries(day)) {
    if (typeof value === 'number') out.push([key, value]);
  }
  day.workouts.forEach((w, i) => {
    for (const [key, value] of Object.entries(w)) {
      if (typeof value === 'number') out.push([`workouts[${i}].${key}`, value]);
    }
    w.zones.forEach((z, j) => {
      if (typeof z === 'number') out.push([`workouts[${i}].zones[${j}]`, z]);
    });
  });
  return out;
}

describe('pipeline completo sobre el fixture', () => {
  const { kinds, days } = loadFixture();

  it('reconoce los cuatro archivos de un export en español', () => {
    expect([...kinds].sort()).toEqual(['cycles', 'journal', 'sleeps', 'workouts']);
  });

  it('produce un registro por día, sin huecos ni repetidos', () => {
    expect(days.length).toBeGreaterThan(50);
    expect(new Set(days.map((d) => d.day)).size).toBe(days.length);

    for (let i = 1; i < days.length; i++) {
      const gap = (days[i].date.getTime() - days[i - 1].date.getTime()) / 86_400_000;
      // Local dates, so a DST boundary would give 0.958 or 1.042 instead of 1.
      expect(Math.round(gap)).toBe(1);
    }

    const span =
      (fromDayKey(days[days.length - 1].day).getTime() - fromDayKey(days[0].day).getTime()) /
      86_400_000;
    expect(days.length).toBe(Math.round(span) + 1);
  });

  it('deriva el día en hora local, nunca en UTC', () => {
    for (const day of days) expect(dayKey(day.date)).toBe(day.day);
  });

  it('alinea recoveryNext y strainPrev con los días vecinos', () => {
    for (let i = 0; i < days.length; i++) {
      expect(days[i].recoveryNext).toBe(i + 1 < days.length ? days[i + 1].recovery : null);
      expect(days[i].strainPrev).toBe(i > 0 ? days[i - 1].strain : null);
    }
    // Not a tautology only if the fixture actually has recovery on both sides.
    expect(days.filter((d) => d.recoveryNext != null).length).toBeGreaterThan(40);
  });

  it('no emite NaN en ningún campo numérico', () => {
    for (const day of days) {
      expect(Number.isNaN(day.date.getTime())).toBe(false);
      for (const [field, value] of numbers(day)) {
        expect(Number.isFinite(value), `${day.day}.${field} vale ${value}`).toBe(true);
      }
    }
  });

  it('une las cuatro fuentes sobre el mismo eje de días', () => {
    expect(days.filter((d) => d.recovery != null).length).toBeGreaterThan(40);
    expect(days.filter((d) => d.workoutCount > 0).length).toBeGreaterThan(10);
    expect(days.filter((d) => Object.keys(d.journal).length > 0).length).toBeGreaterThan(20);
    // Naps live in sleeps.csv only; if the nap column stopped being detected,
    // they would silently overwrite the night instead of adding to napMinutes.
    expect(days.filter((d) => d.napMinutes != null).length).toBeGreaterThan(0);
    for (const day of days) expect(day.workoutMinutes).toBe(sumDurations(day));
  });

  it('llena las ventanas móviles una vez hay observaciones suficientes', () => {
    const last = days[days.length - 1];
    expect(last.recovery7).not.toBeNull();
    expect(last.recovery28).not.toBeNull();
    expect(last.hrv28).not.toBeNull();
    // Empty leading window: nothing to average yet, so null, never 0.
    expect(days[0].recovery28).toBeNull();
  });
});

const sumDurations = (day: DayRecord) =>
  day.workouts.reduce((total, w) => total + (w.duration ?? 0), 0);
