import { describe, expect, it } from 'vitest';
import { cycleDay, ingestCsv, parseBoolean, parseNumber, parseTimestamp } from '@/lib/whoop/parse';
import { detectKind, mapHeaders } from '@/lib/whoop/columns';
import { emptyExport } from '@/lib/whoop/types';
import { buildDayRecords } from '@/lib/whoop/model';

const CYCLES_CSV = `Cycle start time,Cycle end time,Cycle timezone,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms),Skin temp (celsius),Blood oxygen %,Day Strain,Energy burned (cal),Max HR (bpm),Average HR (bpm),Sleep onset,Wake onset,Sleep performance %,Respiratory rate (rpm),Asleep duration (min),In bed duration (min),Light sleep duration (min),Deep (SWS) duration (min),REM duration (min),Awake duration (min),Sleep need (min),Sleep debt (min),Sleep efficiency %,Sleep consistency %
2026-03-01 23:12:00,2026-03-02 22:40:00,GMT-5,71,52,84,33.4,95.8,12.4,2680,168,74,2026-03-01 23:12:00,2026-03-02 07:05:00,94,14.6,432,473,210,88,134,41,460,55,91.3,78
2026-03-02 23:40:00,2026-03-03 23:01:00,GMT-5,48,56,64,33.6,95.1,15.9,2990,176,79,2026-03-02 23:40:00,2026-03-03 06:32:00,80,15.4,371,412,192,70,109,41,464,120,90.0,71`;

const WORKOUTS_CSV = `Cycle start time,Workout start time,Workout end time,Duration (min),Activity name,Activity Strain,Energy burned (cal),Max HR (bpm),Average HR (bpm),HR Zone 1 %,HR Zone 2 %,HR Zone 3 %,HR Zone 4 %,HR Zone 5 %,GPS Enabled,Distance (meters),Altitude Gain (meters)
2026-03-02 07:05:00,2026-03-02 18:10:00,2026-03-02 19:35:00,85,Tennis,11.2,720,178,141,10,18,32,28,12,false,,`;

const JOURNAL_CSV = `Cycle start time,Cycle end time,Cycle timezone,Question text,Answered yes,Notes
2026-03-01 23:12:00,2026-03-02 22:40:00,GMT-5,Have any alcoholic drinks?,false,
2026-03-02 23:40:00,2026-03-03 23:01:00,GMT-5,Have any alcoholic drinks?,true,`;

describe('scalar parsers', () => {
  it('keeps timestamps in local time', () => {
    const d = parseTimestamp('2026-03-01 23:12:00')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(23);
  });

  it('handles US-style timestamps with meridiem', () => {
    const d = parseTimestamp('3/1/2026 11:12:00 PM')!;
    expect(d.getHours()).toBe(23);
    expect(d.getDate()).toBe(1);
  });

  it('treats blanks and n/a as missing', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('n/a')).toBeNull();
    expect(parseNumber('12.5')).toBe(12.5);
  });

  it('accepts the booleans WHOOP actually emits', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('FALSE')).toBe(false);
    expect(parseBoolean('yes')).toBe(true);
  });
});

describe('header mapping', () => {
  const headers = CYCLES_CSV.split('\n')[0].split(',');

  it('claims sleep-stage durations before the workout duration', () => {
    const map = mapHeaders(headers);
    expect(map.asleep).toBe('Asleep duration (min)');
    expect(map.deep).toBe('Deep (SWS) duration (min)');
    expect(map.duration).toBeUndefined();
  });

  it('maps the workout duration when there are no sleep stages', () => {
    const map = mapHeaders(WORKOUTS_CSV.split('\n')[0].split(','));
    expect(map.duration).toBe('Duration (min)');
    expect(map.activity).toBe('Activity name');
  });

  it('identifies each export file', () => {
    expect(detectKind('physiological_cycles.csv', headers)).toBe('cycles');
    expect(detectKind('workouts.csv', WORKOUTS_CSV.split('\n')[0].split(','))).toBe('workouts');
    expect(detectKind('journal_entries.csv', JOURNAL_CSV.split('\n')[0].split(','))).toBe(
      'journal',
    );
    expect(detectKind('random.csv', ['a', 'b'])).toBeNull();
  });
});

describe('cycleDay', () => {
  it('prefers wake onset, so the score lands on the morning you saw it', () => {
    const map = mapHeaders(CYCLES_CSV.split('\n')[0].split(','));
    const row = Object.fromEntries(
      CYCLES_CSV.split('\n')[0]
        .split(',')
        .map((h, i) => [h, CYCLES_CSV.split('\n')[1].split(',')[i]]),
    );
    expect(cycleDay(row, map)).toBe('2026-03-02');
  });
});

describe('ingest and model', () => {
  it('joins the four files into one row per day', () => {
    const data = emptyExport();
    expect(ingestCsv('physiological_cycles.csv', CYCLES_CSV, data)?.kind).toBe('cycles');
    expect(ingestCsv('workouts.csv', WORKOUTS_CSV, data)?.kind).toBe('workouts');
    expect(ingestCsv('journal_entries.csv', JOURNAL_CSV, data)?.kind).toBe('journal');

    const days = buildDayRecords(data);
    expect(days).toHaveLength(2);
    expect(days[0].day).toBe('2026-03-02');
    expect(days[0].recovery).toBe(71);
    expect(days[0].workoutCount).toBe(1);
    expect(days[0].workoutMinutes).toBe(85);
    expect(days[0].sleepHours).toBeCloseTo(7.2, 5);
    expect(days[0].journal['Have any alcoholic drinks?']).toBe(false);
    expect(days[1].journal['Have any alcoholic drinks?']).toBe(true);
  });

  it('exposes the lag columns the correlation panels rely on', () => {
    const data = emptyExport();
    ingestCsv('physiological_cycles.csv', CYCLES_CSV, data);
    const days = buildDayRecords(data);
    expect(days[0].recoveryNext).toBe(48);
    expect(days[1].strainPrev).toBeCloseTo(12.4, 5);
  });

  it('rejects a CSV it does not recognise', () => {
    expect(ingestCsv('shopping.csv', 'a,b\n1,2', emptyExport())).toBeNull();
  });
});
