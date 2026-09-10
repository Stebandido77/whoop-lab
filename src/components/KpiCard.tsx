import type { ReactNode } from 'react';
import { Sparkline } from '@/charts';
import { f1 } from '@/lib/format';
import { useMessages } from '@/lib/i18n';

export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  /** Change against the previous window, already in display units. */
  delta?: number | null;
  deltaUnit?: string;
  /** `1` when higher is better, `-1` when lower is better. */
  direction?: 1 | -1;
  /** Defaults to the locale's one-decimal format; never `toFixed`, which is en-US. */
  formatDelta?: (v: number) => string;
  trend?: (number | null)[];
  trendColor?: string;
  children?: ReactNode;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaUnit = '',
  direction = 1,
  formatDelta = f1,
  trend,
  trendColor = '--hi',
}: KpiCardProps) {
  const m = useMessages();
  const tone =
    delta == null || Math.abs(delta) < 1e-9
      ? ''
      : (delta > 0 ? 1 : -1) === direction
        ? 'up'
        : 'down';
  return (
    <div className="panel span-3 kpi">
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {unit && <em>{unit}</em>}
      </span>
      <span className="delta">
        {delta == null ? (
          m.common.noPreviousPeriod
        ) : (
          <>
            <b className={tone}>
              {delta > 0 ? '+' : ''}
              {formatDelta(delta)}
              {deltaUnit}
            </b>{' '}
            {m.common.vsPreviousPeriod}
          </>
        )}
      </span>
      {trend && <Sparkline values={trend} color={trendColor} />}
    </div>
  );
}
