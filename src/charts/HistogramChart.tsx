import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3Line } from 'd3-shape';
import { f0, f1 } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import type { DensityPoint, DensityPeak, HistogramBin } from '@/lib/econ';
import {
  niceTicks,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';

export interface HistogramChartProps {
  bins: HistogramBin[];
  /** Kernel density on the same vertical scale as the bars. */
  density?: DensityPoint[];
  /** Peaks worth naming, drawn as ticks under the curve. */
  peaks?: DensityPeak[];
  /** The valley between the two tallest peaks. */
  antimode?: DensityPoint | null;
  height?: number;
  xLabel: string;
  formatX?: (value: number | null) => string;
  color?: string;
  emptyMessage?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 38, left: 44 };

/**
 * A histogram with its kernel density over it.
 *
 * Both, and not one or the other, because they fail in opposite directions. The
 * bars are honest about where the observations actually are but their shape
 * moves with the bin edges; the curve is smooth but its shape is a bandwidth
 * choice. Two humps that survive both readings are worth naming.
 *
 * The bars are drawn as densities rather than counts so the curve can share
 * their axis without a second scale to misread.
 */
export function HistogramChart({
  bins,
  density = [],
  peaks = [],
  antimode = null,
  height = 260,
  xLabel,
  formatX = f1,
  color: token = '--strain',
  emptyMessage,
}: HistogramChartProps) {
  const m = useMessages();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  if (!bins.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noData}</p>
      </div>
    );
  }
  if (width < 80) return <div className="chart" ref={ref} style={{ height }} />;

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom);

  const minX = Math.min(bins[0].from, ...density.map((p) => p.x));
  const maxX = Math.max(bins[bins.length - 1].to, ...density.map((p) => p.x));
  const maxY = Math.max(...bins.map((b) => b.density), ...density.map((p) => p.y), Number.EPSILON);
  const ticks = niceTicks(0, maxY, 3);

  const x = scaleLinear()
    .domain([minX, maxX])
    .range([MARGIN.left, MARGIN.left + plotWidth]);
  const y = scaleLinear()
    .domain([0, ticks.hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);

  const curve =
    d3Line<DensityPoint>()
      .x((p) => x(p.x))
      .y((p) => y(p.y))(density) ?? '';

  const totalCount = bins.reduce((s, b) => s + b.count, 0);

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} onMouseLeave={() => setTip(null)}>
        {ticks.ticks
          .filter((t) => t <= ticks.hi)
          .map((t) => (
            <line
              key={t}
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(t)}
              y2={y(t)}
              stroke={color('--grid')}
            />
          ))}

        {bins.map((bin, i) => {
          const left = x(bin.from);
          const right = x(bin.to);
          const top = y(bin.density);
          return (
            <rect
              key={i}
              x={left + 0.5}
              y={top}
              width={Math.max(0.5, right - left - 1)}
              height={Math.max(0, y(0) - top)}
              fill={color(token)}
              opacity={0.42}
              onMouseMove={(event) => {
                const rect = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
                setTip({
                  x: ((left + right) / 2 / width) * rect.width,
                  y: event.clientY - rect.top,
                  html: (
                    <>
                      <b>{m.charts.range(formatX(bin.from), formatX(bin.to))}</b>
                      <div>
                        {m.charts.days(f0(bin.count))}{' '}
                        <b>{f0((100 * bin.count) / Math.max(1, totalCount))}%</b>
                      </div>
                    </>
                  ),
                });
              }}
            />
          );
        })}

        {curve && (
          <path d={curve} fill="none" stroke={color('--ink')} strokeWidth={1.8} opacity={0.85} />
        )}

        {antimode && (
          <line
            x1={x(antimode.x)}
            x2={x(antimode.x)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
            stroke={color('--muted')}
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        )}

        {peaks.map((peak) => (
          <g key={peak.x}>
            <line
              x1={x(peak.x)}
              x2={x(peak.x)}
              y1={y(peak.y)}
              y2={y(peak.y) - 9}
              stroke={color('--ink')}
              strokeWidth={1.4}
            />
            <text
              x={x(peak.x)}
              y={y(peak.y) - 13}
              textAnchor="middle"
              fontSize={10.5}
              fill={color('--ink-2')}
            >
              {formatX(peak.x)}
            </text>
          </g>
        ))}

        <line
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={y(0)}
          y2={y(0)}
          stroke={color('--rule')}
        />

        {niceTicks(minX, maxX, 6)
          .ticks.filter((t) => t >= minX && t <= maxX)
          .map((t) => (
            <text
              key={t}
              x={x(t)}
              y={height - MARGIN.bottom + 16}
              textAnchor="middle"
              fontSize={10.5}
              fill={color('--muted')}
            >
              {formatX(t)}
            </text>
          ))}

        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          fill={color('--muted')}
        >
          {xLabel}
        </text>
      </svg>
      {tip && (
        <div className="tooltip" style={tooltipStyle(tip, width)}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
