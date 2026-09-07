import { CalendarHeatmap, recoveryToken, ScatterChart, TimeSeriesChart } from '@/charts';
import { KpiCard, Legend, Panel } from '@/components';
import { f0, f1, f2, fmtDayLong, hoursMinutes, pct, WEEKDAYS } from '@/lib/format';
import { column, periodValue } from '@/lib/metrics';
import { mean, pearson, sd } from '@/lib/stats';
import type { DayRecord } from '@/lib/whoop/types';

export function OverviewView({ days, previous }: { days: DayRecord[]; previous: DayRecord[] }) {
  const latest = [...days].reverse().find((d) => d.recovery != null) ?? days[days.length - 1];
  const recovery = periodValue(days, previous, 'recovery');
  const hrv = periodValue(days, previous, 'hrv');
  const rhr = periodValue(days, previous, 'rhr');
  const sleep = periodValue(days, previous, 'sleepHours');
  const strainVsNext = pearson(column(days, 'strain'), column(days, 'recoveryNext'));

  return (
    <div className="grid">
      <Panel span={12}>
        <div className="hero">
          <div className="rail">
            <div>
              <span className="label" style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                Última recuperación · {fmtDayLong(latest.day)}
              </span>
              <div className="big" style={{ color: `var(${recoveryToken(latest.recovery)})` }}>
                {latest.recovery == null ? '—' : f0(latest.recovery)}
                <em>%</em>
              </div>
            </div>
            <div>
              <div className="row">
                <span>HRV</span>
                <span>{f0(latest.hrv)} ms</span>
              </div>
              <div className="row">
                <span>Pulso en reposo</span>
                <span>{f0(latest.rhr)} bpm</span>
              </div>
              <div className="row">
                <span>Sueño</span>
                <span>{hoursMinutes(latest.asleep)}</span>
              </div>
              <div className="row">
                <span>Strain</span>
                <span>{f1(latest.strain)}</span>
              </div>
            </div>
          </div>
          <div>
            <h3>Recuperación diaria y su media móvil de 7 días</h3>
            <p className="subtitle">
              Las barras son el score del día; la línea es la tendencia que la app no te muestra.
            </p>
            <TimeSeriesChart
              data={days}
              height={206}
              yMin={0}
              yMax={100}
              formatY={pct}
              guides={[
                { value: 34, color: '--lo' },
                { value: 67, color: '--hi' },
              ]}
              series={[
                {
                  key: 'recovery',
                  type: 'bar',
                  label: 'Recuperación',
                  color: '--hi',
                  colorFor: (v) => recoveryToken(v),
                  format: pct,
                },
                {
                  key: 'recovery7',
                  type: 'line',
                  label: 'Media 7d',
                  color: '--ink',
                  width: 1.8,
                  format: pct,
                },
              ]}
            />
          </div>
        </div>
      </Panel>

      <div className="grid span-12 kpi-row" style={{ gridColumn: 'span 12' }}>
        <KpiCard
          label="Recuperación media"
          value={f0(recovery.value)}
          unit="%"
          delta={recovery.delta}
          deltaUnit="pp"
          trend={column(days, 'recovery7')}
          trendColor="--hi"
        />
        <KpiCard
          label="HRV media"
          value={f0(hrv.value)}
          unit="ms"
          delta={hrv.delta}
          deltaUnit="ms"
          trend={column(days, 'hrv7')}
          trendColor="--hrv"
        />
        <KpiCard
          label="Pulso en reposo"
          value={f0(rhr.value)}
          unit="bpm"
          delta={rhr.delta}
          deltaUnit="bpm"
          direction={-1}
          trend={column(days, 'rhr7')}
          trendColor="--lo"
        />
        <KpiCard
          label="Sueño por noche"
          value={f1(sleep.value)}
          unit="h"
          delta={sleep.delta}
          deltaUnit="h"
          trend={column(days, 'sleepHours')}
          trendColor="--sleep"
        />
      </div>

      <Panel
        span={12}
        title="Calendario de recuperación"
        subtitle="Cada celda es un día. Sirve para ver rachas y estacionalidad, no picos aislados."
      >
        <CalendarHeatmap
          data={days}
          metric="recovery"
          label="Recuperación"
          colorFor={recoveryToken}
          format={pct}
        />
        <Legend
          items={[
            { color: '--lo', label: '< 34%' },
            { color: '--mid', label: '34–66%' },
            { color: '--hi', label: '≥ 67%' },
            { color: '--grid', label: 'sin dato' },
          ]}
        />
      </Panel>

      <Panel
        span={7}
        title="¿Cuánto te cuesta el strain al día siguiente?"
        subtitle="Cada punto es un día: strain acumulado frente a la recuperación de la mañana siguiente."
      >
        <ScatterChart
          height={270}
          xLabel="Strain del día"
          yLabel="Recuperación al día siguiente"
          formatY={pct}
          guideY={67}
          points={days
            .filter((d) => d.strain != null && d.recoveryNext != null)
            .map((d) => ({
              x: d.strain!,
              y: d.recoveryNext!,
              color: recoveryToken(d.recoveryNext),
              label: fmtDayLong(d.day),
            }))}
        />
        <p className="subtitle" style={{ margin: '10px 0 0' }}>
          Correlación r = <b>{f2(strainVsNext.r)}</b> sobre {strainVsNext.n} días.
        </p>
      </Panel>

      <Highlights days={days} />
    </div>
  );
}

function Highlights({ days }: { days: DayRecord[] }) {
  const withRecovery = days.filter((d) => d.recovery != null);
  const rows: [string, string][] = [];

  if (withRecovery.length > 6) {
    const best = withRecovery.reduce((a, b) => (b.recovery! > a.recovery! ? b : a));
    const worst = withRecovery.reduce((a, b) => (b.recovery! < a.recovery! ? b : a));
    rows.push([
      'Mejor y peor día',
      `${pct(best.recovery)} el ${fmtDayLong(best.day)} · ${pct(worst.recovery)} el ${fmtDayLong(worst.day)}`,
    ]);
    const green = withRecovery.filter((d) => d.recovery! >= 67).length;
    const red = withRecovery.filter((d) => d.recovery! < 34).length;
    rows.push([
      'Reparto de días',
      `${f0((100 * green) / withRecovery.length)}% en verde, ${f0((100 * red) / withRecovery.length)}% en rojo`,
    ]);
  }

  const perWeekday = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => ({ i, value: mean(days.filter((d) => d.weekday === i).map((d) => d.recovery)) }))
    .filter((x): x is { i: number; value: number } => x.value != null);
  if (perWeekday.length === 7) {
    const best = perWeekday.reduce((a, b) => (b.value > a.value ? b : a));
    const worst = perWeekday.reduce((a, b) => (b.value < a.value ? b : a));
    rows.push([
      'Día fuerte / día flojo',
      `${WEEKDAYS[best.i]} ${pct(best.value)} frente a ${WEEKDAYS[worst.i]} ${pct(worst.value)}`,
    ]);
  }

  const sleepVsRecovery = pearson(column(days, 'sleepHours'), column(days, 'recovery'));
  if (sleepVsRecovery.r != null) {
    const slope =
      (sleepVsRecovery.r * (sd(column(days, 'recovery')) ?? 0)) /
      (sd(column(days, 'sleepHours')) || 1);
    rows.push([
      'Sueño y recuperación',
      `r = ${f2(sleepVsRecovery.r)} (${sleepVsRecovery.n} días). Una hora más se asocia a ${f1(slope)} pp.`,
    ]);
  }

  const consistency = mean(column(days, 'sleepConsistency'));
  if (consistency != null)
    rows.push(['Consistencia de horarios', `${f0(consistency)}% en promedio`]);

  const debt = mean(column(days, 'sleepDebt'));
  if (debt != null) rows.push(['Deuda de sueño media', hoursMinutes(debt)]);

  const acwr = [...days].reverse().find((d) => d.acwr != null)?.acwr;
  if (acwr != null) {
    const verdict =
      acwr > 1.35
        ? 'estás subiendo carga rápido'
        : acwr < 0.8
          ? 'vienes descargando'
          : 'en rango estable';
    rows.push(['Carga aguda / crónica', `${f2(acwr)} — ${verdict}`]);
  }

  return (
    <Panel
      span={5}
      title="Lo que salta a la vista"
      subtitle="Cálculos sobre el rango seleccionado."
    >
      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={{ color: 'var(--muted)', width: '42%' }}>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
