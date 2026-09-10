import { useState } from 'react';
import { Panel } from '@/components';
import { f0, f1 } from '@/lib/format';
import { useMessages, type Messages } from '@/lib/i18n';
import type { DayRecord } from '@/lib/whoop/types';

type ColumnKey = keyof Messages['data']['columns'];

interface ColumnSpec {
  key: ColumnKey & keyof DayRecord;
  format: (v: number) => string;
}

const COLUMNS: ColumnSpec[] = [
  { key: 'recovery', format: f0 },
  { key: 'hrv', format: f0 },
  { key: 'rhr', format: f0 },
  { key: 'strain', format: f1 },
  { key: 'calories', format: f0 },
  { key: 'sleepHours', format: f1 },
  { key: 'sleepEfficiency', format: f0 },
  { key: 'deep', format: f0 },
  { key: 'rem', format: f0 },
  { key: 'light', format: f0 },
  { key: 'awake', format: f0 },
  { key: 'sleepDebt', format: f0 },
  { key: 'sleepConsistency', format: f0 },
  { key: 'respiratoryRate', format: f1 },
  { key: 'workoutCount', format: f0 },
  { key: 'workoutMinutes', format: f0 },
];

export function DataView({ days }: { days: DayRecord[] }) {
  const m = useMessages();
  const [copied, setCopied] = useState(false);

  /**
   * Headers follow the interface language, values do not: these are raw numbers
   * on their way to a spreadsheet or to R, and a locale-formatted decimal comma
   * would arrive there as text.
   */
  const toTsv = () =>
    [
      [m.data.date, ...COLUMNS.map((c) => m.data.columns[c.key])].join('\t'),
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
      <Panel span={12} title={m.data.title} subtitle={m.data.subtitle}>
        <div className="controls" style={{ marginBottom: 10 }}>
          <button type="button" onClick={() => void copy()}>
            {m.data.copy}
          </button>
          {copied && <span className="pill">{m.data.copied}</span>}
        </div>
        <div className="table-box scroll-x">
          <table>
            <thead>
              <tr>
                <th>{m.data.date}</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="num">
                    {m.data.columns[c.key]}
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
                      <td key={c.key} className="num">
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
