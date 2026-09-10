import { useMemo } from 'react';
import {
  ActivityHeatmap,
  BinScatterChart,
  HBarChart,
  HistogramChart,
  IrfChart,
  TimeSeriesChart,
} from '@/charts';
import { NotEnough, Panel, PanelGrid } from '@/components';
import { f0, f1, f2, hoursMinutes, pct, pRelation, signed } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import {
  activityWeekLoad,
  doseResponse,
  strainDistribution,
  strainImpulseResponse,
  summarizeActivities,
  zoneMinutes,
} from '@/lib/metrics';
import { byWeek } from '@/lib/whoop/model';
import type { DayRecord } from '@/lib/whoop/types';

const ZONE_COLORS = ['--wake', '--light', '--rem', '--mid', '--lo'];

export function TrainingView({ days }: { days: DayRecord[] }) {
  const m = useMessages();
  const activities = summarizeActivities(days);
  const zones = zoneMinutes(days);
  const irf = useMemo(() => strainImpulseResponse(days), [days]);
  const dose = useMemo(() => doseResponse(days, 'strain', 'recoveryNext'), [days]);
  const distribution = useMemo(() => strainDistribution(days), [days]);
  const weekLoad = useMemo(() => activityWeekLoad(days), [days]);
  const weeks = byWeek(days, ['workoutMinutes', 'workoutCount', 'strain']).map((w) => ({
    ...w,
    totalMinutes:
      (w.workoutMinutes as number | null) != null ? (w.workoutMinutes as number) * w.count : null,
  }));

  return (
    <PanelGrid days={days}>
      <Panel
        span={12}
        title={m.training.irfTitle}
        subtitle={m.training.irfSubtitle}
        state={irf}
        needs={['recovery', 'strain', 'sleepHours']}
        what={m.training.irfWhat}
      >
        {irf.ok && (
          <>
            <IrfChart
              points={irf.lags}
              label={m.training.irfLabel}
              format={(v) => signed(v, f2, ' pp')}
              color="--strain"
            />
            <div className="callout" style={{ marginTop: 10 }}>
              {m.training.cumulative(
                signed(irf.cumulative.coef, f2, ' pp'),
                f2(irf.cumulative.ciLow),
                f2(irf.cumulative.ciHigh),
              )}{' '}
              {irf.lastLagThatBites == null
                ? m.training.noLagBites
                : m.training.lastLagBites(
                    irf.lastLagThatBites,
                    m.common.days(irf.lastLagThatBites),
                  )}{' '}
              <span style={{ color: 'var(--muted)' }}>
                {m.training.irfFooter(f0(irf.n), f0(irf.bandwidth), f2(irf.r2))}
              </span>
            </div>
          </>
        )}
      </Panel>

      <Panel
        span={12}
        title={m.training.distributionTitle}
        subtitle={m.training.distributionSubtitle}
        state={distribution}
        needs={['strain']}
        what={m.training.distributionWhat}
      >
        {distribution.ok && (
          <>
            <HistogramChart
              bins={distribution.bins}
              density={distribution.density}
              peaks={distribution.modality.ok ? distribution.modality.peaks : []}
              antimode={distribution.modality.ok ? distribution.modality.antimode : null}
              xLabel={m.training.distributionAxis}
              formatX={f1}
              color="--strain"
              height={280}
            />
            {distribution.modality.ok ? (
              <>
                <div className="callout" style={{ marginTop: 12 }}>
                  {distribution.modality.p < 0.05 && distribution.modality.antimode
                    ? m.training.bimodal(
                        f1(
                          Math.min(
                            ...distribution.modality.peaks.slice(0, 2).map((peak) => peak.x),
                          ),
                        ),
                        f1(
                          Math.max(
                            ...distribution.modality.peaks.slice(0, 2).map((peak) => peak.x),
                          ),
                        ),
                        pRelation(distribution.modality.p),
                        f0((distribution.modality.separation ?? 0) * 100),
                      )
                    : m.training.unimodal(pRelation(distribution.modality.p))}
                </div>
                <p className="subtitle" style={{ margin: '8px 0 0' }}>
                  {m.training.modalityShort(
                    distribution.modality.modes,
                    pRelation(distribution.modality.p),
                  )}{' '}
                  ·{' '}
                  {m.training.modalityBandwidth(
                    f2(distribution.modality.ruleOfThumbBandwidth),
                    f2(distribution.modality.criticalBandwidth),
                  )}
                </p>
              </>
            ) : (
              <p className="subtitle" style={{ margin: '10px 0 0' }}>
                <NotEnough state={distribution.modality} what={m.training.distributionWhat} />
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        span={12}
        title={m.training.doseTitle}
        subtitle={m.training.doseSubtitle}
        state={dose}
        needs={['strain', 'recovery']}
        what={m.training.doseWhat}
      >
        {dose.ok && (
          <>
            <BinScatterChart
              points={dose.points}
              xLabel={m.training.doseX}
              yLabel={m.training.doseY}
              formatY={pct}
              formatX={f1}
              color="--strain"
              height={300}
            />
            {dose.gaps.widest && (
              <p className="callout" style={{ margin: '12px 0 0' }}>
                {m.common.supportGap(
                  f1(dose.gaps.widest.from),
                  f1(dose.gaps.widest.to),
                  f0(dose.gaps.widest.share * 100),
                )}
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        span={12}
        title={m.training.heatmapTitle}
        subtitle={m.training.heatmapSubtitle}
        state={weekLoad}
        needs={['strain', 'workoutCount']}
        what={m.training.heatmapWhat}
      >
        {weekLoad.ok && (
          <>
            <ActivityHeatmap data={weekLoad} />
            {weekLoad.hidden.activities > 0 && (
              <p className="subtitle" style={{ margin: '10px 0 0' }}>
                {m.training.heatmapHidden(
                  f0(weekLoad.hidden.activities),
                  f1(weekLoad.hidden.strain),
                )}
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel span={12} title={m.training.acwrTitle} subtitle={m.training.acwrSubtitle}>
        <TimeSeriesChart
          data={days}
          height={210}
          formatY={f2}
          guides={[
            { value: 1.3, color: '--lo' },
            { value: 0.8, color: '--mid' },
          ]}
          series={[
            { key: 'acwr', type: 'line', label: 'ACWR', color: '--strain', width: 2, format: f2 },
          ]}
        />
      </Panel>

      <Panel span={7} title={m.training.strainTitle}>
        <TimeSeriesChart
          data={days}
          height={210}
          formatY={f1}
          series={[
            {
              key: 'strain',
              type: 'bar',
              label: m.training.strainSeries,
              color: '--strain',
              opacity: 0.55,
              format: f1,
            },
            {
              key: 'strain7',
              type: 'line',
              label: m.training.mean7,
              color: '--ink',
              width: 1.9,
              format: f2,
            },
          ]}
        />
      </Panel>

      <Panel span={5} title={m.training.activitiesTitle}>
        {activities.length === 0 ? (
          <p className="empty">{m.training.activitiesEmpty}</p>
        ) : (
          <div className="table-box">
            <table>
              <thead>
                <tr>
                  <th>{m.training.colActivity}</th>
                  <th className="num">{m.training.colSessions}</th>
                  <th className="num">{m.training.colTime}</th>
                  <th className="num">{m.training.colMeanStrain}</th>
                  <th className="num">{m.training.colMeanHr}</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.activity}>
                    <td>{a.activity}</td>
                    <td className="num">{f0(a.sessions)}</td>
                    <td className="num">{hoursMinutes(a.minutes)}</td>
                    <td className="num">{f1(a.meanStrain)}</td>
                    <td className="num">{f0(a.meanHr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel span={6} title={m.training.zonesTitle} subtitle={m.training.zonesSubtitle}>
        <HBarChart
          format={hoursMinutes}
          rows={zones.map((minutes, i) => ({
            label: m.training.zone(i + 1),
            value: minutes,
            color: ZONE_COLORS[i],
          }))}
        />
      </Panel>

      <Panel span={6} title={m.training.volumeTitle} subtitle={m.training.volumeSubtitle}>
        <TimeSeriesChart
          data={weeks}
          height={210}
          formatY={(v) => `${f0((v ?? 0) / 60)}h`}
          series={[
            {
              key: 'totalMinutes',
              type: 'bar',
              label: m.training.volumeSeries,
              color: '--strain',
              format: hoursMinutes,
            },
          ]}
        />
      </Panel>
    </PanelGrid>
  );
}
