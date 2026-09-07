import type { ReactNode } from 'react';

export interface PanelProps {
  title?: string;
  subtitle?: ReactNode;
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  children: ReactNode;
}

export function Panel({ title, subtitle, span = 12, children }: PanelProps) {
  return (
    <section className={`panel span-${span}`}>
      {title && <h3>{title}</h3>}
      {subtitle && <p className="subtitle">{subtitle}</p>}
      {children}
    </section>
  );
}
