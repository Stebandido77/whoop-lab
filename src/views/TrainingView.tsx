import { HBarChart, TimeSeriesChart } from '@/charts';
import { Panel } from '@/components';
import { f0, f1, f2, hoursMinutes } from '@/lib/format';
import { summarizeActivities, zoneMinutes } from '@/lib/metrics';
import { byWeek } from '@/lib/whoop/model';
import type { DayRecord } from '@/lib/whoop/types';

const ZONE_COLORS = ['--wake', '--light', '--rem', '--mid', '--lo'];

export function TrainingView({ days }: { days: DayRecord[] }) {
  const activities = summarizeActivities(days);
  const zones = zoneMinutes(days);
  const weeks = byWeek(days, ['workoutMinutes', 'workoutCount', 'strain']).map((w) => ({
    ...w,
    totalMinutes:
      (w.workoutMinutes as number | null) != null ? (w.workoutMinutes as number) * w.count : null,
  }));

  return (
    <div className="grid">
      <Panel
        span={12}
        title="Carga aguda contra carga crónica"
        subtitle="Media de strain a 7 días sobre la de 28 días. Por encima de 1,3 la carga sube más rápido de lo que la aguantas."
      >
        <TimeSeriesChart
          data={days}
          height={210}
          formatY={f2}
          guides={[
            { value: 1.3, color: '--lo' },
            { value: 0.8, color: '--mid' },
          ]}
          series={[
            { key: 'acwr', type: 'line', label: 'ACWR', color: '--strain', width: 2, format: f2 },
          ]}
        />
      </Panel>

      <Panel span={7} title="Strain diario y su media móvil">
        <TimeSeriesChart
          data={days}
          height={210}
          formatY={f1}
          series={[
            {
              key: 'strain',
              type: 'bar',
              label: 'Strain',
              color: '--strain',
              opacity: 0.55,
              format: f1,
            },
            {
              key: 'strain7',
              type: 'line',
              label: 'Media 7d',
              color: '--ink',
              width: 1.9,
              format: f2,
            },
          ]}
        />
      </Panel>

      <Panel span={5} title="Actividades del rango">
        {activities.length === 0 ? (
          <p className="empty">No hay actividades en este rango.</p>
        ) : (
          <div className="table-box">
            <table>
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th className="num">Sesiones</th>
                  <th className="num">Tiempo</th>
                  <th className="num">Strain medio</th>
                  <th className="num">FC media</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.activity}>
                    <td>{a.activity}</td>
                    <td className="num">{a.sessions}</td>
                    <td className="num">{hoursMinutes(a.minutes)}</td>
                    <td className="num">{f1(a.meanStrain)}</td>
                    <td className="num">{f0(a.meanHr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        span={6}
        title="Reparto por zona de frecuencia cardiaca"
        subtitle="Minutos totales del rango en cada zona."
      >
        <HBarChart
          format={hoursMinutes}
          rows={zones.map((minutes, i) => ({
            label: `Zona ${i + 1}`,
            value: minutes,
            color: ZONE_COLORS[i],
          }))}
        />
      </Panel>

      <Panel
        span={6}
        title="Volumen semanal"
        subtitle="Minutos de actividad acumulados por semana."
      >
        <TimeSeriesChart
          data={weeks}
          height={210}
          formatY={(v) => `${f0((v ?? 0) / 60)}h`}
          series={[
            {
              key: 'totalMinutes',
              type: 'bar',
              label: 'Minutos',
              color: '--strain',
              format: hoursMinutes,
            },
          ]}
        />
      </Panel>
    </div>
  );
}
