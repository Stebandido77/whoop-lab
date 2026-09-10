import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { DayRecord } from '@/lib/whoop/types';
import { Panel, type PanelProps, type PanelSpan } from './Panel';
import { COLUMNS, DaysContext, resolveSpans } from './panelLayout';

const isPanel = (node: ReactNode): node is ReactElement<PanelProps> =>
  isValidElement(node) && node.type === Panel;

export interface PanelGridProps {
  /** Rows behind these panels, for what a switched-off one can still report. */
  days?: DayRecord[];
  children: ReactNode;
}

/**
 * The grid every view lays its panels out in.
 *
 * Views go on declaring `<Panel span={7}>` exactly as before; this resolves what
 * the span actually becomes, so the rule that no state may leave a hole lives in
 * one file rather than in seven. Anything that is not a `<Panel>` — the KPI row —
 * is passed through untouched: it brings its own full-width class and has no off
 * state to reason about.
 *
 * It reads its children's props rather than taking a list of panel descriptors.
 * The descriptor version was the other candidate and it loses something real: a
 * panel body is JSX that narrows on its own result (`{dose.ok && <Chart …/>}`),
 * and moving those bodies into data objects turns every one of them into a
 * thunk or a cast. The cost is that a panel has to be a direct child — a
 * component that hides a `<Panel>` inside itself is invisible here.
 */
export function PanelGrid({ days = [], children }: PanelGridProps) {
  const nodes = Children.toArray(children);
  const spans = resolveSpans(
    nodes.map((node) =>
      isPanel(node)
        ? { desired: node.props.span ?? COLUMNS, off: node.props.state?.ok === false }
        : { desired: COLUMNS, off: false },
    ),
  );

  return (
    <DaysContext.Provider value={days}>
      <div className="grid">
        {nodes.map((node, index) =>
          isPanel(node) ? cloneElement(node, { resolvedSpan: spans[index] as PanelSpan }) : node,
        )}
      </div>
    </DaysContext.Provider>
  );
}
