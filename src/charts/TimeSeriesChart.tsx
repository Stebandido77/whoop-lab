import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { area as d3Area, line as d3Line } from 'd3-shape';
import { fmtDayLong, fmtDayShort, f0 } from '@/lib/format';
import {
  niceTicks,
  numeric,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type ChartDatum,
  type GuideLine,
  type Series,
  type TooltipState,
} from './primitives';

export interface TimeSeriesChartProps {
  data: ChartDatum[];
  series: Series[];
  height?: number;
  yMin?: number;
  yMax?: number;
  formatY?: (value: number | null) => string;
  guides?: GuideLine[];
  emptyMessage?: string;
}

const MARGIN = { top: 12, right: 10, bottom: 22, left: 40 };

/**
 * Bars, lines, areas and dot clouds over a categorical day axis. Days are
 * equally spaced rather than time-scaled so a gap in the export reads as a gap
 * instead of silently stretching the neighbouring bars.
 */
export function TimeSeriesChart({
  data,
  series,
  height = 210,
  yMin,
  yMax,
  formatY = f0,
  guides = [],
  emptyMessage = 'Sin datos en este rango',
}: TimeSeriesChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const values = series.flatMap((s) =>
    data.map((d) => numeric(d, s.key)).filter((v): v is number => v != null),
  );
  if (!data.length || !values.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage}</p>
      </div>
    );
  }
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const rawLo = yMin ?? Math.min(...values);
  const rawHi = yMax ?? Math.max(...values);
  const scaleTicks = niceTicks(rawLo, rawHi, 4);
  const lo = yMin ?? scaleTicks.lo;
  const hi = yMax ?? scaleTicks.hi;

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / data.length;
  const x = (i: number) => MARGIN.left + (i + 0.5) * band;
  const y = scaleLinear()
    .domain([lo, hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);

  const labelEvery = Math.max(
    1,
    Math.round(data.length / Math.min(8, Math.max(2, Math.floor(width / 110)))),
  );
  const barWidth = Math.max(1, Math.min(band - 1.2, band * 0.78));

  const buildLine = (key: string) =>
    d3Line<ChartDatum>()
      .defined((d) => numeric(d, key) != null)
      .x((_, i) => x(i))
      .y((d) => y(numeric(d, key)!))(data) ?? '';

  const buildArea = (key: string) =>
    d3Area<ChartDatum>()
      .defined((d) => numeric(d, key) != null)
      .x((_, i) => x(i))
      .y0(MARGIN.top + plotHeight)
      .y1((d) => y(numeric(d, key)!))(data) ?? '';

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * width) / rect.width;
    const index = Math.max(
      0,
      Math.min(data.length - 1, Math.round((px - MARGIN.left) / band - 0.5)),
    );
    const datum = data[index];
    const rows = series
      .filter((s) => numeric(datum, s.key) != null)
      .map((s) => {
        const value = numeric(datum, s.key)!;
        return (
          <div key={s.key}>
            <span
              className="swatch"
              style={{ background: color(s.colorFor ? s.colorFor(value, datum) : s.color) }}
            />
            {s.label} <b>{(s.format ?? formatY)(value)}</b>
          </div>
        );
      });
    setTip({
      x: (x(index) / width) * rect.width,
      y: event.clientY - rect.top,
      html: (
        <>
          <b>{fmtDayLong(datum.day)}</b>
          {rows.length ? rows : <div>sin datos</div>}
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
        {scaleTicks.ticks
          .filter((t) => t >= lo && t <= hi)
          .map((t) => (
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
                {formatY(t)}
              </text>
            </g>
          ))}

        {guides
          .filter((g) => g.value >= lo && g.value <= hi)
          .map((g) => (
            <line
              key={`guide-${g.value}`}
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(g.value)}
              y2={y(g.value)}
              stroke={color(g.color ?? '--muted')}
              strokeDasharray="3 3"
              opacity={0.7}
            />
          ))}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.day}
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

        {series.map((s) => {
          if (s.type === 'bar') {
            const zero = y(Math.max(lo, 0));
            return (
              <g key={s.key}>
                {data.map((d, i) => {
                  const v = numeric(d, s.key);
                  if (v == null) return null;
                  const top = y(v);
                  return (
                    <rect
                      key={d.day}
                      x={x(i) - barWidth / 2}
                      y={Math.min(top, zero)}
                      width={barWidth}
                      height={Math.max(1, Math.abs(zero - top))}
                      rx={1}
                      fill={color(s.colorFor ? s.colorFor(v, d) : s.color)}
                      opacity={s.opacity ?? 0.85}
                    />
                  );
                })}
              </g>
            );
          }
          if (s.type === 'dots') {
            return (
              <g key={s.key}>
                {data.map((d, i) => {
                  const v = numeric(d, s.key);
                  return v == null ? null : (
                    <circle
                      key={d.day}
                      cx={x(i)}
                      cy={y(v)}
                      r={s.radius ?? 2.4}
                      fill={color(s.colorFor ? s.colorFor(v, d) : s.color)}
                      opacity={s.opacity ?? 0.9}
                    />
                  );
                })}
              </g>
            );
          }
          return (
            <g key={s.key}>
              {s.type === 'area' && (
                <path d={buildArea(s.key)} fill={color(s.color)} opacity={0.1} />
              )}
              <path
                d={buildLine(s.key)}
                fill="none"
                stroke={color(s.color)}
                strokeWidth={s.width ?? 1.8}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={s.opacity ?? 1}
              />
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
