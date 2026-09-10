import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3Line } from 'd3-shape';
import { f0, f1 } from '@/lib/format';
import { binscatter, loess, type SmoothPoint } from '@/lib/econ';
import {
  niceTicks,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';
import { useMessages } from '@/lib/i18n';

export interface BinScatterPoint {
  x: number;
  y: number;
}

export interface BinScatterChartProps {
  points: BinScatterPoint[];
  /** Quantile groups. Twenty is enough to see a bend and few enough to read. */
  bins?: number;
  /** Bins thinner than this are dropped rather than drawn without an error bar. */
  minPerBin?: number;
  /** LOESS neighbourhood, as a fraction of the sample. */
  bandwidth?: number;
  showSmooth?: boolean;
  /** Draw the raw observations behind the bins. */
  showCloud?: boolean;
  height?: number;
  xLabel: string;
  yLabel: string;
  formatX?: (value: number | null) => string;
  formatY?: (value: number | null) => string;
  color?: string;
  emptyMessage?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 38, left: 44 };

/**
 * Binned conditional means with error bars, a LOESS curve, and the raw cloud
 * behind them.
 *
 * Three layers because each answers a different objection. The cloud shows how
 * much data there is and where it thins out. The bins show the conditional mean
 * with the uncertainty of each one, which is the honest version of "on average,
 * when x is high, y is…". The curve shows the shape without asking anyone to
 * connect twenty dots by eye — and, being local-linear, it does not flatten the
 * ends the way a moving average would.
 *
 * Both summaries are computed here rather than by the caller, the same way
 * `ScatterChart` fits its own line: they are readings of the same points, not
 * new metrics.
 */
export function BinScatterChart({
  points,
  bins = 20,
  minPerBin = 3,
  bandwidth = 0.35,
  showSmooth = true,
  showCloud = true,
  height = 300,
  xLabel,
  yLabel,
  formatX = f1,
  formatY = f0,
  color: token = '--strain',
  emptyMessage,
}: BinScatterChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const usable = useMemo(
    () => points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [points],
  );
  const grouped = useMemo(
    () =>
      binscatter(
        usable.map((p) => p.x),
        usable.map((p) => p.y),
        { bins, minPerBin },
      ),
    [usable, bins, minPerBin],
  );
  const curve = useMemo<SmoothPoint[]>(
    () =>
      showSmooth
        ? loess(
            usable.map((p) => p.x),
            usable.map((p) => p.y),
            { bandwidth },
          )
        : [],
    [usable, bandwidth, showSmooth],
  );

  if (!grouped.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noPairs}</p>
      </div>
    );
  }
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const xs = usable.map((p) => p.x);
  const ys = [
    ...usable.map((p) => p.y),
    ...grouped.flatMap((bin) => [bin.ciLow, bin.ciHigh]),
    ...curve.map((p) => p.y),
  ];
  const sx = niceTicks(Math.min(...xs), Math.max(...xs), 4);
  const sy = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const x = scaleLinear()
    .domain([sx.lo, sx.hi])
    .range([MARGIN.left, MARGIN.left + plotWidth]);
  const y = scaleLinear()
    .domain([sy.lo, sy.hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);

  const smoothPath =
    d3Line<SmoothPoint>()
      .x((p) => x(p.x))
      .y((p) => y(p.y))(curve) ?? '';

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height}>
        {sy.ticks.map((t) => (
          <g key={`y${t}`}>
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
        {sx.ticks.map((t) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={height - 20}
            textAnchor="middle"
            fontSize={10.5}
            fill={color('--muted')}
          >
            {formatX(t)}
          </text>
        ))}

        {showCloud &&
          usable.map((point, i) => (
            <circle
              key={i}
              cx={x(point.x)}
              cy={y(point.y)}
              r={2}
              fill={color('--ink')}
              opacity={0.13}
            />
          ))}

        {showSmooth && smoothPath && (
          <path
            d={smoothPath}
            fill="none"
            stroke={color('--ink')}
            strokeWidth={1.5}
            opacity={0.55}
          />
        )}

        {grouped.map((bin, i) => (
          <g key={i}>
            <line
              x1={x(bin.x)}
              x2={x(bin.x)}
              y1={y(bin.ciLow)}
              y2={y(bin.ciHigh)}
              stroke={color(token)}
              strokeWidth={1.5}
              opacity={0.8}
            />
            <circle
              cx={x(bin.x)}
              cy={y(bin.y)}
              r={4}
              fill={color(token)}
              stroke={color('--panel')}
              strokeWidth={1}
              onMouseMove={(event) => {
                const rect = (
                  event.currentTarget.ownerSVGElement as SVGSVGElement
                ).getBoundingClientRect();
                setTip({
                  x: (x(bin.x) / width) * rect.width,
                  y: event.clientY - rect.top,
                  html: (
                    <>
                      <b>
                        {xLabel} {m.charts.range(formatX(bin.xLow), formatX(bin.xHigh))}
                      </b>
                      <div>
                        {yLabel} <b>{formatY(bin.y)}</b>
                      </div>
                      <div>{m.charts.ci95(formatY(bin.ciLow), formatY(bin.ciHigh))}</div>
                      <div>{m.charts.n(f0(bin.n))}</div>
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            />
          </g>
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
      <p className="legend">
        <span>
          <i style={{ background: color(token) }} />
          {m.charts.binMean(f0(grouped[0].n))}
        </span>
        {showSmooth && (
          <span>
            <i style={{ background: color('--ink'), opacity: 0.55 }} />
            {m.charts.loess(f0(bandwidth * 100))}
          </span>
        )}
      </p>
      {tip && (
        <div className="tooltip" style={tooltipStyle(tip, width)}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
