import { useResolvedColor } from '@/charts';

export interface LegendItem {
  color: string;
  label: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  const resolve = useResolvedColor();
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: resolve(item.color) }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
