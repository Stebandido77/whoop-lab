import { f1 } from '@/lib/format';
import { useElementWidth, useResolvedColor } from './primitives';
import { useMessages } from '@/lib/i18n';

export interface HBarRow {
  label: string;
  value: number;
  color?: string;
  /** Small grey suffix after the value, e.g. `n=182`. */
  note?: string;
}

export interface HBarChartProps {
  rows: HBarRow[];
  format?: (v: number) => string;
  /** Diverging layout with a zero line, for correlations and deltas. */
  diverging?: boolean;
  rowHeight?: number;
  emptyMessage?: string;
}

/**
 * Ranked horizontal bars. The value label sits outside the bar, so the plot
 * area reserves a gutter on the side(s) the labels can land on — otherwise long
 * negative bars collide with the category names.
 */
export function HBarChart({
  rows,
  format = f1,
  diverging = false,
  rowHeight = 26,
  emptyMessage,
}: HBarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();

  if (!rows.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noObservations}</p>
      </div>
    );
  }
  if (!width)
    return <div className="chart" ref={ref} style={{ height: rows.length * rowHeight + 8 }} />;

  const labelWidth = Math.min(230, Math.max(112, Math.round(width * 0.32)));
  const gutter = diverging ? 66 : 0;
  const rightGutter = diverging ? 66 : 84;
  const areaLeft = labelWidth + gutter;
  const plotWidth = Math.max(40, width - areaLeft - rightGutter);
  const height = rows.length * rowHeight + 8;
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  const zero = diverging ? areaLeft + plotWidth / 2 : areaLeft;

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height}>
        {diverging && <line x1={zero} x2={zero} y1={0} y2={height - 8} stroke={color('--rule')} />}
        {rows.map((row, i) => {
          const y = i * rowHeight + 4;
          const barLength =
            (Math.abs(row.value) / maxAbs) * (diverging ? plotWidth / 2 : plotWidth);
          const negative = diverging && row.value < 0;
          return (
            <g key={row.label}>
              <text
                x={labelWidth - 10}
                y={y + rowHeight / 2 + 0.5}
                textAnchor="end"
                fontSize={12}
                fill={color('--ink-2')}
              >
                {row.label}
              </text>
              <rect
                x={negative ? zero - barLength : zero}
                y={y + 3}
                width={Math.max(1, barLength)}
                height={rowHeight - 11}
                rx={1}
                fill={color(row.color ?? '--strain')}
                opacity={0.85}
              />
              <text
                x={negative ? zero - barLength - 6 : zero + barLength + 6}
                y={y + rowHeight / 2 + 0.5}
                textAnchor={negative ? 'end' : 'start'}
                fontSize={11.5}
                fill={color('--muted')}
              >
                {format(row.value)}
                {row.note ? `  ${row.note}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
