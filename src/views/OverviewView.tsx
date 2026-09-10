import { useMemo } from 'react';
import {
  BinScatterChart,
  CalendarHeatmap,
  CircadianClock,
  recoveryToken,
  TimeSeriesChart,
} from '@/charts';
import { KpiCard, Legend, Panel, PanelGrid } from '@/components';
import { f0, f1, f2, fmtDayLong, hoursMinutes, pct, signed, weekdayName } from '@/lib/format';
import type { RatioProblem } from '@/lib/econ';
import { useMessages, type Messages } from '@/lib/i18n';
import {
  adjustedHabitEffects,
  circadianClock,
  column,
  doseResponse,
  periodValue,
  recoveryElasticities,
  type ElasticitiesResult,
} from '@/lib/metrics';
import { mean, pearson, sd } from '@/lib/stats';
import type { DayRecord } from '@/lib/whoop/types';

export function OverviewView({
  days,
  previous,
  questions,
}: {
  days: DayRecord[];
  previous: DayRecord[];
  questions: string[];
}) {
  const m = useMessages();
  const elasticities = useMemo(
    () => recoveryElasticities(adjustedHabitEffects(days, questions)),
    [days, questions],
  );
  const latest = [...days].reverse().find((d) => d.recovery != null) ?? days[days.length - 1];
  const recovery = periodValue(days, previous, 'recovery');
  const hrv = periodValue(days, previous, 'hrv');
  const rhr = periodValue(days, previous, 'rhr');
  const sleep = periodValue(days, previous, 'sleepHours');
  const strainVsNext = pearson(column(days, 'strain'), column(days, 'recoveryNext'));
  const strainDose = useMemo(() => doseResponse(days, 'strain', 'recoveryNext'), [days]);
  const clock = useMemo(() => circadianClock(days), [days]);

  return (
    <PanelGrid days={days}>
      <Panel span={12}>
        <div className="hero">
          <div className="rail">
            <div>
              <span className="label" style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                {m.overview.lastRecovery} · {fmtDayLong(latest.day)}
              </span>
              <div className="big" style={{ color: `var(${recoveryToken(latest.recovery)})` }}>
                {latest.recovery == null ? '—' : f0(latest.recovery)}
                <em>%</em>
              </div>
            </div>
            <div>
              <div className="row">
                <span>{m.overview.hrv}</span>
                <span>{f0(latest.hrv)} ms</span>
              </div>
              <div className="row">
                <span>{m.overview.rhr}</span>
                <span>{f0(latest.rhr)} bpm</span>
              </div>
              <div className="row">
                <span>{m.overview.sleep}</span>
                <span>{hoursMinutes(latest.asleep)}</span>
              </div>
              <div className="row">
                <span>{m.overview.strain}</span>
                <span>{f1(latest.strain)}</span>
              </div>
            </div>
          </div>
          <div>
            <h3>{m.overview.heroTitle}</h3>
            <p className="subtitle">{m.overview.heroSubtitle}</p>
            <TimeSeriesChart
              data={days}
              height={206}
              yMin={0}
              yMax={100}
              formatY={pct}
              guides={[
                { value: 34, color: '--lo' },
                { value: 67, color: '--hi' },
              ]}
              series={[
                {
                  key: 'recovery',
                  type: 'bar',
                  label: m.overview.seriesRecovery,
                  color: '--hi',
                  colorFor: (v) => recoveryToken(v),
                  format: pct,
                },
                {
                  key: 'recovery7',
                  type: 'line',
                  label: m.overview.seriesMean7,
                  color: '--ink',
                  width: 1.8,
                  format: pct,
                },
              ]}
            />
          </div>
        </div>
      </Panel>

      <div className="grid span-12 kpi-row" style={{ gridColumn: 'span 12' }}>
        <KpiCard
          label={m.overview.kpiRecovery}
          value={f0(recovery.value)}
          unit="%"
          delta={recovery.delta}
          deltaUnit="pp"
          trend={column(days, 'recovery7')}
          trendColor="--hi"
        />
        <KpiCard
          label={m.overview.kpiHrv}
          value={f0(hrv.value)}
          unit="ms"
          delta={hrv.delta}
          deltaUnit="ms"
          trend={column(days, 'hrv7')}
          trendColor="--hrv"
        />
        <KpiCard
          label={m.overview.kpiRhr}
          value={f0(rhr.value)}
          unit="bpm"
          delta={rhr.delta}
          deltaUnit="bpm"
          direction={-1}
          trend={column(days, 'rhr7')}
          trendColor="--lo"
        />
        <KpiCard
          label={m.overview.kpiSleep}
          value={f1(sleep.value)}
          unit="h"
          delta={sleep.delta}
          deltaUnit="h"
          trend={column(days, 'sleepHours')}
          trendColor="--sleep"
        />
      </div>

      <Panel
        span={12}
        title={m.overview.clockTitle}
        subtitle={m.overview.clockSubtitle}
        state={clock}
        needs={['bedtime', 'wakeTime', 'strain', 'recovery']}
        what={m.overview.clockWhat}
      >
        {clock.ok && (
          <>
            <CircadianClock data={clock} />
            <p className="callout" style={{ margin: '12px 0 0' }}>
              {m.overview.clockRingCaveat(pct(clock.meanRecovery))}
            </p>
          </>
        )}
      </Panel>

      <Panel span={12} title={m.overview.calendarTitle} subtitle={m.overview.calendarSubtitle}>
        <CalendarHeatmap
          data={days}
          metric="recovery"
          label={m.overview.seriesRecovery}
          colorFor={recoveryToken}
          format={pct}
        />
        <Legend
          items={[
            { color: '--lo', label: '< 34%' },
            { color: '--mid', label: '34–66%' },
            { color: '--hi', label: '≥ 67%' },
            { color: '--grid', label: m.common.noData },
          ]}
        />
      </Panel>

      <Panel
        span={7}
        title={m.overview.scatterTitle}
        subtitle={m.overview.scatterSubtitle}
        state={strainDose}
        needs={['strain', 'recovery']}
        what={m.overview.scatterWhat}
      >
        {strainDose.ok && (
          <>
            <BinScatterChart
              points={strainDose.points}
              height={270}
              xLabel={m.overview.scatterX}
              yLabel={m.overview.scatterY}
              formatY={pct}
              formatX={f1}
              color="--strain"
            />
            <p className="subtitle" style={{ margin: '10px 0 0' }}>
              {m.overview.correlation(f2(strainVsNext.r), f0(strainVsNext.n))}
            </p>
            {strainDose.gaps.widest && (
              <p className="callout" style={{ margin: '12px 0 0' }}>
                {m.common.supportGap(
                  f1(strainDose.gaps.widest.from),
                  f1(strainDose.gaps.widest.to),
                  f0(strainDose.gaps.widest.share * 100),
                )}
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        span={12}
        title={m.overview.elasticitiesTitle}
        subtitle={m.overview.elasticitiesSubtitle}
        state={elasticities}
        needs={['recovery', 'sleepHours', 'strain', 'bedtime']}
        what={m.overview.elasticitiesWhat}
      >
        {elasticities.ok && <Elasticities result={elasticities} />}
      </Panel>

      <Panel span={5} title={m.overview.highlightsTitle} subtitle={m.overview.highlightsSubtitle}>
        <Highlights days={days} />
      </Panel>
    </PanelGrid>
  );
}

/**
 * Marginal effects and the rate at which one buys back the other. The ratio is
 * the interesting number and the fragile one: it is only defined while its
 * denominator is, so the card says so rather than printing a figure whose
 * confidence set is really the whole number line.
 */
function Elasticities({ result }: { result: Extract<ElasticitiesResult, { ok: true }> }) {
  const m = useMessages();
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>{m.overview.colMarginalEffect}</th>
            <th className="num">{m.overview.colPp}</th>
            <th className="num">{m.overview.colCi95}</th>
            <th className="num">{m.overview.colQ}</th>
          </tr>
        </thead>
        <tbody>
          {result.terms.map((t) => (
            <tr key={t.id}>
              <td>{m.overview.elasticity[t.id]}</td>
              <td
                className="num"
                style={{ color: t.coef > 0 ? 'var(--hi)' : 'var(--lo)', fontWeight: 500 }}
              >
                {signed(t.coef, f2)}
              </td>
              <td className="num" style={{ color: 'var(--muted)' }}>
                {m.overview.ciRange(f2(t.ciLow), f2(t.ciHigh))}
              </td>
              <td className="num">{t.q == null ? '—' : f2(t.q)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="callout" style={{ marginTop: 12 }}>
        {result.substitution.identified
          ? m.overview.substitution(
              f2(Math.abs(result.substitution.coef)),
              f2(Math.min(result.substitution.ciLow, result.substitution.ciHigh)),
              f2(Math.max(result.substitution.ciLow, result.substitution.ciHigh)),
              f0(result.n),
            )
          : m.overview.substitutionUnidentified(ratioReason(m, result.substitution.problem))}
      </div>
    </>
  );
}

const ratioReason = (m: Messages, problem: RatioProblem): string =>
  problem.code === 'missing-term'
    ? m.overview.ratioMissingTerm
    : m.overview.ratioDenominatorZero(problem.name);

function Highlights({ days }: { days: DayRecord[] }) {
  const m = useMessages();
  const h = m.overview.highlights;
  const withRecovery = days.filter((d) => d.recovery != null);
  const rows: [string, string][] = [];

  if (withRecovery.length > 6) {
    const best = withRecovery.reduce((a, b) => (b.recovery! > a.recovery! ? b : a));
    const worst = withRecovery.reduce((a, b) => (b.recovery! < a.recovery! ? b : a));
    rows.push([
      h.bestWorst,
      h.bestWorstValue(
        pct(best.recovery),
        fmtDayLong(best.day),
        pct(worst.recovery),
        fmtDayLong(worst.day),
      ),
    ]);
    const green = withRecovery.filter((d) => d.recovery! >= 67).length;
    const red = withRecovery.filter((d) => d.recovery! < 34).length;
    rows.push([
      h.split,
      h.splitValue(f0((100 * green) / withRecovery.length), f0((100 * red) / withRecovery.length)),
    ]);
  }

  const perWeekday = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => ({ i, value: mean(days.filter((d) => d.weekday === i).map((d) => d.recovery)) }))
    .filter((x): x is { i: number; value: number } => x.value != null);
  if (perWeekday.length === 7) {
    const best = perWeekday.reduce((a, b) => (b.value > a.value ? b : a));
    const worst = perWeekday.reduce((a, b) => (b.value < a.value ? b : a));
    rows.push([
      h.weekday,
      h.weekdayValue(weekdayName(best.i), pct(best.value), weekdayName(worst.i), pct(worst.value)),
    ]);
  }

  const sleepVsRecovery = pearson(column(days, 'sleepHours'), column(days, 'recovery'));
  if (sleepVsRecovery.r != null) {
    const slope =
      (sleepVsRecovery.r * (sd(column(days, 'recovery')) ?? 0)) /
      (sd(column(days, 'sleepHours')) || 1);
    rows.push([
      h.sleepRecovery,
      h.sleepRecoveryValue(f2(sleepVsRecovery.r), f0(sleepVsRecovery.n), f1(slope)),
    ]);
  }

  const consistency = mean(column(days, 'sleepConsistency'));
  if (consistency != null) rows.push([h.consistency, h.consistencyValue(f0(consistency))]);

  const debt = mean(column(days, 'sleepDebt'));
  if (debt != null) rows.push([h.debt, hoursMinutes(debt)]);

  const acwr = [...days].reverse().find((d) => d.acwr != null)?.acwr;
  if (acwr != null) {
    const verdict = acwr > 1.35 ? h.acwrRising : acwr < 0.8 ? h.acwrFalling : h.acwrStable;
    rows.push([h.acwr, h.acwrValue(f2(acwr), verdict)]);
  }

  return (
    <table>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={{ color: 'var(--muted)', width: '42%' }}>{label}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
