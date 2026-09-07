import { useState } from 'react';
import { fmtDayLong, MONTHS, WEEKDAYS } from '@/lib/format';
import {
  numeric,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type ChartDatum,
  type TooltipState,
} from './primitives';

export interface CalendarHeatmapProps {
  data: (ChartDatum & { date: Date })[];
  metric: string;
  label: string;
  colorFor: (value: number | null) => string;
  format?: (v: number | null) => string;
}

const CELL = 13;
const GAP = 3;
const TOP = 16;
const LEFT = 30;

/** GitHub-style year grid. Scrolls horizontally rather than shrinking cells. */
export function CalendarHeatmap({
  data,
  metric,
  label,
  colorFor,
  format = String,
}: CalendarHeatmapProps) {
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

  const offset = data[0].date.getDay();
  const weeks = Math.ceil((data.length + offset) / 7);
  const svgWidth = weeks * (CELL + GAP) + LEFT;
  const svgHeight = TOP + 7 * (CELL + GAP) + 4;

  let lastMonth = -1;
  const monthLabels: { x: number; text: string }[] = [];

  return (
    <div className="chart" ref={ref}>
      <div className="scroller">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width={svgWidth} height={svgHeight}>
          {[1, 3, 5].map((r) => (
            <text
              key={r}
              x={0}
              y={TOP + r * (CELL + GAP) + CELL - 2}
              fontSize={10}
              fill={color('--muted')}
            >
              {WEEKDAYS[r]}
            </text>
          ))}
          {data.map((d, i) => {
            const pos = i + offset;
            const x = LEFT + Math.floor(pos / 7) * (CELL + GAP);
            const y = TOP + (pos % 7) * (CELL + GAP);
            const value = numeric(d, metric);
            if (d.date.getMonth() !== lastMonth && d.date.getDate() <= 7) {
              lastMonth = d.date.getMonth();
              monthLabels.push({ x, text: MONTHS[lastMonth] });
            }
            return (
              <rect
                key={d.day}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill={color(colorFor(value))}
                opacity={value == null ? 0.35 : 0.92}
                onMouseMove={(e) => {
                  const rect = (
                    e.currentTarget.ownerSVGElement as SVGSVGElement
                  ).getBoundingClientRect();
                  setTip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    html: (
                      <>
                        <b>{fmtDayLong(d.day)}</b>
                        <div>
                          {label} <b>{format(value)}</b>
                        </div>
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
            );
          })}
          {monthLabels.map((m) => (
            <text key={`${m.x}-${m.text}`} x={m.x} y={11} fontSize={10} fill={color('--muted')}>
              {m.text}
            </text>
          ))}
        </svg>
      </div>
      {tip && (
        <div className="tooltip" style={tooltipStyle(tip, width || svgWidth)}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
