import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Insufficient } from '@/lib/econ';
import type { FieldId } from '@/lib/fields';
import { f0, f1, fmtDayLong, sig } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import { bindingVariable, describeVariables, forecastSwitchOn } from '@/lib/metrics';
import { useStore } from '@/state/store';
import { usePanelDays } from './panelLayout';

export interface PanelOffProps {
  state: Insufficient;
  /** Fields the estimate would have used. Without them there are no descriptives. */
  needs?: FieldId[];
  what?: string;
  /** Anything the panel wants to add below the diagnosis. */
  extra?: ReactNode;
}

/**
 * What a panel shows instead of an estimate it cannot support.
 *
 * The old version of this was two centred lines in a box the height of the
 * missing chart, which reads as a layout failure rather than as a decision. The
 * count was right and it was not enough: «94 days short» tells a reader the size
 * of the wait but nothing about whether the wait is the real problem, and it
 * leaves the most useful thing unsaid — that plenty *can* be computed from the
 * rows already there, just not this.
 *
 * So the space says three things instead of one. How far along the sample is.
 * When it arrives, or why it will not arrive at this range. And the means and
 * spreads of the variables the estimate would have used, which need no minimum
 * and are true today.
 */
export function PanelOff({ state, needs, what, extra }: PanelOffProps) {
  const m = useMessages();
  const days = usePanelDays();
  const range = useStore((s) => s.range);
  const totalDays = useStore((s) => s.allDays.length);

  const progress = state.minN > 0 ? Math.min(1, state.n / state.minN) : 0;

  const forecast = useMemo(
    () =>
      forecastSwitchOn({
        missing: state.missing,
        minN: state.minN,
        range,
        totalDays,
      }),
    [state.missing, state.minN, range, totalDays],
  );

  const summaries = useMemo(
    () => (needs?.length ? describeVariables(days, needs) : []),
    [days, needs],
  );
  const binding = useMemo(
    () => (needs?.length ? bindingVariable(days, needs, state.minN) : null),
    [days, needs, state.minN],
  );

  return (
    <div className="off-state">
      <p className="off-headline">{m.common.offHeadline(what ?? m.common.thisModel)}</p>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={state.n}
        aria-valuemin={0}
        aria-valuemax={state.minN}
      >
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="off-count">
        {m.common.offProgress(f0(state.n), f0(state.minN), f0(Math.round(progress * 100)))}
      </p>

      <p className="off-forecast">
        {forecast.kind === 'date'
          ? m.common.offForecastDate(fmtDayLong(forecast.day), f0(forecast.missing))
          : forecast.kind === 'range'
            ? m.common.offForecastRange(f0(forecast.minN))
            : m.common.offForecastWindow}
      </p>

      {binding && (
        <p className="off-binding">
          {binding.decisive
            ? m.common.offBindingDecisive(m.fields[binding.id], f0(binding.without))
            : m.common.offBinding(m.fields[binding.id], f0(binding.without), f0(binding.current))}
        </p>
      )}

      {summaries.length > 0 && (
        <>
          <p className="off-meanwhile">{m.common.offMeanwhile}</p>
          <table className="off-table">
            <thead>
              <tr>
                <th>{m.common.offVariable}</th>
                <th className="num">{m.common.offN}</th>
                <th className="num">{m.common.offMissing}</th>
                <th className="num">{m.common.offMean}</th>
                <th className="num">{m.common.offSd}</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((variable) => (
                <tr key={variable.id}>
                  <td>{m.fields[variable.id]}</td>
                  <td className="num">{f0(variable.n)}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>
                    {variable.missing === 0 ? '—' : f0(variable.missing)}
                  </td>
                  <td className="num">{sig(variable.mean)}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>
                    {variable.sd == null ? '—' : f1(variable.sd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {extra}
    </div>
  );
}
