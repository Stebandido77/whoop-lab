import { useMemo, useState } from 'react';
import { CoefficientPlot, HBarChart } from '@/charts';
import { NotEnough, Panel, Segmented } from '@/components';
import { f0, f1, f2, pct, signed } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import { adjustedHabitEffects, habitEffects } from '@/lib/metrics';
import type { DayRecord } from '@/lib/whoop/types';

type Alignment = 'recovery' | 'recoveryNext';

export function HabitsView({ days, questions }: { days: DayRecord[]; questions: string[] }) {
  const m = useMessages();
  const [alignment, setAlignment] = useState<Alignment>('recovery');
  const effects = useMemo(
    () => habitEffects(days, questions, alignment),
    [days, questions, alignment],
  );
  const adjusted = useMemo(
    () => adjustedHabitEffects(days, questions, { target: alignment }),
    [days, questions, alignment],
  );

  if (!questions.length) {
    return <p className="callout">{m.habits.noJournal}</p>;
  }

  return (
    <div className="grid">
      <div style={{ gridColumn: 'span 12' }}>
        <Segmented
          options={[
            { value: 'recovery' as Alignment, label: m.habits.alignmentSameDay },
            { value: 'recoveryNext' as Alignment, label: m.habits.alignmentNextDay },
          ]}
          value={alignment}
          onChange={setAlignment}
          ariaLabel={m.habits.alignmentAria}
        />
      </div>

      <Panel span={12} title={m.habits.adjustedTitle} subtitle={m.habits.adjustedSubtitle}>
        {adjusted.ok ? (
          <>
            <CoefficientPlot
              unit="pp"
              format={(v) => signed(v, f1)}
              rows={adjusted.habits.map((h) => ({
                label: h.shortLabel,
                coef: h.coef,
                se: h.se,
                ciLow: h.ciLow,
                ciHigh: h.ciHigh,
                p: h.p,
                q: h.q,
                n: h.nYes + h.nNo,
                color: h.coef > 0 ? '--hi' : '--lo',
              }))}
            />
            <p className="subtitle" style={{ margin: '10px 0 0' }}>
              {m.habits.fitFooter(
                f0(adjusted.n),
                f0(adjusted.fit.k),
                f2(adjusted.fit.r2Adjusted),
                f0(adjusted.fit.bandwidth),
              )}
              {adjusted.skipped.length > 0 && m.habits.skipped(adjusted.skipped.length)}
            </p>
          </>
        ) : (
          <NotEnough state={adjusted} what={m.habits.adjustedWhat} />
        )}
      </Panel>

      <Panel span={12} title={m.habits.rawTitle} subtitle={m.habits.rawSubtitle}>
        <HBarChart
          diverging
          format={(v) => signed(v, f1, ' pp')}
          emptyMessage={m.habits.rawEmpty}
          rows={effects.slice(0, 14).map((e) => ({
            label: e.shortLabel,
            value: e.delta,
            color: e.delta > 0 ? '--hi' : '--lo',
          }))}
        />
      </Panel>

      {effects.length > 0 && (
        <Panel span={12} title={m.habits.detailTitle} subtitle={m.habits.detailSubtitle}>
          <div className="table-box scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{m.habits.colQuestion}</th>
                  <th className="num">{m.habits.colYes}</th>
                  <th className="num">{m.habits.colNo}</th>
                  <th className="num">{m.habits.colRawDelta}</th>
                  <th className="num">{m.habits.colAdjustedDelta}</th>
                  <th className="num">{m.habits.colQ}</th>
                  <th className="num">{m.habits.colN}</th>
                </tr>
              </thead>
              <tbody>
                {effects.map((e) => {
                  const model = adjusted.ok
                    ? adjusted.habits.find((h) => h.question === e.question)
                    : undefined;
                  return (
                    <tr key={e.question}>
                      <td>{e.question}</td>
                      <td className="num">{pct(e.meanYes)}</td>
                      <td className="num">{pct(e.meanNo)}</td>
                      <td
                        className="num"
                        style={{ color: e.delta > 0 ? 'var(--hi)' : 'var(--lo)' }}
                      >
                        {signed(e.delta)}
                      </td>
                      <td className="num">{model ? signed(model.coef) : '—'}</td>
                      <td className="num">{model?.q == null ? '—' : f2(model.q)}</td>
                      <td className="num">
                        {f0(e.nYes)} / {f0(e.nNo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
