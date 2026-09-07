import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { fmtDayLong, fmtDayShort, hoursMinutes } from '@/lib/format';
import {
  niceTicks,
  numeric,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type ChartDatum,
  type TooltipState,
} from './primitives';

export interface StackLayer {
  key: string;
  label: string;
  color: string;
}

export interface StackedBarChartProps {
  data: ChartDatum[];
  layers: StackLayer[];
  height?: number;
  formatValue?: (v: number | null) => string;
  formatAxis?: (v: number) => string;
}

const MARGIN = { top: 12, right: 10, bottom: 22, left: 40 };

/** Sleep architecture and anything else that decomposes a daily total. */
export function StackedBarChart({
  data,
  layers,
  height = 220,
  formatValue = hoursMinutes,
  formatAxis = (v) => `${Math.round(v / 60)}h`,
}: StackedBarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  if (!data.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">Sin datos en este rango</p>
      </div>
    );
  }
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const totals = data.map((d) => layers.reduce((s, l) => s + (numeric(d, l.key) ?? 0), 0));
  const { hi, ticks } = niceTicks(0, Math.max(...totals, 1), 4);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / data.length;
  const x = (i: number) => MARGIN.left + (i + 0.5) * band;
  const y = scaleLinear()
    .domain([0, hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);
  const barWidth = Math.max(1, Math.min(band - 1.2, band * 0.8));
  const labelEvery = Math.max(
    1,
    Math.round(data.length / Math.min(8, Math.max(2, Math.floor(width / 110)))),
  );

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * width) / rect.width;
    const i = Math.max(0, Math.min(data.length - 1, Math.round((px - MARGIN.left) / band - 0.5)));
    setTip({
      x: (x(i) / width) * rect.width,
      y: event.clientY - rect.top,
      html: (
        <>
          <b>{fmtDayLong(data[i].day)}</b>
          {layers.map((l) => (
            <div key={l.key}>
              <span className="swatch" style={{ background: color(l.color) }} />
              {l.label} <b>{formatValue(numeric(data[i], l.key))}</b>
            </div>
          ))}
          <div>
            Total <b>{formatValue(totals[i])}</b>
          </div>
        </>
      ),
    });
  };

  return (
    <div className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(t)}
              y2={y(t)}
              stroke={color('--grid')}
            />
            <text
              x={MARGIN.left - 6}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill={color('--muted')}
            >
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`x-${d.day}`}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize={10.5}
              fill={color('--muted')}
            >
              {fmtDayShort(d.day)}
            </text>
          ) : null,
        )}
        {data.map((d, i) => {
          let acc = 0;
          return (
            <g key={d.day}>
              {layers.map((l) => {
                const v = numeric(d, l.key);
                if (!v) return null;
                const top = y(acc + v);
                const bottom = y(acc);
                acc += v;
                return (
                  <rect
                    key={l.key}
                    x={x(i) - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={Math.max(0.6, bottom - top)}
                    fill={color(l.color)}
                    opacity={0.92}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="tooltip" style={tooltipStyle(tip, width)}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
