import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { f0, f1 } from '@/lib/format';
import { linreg } from '@/lib/stats';
import {
  niceTicks,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';
import { useMessages } from '@/lib/i18n';

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  height?: number;
  xLabel: string;
  yLabel: string;
  formatX?: (v: number | null) => string;
  formatY?: (v: number | null) => string;
  guideX?: number;
  guideY?: number;
  /** Draw the OLS fit. On by default: the cloud alone rarely reads. */
  showFit?: boolean;
}

const MARGIN = { top: 12, right: 12, bottom: 34, left: 42 };

export function ScatterChart({
  points,
  height = 280,
  xLabel,
  yLabel,
  formatX = f1,
  formatY = f0,
  guideX,
  guideY,
  showFit = true,
}: ScatterChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (usable.length < 3) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{m.charts.noPairs}</p>
      </div>
    );
  }
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const sx = niceTicks(Math.min(...usable.map((p) => p.x)), Math.max(...usable.map((p) => p.x)), 4);
  const sy = niceTicks(Math.min(...usable.map((p) => p.y)), Math.max(...usable.map((p) => p.y)), 4);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const x = scaleLinear()
    .domain([sx.lo, sx.hi])
    .range([MARGIN.left, MARGIN.left + plotWidth]);
  const y = scaleLinear()
    .domain([sy.lo, sy.hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);

  const fit = showFit
    ? linreg(
        usable.map((p) => p.x),
        usable.map((p) => p.y),
      )
    : null;

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
          <g key={`x${t}`}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke={color('--grid')}
            />
            <text
              x={x(t)}
              y={height - 16}
              textAnchor="middle"
              fontSize={10.5}
              fill={color('--muted')}
            >
              {formatX(t)}
            </text>
          </g>
        ))}
        {guideX != null && guideX > sx.lo && guideX < sx.hi && (
          <line
            x1={x(guideX)}
            x2={x(guideX)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
            stroke={color('--ink')}
            opacity={0.3}
            strokeDasharray="4 3"
          />
        )}
        {guideY != null && guideY > sy.lo && guideY < sy.hi && (
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={y(guideY)}
            y2={y(guideY)}
            stroke={color('--ink')}
            opacity={0.3}
            strokeDasharray="4 3"
          />
        )}
        {fit && (
          <line
            x1={x(sx.lo)}
            y1={y(fit.intercept + fit.slope * sx.lo)}
            x2={x(sx.hi)}
            y2={y(fit.intercept + fit.slope * sx.hi)}
            stroke={color('--ink')}
            strokeWidth={1.4}
            opacity={0.5}
          />
        )}
        {usable.map((p, i) => (
          <circle
            key={i}
            cx={x(p.x)}
            cy={y(p.y)}
            r={3.4}
            fill={color(p.color ?? '--strain')}
            stroke={color('--panel')}
            strokeWidth={0.6}
            opacity={0.72}
            onMouseMove={(e) => {
              const rect = (
                e.currentTarget.ownerSVGElement as SVGSVGElement
              ).getBoundingClientRect();
              setTip({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                html: (
                  <>
                    {p.label && <b>{p.label}</b>}
                    <div>
                      {xLabel} <b>{formatX(p.x)}</b>
                    </div>
                    <div>
                      {yLabel} <b>{formatY(p.y)}</b>
                    </div>
                  </>
                ),
              });
            }}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 2}
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
