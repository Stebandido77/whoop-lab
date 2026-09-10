import { describe, expect, it } from 'vitest';
import { activityWeekLoad, circadianClock } from '@/lib/metrics';
import { buildDayRecords } from '@/lib/whoop/model';
import { generateDemoExport } from '@/lib/demo';
import type { DayRecord, WorkoutRow } from '@/lib/whoop/types';

const demo = (days = 420): DayRecord[] => buildDayRecords(generateDemoExport(days));

const workout = (
  day: string,
  hour: number,
  minute: number,
  over: Partial<WorkoutRow> = {},
): WorkoutRow => {
  const [y, mo, d] = day.split('-').map(Number);
  return {
    day,
    start: new Date(y, mo - 1, d, hour, minute),
    end: new Date(y, mo - 1, d, hour + 1, minute),
    duration: 60,
    activity: 'Running',
    strain: 10,
    calories: 500,
    maxHr: 170,
    avgHr: 140,
    zones: [10, 20, 30, 30, 10],
    distance: 10000,
    altitudeGain: 0,
    ...over,
  };
};

describe('circadianClock', () => {
  it('switches off below its minimum number of nights', () => {
    const result = circadianClock(demo(420).slice(0, 10), { minN: 21 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.minN).toBe(21);
      expect(result.missing).toBe(21 - result.n);
    }
  });

  it('wraps a bedtime past midnight back onto the clock face', () => {
    const days = demo(60).map((d) => ({ ...d }));
    // 00:30, stored shifted to 1470 so the axis stays monotonic.
    for (const day of days) {
      day.bedtime = 1470;
      day.wakeTime = 480;
    }
    const result = circadianClock(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bedtime.median).toBe(30);
    expect(result.wake.median).toBe(480);
    // 00:30 to 08:00 is seven and a half hours, not sixteen and a half.
    expect(result.windowMinutes).toBe(450);
  });

  it('measures the window across midnight for an ordinary bedtime too', () => {
    const days = demo(60).map((d) => ({ ...d }));
    for (const day of days) {
      day.bedtime = 23 * 60; // 23:00, already inside the shifted range
      day.wakeTime = 7 * 60;
    }
    const result = circadianClock(days);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.windowMinutes).toBe(8 * 60);
  });

  it('reports quartiles that bracket the median', () => {
    const result = circadianClock(demo(420));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const q of [result.bedtime, result.wake]) {
      expect(q.q1).toBeLessThanOrEqual(q.median);
      expect(q.median).toBeLessThanOrEqual(q.q3);
      expect(q.n).toBeGreaterThan(100);
    }
  });

  it('places each session at the minute it started', () => {
    const days = demo(60).map((d) => ({ ...d, workouts: [] as WorkoutRow[] }));
    days[10].workouts = [workout(days[10].day, 6, 45, { strain: 12 })];
    days[20].workouts = [workout(days[20].day, 18, 15, { strain: 8, activity: 'Cycling' })];
    const result = circadianClock(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].minuteOfDay).toBe(6 * 60 + 45);
    expect(result.sessions[1].minuteOfDay).toBe(18 * 60 + 15);
    expect(result.maxStrain).toBe(12);
  });

  it('skips a session with no start time or no strain rather than placing it at midnight', () => {
    const days = demo(60).map((d) => ({ ...d, workouts: [] as WorkoutRow[] }));
    days[5].workouts = [
      workout(days[5].day, 7, 0, { start: null }),
      workout(days[5].day, 8, 0, { strain: null }),
      workout(days[5].day, 9, 0),
    ];
    const result = circadianClock(days);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].minuteOfDay).toBe(9 * 60);
    }
  });

  it('ranks activities by total strain, which is the colour order', () => {
    const days = demo(90).map((d) => ({ ...d, workouts: [] as WorkoutRow[] }));
    days[1].workouts = [workout(days[1].day, 7, 0, { activity: 'Yoga', strain: 3 })];
    days[2].workouts = [workout(days[2].day, 7, 0, { activity: 'Running', strain: 10 })];
    days[3].workouts = [workout(days[3].day, 7, 0, { activity: 'Running', strain: 10 })];
    days[4].workouts = [workout(days[4].day, 7, 0, { activity: 'Cycling', strain: 15 })];
    const result = circadianClock(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activities.map((a) => a.activity)).toEqual(['Running', 'Cycling', 'Yoga']);
    expect(result.activities[0].strain).toBe(20);
    expect(result.activities[0].sessions).toBe(2);
  });

  it('leaves a wake hour without a mean when too few mornings landed in it', () => {
    const days = demo(120).map((d) => ({ ...d }));
    days.forEach((day, i) => {
      day.wakeTime = i < 3 ? 4 * 60 + 30 : 7 * 60 + 30;
      day.recovery = 60;
    });
    const result = circadianClock(days, { minPerHour: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const early = result.wakeHours.find((h) => h.hour === 4)!;
    const usual = result.wakeHours.find((h) => h.hour === 7)!;
    expect(early.n).toBe(3);
    expect(early.recovery).toBeNull();
    expect(usual.recovery).toBeCloseTo(60, 6);
  });

  it('bins a wake hour by the hour it fell in, not by rounding', () => {
    const days = demo(120).map((d) => ({ ...d }));
    for (const day of days) {
      day.wakeTime = 6 * 60 + 59;
      day.recovery = 55;
    }
    const result = circadianClock(days);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wakeHours.map((h) => h.hour)).toEqual([6]);
  });

  it('runs on the demo export and finds sessions and wake hours', () => {
    const result = circadianClock(demo(420));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessions.length).toBeGreaterThan(50);
    expect(result.wakeHours.length).toBeGreaterThan(0);
    expect(result.meanRecovery).not.toBeNull();
    for (const session of result.sessions) {
      expect(session.minuteOfDay).toBeGreaterThanOrEqual(0);
      expect(session.minuteOfDay).toBeLessThan(1440);
    }
  });
});

describe('activityWeekLoad', () => {
  it('switches off on a range shorter than its minimum', () => {
    const result = activityWeekLoad(demo(420).slice(0, 14), { minN: 28 });
    expect(result.ok).toBe(false);
  });

  it('fills the weeks contiguously, so a month off stays a month off', () => {
    const days = demo(120).map((d) => ({ ...d, workouts: [] as WorkoutRow[] }));
    days[0].workouts = [workout(days[0].day, 7, 0)];
    days[days.length - 1].workouts = [workout(days[days.length - 1].day, 7, 0)];
    const result = activityWeekLoad(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weeks.length).toBeGreaterThanOrEqual(17);
    const row = result.rows[0];
    expect(row.cells[0]).toBeCloseTo(10, 6);
    expect(row.cells[row.cells.length - 1]).toBeCloseTo(10, 6);
    // Everything in between is a week with no session, not a week worth zero.
    expect(row.cells.slice(1, -1).every((c) => c === null)).toBe(true);
  });

  it('accumulates strain within a week and counts the sessions', () => {
    const days = demo(60).map((d) => ({ ...d, workouts: [] as WorkoutRow[] }));
    // Three sessions inside one calendar week.
    days[7].workouts = [workout(days[7].day, 7, 0, { strain: 5 })];
    days[8].workouts = [
      workout(days[8].day, 7, 0, { strain: 6 }),
      workout(days[8].day, 18, 0, { strain: 4 }),
    ];
    const result = activityWeekLoad(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.rows.find((r) => r.activity === 'Running')!;
    const filled = row.cells.findIndex((c) => c != null);
    expect(row.cells[filled]).toBeCloseTo(15, 6);
    expect(row.sessions[filled]).toBe(3);
    expect(row.total).toBeCloseTo(15, 6);
  });

  it('starts every week on a Monday', () => {
    const result = activityWeekLoad(demo(200));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const week of result.weeks) {
      const [y, mo, d] = week.split('-').map(Number);
      expect(new Date(y, mo - 1, d).getDay()).toBe(1);
    }
  });

  it('orders rows by total strain and reports what did not fit', () => {
    const days = demo(200).map((d) => ({ ...d, workouts: [] as WorkoutRow[] }));
    days.forEach((day, i) => {
      day.workouts = [
        workout(day.day, 7, 0, { activity: `Sport ${i % 15}`, strain: 15 - (i % 15) }),
      ];
    });
    const result = activityWeekLoad(days, { maxRows: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(5);
    const totals = result.rows.map((r) => r.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(result.hidden.activities).toBe(10);
    expect(result.hidden.strain).toBeGreaterThan(0);
  });

  it('reports the largest cell, which is what the colour scale runs to', () => {
    const result = activityWeekLoad(demo(420));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const largest = Math.max(...result.rows.flatMap((row) => row.cells.map((c) => c ?? 0)));
    expect(result.max).toBeCloseTo(largest, 6);
  });

  it('keeps every row the same width as the week axis', () => {
    const result = activityWeekLoad(demo(300));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const row of result.rows) {
      expect(row.cells).toHaveLength(result.weeks.length);
      expect(row.sessions).toHaveLength(result.weeks.length);
    }
  });
});
