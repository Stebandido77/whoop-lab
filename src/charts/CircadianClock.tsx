import { useState } from 'react';
import { clockTime, f0, f1, fmtDayLong, hoursMinutes, signed } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import type { CircadianClock as ClockData } from '@/lib/metrics';
import {
  categoricalToken,
  tooltipStyle,
  useElementWidth,
  useResolvedColor,
  type TooltipState,
} from './primitives';

export interface CircadianClockProps {
  data: ClockData;
  /** Height of the dial. The width comes from its own column, not from the panel. */
  size?: number;
  emptyMessage?: string;
}

/**
 * Radii as fractions of the outer one. The dial is laid out from these and
 * nothing else, so moving a ring is one number.
 *
 * The gap between `centre` and `sessionBase` is deliberate and load-bearing: the
 * spokes have to stop short of the summary in the middle. An earlier version let
 * them run to the centre and the one legible sentence on the whole chart was
 * buried under three hundred hairlines.
 */
const RING = {
  recoveryOuter: 1,
  recoveryInner: 0.9,
  hourLabel: 0.815,
  sleepOuter: 0.775,
  sleepInner: 0.63,
  sessionBase: 0.335,
  sessionMax: 0.6,
  centre: 0.3,
};

const TAU = Math.PI * 2;
/** Minutes to radians, with midnight at twelve o'clock and the day running clockwise. */
const angleOf = (minute: number) => (minute / 1440) * TAU - Math.PI / 2;

const point = (cx: number, cy: number, radius: number, minute: number) => {
  const a = angleOf(minute);
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
};

/** An annular sector between two radii, always swept clockwise from `from` to `to`. */
function sector(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  from: number,
  to: number,
): string {
  const span = to >= from ? to - from : to + 1440 - from;
  const large = span > 720 ? 1 : 0;
  const [ox1, oy1] = point(cx, cy, outer, from);
  const [ox2, oy2] = point(cx, cy, outer, to);
  const [ix2, iy2] = point(cx, cy, inner, to);
  const [ix1, iy1] = point(cx, cy, inner, from);
  return [
    `M ${ox1} ${oy1}`,
    `A ${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ');
}

/**
 * The day on a twenty-four hour dial.
 *
 * Three readings share one axis here, and sharing it is the whole point: the
 * sleep window, every workout at the hour it began, and recovery by the hour of
 * waking. As separate time series — which is how the rest of the dashboard shows
 * them — none of the three can answer where the day's load actually sits.
 *
 * Read from the outside in, which is also the direction the causation is claimed
 * to run: the outer ring is the consequence, the band is the night, the spokes
 * are the training. Midnight is at the top and the day runs clockwise, because a
 * clock face has already taught everyone that.
 *
 * Every spoke is one session out of the export. Nothing here is smoothed, and
 * the two places where the picture summarises rather than records — the quartile
 * wedges and the ring — carry their sample size in the tooltip.
 */
export function CircadianClock({ data, size = 520, emptyMessage }: CircadianClockProps) {
  const m = useMessages();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const color = useResolvedColor();
  const [tip, setTip] = useState<TooltipState | null>(null);

  if (!data.sessions.length && !data.wakeHours.length) {
    return (
      <div className="chart">
        <p className="empty">{emptyMessage ?? m.charts.noData}</p>
      </div>
    );
  }

  const shown = data.activities.slice(0, 8);
  const rest = data.activities.length - shown.length;

  // Square unless the column is narrower than the dial wants to be, so a phone
  // gets a circle that fits rather than one cropped by its own viewBox.
  const height = Math.min(Math.max(width, 1), size);
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) / 2 - 16;
  const r = (fraction: number) => R * fraction;

  const track = (event: React.MouseEvent, html: React.ReactNode) => {
    const box = (event.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, html });
  };

  const activityIndex = new Map(data.activities.map((a, i) => [a.activity, i]));
  const strainSpan = Math.max(1, data.maxStrain);

  return (
    <div className="clock">
      <div className="chart clock-dial" ref={ref}>
        {width < 80 ? (
          <div style={{ height }} />
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            role="img"
            onMouseLeave={() => setTip(null)}
          >
            {Array.from({ length: 24 }, (_, hour) => {
              const quarter = hour % 6 === 0;
              const [x1, y1] = point(cx, cy, r(RING.centre), hour * 60);
              const [x2, y2] = point(cx, cy, r(RING.recoveryOuter), hour * 60);
              return (
                <line
                  key={hour}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color(quarter ? '--rule' : '--grid')}
                  strokeWidth={quarter ? 1 : 0.6}
                  opacity={quarter ? 0.85 : 0.5}
                />
              );
            })}

            {/* An empty track behind the outer ring, so the hours nobody ever woke
              in read as absent rather than as a chart that stops. */}
            <circle
              cx={cx}
              cy={cy}
              r={(r(RING.recoveryInner) + r(RING.recoveryOuter)) / 2}
              fill="none"
              stroke={color('--grid')}
              strokeWidth={r(RING.recoveryOuter) - r(RING.recoveryInner)}
              opacity={0.4}
            />

            {/* The night: a soft arc between the medians, with the quartile spread
              of each end laid over it. The wedges are the honest width. */}
            <path
              d={sector(
                cx,
                cy,
                r(RING.sleepInner),
                r(RING.sleepOuter),
                data.bedtime.median,
                data.wake.median,
              )}
              fill={color('--sleep')}
              opacity={0.3}
            />
            {(
              [
                ['bedtime', data.bedtime, m.charts.clock.bedtime],
                ['wake', data.wake, m.charts.clock.wake],
              ] as const
            ).map(([key, q, label]) => (
              <path
                key={key}
                d={sector(cx, cy, r(RING.sleepInner), r(RING.sleepOuter), q.q1, q.q3)}
                fill={color('--sleep')}
                opacity={0.5}
                onMouseMove={(event) =>
                  track(
                    event,
                    <>
                      <b>{label}</b>
                      <div>{m.charts.clock.median(clockTime(q.median))}</div>
                      <div>{m.charts.clock.iqr(clockTime(q.q1), clockTime(q.q3))}</div>
                      <div style={{ color: 'var(--muted)' }}>{m.charts.clock.nights(f0(q.n))}</div>
                    </>,
                  )
                }
              />
            ))}
            {[data.bedtime.median, data.wake.median].map((minute, i) => {
              const [x1, y1] = point(cx, cy, r(RING.sleepInner) - 3, minute);
              const [x2, y2] = point(cx, cy, r(RING.sleepOuter) + 3, minute);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color('--sleep')}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              );
            })}

            {/* One spoke per session, at the minute it started, as long as its
              strain. Where they bunch up are the hours you train. */}
            <circle
              cx={cx}
              cy={cy}
              r={r(RING.sessionBase)}
              fill="none"
              stroke={color('--rule-soft')}
              strokeWidth={1}
            />
            {data.sessions.map((session, i) => {
              const length =
                r(RING.sessionBase) +
                (session.strain / strainSpan) * r(RING.sessionMax - RING.sessionBase);
              const [x1, y1] = point(cx, cy, r(RING.sessionBase), session.minuteOfDay);
              const [x2, y2] = point(cx, cy, length, session.minuteOfDay);
              return (
                <line
                  key={`${session.day}-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color(categoricalToken(activityIndex.get(session.activity) ?? -1))}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  opacity={0.62}
                  onMouseMove={(event) =>
                    track(
                      event,
                      <>
                        <b>{session.activity}</b>
                        <div>{fmtDayLong(session.day)}</div>
                        <div>
                          {m.charts.clock.startedAt} <b>{clockTime(session.minuteOfDay)}</b>
                        </div>
                        <div>
                          {m.charts.clock.strain} <b>{f1(session.strain)}</b>
                        </div>
                        {session.duration != null && (
                          <div style={{ color: 'var(--muted)' }}>
                            {hoursMinutes(session.duration)}
                          </div>
                        )}
                      </>,
                    )
                  }
                />
              );
            })}

            {/* Outer ring: how the mornings that woke in each hour scored, against
              the range mean. An hour with too few mornings is outlined and not
              filled — otherwise «no evidence» and «no difference» would look the
              same, and they are not the same statement. */}
            {data.wakeHours.map((entry) => {
              const deviation =
                entry.recovery != null && data.meanRecovery != null
                  ? entry.recovery - data.meanRecovery
                  : null;
              const path = sector(
                cx,
                cy,
                r(RING.recoveryInner),
                r(RING.recoveryOuter),
                entry.hour * 60 + 2,
                (entry.hour + 1) * 60 - 2,
              );
              const hover = (event: React.MouseEvent) =>
                track(
                  event,
                  <>
                    <b>{m.charts.clock.wokeAt(clockTime(entry.hour * 60))}</b>
                    {entry.recovery == null ? (
                      <div>{m.charts.clock.tooFewMornings(f0(entry.n))}</div>
                    ) : (
                      <>
                        <div>
                          {m.charts.clock.meanRecovery} <b>{f0(entry.recovery)}%</b>
                        </div>
                        {deviation != null && (
                          <div style={{ color: 'var(--muted)' }}>
                            {m.charts.clock.againstRange(signed(deviation, f1, ' pp'))}
                          </div>
                        )}
                        <div style={{ color: 'var(--muted)' }}>
                          {m.charts.clock.mornings(f0(entry.n))}
                        </div>
                      </>
                    )}
                  </>,
                );

              if (deviation == null) {
                return (
                  <path
                    key={entry.hour}
                    d={path}
                    fill="none"
                    stroke={color('--muted')}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.75}
                    onMouseMove={hover}
                  />
                );
              }
              return (
                <path
                  key={entry.hour}
                  d={path}
                  fill={color(deviation >= 0 ? '--hi' : '--lo')}
                  opacity={Math.min(0.95, 0.3 + Math.abs(deviation) / 10)}
                  onMouseMove={hover}
                />
              );
            })}

            {Array.from({ length: 8 }, (_, i) => {
              const hour = i * 3;
              const [x, y] = point(cx, cy, r(RING.hourLabel), hour * 60);
              return (
                <text
                  key={hour}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill={color(hour % 6 === 0 ? '--ink-2' : '--muted')}
                  fontWeight={hour % 6 === 0 ? 600 : 400}
                >
                  {clockTime(hour * 60)}
                </text>
              );
            })}

            {/* The summary sits on its own disc. Without the fill it would be read
              through three hundred spokes. */}
            <circle cx={cx} cy={cy} r={r(RING.centre) - 4} fill={color('--panel')} />
            <text
              x={cx}
              y={cy - 20}
              textAnchor="middle"
              fontSize={11}
              fill={color('--muted')}
              dominantBaseline="central"
            >
              {m.charts.clock.centreLabel}
            </text>
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              fontSize={19}
              fill={color('--ink')}
              fontWeight={600}
              dominantBaseline="central"
            >
              {clockTime(data.bedtime.median)} → {clockTime(data.wake.median)}
            </text>
            <text
              x={cx}
              y={cy + 21}
              textAnchor="middle"
              fontSize={12.5}
              fill={color('--muted')}
              dominantBaseline="central"
            >
              {hoursMinutes(data.windowMinutes)}
            </text>
          </svg>
        )}
        {tip && (
          <div className="tooltip" style={tooltipStyle(tip, width)}>
            {tip.html}
          </div>
        )}
      </div>

      <div className="clock-key">
        <div>
          <h4>{m.charts.clock.keyNight}</h4>
          <ul>
            <li>
              <i style={{ background: color('--sleep'), opacity: 0.5 }} />
              {m.charts.clock.legendSleep}
            </li>
          </ul>
        </div>
        <div>
          <h4>{m.charts.clock.keySessions}</h4>
          <ul>
            {shown.map((activity, i) => (
              <li key={activity.activity}>
                <i style={{ background: color(categoricalToken(i)) }} />
                {activity.activity}
                <span className="clock-count">{f0(activity.sessions)}</span>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <i style={{ background: color(categoricalToken(99)) }} />
                {m.charts.clock.legendOther(f0(rest))}
              </li>
            )}
          </ul>
        </div>
        <div>
          <h4>{m.charts.clock.keyRing}</h4>
          <ul>
            <li>
              <i style={{ background: color('--hi') }} />
              {m.charts.clock.legendAbove}
            </li>
            <li>
              <i style={{ background: color('--lo') }} />
              {m.charts.clock.legendBelow}
            </li>
            <li>
              <i className="hollow" style={{ borderColor: color('--muted') }} />
              {m.charts.clock.legendTooFew}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
