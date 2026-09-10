import { useState } from 'react';
import { f0, f1, fmtDayShort, monthName } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import { fromDayKey } from '@/lib/format';
import type { ActivityWeekLoad } from '@/lib/metrics';
import { tooltipStyle, useElementWidth, useResolvedColor, type TooltipState } from './primitives';

export interface ActivityHeatmapProps {
  data: ActivityWeekLoad;
  color?: string;
  emptyMessage?: string;
}

const CELL = 15;
const GAP = 3;
const TOP = 16;
const LABEL_WIDTH = 132;
const ROW_HEIGHT = CELL + GAP;

/**
 * Activity against ISO week, shaded by the strain accumulated that week.
 *
 * Which disciplines come and go is invisible everywhere else in the dashboard:
 * the strain series adds them together and the activity table flattens the range
 * into one mean, so a block that ends in March and one that starts in April look
 * identical in both. Here they are two blocks.
 *
 * A week with no session of that activity is left empty rather than shaded as a
 * zero. The distinction matters on a grid this sparse — most cells are genuinely
 * «did not do this», not «did this and it was worth nothing» — and it is what
 * makes the filled runs read as blocks.
 *
 * Cells keep their size and the grid scrolls, for the same reason the calendar
 * does: a year squeezed into panel width is a row of one-pixel slivers.
 */
export function ActivityHeatmap({
  data,
  color: token = '--strain',
  emptyMessage,
}: ActivityHeatmapProps) {
  const m = useMessages();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  if (!data.rows.length) {
    return (
      <div className="chart" ref={ref}>
        <p className="empty">{emptyMessage ?? m.charts.noData}</p>
      </div>
    );
  }

  const svgWidth = LABEL_WIDTH + data.weeks.length * ROW_HEIGHT;
  const svgHeight = TOP + data.rows.length * ROW_HEIGHT + 4;
  const span = Math.max(1, data.max);

  let lastMonth = -1;
  const monthLabels: { x: number; text: string }[] = [];
  data.weeks.forEach((week, i) => {
    const date = fromDayKey(week);
    if (date.getMonth() !== lastMonth) {
      lastMonth = date.getMonth();
      monthLabels.push({ x: LABEL_WIDTH + i * ROW_HEIGHT, text: monthName(lastMonth) });
    }
  });

  return (
    <div className="chart" ref={ref}>
      <div className="scroller">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width={svgWidth} height={svgHeight}>
          {monthLabels.map((label) => (
            <text
              key={`${label.x}-${label.text}`}
              x={label.x}
              y={11}
              fontSize={10}
              fill={color('--muted')}
            >
              {label.text}
            </text>
          ))}

          {data.rows.map((row, y) => (
            <g key={row.activity}>
              <text
                x={LABEL_WIDTH - 8}
                y={TOP + y * ROW_HEIGHT + CELL - 3}
                textAnchor="end"
                fontSize={11}
                fill={color('--ink-2')}
              >
                {row.activity.length > 20 ? `${row.activity.slice(0, 19)}…` : row.activity}
              </text>
              {row.cells.map((value, x) => (
                <rect
                  key={x}
                  x={LABEL_WIDTH + x * ROW_HEIGHT}
                  y={TOP + y * ROW_HEIGHT}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={color(value == null ? '--grid' : token)}
                  // A floor of 0.18 on a present cell so one hard week does not
                  // wash every ordinary one out to invisible.
                  opacity={value == null ? 0.4 : 0.18 + 0.82 * (value / span)}
                  onMouseMove={(event) => {
                    const box = (
                      event.currentTarget.ownerSVGElement as SVGSVGElement
                    ).getBoundingClientRect();
                    setTip({
                      x: ((event.clientX - box.left) * svgWidth) / box.width,
                      y: ((event.clientY - box.top) * svgHeight) / box.height,
                      html: (
                        <>
                          <b>{row.activity}</b>
                          <div>{m.charts.heatmap.weekOf(fmtDayShort(data.weeks[x]))}</div>
                          {value == null ? (
                            <div style={{ color: 'var(--muted)' }}>
                              {m.charts.heatmap.noSession}
                            </div>
                          ) : (
                            <>
                              <div>
                                {m.charts.heatmap.strain} <b>{f1(value)}</b>
                              </div>
                              <div style={{ color: 'var(--muted)' }}>
                                {m.charts.heatmap.sessions(f0(row.sessions[x]))}
                              </div>
                            </>
                          )}
                        </>
                      ),
                    });
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <p className="legend">
        <span>{m.charts.heatmap.scale}</span>
        {[0.15, 0.4, 0.65, 0.9].map((step) => (
          <span key={step}>
            <i style={{ background: color(token), opacity: 0.18 + 0.82 * step }} />
            {f0(step * data.max)}
          </span>
        ))}
        <span>
          <i style={{ background: color('--grid'), opacity: 0.4 }} />
          {m.charts.heatmap.noSession}
        </span>
      </p>
      {tip && (
        <div className="tooltip" style={tooltipStyle(tip, width || svgWidth)}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
