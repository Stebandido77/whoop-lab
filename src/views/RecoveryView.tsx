import { useMemo } from 'react';
import { HBarChart, SpectrumChart, TimeSeriesChart, type SeriesMarker } from '@/charts';
import { Legend, Panel, PanelGrid } from '@/components';
import { bpm, f0, f1, f2, fmtDayShort, ms, pct, signed, weekdayName } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import {
  column,
  computeDrivers,
  hrvRegimeBreaks,
  rhrControlChart,
  rhythms,
  weekdayDeviation,
} from '@/lib/metrics';
import { mean } from '@/lib/stats';
import type { DayRecord } from '@/lib/whoop/types';

export function RecoveryView({ days }: { days: DayRecord[] }) {
  const m = useMessages();
  const drivers = computeDrivers(days);
  const weekdays = weekdayDeviation(days);
  const base = mean(column(days, 'recovery'));
  const breaks = useMemo(() => hrvRegimeBreaks(days), [days]);
  const control = useMemo(() => rhrControlChart(days), [days]);
  const spectra = useMemo(() => rhythms(days), [days]);

  const breakMarkers: SeriesMarker[] = breaks.ok
    ? breaks.points.map((p) => ({
        day: p.day,
        kind: 'break',
        label: fmtDayShort(p.day),
        color: p.delta > 0 ? '--hi' : '--lo',
      }))
    : [];
  const signalMarkers: SeriesMarker[] = control.ok
    ? control.signals.map((s) => ({ day: s.day, kind: s.side }))
    : [];

  return (
    <PanelGrid days={days}>
      <Panel span={12} title={m.recovery.baselineTitle} subtitle={m.recovery.baselineSubtitle}>
        <TimeSeriesChart
          data={days}
          height={230}
          formatY={ms}
          markers={breakMarkers}
          series={[
            {
              key: 'hrv',
              type: 'area',
              label: m.recovery.seriesHrv,
              color: '--hrv',
              width: 1.3,
              opacity: 0.55,
              format: ms,
            },
            {
              key: 'hrv28',
              type: 'line',
              label: m.recovery.seriesBase28,
              color: '--ink',
              width: 2,
              format: ms,
            },
          ]}
        />
        <Legend
          items={[
            { color: '--hrv', label: m.recovery.legendDailyHrv },
            { color: '--ink', label: m.recovery.legendBaseline28 },
            { color: '--hi', label: m.recovery.legendBreakUp },
            { color: '--lo', label: m.recovery.legendBreakDown },
          ]}
        />
        {!breaks.ok && (
          <p className="subtitle" style={{ margin: '8px 0 0' }}>
            {m.recovery.breaksMissing(f0(breaks.missing), f0(breaks.n), f0(breaks.minN))}
          </p>
        )}
        {breaks.ok && breaks.points.length === 0 && (
          <p className="subtitle" style={{ margin: '8px 0 0' }}>
            {m.recovery.breaksNone}
          </p>
        )}
      </Panel>

      <Panel span={6} title={m.recovery.zTitle} subtitle={m.recovery.zSubtitle}>
        <TimeSeriesChart
          data={days}
          height={200}
          formatY={f1}
          guides={[{ value: 0 }, { value: -1, color: '--lo' }, { value: 1, color: '--hi' }]}
          series={[
            {
              key: 'hrvZ',
              type: 'bar',
              label: m.recovery.zSeries,
              color: '--mid',
              colorFor: (v) => (v < -1 ? '--lo' : v > 1 ? '--hi' : '--mid'),
              format: f2,
            },
          ]}
        />
      </Panel>

      <Panel span={6} title={m.recovery.rhrTitle} subtitle={m.recovery.rhrSubtitle}>
        <TimeSeriesChart
          data={days}
          height={200}
          formatY={bpm}
          markers={signalMarkers}
          series={[
            {
              key: 'rhr',
              type: 'dots',
              label: m.recovery.seriesRhr,
              color: '--lo',
              radius: 2.2,
              opacity: 0.55,
              format: bpm,
            },
            {
              key: 'rhr7',
              type: 'line',
              label: m.recovery.seriesMean7,
              color: '--lo',
              width: 2,
              format: bpm,
            },
            {
              key: 'rhr28',
              type: 'line',
              label: m.recovery.seriesBase28,
              color: '--muted',
              width: 1.4,
              dash: '4 3',
              format: bpm,
            },
          ]}
        />
        <p className="subtitle" style={{ margin: '8px 0 0' }}>
          {!control.ok
            ? m.recovery.controlMissing(f0(control.missing), f0(control.n), f0(control.minN))
            : control.signals.length === 0
              ? m.recovery.controlNone(f0(control.h))
              : m.recovery.controlSignals(
                  control.signals.length,
                  f0(control.signals.length),
                  f0(control.n),
                )}
        </p>
      </Panel>

      <Panel span={6} title={m.recovery.driversTitle} subtitle={m.recovery.driversSubtitle}>
        <HBarChart
          diverging
          format={f2}
          rows={drivers.map((d) => ({
            label: m.recovery.drivers[d.id],
            value: d.r!,
            color: d.r! > 0 ? '--hi' : '--lo',
            note: `n=${f0(d.n)}`,
          }))}
        />
      </Panel>

      {spectra.map((r) => (
        <Panel
          key={r.key}
          span={6}
          title={m.recovery.rhythmTitle(m.recovery.rhythmSeries[r.key])}
          subtitle={m.recovery.rhythmSubtitle}
          state={r.spectrum}
          needs={[r.key]}
          what={m.recovery.periodogramWhat}
        >
          {r.spectrum.ok && (
            <>
              <SpectrumChart
                points={r.spectrum.points}
                threshold={r.spectrum.faLevel}
                color={r.key === 'hrv' ? '--hrv' : '--hi'}
                marks={[{ period: 7, label: m.recovery.weekMark, strong: r.weeklyIsReal }]}
              />
              <p className="subtitle" style={{ margin: '8px 0 0' }}>
                {r.spectrum.peak == null
                  ? m.recovery.noPeak
                  : r.spectrum.peak.power > r.spectrum.faLevel
                    ? m.recovery.peak(
                        f1(r.spectrum.peak.period),
                        r.q == null ? '—' : f2(r.q),
                        r.weeklyIsReal,
                      )
                    : m.recovery.noPeakOverThreshold(f1(r.spectrum.peak.period))}{' '}
                <span style={{ color: 'var(--muted)' }}>
                  {m.recovery.spectrumDays(f0(r.spectrum.n))}
                </span>
              </p>
            </>
          )}
        </Panel>
      ))}

      <Panel
        span={6}
        title={m.recovery.weekdayTitle}
        subtitle={m.recovery.weekdaySubtitle(pct(base))}
      >
        <HBarChart
          diverging
          format={(v) => signed(v, f1, ' pp')}
          rows={weekdays.map((w) => ({
            label: weekdayName(w.weekday),
            value: w.deviation,
            color: w.deviation > 0 ? '--hi' : '--lo',
            note: `(${f0(w.mean)}%)`,
          }))}
        />
      </Panel>
    </PanelGrid>
  );
}
