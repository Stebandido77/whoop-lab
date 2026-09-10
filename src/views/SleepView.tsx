import { useMemo } from 'react';
import {
  BinScatterChart,
  recoveryToken,
  ScatterChart,
  StackedBarChart,
  TimeSeriesChart,
} from '@/charts';
import { KpiCard, Legend, NotEnough, Panel } from '@/components';
import { clockTime, f0, f1, fmtDayLong, pct } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import { column, doseResponse, periodValue } from '@/lib/metrics';
import { bedtimeVariability, byWeek } from '@/lib/whoop/model';
import type { DayRecord } from '@/lib/whoop/types';

const STAGES = [
  { key: 'deep', color: '--deep' },
  { key: 'rem', color: '--rem' },
  { key: 'light', color: '--light' },
  { key: 'awake', color: '--wake' },
] as const;

const WEEKLY_THRESHOLD = 120;

export function SleepView({ days, previous }: { days: DayRecord[]; previous: DayRecord[] }) {
  const m = useMessages();
  const weekly = days.length > WEEKLY_THRESHOLD;
  const stackData = weekly ? byWeek(days, ['deep', 'rem', 'light', 'awake']) : days;
  const layers = STAGES.map((s) => ({ ...s, label: m.sleep.stages[s.key] }));

  const sleep = periodValue(days, previous, 'sleepHours');
  const efficiency = periodValue(days, previous, 'sleepEfficiency');
  const consistency = periodValue(days, previous, 'sleepConsistency');
  const debt = periodValue(days, previous, 'sleepDebt');
  const bedSd = bedtimeVariability(days);
  const dose = useMemo(() => doseResponse(days, 'sleepHours', 'recovery'), [days]);

  return (
    <div className="grid">
      <Panel span={12} title={m.sleep.doseTitle} subtitle={m.sleep.doseSubtitle}>
        {dose.ok ? (
          <BinScatterChart
            points={dose.points}
            xLabel={m.sleep.doseX}
            yLabel={m.sleep.doseY}
            formatY={pct}
            formatX={f1}
            color="--sleep"
            height={300}
          />
        ) : (
          <NotEnough state={dose} what={m.sleep.doseWhat} />
        )}
      </Panel>
      <Panel
        span={12}
        title={m.sleep.architectureTitle}
        subtitle={weekly ? m.sleep.architectureWeekly : m.sleep.architectureDaily}
      >
        <StackedBarChart data={stackData} layers={layers} height={240} />
        <Legend items={layers.map((l) => ({ color: l.color, label: l.label }))} />
      </Panel>

      <div className="grid span-12 kpi-row" style={{ gridColumn: 'span 12' }}>
        <KpiCard
          label={m.sleep.kpiSleep}
          value={f1(sleep.value)}
          unit="h"
          delta={sleep.delta}
          deltaUnit="h"
          trend={column(days, 'sleepHours')}
          trendColor="--sleep"
        />
        <KpiCard
          label={m.sleep.kpiEfficiency}
          value={f0(efficiency.value)}
          unit="%"
          delta={efficiency.delta}
          deltaUnit="pp"
          trend={column(days, 'sleepEfficiency')}
          trendColor="--hi"
        />
        <KpiCard
          label={m.sleep.kpiConsistency}
          value={f0(consistency.value)}
          unit="%"
          delta={consistency.delta}
          deltaUnit="pp"
          trend={column(days, 'sleepConsistency')}
          trendColor="--hrv"
        />
        <KpiCard
          label={m.sleep.kpiDebt}
          value={f0(debt.value)}
          unit="min"
          delta={debt.delta}
          deltaUnit="min"
          direction={-1}
          trend={column(days, 'sleepDebt')}
          trendColor="--lo"
        />
      </div>

      <Panel span={7} title={m.sleep.windowTitle} subtitle={m.sleep.windowSubtitle}>
        <TimeSeriesChart
          data={days}
          height={230}
          formatY={clockTime}
          series={[
            {
              key: 'bedtime',
              type: 'line',
              label: m.sleep.bedtime,
              color: '--deep',
              width: 1.5,
              opacity: 0.85,
              format: clockTime,
            },
            {
              key: 'wakeTimeAdjusted',
              type: 'line',
              label: m.sleep.wakeTime,
              color: '--mid',
              width: 1.5,
              opacity: 0.85,
              format: clockTime,
            },
          ]}
        />
        <p className="subtitle" style={{ margin: '10px 0 0' }}>
          {m.sleep.bedtimeSd(bedSd == null ? '—' : `${f0(bedSd)} min`)}
        </p>
      </Panel>

      <Panel span={5} title={m.sleep.scatterTitle} subtitle={m.sleep.scatterSubtitle}>
        <ScatterChart
          height={265}
          xLabel={m.sleep.scatterX}
          yLabel={m.sleep.scatterY}
          formatY={pct}
          guideY={67}
          points={days
            .filter((d) => d.sleepHours != null && d.recovery != null)
            .map((d) => ({
              x: d.sleepHours!,
              y: d.recovery!,
              color: recoveryToken(d.recovery),
              label: fmtDayLong(d.day),
            }))}
        />
      </Panel>

      <Panel span={6} title={m.sleep.performanceTitle} subtitle={m.sleep.performanceSubtitle}>
        <TimeSeriesChart
          data={days}
          height={210}
          yMin={0}
          yMax={120}
          formatY={pct}
          guides={[{ value: 100, color: '--hi' }]}
          series={[
            {
              key: 'sleepPerformance',
              type: 'bar',
              label: m.sleep.performanceSeries,
              color: '--hi',
              colorFor: (v) => (v >= 90 ? '--hi' : v >= 70 ? '--mid' : '--lo'),
              format: pct,
            },
          ]}
        />
      </Panel>

      <Panel span={6} title={m.sleep.compositionTitle} subtitle={m.sleep.compositionSubtitle}>
        <TimeSeriesChart
          data={days}
          height={210}
          formatY={pct}
          series={[
            {
              key: 'remShare7',
              type: 'line',
              label: m.sleep.stages.rem,
              color: '--rem',
              width: 2,
              format: (v) => `${f1(v)}%`,
            },
            {
              key: 'deepShare7',
              type: 'line',
              label: m.sleep.stages.deep,
              color: '--hi',
              width: 2,
              format: (v) => `${f1(v)}%`,
            },
            {
              key: 'remShare',
              type: 'dots',
              label: m.sleep.remDaily,
              color: '--rem',
              radius: 1.6,
              opacity: 0.28,
              format: (v) => `${f1(v)}%`,
            },
            {
              key: 'deepShare',
              type: 'dots',
              label: m.sleep.deepDaily,
              color: '--hi',
              radius: 1.6,
              opacity: 0.28,
              format: (v) => `${f1(v)}%`,
            },
          ]}
        />
        <Legend
          items={[
            { color: '--rem', label: m.sleep.stages.rem },
            { color: '--hi', label: m.sleep.stages.deep },
          ]}
        />
      </Panel>
    </div>
  );
}
