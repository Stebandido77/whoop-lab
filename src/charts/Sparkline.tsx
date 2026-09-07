import { useResolvedColor } from './primitives';

export interface SparklineProps {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
}

/** Decoration-free trend line for KPI cards. Renders nothing below two points. */
export function Sparkline({ values, color, width = 150, height = 30 }: SparklineProps) {
  const resolve = useResolvedColor();
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length < 2) return null;

  const lo = Math.min(...present);
  const span = Math.max(...present) - lo || 1;
  let path = '';
  let open = false;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      open = false;
      return;
    }
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - lo) / span) * (height - 4) - 2;
    path += `${open ? ' L' : ' M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    open = true;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      preserveAspectRatio="none"
      style={{ width: '100%', marginTop: 6 }}
      aria-hidden
    >
      <path
        d={path.trim()}
        fill="none"
        stroke={resolve(color)}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
