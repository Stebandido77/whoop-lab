import { dayKey } from './format';
import type { WhoopExport, WorkoutRow } from './whoop/types';

const QUESTIONS = [
  'Have any alcoholic drinks?',
  'Consume caffeine?',
  'View a screen in bed?',
  'Have a late meal?',
  'Spend time stretching?',
  'Read (non-work related)?',
  'Feel sick or ill?',
  'Share a bed?',
  'Have any exposure to sunlight?',
  'Take magnesium?',
];

/** Deterministic PRNG so the demo looks the same for everyone in screenshots. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthetic but structurally honest data: alcohol suppresses HRV and lifts RHR,
 * yesterday's strain costs today's recovery, and sleep debt accumulates. The
 * point is that the panels show real relationships before you load your export.
 */
export function generateDemoExport(days = 420): WhoopExport {
  const rand = mulberry32(20260906);
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const data: WhoopExport = { cycles: [], sleeps: [], workouts: [], journal: [] };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let debt = 60;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    const weekday = date.getDay();
    const weekend = weekday === 0 || weekday === 6;
    const season = (days - i) / days;

    const alcohol = (weekend && rand() < 0.42) || rand() < 0.07;
    const sick = rand() < 0.02;
    const lateMeal = rand() < 0.25 + (weekend ? 0.2 : 0);
    const stretch = rand() < 0.35;
    const magnesium = rand() < 0.4;

    const bedHour = 22.9 + (weekend ? 1.1 : 0) + (alcohol ? 0.7 : 0) + gauss() * 0.55;
    const hours = Math.max(
      4.2,
      Math.min(
        9.6,
        7.35 - (alcohol ? 0.75 : 0) - (lateMeal ? 0.25 : 0) + (weekend ? 0.45 : 0) + gauss() * 0.62,
      ),
    );

    const asleep = hours * 60;
    const inBed = asleep * (1.07 + Math.abs(gauss()) * 0.03);
    const rem = asleep * Math.max(0.09, 0.215 - (alcohol ? 0.045 : 0) + gauss() * 0.022);
    const deep =
      asleep *
      Math.max(0.07, 0.185 - (alcohol ? 0.03 : 0) + (stretch ? 0.01 : 0) + gauss() * 0.024);
    const awake = inBed - asleep;
    const light = asleep - rem - deep;

    const need = 470 + Math.min(90, debt * 0.3);
    const performance = Math.min(112, (100 * asleep) / need);
    debt = Math.max(0, Math.min(560, debt * 0.72 + (need - asleep) * 0.5));

    const workouts: WorkoutRow[] = [];
    const addWorkout = (activity: string, duration: number, strain: number, avgHr: number) => {
      const start = new Date(date);
      start.setHours(6 + Math.floor(rand() * 13), Math.floor(rand() * 60));
      const zones: number[] = [0, 0, 0, 0, 0];
      let left = 100;
      for (let z = 4; z >= 0; z--) {
        const share =
          z === 0
            ? left
            : Math.min(left, Math.max(0, (z === 2 || z === 3 ? 28 : 12) + gauss() * 8));
        zones[z] = share;
        left -= share;
      }
      workouts.push({
        day: key,
        start,
        end: new Date(start.getTime() + duration * 60_000),
        duration,
        activity,
        strain,
        calories: Math.round(duration * avgHr * 0.11),
        maxHr: Math.round(avgHr + 18 + rand() * 10),
        avgHr: Math.round(avgHr),
        zones,
        distance: null,
        altitudeGain: null,
      });
    };
    if ((weekday === 2 || weekday === 4 || weekday === 6) && rand() < 0.8)
      addWorkout('Tennis', 75 + Math.round(rand() * 40), 10.5 + gauss() * 1.6, 142);
    if ((weekday === 1 || weekday === 3 || weekday === 5) && rand() < 0.72)
      addWorkout('Weightlifting', 55 + Math.round(rand() * 25), 7.8 + gauss() * 1.3, 121);
    if (rand() < 0.22)
      addWorkout('Running', 35 + Math.round(rand() * 30), 9.4 + gauss() * 1.5, 155);

    const strain = Math.max(
      3.5,
      Math.min(
        20.5,
        6.2 + workouts.reduce((s, w) => s + (w.strain ?? 0) * 0.72, 0) * 0.75 + gauss() * 1.1,
      ),
    );

    const prevStrain = data.cycles.at(-1)?.strain ?? 8;
    const hrv = Math.max(
      28,
      79 +
        6 * Math.sin(season * Math.PI * 1.4) -
        (alcohol ? 6.2 : 0) -
        (sick ? 10 : 0) +
        (hours - 7.3) * 2.2 -
        (prevStrain - 9) * 0.85 +
        gauss() * 5.2,
    );
    const rhr =
      51 +
      (alcohol ? 2.4 : 0) +
      (sick ? 4 : 0) -
      (hours - 7.3) * 0.7 +
      (prevStrain - 9) * 0.3 +
      gauss() * 1.6;
    const recovery = Math.max(
      3,
      Math.min(
        99,
        64 +
          (hrv - 79) * 0.85 -
          (rhr - 51) * 1.4 +
          (hours - 7.3) * 3.2 +
          (performance - 95) * 0.1 -
          (alcohol ? 3 : 0) -
          (sick ? 9 : 0) +
          (magnesium ? 1.2 : 0) +
          gauss() * 7.5,
      ),
    );

    const onset = new Date(date);
    onset.setDate(onset.getDate() - 1);
    onset.setHours(Math.floor(bedHour), Math.round((bedHour % 1) * 60));
    const wake = new Date(onset.getTime() + inBed * 60_000);

    data.cycles.push({
      day: key,
      start: onset,
      end: new Date(date.getTime() + 86_400_000),
      recovery: Math.round(recovery),
      rhr: Math.round(rhr),
      hrv: Math.round(hrv),
      skinTemp: 33.4 + gauss() * 0.35,
      spo2: 95.6 + gauss() * 0.7,
      strain,
      calories: Math.round(2100 + strain * 95 + gauss() * 160),
      maxHr: Math.round(150 + rand() * 30),
      avgHr: Math.round(72 + strain * 1.3),
      sleepOnset: onset,
      wakeOnset: wake,
      sleepPerformance: performance,
      respiratoryRate: 14.6 + (alcohol ? 0.7 : 0) + gauss() * 0.5,
      asleep,
      inBed,
      light,
      deep,
      rem,
      awake,
      sleepNeed: need,
      sleepDebt: debt,
      sleepEfficiency: (100 * asleep) / inBed,
      sleepConsistency: Math.max(35, Math.min(98, 82 - Math.abs(bedHour - 23) * 11 + gauss() * 7)),
    });
    data.workouts.push(...workouts);

    const answers: Record<string, boolean> = {
      'Have any alcoholic drinks?': alcohol,
      'Consume caffeine?': rand() < 0.8,
      'View a screen in bed?': rand() < 0.5,
      'Have a late meal?': lateMeal,
      'Spend time stretching?': stretch,
      'Read (non-work related)?': rand() < 0.3,
      'Feel sick or ill?': sick,
      'Share a bed?': rand() < 0.6,
      'Have any exposure to sunlight?': rand() < 0.55,
      'Take magnesium?': magnesium,
    };
    for (const q of QUESTIONS)
      data.journal.push({ day: key, question: q, yes: answers[q], notes: '' });
  }

  return data;
}
