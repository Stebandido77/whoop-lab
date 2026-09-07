import { recoveryToken, ScatterChart, StackedBarChart, TimeSeriesChart } from '@/charts';
import { KpiCard, Legend, Panel } from '@/components';
import { clockTime, f0, f1, fmtDayLong, pct } from '@/lib/format';
import { column, periodValue } from '@/lib/metrics';
import { bedtimeVariability, byWeek } from '@/lib/whoop/model';
import type { DayRecord } from '@/lib/whoop/types';

const LAYERS = [
  { key: 'deep', label: 'Profundo', color: '--deep' },
  { key: 'rem', label: 'REM', color: '--rem' },
  { key: 'light', label: 'Ligero', color: '--light' },
  { key: 'awake', label: 'Despierto', color: '--wake' },
];

const WEEKLY_THRESHOLD = 120;

export function SleepView({ days, previous }: { days: DayRecord[]; previous: DayRecord[] }) {
  const weekly = days.length > WEEKLY_THRESHOLD;
  const stackData = weekly ? byWeek(days, ['deep', 'rem', 'light', 'awake']) : days;

  const sleep = periodValue(days, previous, 'sleepHours');
  const efficiency = periodValue(days, previous, 'sleepEfficiency');
  const consistency = periodValue(days, previous, 'sleepConsistency');
  const debt = periodValue(days, previous, 'sleepDebt');
  const bedSd = bedtimeVariability(days);

  return (
    <div className="grid">
      <Panel
        span={12}
        title="Arquitectura del sueño"
        subtitle={
          weekly
            ? 'Cada barra es una semana (promedio por noche), partida por fase. Baja el rango a 90 días para ver noche a noche.'
            : 'Cada barra es una noche, partida por fase.'
        }
      >
        <StackedBarChart data={stackData} layers={LAYERS} height={240} />
        <Legend items={LAYERS.map((l) => ({ color: l.color, label: l.label }))} />
      </Panel>

      <div className="grid span-12 kpi-row" style={{ gridColumn: 'span 12' }}>
        <KpiCard
          label="Sueño medio"
          value={f1(sleep.value)}
          unit="h"
          delta={sleep.delta}
          deltaUnit="h"
          trend={column(days, 'sleepHours')}
          trendColor="--sleep"
        />
        <KpiCard
          label="Eficiencia"
          value={f0(efficiency.value)}
          unit="%"
          delta={efficiency.delta}
          deltaUnit="pp"
          trend={column(days, 'sleepEfficiency')}
          trendColor="--hi"
        />
        <KpiCard
          label="Consistencia"
          value={f0(consistency.value)}
          unit="%"
          delta={consistency.delta}
          deltaUnit="pp"
          trend={column(days, 'sleepConsistency')}
          trendColor="--hrv"
        />
        <KpiCard
          label="Deuda media"
          value={f0(debt.value)}
          unit="min"
          delta={debt.delta}
          deltaUnit="min"
          direction={-1}
          trend={column(days, 'sleepDebt')}
          trendColor="--lo"
        />
      </div>

      <Panel
        span={7}
        title="Tu ventana de sueño"
        subtitle="Hora de acostarte y de levantarte, noche por noche. Mientras más planas las líneas, mejor tu consistencia."
      >
        <TimeSeriesChart
          data={days}
          height={230}
          formatY={clockTime}
          series={[
            {
              key: 'bedtime',
              type: 'line',
              label: 'Me acuesto',
              color: '--deep',
              width: 1.5,
              opacity: 0.85,
              format: clockTime,
            },
            {
              key: 'wakeTimeAdjusted',
              type: 'line',
              label: 'Me levanto',
              color: '--mid',
              width: 1.5,
              opacity: 0.85,
              format: clockTime,
            },
          ]}
        />
        <p className="subtitle" style={{ margin: '10px 0 0' }}>
          Desviación estándar de la hora de acostarte:{' '}
          <b>{bedSd == null ? '—' : `${f0(bedSd)} min`}</b>.
        </p>
      </Panel>

      <Panel
        span={5}
        title="Sueño y recuperación"
        subtitle="Horas dormidas frente al score de esa misma mañana."
      >
        <ScatterChart
          height={265}
          xLabel="Horas dormidas"
          yLabel="Recuperación"
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

      <Panel
        span={6}
        title="Rendimiento del sueño frente a lo que necesitabas"
        subtitle="Sleep performance = dormido / necesidad calculada por WHOOP."
      >
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
              label: 'Rendimiento',
              color: '--hi',
              colorFor: (v) => (v >= 90 ? '--hi' : v >= 70 ? '--mid' : '--lo'),
              format: pct,
            },
          ]}
        />
      </Panel>

      <Panel
        span={6}
        title="Composición: REM y profundo"
        subtitle="Porcentaje del tiempo dormido, suavizado a 7 días para que se vea la tendencia y no el ruido."
      >
        <TimeSeriesChart
          data={days}
          height={210}
          formatY={pct}
          series={[
            {
              key: 'remShare7',
              type: 'line',
              label: 'REM',
              color: '--rem',
              width: 2,
              format: (v) => `${f1(v)}%`,
            },
            {
              key: 'deepShare7',
              type: 'line',
              label: 'Profundo',
              color: '--hi',
              width: 2,
              format: (v) => `${f1(v)}%`,
            },
            {
              key: 'remShare',
              type: 'dots',
              label: 'REM diario',
              color: '--rem',
              radius: 1.6,
              opacity: 0.28,
              format: (v) => `${f1(v)}%`,
            },
            {
              key: 'deepShare',
              type: 'dots',
              label: 'Profundo diario',
              color: '--hi',
              radius: 1.6,
              opacity: 0.28,
              format: (v) => `${f1(v)}%`,
            },
          ]}
        />
        <Legend
          items={[
            { color: '--rem', label: 'REM' },
            { color: '--hi', label: 'Profundo' },
          ]}
        />
      </Panel>
    </div>
  );
}
