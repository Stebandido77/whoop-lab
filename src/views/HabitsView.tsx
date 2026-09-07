import { useState } from 'react';
import { HBarChart } from '@/charts';
import { Panel, Segmented } from '@/components';
import { f1, pct, signed } from '@/lib/format';
import { habitEffects } from '@/lib/metrics';
import type { DayRecord } from '@/lib/whoop/types';

type Alignment = 'recovery' | 'recoveryNext';

const ALIGNMENTS = [
  { value: 'recovery' as Alignment, label: 'Recuperación del mismo día' },
  { value: 'recoveryNext' as Alignment, label: 'Recuperación del día siguiente' },
];

export function HabitsView({ days, questions }: { days: DayRecord[]; questions: string[] }) {
  const [alignment, setAlignment] = useState<Alignment>('recovery');
  const effects = habitEffects(days, questions, alignment);

  if (!questions.length) {
    return (
      <p className="callout">
        No cargaste <code>journal_entries.csv</code>. Esa es la tabla que convierte el tablero en
        algo que WHOOP no te da: el efecto de cada hábito sobre tu recuperación.
      </p>
    );
  }

  return (
    <div className="grid">
      <Panel
        span={12}
        title="Efecto de cada hábito sobre la recuperación"
        subtitle="Diferencia en puntos porcentuales entre los días que respondiste sí y los que respondiste no. Se exigen al menos 8 observaciones por grupo. WHOOP no documenta a qué noche asigna cada respuesta: compara los dos botones con lo que muestra la app y quédate con el que cuadre."
      >
        <div style={{ marginBottom: 10 }}>
          <Segmented
            options={ALIGNMENTS}
            value={alignment}
            onChange={setAlignment}
            ariaLabel="Alineación temporal"
          />
        </div>
        <HBarChart
          diverging
          format={(v) => signed(v, f1, ' pp')}
          emptyMessage="Aún no hay preguntas con suficientes respuestas en ambos grupos dentro de este rango. Prueba con “Todo”."
          rows={effects.slice(0, 14).map((e) => ({
            label: e.shortLabel,
            value: e.delta,
            color: e.delta > 0 ? '--hi' : '--lo',
          }))}
        />
      </Panel>

      {effects.length > 0 && (
        <Panel
          span={12}
          title="Detalle"
          subtitle="|t| por encima de 2 sugiere que la diferencia no es solo ruido. Sigue siendo observacional: tú decides qué es causa y qué es consecuencia."
        >
          <div className="table-box scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Pregunta</th>
                  <th className="num">Sí</th>
                  <th className="num">No</th>
                  <th className="num">Δ pp</th>
                  <th className="num">|t|</th>
                  <th className="num">n sí / n no</th>
                </tr>
              </thead>
              <tbody>
                {effects.map((e) => (
                  <tr key={e.question}>
                    <td>{e.question}</td>
                    <td className="num">{pct(e.meanYes)}</td>
                    <td className="num">{pct(e.meanNo)}</td>
                    <td className="num" style={{ color: e.delta > 0 ? 'var(--hi)' : 'var(--lo)' }}>
                      {signed(e.delta)}
                    </td>
                    <td className="num">{e.t == null ? '—' : f1(Math.abs(e.t))}</td>
                    <td className="num">
                      {e.nYes} / {e.nNo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
