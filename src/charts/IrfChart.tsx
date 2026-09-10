import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { area as d3Area, line as d3Line } from 'd3-shape';
import { f0, f2 } from '@/lib/format';
import {
  niceTicks,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';
import { useMessages } from '@/lib/i18n';

export interface IrfPoint {
  lag: number;
  coef: number;
  ciLow: number;
  ciHigh: number;
  se?: number;
  p?: number;
  /** Benjamini–Hochberg q across the lags. Shown instead of p when present. */
  q?: number | null;
}

export interface IrfChartProps {
  points: IrfPoint[];
  height?: number;
  /** Token name for the line and the band. */
  color?: string;
  format?: (value: number | null) => string;
  /** Named in the tooltip, e.g. «Recuperación». */
  label?: string;
  xLabel?: string;
  emptyMessage?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 34, left: 46 };

/**
 * The response of the outcome to the driver, lag by lag, with a shaded 95%
 * band.
 *
 * The band is drawn as one continuous shape rather than as per-lag error bars
 * on purpose: the point of this chart is the *shape* of the response over time
 * — when it peaks, how fast it decays — and a row of separate bars invites
 * reading each lag as its own finding. The horizontal rule at zero is where
 * that shape stops being a claim: wherever the band covers it, the response at
 * that lag is not distinguishable from none.
 */
export function IrfChart({
  points,
  height = 250,
  color: token = '--strain',
  format = f2,
  label,
  xLabel,
  emptyMessage,
}: IrfChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const usable = points
    .filter((p) => Number.isFinite(p.coef) && Number.isFinite(p.ciLow) && Number.isFinite(p.ciHigh))
    .sort((a, b) => a.lag - b.lag);
  if (usable.length < 2) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noLags}</p>
      </div>
    );
  }
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const bounds = usable.flatMap((p) => [p.ciLow, p.ciHigh]).concat(0);
  const ticks = niceTicks(Math.min(...bounds), Math.max(...bounds), 4);

  const x = scaleLinear()
    .domain([usable[0].lag, usable[usable.length - 1].lag])
    .range([MARGIN.left + 10, MARGIN.left + plotWidth - 10]);
  const y = scaleLinear()
    .domain([ticks.lo, ticks.hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);

  const band =
    d3Area<IrfPoint>()
      .x((p) => x(p.lag))
      .y0((p) => y(p.ciLow))
      .y1((p) => y(p.ciHigh))(usable) ?? '';
  const path =
    d3Line<IrfPoint>()
      .x((p) => x(p.lag))
      .y((p) => y(p.coef))(usable) ?? '';

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height}>
        {ticks.ticks.map((t) => (
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
              {format(t)}
            </text>
          </g>
        ))}

        <path d={band} fill={color(token)} opacity={0.16} />
        {ticks.lo <= 0 && ticks.hi >= 0 && (
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={y(0)}
            y2={y(0)}
            stroke={color('--ink')}
            opacity={0.42}
            strokeDasharray="3 3"
          />
        )}
        <path d={path} fill="none" stroke={color(token)} strokeWidth={1.8} />

        {usable.map((point) => {
          const covered = point.ciLow <= 0 && point.ciHigh >= 0;
          return (
            <g key={point.lag}>
              <circle
                cx={x(point.lag)}
                cy={y(point.coef)}
                r={4}
                fill={covered ? color('--panel') : color(token)}
                stroke={color(token)}
                strokeWidth={1.6}
              />
              <text
                x={x(point.lag)}
                y={height - 18}
                textAnchor="middle"
                fontSize={10.5}
                fill={color('--muted')}
              >
                {point.lag}
              </text>
              <rect
                x={x(point.lag) - 14}
                y={MARGIN.top}
                width={28}
                height={plotHeight}
                fill="transparent"
                onMouseMove={(event) => {
                  const rect = (
                    event.currentTarget.ownerSVGElement as SVGSVGElement
                  ).getBoundingClientRect();
                  setTip({
                    x: (x(point.lag) / width) * rect.width,
                    y: event.clientY - rect.top,
                    html: (
                      <>
                        <b>{m.charts.lag(f0(point.lag))}</b>
                        <div>
                          {label ?? m.charts.effect} <b>{format(point.coef)}</b>
                        </div>
                        <div>{m.charts.ci95(format(point.ciLow), format(point.ciHigh))}</div>
                        {point.se != null && (
                          <div>
                            {m.charts.standardError} {format(point.se)}
                          </div>
                        )}
                        {point.p != null && (
                          <div>
                            p {f2(point.p)}
                            {point.q != null && ` · q ${f2(point.q)}`}
                          </div>
                        )}
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}

        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 3}
          textAnchor="middle"
          fontSize={11}
          fill={color('--muted')}
        >
          {xLabel ?? m.charts.lagAxis}
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
