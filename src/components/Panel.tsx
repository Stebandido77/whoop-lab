import type { ReactNode } from 'react';
import type { Insufficient } from '@/lib/econ';
import { PanelOff } from './PanelOff';
import type { FieldId } from '@/lib/fields';

export type PanelSpan = number;

/** Anything an estimator returns: a result that worked, or one that switched off. */
export type PanelState = { ok: true } | Insufficient;

export interface PanelProps {
  title?: string;
  subtitle?: ReactNode;
  /** Columns out of twelve the panel asks for. `PanelGrid` decides what it gets. */
  span?: PanelSpan;
  /**
   * When this is an `Insufficient`, the panel draws its off state instead of
   * `children` and stops reserving the height of the chart it cannot draw.
   */
  state?: PanelState;
  /** Fields the estimate would have used, for the off state's descriptives. */
  needs?: FieldId[];
  /** What the panel is estimating, for the off state's first line. */
  what?: string;
  /** Extra content for the off state, below the diagnosis. */
  offExtra?: ReactNode;
  /** Set by `PanelGrid`. A view never passes this. */
  resolvedSpan?: PanelSpan;
  children?: ReactNode;
}

export function Panel({
  title,
  subtitle,
  span = 12,
  state,
  needs,
  what,
  offExtra,
  resolvedSpan,
  children,
}: PanelProps) {
  const off = state?.ok === false;
  return (
    <section
      className={`panel grid-panel${off ? ' off' : ''}`}
      style={{ ['--span' as string]: resolvedSpan ?? span }}
    >
      {title && <h3>{title}</h3>}
      {subtitle && <p className="subtitle">{subtitle}</p>}
      {off ? (
        <PanelOff state={state as Insufficient} needs={needs} what={what} extra={offExtra} />
      ) : (
        children
      )}
    </section>
  );
}
