import { HBarChart, TimeSeriesChart } from '@/charts';
import { Legend, Panel } from '@/components';
import { bpm, f0, f1, f2, ms, pct, signed, WEEKDAYS } from '@/lib/format';
import { column, computeDrivers, weekdayDeviation } from '@/lib/metrics';
import { mean } from '@/lib/stats';
import type { DayRecord } from '@/lib/whoop/types';

export function RecoveryView({ days }: { days: DayRecord[] }) {
  const drivers = computeDrivers(days);
  const weekdays = weekdayDeviation(days);
  const base = mean(column(days, 'recovery'));

  return (
    <div className="grid">
      <Panel
        span={12}
        title="HRV contra tu propia línea base"
        subtitle="La línea gruesa es la media móvil de 28 días. Lo que importa no es el número, sino la distancia a tu base."
      >
        <TimeSeriesChart
          data={days}
          height={230}
          formatY={ms}
          series={[
            {
              key: 'hrv',
              type: 'area',
              label: 'HRV',
              color: '--hrv',
              width: 1.3,
              opacity: 0.55,
              format: ms,
            },
            { key: 'hrv28', type: 'line', label: 'Base 28d', color: '--ink', width: 2, format: ms },
          ]}
        />
        <Legend
          items={[
            { color: '--hrv', label: 'HRV diaria' },
            { color: '--ink', label: 'Línea base 28 días' },
          ]}
        />
      </Panel>

      <Panel
        span={6}
        title="Desviación de la base (z-score)"
        subtitle="Por debajo de −1 son días en los que tu sistema nervioso pide calma."
      >
        <TimeSeriesChart
          data={days}
          height={200}
          formatY={f1}
          guides={[{ value: 0 }, { value: -1, color: '--lo' }, { value: 1, color: '--hi' }]}
          series={[
            {
              key: 'hrvZ',
              type: 'bar',
              label: 'z HRV',
              color: '--mid',
              colorFor: (v) => (v < -1 ? '--lo' : v > 1 ? '--hi' : '--mid'),
              format: f2,
            },
          ]}
        />
      </Panel>

      <Panel
        span={6}
        title="Pulso en reposo"
        subtitle="Subidas sostenidas suelen adelantarse a enfermedad, alcohol o carga acumulada."
      >
        <TimeSeriesChart
          data={days}
          height={200}
          formatY={bpm}
          series={[
            {
              key: 'rhr',
              type: 'dots',
              label: 'RHR',
              color: '--lo',
              radius: 2.2,
              opacity: 0.55,
              format: bpm,
            },
            { key: 'rhr7', type: 'line', label: 'Media 7d', color: '--lo', width: 2, format: bpm },
            {
              key: 'rhr28',
              type: 'line',
              label: 'Base 28d',
              color: '--muted',
              width: 1.4,
              dash: '4 3',
              format: bpm,
            },
          ]}
        />
      </Panel>

      <Panel
        span={6}
        title="Qué mueve tu recuperación"
        subtitle="Correlación de Pearson con el score de recuperación. Correlación no es causalidad, pero ordena las hipótesis."
      >
        <HBarChart
          diverging
          format={f2}
          rows={drivers.map((d) => ({
            label: d.label,
            value: d.r!,
            color: d.r! > 0 ? '--hi' : '--lo',
            note: `n=${d.n}`,
          }))}
        />
      </Panel>

      <Panel
        span={6}
        title="Recuperación por día de la semana"
        subtitle={`Diferencia frente a tu media del rango (${pct(base)}). Aquí es donde se ven los viernes.`}
      >
        <HBarChart
          diverging
          format={(v) => signed(v, f1, ' pp')}
          rows={weekdays.map((w) => ({
            label: WEEKDAYS[w.weekday],
            value: w.deviation,
            color: w.deviation > 0 ? '--hi' : '--lo',
            note: `(${f0(w.mean)}%)`,
          }))}
        />
      </Panel>
    </div>
  );
}
