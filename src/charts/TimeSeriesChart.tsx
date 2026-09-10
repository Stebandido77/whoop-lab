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
  type SeriesMarker,
  type TooltipState,
} from './primitives';
import { useMessages } from '@/lib/i18n';

export interface TimeSeriesChartProps {
  data: ChartDatum[];
  series: Series[];
  height?: number;
  yMin?: number;
  yMax?: number;
  formatY?: (value: number | null) => string;
  guides?: GuideLine[];
  /** Dated annotations: regime breaks and control-chart signals. */
  markers?: SeriesMarker[];
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
  markers = [],
  emptyMessage,
}: TimeSeriesChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const values = series.flatMap((s) =>
    data.map((d) => numeric(d, s.key)).filter((v): v is number => v != null),
  );
  if (!data.length || !values.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noData}</p>
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

  const indexOfDay = new Map(data.map((d, i) => [d.day, i]));
  const placed = markers
    .map((m) => ({ marker: m, index: indexOfDay.get(m.day) }))
    .filter((m): m is { marker: SeriesMarker; index: number } => m.index != null);
  const breaks = placed.filter((m) => m.marker.kind === 'break');
  const flags = placed.filter((m) => m.marker.kind !== 'break');

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
          {rows.length ? rows : <div>{m.charts.noDataShort}</div>}
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

        {breaks.map(({ marker, index }) => (
          <g key={`break-${marker.day}`}>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke={color(marker.color ?? '--ink')}
              strokeWidth={1.2}
              strokeDasharray="5 3"
              opacity={0.55}
            />
            {marker.label && (
              <text
                x={x(index) + 4}
                y={MARGIN.top + 9}
                fontSize={10}
                fill={color(marker.color ?? '--ink')}
                opacity={0.85}
              >
                {marker.label}
              </text>
            )}
          </g>
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

        {flags.map(({ marker, index }) => {
          const up = marker.kind === 'high';
          const tip = up ? MARGIN.top + 1 : MARGIN.top + plotHeight - 1;
          const base = up ? MARGIN.top + 7 : MARGIN.top + plotHeight - 7;
          return (
            <polygon
              key={`flag-${marker.kind}-${marker.day}`}
              points={`${x(index)},${tip} ${x(index) - 4},${base} ${x(index) + 4},${base}`}
              fill={color(marker.color ?? (up ? '--lo' : '--hi'))}
              opacity={0.9}
            />
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
