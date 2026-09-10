import { useEffect, useMemo, useState } from 'react';
import { BinScatterChart } from '@/charts';
import { NotEnough, Panel } from '@/components';
import { f0, f1, f2, pValue, sig, signed } from '@/lib/format';
import { useMessages, type Messages } from '@/lib/i18n';
import { FIELD_GROUPS, FIELDS, fieldSpec, type FieldId } from '@/lib/fields';
import {
  ABSOLUTE_MIN_N,
  DEFAULT_SPECIFICATION,
  describeSpecification,
  isRunnable,
  loadPresets,
  MAX_LAG,
  OBSERVATIONS_PER_PARAMETER,
  presetId,
  runSpecification,
  savePresets,
  type Preset,
  type Specification,
  type TermSpec,
} from '@/lib/explorer';
import { useStore } from '@/state/store';
import type { DayRecord } from '@/lib/whoop/types';

const LAGS = Array.from({ length: MAX_LAG + 1 }, (_, i) => i);

export function ModelsView({ days }: { days: DayRecord[] }) {
  const m = useMessages();
  const [spec, setSpec] = useState<Specification>(DEFAULT_SPECIFICATION);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');

  const modelFamily = useStore((s) => s.modelFamily);
  const recordModelRun = useStore((s) => s.recordModelRun);
  const clearModelFamily = useStore((s) => s.clearModelFamily);

  useEffect(() => {
    let cancelled = false;
    void loadPresets().then((list) => {
      if (!cancelled) setPresets(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runnable = isRunnable(spec);
  const result = useMemo(
    () => (runnable ? runSpecification(days, spec, modelFamily) : null),
    [days, spec, modelFamily, runnable],
  );

  // The family is recorded after the fact, but the q values above were already
  // computed against it plus this run — `runSpecification` merges the current
  // tests in itself, so the table never shows a q that ignores the model it
  // sits under. The store de-duplicates by specification key, which is what
  // keeps this from looping.
  const key = result?.ok ? result.key : null;
  const tests = result?.ok ? result.tests : null;
  useEffect(() => {
    if (key && tests) recordModelRun(key, tests);
  }, [key, tests, recordModelRun]);

  async function persist(next: Preset[]) {
    setPresets(next);
    await savePresets(next);
  }

  const label = (id: FieldId) => m.models.fields[id];
  const termLabel = (t: TermSpec) =>
    t.lag === 0 ? label(t.field) : `${label(t.field)} (${m.models.lagDays(t.lag)})`;

  return (
    <div className="grid">
      <Panel span={12} title={m.models.title} subtitle={m.models.subtitle}>
        <Builder spec={spec} onChange={setSpec} m={m} />
      </Panel>

      <Panel span={12} title={m.models.familyTitle}>
        <p className="callout" style={{ marginBottom: 10 }}>
          {m.models.family(
            result?.ok
              ? result.family.specifications
              : new Set(modelFamily.map((t) => t.spec)).size,
            result?.ok ? result.family.tests : modelFamily.length,
          )}
        </p>
        <button type="button" className="ghost" onClick={clearModelFamily}>
          {m.models.familyReset}
        </button>
      </Panel>

      <Panel span={12} title={m.models.resultsTitle}>
        {!runnable ? (
          <p className="empty">{m.models.needRegressor}</p>
        ) : !result?.ok ? (
          <>
            <NotEnough state={result!} what={m.models.insufficientWhat} />
            <p className="subtitle" style={{ margin: '10px 0 0' }}>
              {m.models.guard(f0(OBSERVATIONS_PER_PARAMETER), f0(ABSOLUTE_MIN_N))}
            </p>
          </>
        ) : (
          <>
            <div className="table-box scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>{m.models.colTerm}</th>
                    <th>{m.models.colRole}</th>
                    <th className="num">{m.models.colCoef}</th>
                    <th className="num">{m.models.colCi}</th>
                    <th className="num">{m.models.colSe}</th>
                    <th className="num">{m.models.colP}</th>
                    <th className="num">{m.models.colQ}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.terms.map((term) => (
                    <tr key={`${term.field}@${term.lag}`}>
                      <td>{termLabel(term)}</td>
                      <td style={{ color: 'var(--muted)' }}>
                        {term.role === 'regressor' ? m.models.roleRegressor : m.models.roleControl}
                      </td>
                      <td
                        className="num"
                        style={{
                          color: term.coef > 0 ? 'var(--hi)' : 'var(--lo)',
                          fontWeight: term.role === 'regressor' ? 500 : 400,
                        }}
                      >
                        {signed(term.coef, sig)}
                      </td>
                      <td className="num" style={{ color: 'var(--muted)' }}>
                        {m.models.ci95(sig(term.ciLow), sig(term.ciHigh))}
                      </td>
                      <td className="num" style={{ color: 'var(--muted)' }}>
                        {sig(term.se)}
                      </td>
                      <td className="num">{pValue(term.p)}</td>
                      <td className="num" style={{ fontWeight: 500 }}>
                        {pValue(term.q)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="subtitle" style={{ margin: '10px 0 0' }}>
              {m.models.fitFooter(
                f0(result.n),
                f0(result.k),
                f2(result.fit.r2Adjusted),
                f0(result.fit.bandwidth),
              )}{' '}
              · {m.models.perParameter(f1(result.density))}
              {result.dropped.length > 0 && (
                <> · {m.models.dropped(result.dropped.map(termLabel).join(', '))}</>
              )}
              <br />
              {m.models.coefficientUnit(
                m.models.units[fieldSpec(spec.dependent).unit],
                label(spec.dependent),
              )}
            </p>
          </>
        )}
      </Panel>

      {result?.ok && (
        <Panel
          span={12}
          title={m.models.scatterTitle(termLabel(result.scatter.term), label(spec.dependent))}
          subtitle={m.models.scatterSubtitle}
        >
          <BinScatterChart
            points={result.scatter.points}
            xLabel={termLabel(result.scatter.term)}
            yLabel={label(spec.dependent)}
            formatX={f1}
            formatY={f1}
            color="--strain"
            height={300}
          />
          {result.gaps.widest && (
            <p className="callout" style={{ margin: '12px 0 0' }}>
              {m.common.supportGap(
                f1(result.gaps.widest.from),
                f1(result.gaps.widest.to),
                f0(result.gaps.widest.share * 100),
              )}
            </p>
          )}
        </Panel>
      )}

      <Panel span={12} title={m.models.presetsTitle}>
        <div className="controls" style={{ marginBottom: 10 }}>
          <input
            type="text"
            className="text-input"
            value={presetName}
            maxLength={60}
            placeholder={describeSpecification(spec)}
            aria-label={m.models.presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button
            type="button"
            disabled={!runnable}
            onClick={() =>
              void persist([
                {
                  id: presetId(),
                  name: presetName.trim() || describeSpecification(spec),
                  spec,
                  savedAt: Date.now(),
                },
                ...presets,
              ]).then(() => setPresetName(''))
            }
          >
            {m.models.presetSave}
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="empty">{m.models.presetsEmpty}</p>
        ) : (
          <table>
            <tbody>
              {presets.map((preset) => (
                <tr key={preset.id}>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '2px 8px' }}
                      onClick={() => setSpec(preset.spec)}
                    >
                      {preset.name}
                    </button>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                    {describeSpecification(preset.spec)}
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '2px 8px' }}
                      onClick={() => void persist(presets.filter((p) => p.id !== preset.id))}
                    >
                      {m.models.presetDelete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function FieldSelect({
  value,
  exclude,
  onChange,
  m,
  ariaLabel,
}: {
  value: FieldId;
  exclude?: FieldId;
  onChange: (id: FieldId) => void;
  m: Messages;
  ariaLabel: string;
}) {
  return (
    <select
      className="select"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as FieldId)}
    >
      {FIELD_GROUPS.map((group) => (
        <optgroup key={group} label={m.models.groups[group]}>
          {FIELDS.filter((f) => f.group === group && f.id !== exclude).map((f) => (
            <option key={f.id} value={f.id}>
              {m.models.fields[f.id]}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function TermRows({
  terms,
  dependent,
  onChange,
  m,
  ariaLabel,
}: {
  terms: TermSpec[];
  dependent: FieldId;
  onChange: (next: TermSpec[]) => void;
  m: Messages;
  ariaLabel: string;
}) {
  const replace = (index: number, patch: Partial<TermSpec>) =>
    onChange(terms.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <>
      {terms.map((term, index) => (
        <div className="term-row" key={index}>
          <FieldSelect
            value={term.field}
            onChange={(field) => replace(index, { field })}
            m={m}
            ariaLabel={ariaLabel}
          />
          <select
            className="select"
            value={term.lag}
            aria-label={`${ariaLabel} — ${m.models.lagDays(1)}`}
            onChange={(e) => replace(index, { lag: Number(e.target.value) })}
          >
            {LAGS.filter((lag) => !(term.field === dependent && lag === 0)).map((lag) => (
              <option key={lag} value={lag}>
                {lag === 0 ? m.models.lagSameDay : m.models.lagDays(lag)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost"
            onClick={() => onChange(terms.filter((_, i) => i !== index))}
          >
            {m.models.remove}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...terms,
            { field: FIELDS.find((f) => f.id !== dependent)!.id, lag: dependent ? 1 : 0 },
          ])
        }
      >
        {m.models.add}
      </button>
    </>
  );
}

function Builder({
  spec,
  onChange,
  m,
}: {
  spec: Specification;
  onChange: (next: Specification) => void;
  m: Messages;
}) {
  return (
    <div className="builder">
      <div>
        <span className="label">{m.models.dependent}</span>
        <FieldSelect
          value={spec.dependent}
          onChange={(dependent) => onChange({ ...spec, dependent })}
          m={m}
          ariaLabel={m.models.dependent}
        />
      </div>

      <div>
        <span className="label">{m.models.regressors}</span>
        <p className="subtitle">{m.models.regressorsHint}</p>
        <TermRows
          terms={spec.regressors}
          dependent={spec.dependent}
          onChange={(regressors) => onChange({ ...spec, regressors })}
          m={m}
          ariaLabel={m.models.regressors}
        />
      </div>

      <div>
        <span className="label">{m.models.controls}</span>
        <p className="subtitle">{m.models.controlsHint}</p>
        <TermRows
          terms={spec.controls}
          dependent={spec.dependent}
          onChange={(controls) => onChange({ ...spec, controls })}
          m={m}
          ariaLabel={m.models.controls}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={spec.weekdayFixedEffects}
            onChange={(e) => onChange({ ...spec, weekdayFixedEffects: e.target.checked })}
          />
          {m.models.weekdayFixedEffects}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={spec.monthFixedEffects}
            onChange={(e) => onChange({ ...spec, monthFixedEffects: e.target.checked })}
          />
          {m.models.monthFixedEffects}
        </label>
      </div>
    </div>
  );
}
