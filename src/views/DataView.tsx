import { useState } from 'react';
import { Panel } from '@/components';
import { f0, f1 } from '@/lib/format';
import type { DayRecord } from '@/lib/whoop/types';

interface ColumnSpec {
  key: keyof DayRecord;
  label: string;
  format: (v: number) => string;
}

const COLUMNS: ColumnSpec[] = [
  { key: 'recovery', label: 'Recup %', format: f0 },
  { key: 'hrv', label: 'HRV', format: f0 },
  { key: 'rhr', label: 'RHR', format: f0 },
  { key: 'strain', label: 'Strain', format: f1 },
  { key: 'calories', label: 'Calorías', format: f0 },
  { key: 'sleepHours', label: 'Sueño h', format: f1 },
  { key: 'sleepEfficiency', label: 'Efic %', format: f0 },
  { key: 'deep', label: 'Profundo', format: f0 },
  { key: 'rem', label: 'REM', format: f0 },
  { key: 'light', label: 'Ligero', format: f0 },
  { key: 'awake', label: 'Despierto', format: f0 },
  { key: 'sleepDebt', label: 'Deuda', format: f0 },
  { key: 'sleepConsistency', label: 'Consist %', format: f0 },
  { key: 'respiratoryRate', label: 'Resp', format: f1 },
  { key: 'workoutCount', label: 'Actividades', format: f0 },
  { key: 'workoutMinutes', label: 'Min activ.', format: f0 },
];

export function DataView({ days }: { days: DayRecord[] }) {
  const [copied, setCopied] = useState(false);

  const toTsv = () =>
    [
      ['Fecha', ...COLUMNS.map((c) => c.label)].join('\t'),
      ...days.map((d) =>
        [d.day, ...COLUMNS.map((c) => (d[c.key] == null ? '' : String(d[c.key])))].join('\t'),
      ),
    ].join('\n');

  async function copy() {
    const tsv = toTsv();
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      const area = document.createElement('textarea');
      area.value = tsv;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid">
      <Panel
        span={12}
        title="Tabla diaria consolidada"
        subtitle="Los cuatro CSV unidos por día. Cópiala y pégala en Excel, Stata o R."
      >
        <div className="controls" style={{ marginBottom: 10 }}>
          <button type="button" onClick={() => void copy()}>
            Copiar como TSV
          </button>
          {copied && <span className="pill">Listo</span>}
        </div>
        <div className="table-box scroll-x">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                {COLUMNS.map((c) => (
                  <th key={String(c.key)} className="num">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  {COLUMNS.map((c) => {
                    const value = d[c.key] as number | null;
                    return (
                      <td key={String(c.key)} className="num">
                        {value == null ? '' : c.format(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
