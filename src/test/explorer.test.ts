import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MIN_N,
  DEFAULT_SPECIFICATION,
  describeSpecification,
  isRunnable,
  normalizeSpecification,
  OBSERVATIONS_PER_PARAMETER,
  parsePreset,
  runSpecification,
  specificationKey,
  type FamilyTest,
  type Specification,
} from '@/lib/explorer';
import { laggedColumn } from '@/lib/fields';
import { buildDayRecords } from '@/lib/whoop/model';
import { generateDemoExport } from '@/lib/demo';
import type { DayRecord } from '@/lib/whoop/types';
import { gaussian } from './random';

const demo = (days = 420): DayRecord[] => buildDayRecords(generateDemoExport(days));

const spec = (over: Partial<Specification> = {}): Specification => ({
  ...DEFAULT_SPECIFICATION,
  ...over,
});

describe('laggedColumn', () => {
  it('shifts by whole days, including across days with no reading', () => {
    const days = demo(60);
    const same = laggedColumn(days, 'strain', 0);
    const back = laggedColumn(days, 'strain', 2);
    expect(back[0]).toBeNull();
    expect(back[1]).toBeNull();
    expect(back[10]).toBe(same[8]);
  });

  it('puts bedtime in hours so the coefficient reads per hour', () => {
    const days = demo(60);
    const raw = days.find((d) => d.bedtime != null)!;
    const index = days.indexOf(raw);
    expect(laggedColumn(days, 'bedtime', 0)[index]).toBeCloseTo(raw.bedtime! / 60, 10);
  });
});

describe('normalizeSpecification', () => {
  it('refuses the dependent at lag zero, which would be y on y', () => {
    const out = normalizeSpecification(
      spec({ dependent: 'recovery', regressors: [{ field: 'recovery', lag: 0 }] }),
    );
    expect(out.regressors).toHaveLength(0);
    expect(isRunnable(spec({ regressors: [{ field: 'recovery', lag: 0 }] }))).toBe(false);
  });

  it('keeps the dependent at a positive lag, which is a real autoregressive term', () => {
    const out = normalizeSpecification(
      spec({ dependent: 'recovery', regressors: [{ field: 'recovery', lag: 1 }] }),
    );
    expect(out.regressors).toEqual([{ field: 'recovery', lag: 1 }]);
  });

  it('drops a term that repeats one already present, in either list', () => {
    const out = normalizeSpecification(
      spec({
        regressors: [
          { field: 'strain', lag: 1 },
          { field: 'strain', lag: 1 },
        ],
        controls: [{ field: 'strain', lag: 1 }],
      }),
    );
    expect(out.regressors).toHaveLength(1);
    expect(out.controls).toHaveLength(0);
  });

  it('drops a lag outside the allowed window', () => {
    const out = normalizeSpecification(
      spec({
        regressors: [
          { field: 'strain', lag: 99 },
          { field: 'hrv', lag: -1 },
          { field: 'rem', lag: 3 },
        ],
      }),
    );
    expect(out.regressors).toEqual([{ field: 'rem', lag: 3 }]);
  });
});

describe('specificationKey', () => {
  it('ignores the order terms were added in', () => {
    const a = spec({
      regressors: [
        { field: 'strain', lag: 1 },
        { field: 'hrv', lag: 0 },
      ],
    });
    const b = spec({
      regressors: [
        { field: 'hrv', lag: 0 },
        { field: 'strain', lag: 1 },
      ],
    });
    expect(specificationKey(a)).toBe(specificationKey(b));
  });

  it('separates a regressor from the same variable used as a control', () => {
    const asRegressor = spec({ regressors: [{ field: 'strain', lag: 1 }], controls: [] });
    const asControl = spec({
      regressors: [{ field: 'hrv', lag: 0 }],
      controls: [{ field: 'strain', lag: 1 }],
    });
    expect(specificationKey(asRegressor)).not.toBe(specificationKey(asControl));
  });

  it('separates specifications that differ only in fixed effects', () => {
    expect(specificationKey(spec({ monthFixedEffects: true }))).not.toBe(
      specificationKey(spec({ monthFixedEffects: false })),
    );
  });
});

describe('runSpecification', () => {
  it('recovers a coefficient that was put into the data by hand', () => {
    // Overwrite the demo's recovery with a known linear function of yesterday's
    // strain, so there is a right answer to hit.
    const days = demo(420).map((d) => ({ ...d }));
    const z = gaussian(99);
    for (let i = 1; i < days.length; i++) {
      const strain = days[i - 1].strain;
      days[i].recovery = strain == null ? null : 80 - 2 * strain + 3 * z();
    }
    const result = runSpecification(
      days,
      spec({
        dependent: 'recovery',
        regressors: [{ field: 'strain', lag: 1 }],
        controls: [],
        weekdayFixedEffects: false,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const term = result.terms.find((t) => t.field === 'strain')!;
    expect(term.coef).toBeCloseTo(-2, 1);
    expect(term.ciLow).toBeLessThan(-2);
    expect(term.ciHigh).toBeGreaterThan(-2);
  });

  it('always uses HAC, because every design here is a daily series', () => {
    const result = runSpecification(demo(420), DEFAULT_SPECIFICATION);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fit.vcovType).toBe('hac');
  });

  it('switches off when observations per parameter fall below the guard', () => {
    const days = demo(60);
    const result = runSpecification(
      days,
      spec({
        regressors: [
          { field: 'strain', lag: 1 },
          { field: 'hrv', lag: 1 },
          { field: 'rhr', lag: 1 },
        ],
        controls: [
          { field: 'sleepHours', lag: 0 },
          { field: 'sleepEfficiency', lag: 0 },
        ],
        weekdayFixedEffects: true,
        monthFixedEffects: true,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.minN).toBeGreaterThan(days.length);
      expect(result.missing).toBe(result.minN - result.n);
    }
  });

  it('sets the minimum from the parameters asked for, not the ones that survived', () => {
    const days = demo(420);
    const one = runSpecification(days, spec({ controls: [], weekdayFixedEffects: false }));
    const many = runSpecification(
      days,
      spec({
        controls: [
          { field: 'sleepHours', lag: 0 },
          { field: 'rem', lag: 0 },
          { field: 'deep', lag: 0 },
        ],
        weekdayFixedEffects: true,
      }),
    );
    expect(one.ok && many.ok).toBe(true);
    if (!one.ok || !many.ok) return;
    expect(many.minN).toBeGreaterThan(one.minN);
    expect(one.minN).toBe(Math.max(ABSOLUTE_MIN_N, OBSERVATIONS_PER_PARAMETER * 2));
  });

  it('reports a collinear term as dropped instead of as a zero', () => {
    const days = demo(420).map((d) => ({ ...d }));
    // Make one field an exact copy of another: QR has to drop one of the two.
    for (const day of days) day.spo2 = day.recovery;
    const result = runSpecification(
      days,
      spec({
        dependent: 'hrv',
        regressors: [
          { field: 'recovery', lag: 0 },
          { field: 'spo2', lag: 0 },
        ],
        controls: [],
        weekdayFixedEffects: false,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dropped).toHaveLength(1);
    expect(result.terms).toHaveLength(1);
  });

  it('marks controls as controls and leaves them out of the family', () => {
    const result = runSpecification(demo(420), DEFAULT_SPECIFICATION);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const controls = result.terms.filter((t) => t.role === 'control');
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) expect(c.q).toBeNull();
    expect(result.tests.every((t) => t.field !== 'sleepHours')).toBe(true);
  });

  it('counts fixed effects as parameters without listing them as findings', () => {
    const result = runSpecification(demo(420), spec({ weekdayFixedEffects: true }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fixedEffects).toBe(6);
    expect(result.terms).toHaveLength(2);
    expect(result.k).toBe(result.terms.length + result.fixedEffects + 1);
  });

  it('plots the first regressor over exactly the rows the fit used', () => {
    const result = runSpecification(demo(420), DEFAULT_SPECIFICATION);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scatter.points).toHaveLength(result.n);
    expect(result.scatter.term).toEqual({ field: 'strain', lag: 1 });
  });
});

describe('the accumulated family', () => {
  const days = demo(420);

  it('corrects over every regressor tested this session, not just this model', () => {
    const alone = runSpecification(days, DEFAULT_SPECIFICATION);
    const history: FamilyTest[] = Array.from({ length: 40 }, (_, i) => ({
      spec: `made-up-${i}`,
      field: 'hrv' as const,
      lag: 0,
      p: 0.5,
    }));
    const crowded = runSpecification(days, DEFAULT_SPECIFICATION, history);
    expect(alone.ok && crowded.ok).toBe(true);
    if (!alone.ok || !crowded.ok) return;
    const q = (r: typeof alone) => (r.ok ? r.terms.find((t) => t.role === 'regressor')!.q! : NaN);
    expect(q(crowded)).toBeGreaterThan(q(alone));
    expect(crowded.family.tests).toBe(41);
    expect(crowded.family.specifications).toBe(41);
  });

  it('does not grow when the same specification is run again', () => {
    const first = runSpecification(days, DEFAULT_SPECIFICATION);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = runSpecification(days, DEFAULT_SPECIFICATION, first.tests);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.family.specifications).toBe(1);
    expect(again.family.tests).toBe(first.family.tests);
  });

  it('grows by one specification when a different one is run', () => {
    const first = runSpecification(days, DEFAULT_SPECIFICATION);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = runSpecification(
      days,
      spec({ regressors: [{ field: 'sleepHours', lag: 0 }] }),
      first.tests,
    );
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.family.specifications).toBe(2);
  });
});

describe('presets', () => {
  it('round-trips a specification', () => {
    const saved = {
      id: 'a',
      name: 'Mine',
      savedAt: 12,
      spec: DEFAULT_SPECIFICATION,
    };
    expect(parsePreset(saved)?.spec).toEqual(normalizeSpecification(DEFAULT_SPECIFICATION));
  });

  it('rejects a preset naming a field the catalogue no longer has', () => {
    expect(
      parsePreset({
        id: 'a',
        name: 'Old',
        spec: { ...DEFAULT_SPECIFICATION, dependent: 'vo2max' },
      }),
    ).toBeNull();
  });

  it('drops a regressor that is no longer a field, and the preset with it if none remain', () => {
    expect(
      parsePreset({
        id: 'a',
        name: 'Old',
        spec: { ...DEFAULT_SPECIFICATION, regressors: [{ field: 'steps', lag: 1 }] },
      }),
    ).toBeNull();
  });

  it('refuses anything that is not a preset at all', () => {
    for (const value of [null, 3, 'x', {}, { id: 'a' }]) {
      expect(parsePreset(value)).toBeNull();
    }
  });
});

describe('describeSpecification', () => {
  it('reads like a formula', () => {
    expect(describeSpecification(DEFAULT_SPECIFICATION)).toBe(
      'recovery ~ strain−1 + sleepHours + dow',
    );
  });
});
