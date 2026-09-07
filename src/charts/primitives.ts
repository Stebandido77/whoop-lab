import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Any row a chart can plot. `day` is the x key; other metrics are looked up by
 * name at runtime. Deliberately *not* an index signature, so that `DayRecord`
 * and `WeekBucket` satisfy it without loosening their own types.
 */
export interface ChartDatum {
  day: string;
}

export const numeric = (d: ChartDatum, key: string): number | null => {
  const v = (d as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export type SeriesType = 'bar' | 'line' | 'area' | 'dots';

export interface Series {
  key: string;
  type: SeriesType;
  label: string;
  /** A CSS custom property name such as `--hi`, resolved at paint time. */
  color: string;
  /** Per-point colour, for things like recovery bands. Wins over `color`. */
  colorFor?: (value: number, datum: ChartDatum) => string;
  format?: (value: number | null) => string;
  width?: number;
  dash?: string;
  opacity?: number;
  radius?: number;
}

export interface GuideLine {
  value: number;
  color?: string;
}

/**
 * Charts are painted from CSS custom properties so that the light and dark
 * palettes stay in one file. SVG presentation attributes do not reliably accept
 * `var()`, so we resolve to a concrete colour and re-resolve when the theme
 * changes.
 */
export function useResolvedColor(): (token: string) => string {
  const [, bump] = useState(0);
  const cache = useRef(new Map<string, string>());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      cache.current.clear();
      bump((n) => n + 1);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return useCallback((token: string) => {
    if (!token.startsWith('--')) return token;
    const hit = cache.current.get(token);
    if (hit) return hit;
    const value =
      getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
    cache.current.set(token, value);
    return value;
  }, []);
}

/** Width of an element, tracked with ResizeObserver. Returns 0 before first paint. */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      setWidth((prev) => (Math.abs(prev - next) < 3 ? prev : next));
    });
    observer.observe(node);
    setWidth(Math.round(node.clientWidth));
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/** Round a domain outward to human-friendly ticks. */
export function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rough = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, step, ticks };
}

export interface TooltipState {
  x: number;
  y: number;
  html: React.ReactNode;
}

/** Keeps the tooltip inside the chart box instead of clipping at the right edge. */
export function tooltipStyle(state: TooltipState, boxWidth: number): React.CSSProperties {
  const estimated = 190;
  const left =
    state.x + 12 + estimated > boxWidth ? Math.max(4, state.x - estimated - 12) : state.x + 12;
  return { left, top: Math.max(0, state.y - 10) };
}

export const RECOVERY_BANDS = { low: 34, high: 67 } as const;

/** WHOOP's own recovery bands: red below 34, yellow to 66, green from 67. */
export const recoveryToken = (value: number | null): string =>
  value == null
    ? '--grid'
    : value < RECOVERY_BANDS.low
      ? '--lo'
      : value < RECOVERY_BANDS.high
        ? '--mid'
        : '--hi';
