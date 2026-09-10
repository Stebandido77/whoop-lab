import { useState } from 'react';
import { scaleLinear, scaleLog } from 'd3-scale';
import { line as d3Line } from 'd3-shape';
import { f1, f2 } from '@/lib/format';
import {
  niceTicks,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';
import { useMessages } from '@/lib/i18n';

export interface SpectrumPoint {
  /** Period in days. */
  period: number;
  power: number;
}

export interface SpectrumMark {
  period: number;
  label: string;
  /** Solid when the peak there cleared the threshold, dashed when it did not. */
  strong?: boolean;
}

export interface SpectrumChartProps {
  points: SpectrumPoint[];
  /** Power a peak must clear to be called real. Drawn as a horizontal rule. */
  threshold?: number;
  thresholdLabel?: string;
  marks?: SpectrumMark[];
  height?: number;
  color?: string;
  xLabel?: string;
  emptyMessage?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 36, left: 40 };
const CANDIDATE_TICKS = [2, 3, 4, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];

/**
 * A Lomb–Scargle periodogram: how much of the series a cycle of each length
 * explains.
 *
 * The x axis is logarithmic in the period, because that is where the resolution
 * of the estimator is roughly uniform — on a linear axis every cycle shorter
 * than a fortnight is crushed into the first centimetre, which is exactly the
 * region worth reading for a daily habit.
 *
 * The false-alarm line is the whole chart. Any series produces peaks; the
 * question is only whether a peak is taller than what noise would have thrown
 * up across all the frequencies that were examined, and a periodogram drawn
 * without that rule invites finding a rhythm in anything.
 */
export function SpectrumChart({
  points,
  threshold,
  thresholdLabel,
  marks = [],
  height = 230,
  color: token = '--hrv',
  xLabel,
  emptyMessage,
}: SpectrumChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const m = useMessages();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const usable = points
    .filter((p) => Number.isFinite(p.period) && Number.isFinite(p.power) && p.period > 0)
    .sort((a, b) => a.period - b.period);
  if (usable.length < 4) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noSpectrum}</p>
      </div>
    );
  }
  if (!width) return <div className="chart" ref={ref} style={{ height }} />;

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const minPeriod = usable[0].period;
  const maxPeriod = usable[usable.length - 1].period;
  const top = Math.max(...usable.map((p) => p.power), threshold ?? 0);
  const ticks = niceTicks(0, top, 3);

  const x = scaleLog()
    .domain([minPeriod, maxPeriod])
    .range([MARGIN.left, MARGIN.left + plotWidth]);
  const y = scaleLinear()
    .domain([0, ticks.hi])
    .range([MARGIN.top + plotHeight, MARGIN.top]);

  const path =
    d3Line<SpectrumPoint>()
      .x((p) => x(p.period))
      .y((p) => y(p.power))(usable) ?? '';
  const xTicks = CANDIDATE_TICKS.filter((t) => t >= minPeriod && t <= maxPeriod);

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * width) / rect.width;
    if (px < MARGIN.left || px > MARGIN.left + plotWidth) return setTip(null);
    const period = x.invert(px);
    const nearest = usable.reduce((best, p) =>
      Math.abs(p.period - period) < Math.abs(best.period - period) ? p : best,
    );
    setTip({
      x: (x(nearest.period) / width) * rect.width,
      y: event.clientY - rect.top,
      html: (
        <>
          <b>{m.charts.cycleOf(f1(nearest.period))}</b>
          <div>
            {m.charts.power} <b>{f2(nearest.power)}</b>
          </div>
          {threshold != null && (
            <div>
              {nearest.power > threshold ? m.charts.aboveThreshold : m.charts.belowThreshold}
            </div>
          )}
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
        {ticks.ticks
          .filter((t) => t >= 0 && t <= ticks.hi)
          .map((t) => (
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
                {f1(t)}
              </text>
            </g>
          ))}

        {xTicks.map((t) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={height - 20}
            textAnchor="middle"
            fontSize={10.5}
            fill={color('--muted')}
          >
            {t}
          </text>
        ))}

        {marks.map((mark) =>
          mark.period >= minPeriod && mark.period <= maxPeriod ? (
            <g key={mark.label}>
              <line
                x1={x(mark.period)}
                x2={x(mark.period)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotHeight}
                stroke={color(mark.strong ? '--hi' : '--muted')}
                strokeWidth={mark.strong ? 1.4 : 1}
                strokeDasharray={mark.strong ? undefined : '4 3'}
                opacity={mark.strong ? 0.8 : 0.5}
              />
              <text
                x={x(mark.period) + 4}
                y={MARGIN.top + 9}
                fontSize={10}
                fill={color(mark.strong ? '--hi' : '--muted')}
              >
                {mark.label}
              </text>
            </g>
          ) : null,
        )}

        <path d={path} fill="none" stroke={color(token)} strokeWidth={1.5} />

        {threshold != null && threshold <= ticks.hi && (
          <>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(threshold)}
              y2={y(threshold)}
              stroke={color('--lo')}
              strokeWidth={1.3}
              strokeDasharray="5 3"
            />
            <text
              x={width - MARGIN.right}
              y={y(threshold) - 5}
              textAnchor="end"
              fontSize={10}
              fill={color('--lo')}
            >
              {thresholdLabel ?? m.charts.falseAlarm}
            </text>
          </>
        )}

        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          fill={color('--muted')}
        >
          {xLabel ?? m.charts.periodAxis}
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
