import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { f0, f1, f2 } from '@/lib/format';
import {
  niceTicks,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';
import { useMessages } from '@/lib/i18n';

export interface CoefficientRow {
  label: string;
  coef: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  p: number;
  /**
   * Benjamini–Hochberg q-value. Null means the estimate was not part of a
   * corrected family, and then nothing is marked as significant: an uncorrected
   * star in a plot of fifteen coefficients is the exact mistake to avoid.
   */
  q?: number | null;
  n?: number;
  /** Token name, e.g. `--strain`. */
  color?: string;
}

export interface CoefficientPlotProps {
  rows: CoefficientRow[];
  format?: (value: number | null) => string;
  /** Appended to the numbers in the tooltip, e.g. `pp` or `ms`. */
  unit?: string;
  /** Threshold applied to q, not to p. */
  alpha?: number;
  rowHeight?: number;
  emptyMessage?: string;
}

const MARGIN = { top: 8, right: 16, bottom: 26 };

/**
 * Forest plot of regression coefficients, ordered by magnitude.
 *
 * Every coefficient is drawn as its interval first and its point second,
 * because the interval is the estimate and the dot is only its centre. The
 * vertical rule at zero is the whole reading: an interval that crosses it has
 * not separated the effect from nothing, however far from zero the dot sits.
 *
 * The significance mark comes from the BH q-value and never from p — a plot
 * like this is a family of tests by construction, and marking raw p-values
 * would guarantee a star on noise.
 */
export function CoefficientPlot({
  rows,
  format = f2,
  unit = '',
  alpha = 0.05,
  rowHeight = 28,
  emptyMessage,
}: CoefficientPlotProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const usable = rows.filter(
    (row) => Number.isFinite(row.coef) && Number.isFinite(row.ciLow) && Number.isFinite(row.ciHigh),
  );
  if (!usable.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noModel}</p>
      </div>
    );
  }

  const height = usable.length * rowHeight + MARGIN.top + MARGIN.bottom;
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const ordered = [...usable].sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));
  const labelWidth = Math.min(220, Math.max(104, Math.round(width * 0.3)));
  const valueGutter = 76;
  const plotLeft = labelWidth + 10;
  const plotWidth = Math.max(50, width - plotLeft - valueGutter - MARGIN.right);

  const bounds = ordered.flatMap((row) => [row.ciLow, row.ciHigh]).concat(0);
  const ticks = niceTicks(Math.min(...bounds), Math.max(...bounds), 4);
  const x = scaleLinear()
    .domain([ticks.lo, ticks.hi])
    .range([plotLeft, plotLeft + plotWidth]);
  const plotBottom = MARGIN.top + ordered.length * rowHeight;

  const significant = (row: CoefficientRow) => row.q != null && row.q <= alpha;

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height}>
        {ticks.ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={MARGIN.top} y2={plotBottom} stroke={color('--grid')} />
            <text
              x={x(t)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10.5}
              fill={color('--muted')}
            >
              {format(t)}
            </text>
          </g>
        ))}
        <line
          x1={x(0)}
          x2={x(0)}
          y1={MARGIN.top}
          y2={plotBottom}
          stroke={color('--ink')}
          opacity={0.42}
          strokeDasharray="3 3"
        />

        {ordered.map((row, i) => {
          const y = MARGIN.top + i * rowHeight + rowHeight / 2;
          const token = row.color ?? '--strain';
          const marked = significant(row);
          return (
            <g
              key={row.label}
              onMouseMove={(event) => {
                const rect = (
                  event.currentTarget.ownerSVGElement as SVGSVGElement
                ).getBoundingClientRect();
                setTip({
                  x: ((event.clientX - rect.left) * width) / rect.width,
                  y: event.clientY - rect.top,
                  html: (
                    <>
                      <b>{row.label}</b>
                      <div>
                        {m.charts.coefficient} <b>{format(row.coef)}</b>
                        {unit && ` ${unit}`}
                      </div>
                      <div>{m.charts.ci95(format(row.ciLow), format(row.ciHigh))}</div>
                      <div>
                        {m.charts.standardError} {format(row.se)}
                      </div>
                      <div>
                        p {f2(row.p)}
                        {row.q != null && ` · q ${f2(row.q)}`}
                      </div>
                      {row.n != null && <div>{m.charts.n(f0(row.n))}</div>}
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            >
              <rect
                x={0}
                y={MARGIN.top + i * rowHeight}
                width={width}
                height={rowHeight}
                fill="transparent"
              />
              <text x={labelWidth} y={y + 4} textAnchor="end" fontSize={12} fill={color('--ink-2')}>
                {row.label}
              </text>
              <line
                x1={x(row.ciLow)}
                x2={x(row.ciHigh)}
                y1={y}
                y2={y}
                stroke={color(token)}
                strokeWidth={1.6}
                opacity={0.75}
              />
              {[row.ciLow, row.ciHigh].map((edge) => (
                <line
                  key={edge}
                  x1={x(edge)}
                  x2={x(edge)}
                  y1={y - 4}
                  y2={y + 4}
                  stroke={color(token)}
                  strokeWidth={1.4}
                  opacity={0.75}
                />
              ))}
              <circle
                cx={x(row.coef)}
                cy={y}
                r={4}
                fill={marked ? color(token) : color('--panel')}
                stroke={color(token)}
                strokeWidth={1.6}
              />
              <text
                x={plotLeft + plotWidth + 10}
                y={y + 4}
                fontSize={11.5}
                fill={color(marked ? '--ink-2' : '--muted')}
              >
                {format(row.coef)}
                {marked ? ' *' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="legend">
        <span>{m.charts.coefficientLegend(f1(alpha * 100))}</span>
      </p>
      {tip && (
        <div className="tooltip" style={tooltipStyle(tip, width)}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
