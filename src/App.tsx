import { useEffect, useMemo } from 'react';
import { ImportView, Segmented } from '@/components';
import { fmtDayLong } from '@/lib/format';
import { loadExport } from '@/lib/storage';
import { RANGES, selectWindow, TABS, useStore, type TabId } from '@/state/store';
import { DataView, HabitsView, OverviewView, RecoveryView, SleepView, TrainingView } from '@/views';

export default function App() {
  const {
    allDays,
    questions,
    raw,
    range,
    tab,
    isDemo,
    loaded,
    setExport,
    setRange,
    setTab,
    reset,
  } = useStore();

  // Restore the last import so returning to the page is not a re-upload.
  useEffect(() => {
    void loadExport().then((data) => {
      if (data) setExport(data);
    });
  }, [setExport]);

  const { days, previous } = useMemo(() => selectWindow(allDays, range), [allDays, range]);

  if (!loaded || !allDays.length) {
    return (
      <div className="wrap">
        <Header subtitle="tus datos, sin el filtro de la app" />
        <ImportView />
      </div>
    );
  }

  return (
    <div className="wrap">
      <Header
        subtitle={
          isDemo ? 'datos sintéticos de demostración' : 'tus datos, sin el filtro de la app'
        }
      >
        <Segmented options={RANGES} value={range} onChange={setRange} ariaLabel="Rango de fechas" />
        <button type="button" className="ghost" onClick={reset}>
          Cargar otro export
        </button>
      </Header>

      <nav className="tabs" role="tablist" aria-label="Secciones">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => {
              setTab(t.id as TabId);
              window.scrollTo(0, 0);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewView days={days} previous={previous} />}
      {tab === 'recovery' && <RecoveryView days={days} />}
      {tab === 'sleep' && <SleepView days={days} previous={previous} />}
      {tab === 'training' && <TrainingView days={days} />}
      {tab === 'habits' && <HabitsView days={days} questions={questions} />}
      {tab === 'data' && <DataView days={days} />}

      <footer>
        {allDays.length} días entre {fmtDayLong(allDays[0].day)} y{' '}
        {fmtDayLong(allDays[allDays.length - 1].day)} · {raw.cycles.length} ciclos,{' '}
        {raw.workouts.length} actividades, {raw.journal.length} respuestas de diario · Todo se
        calcula en tu navegador.
      </footer>
    </div>
  );
}

function Header({ subtitle, children }: { subtitle: string; children?: React.ReactNode }) {
  return (
    <header className="top">
      <div className="brand">
        <h1>WHOOP Lab</h1>
        <span>{subtitle}</span>
      </div>
      {children && <div className="controls">{children}</div>}
    </header>
  );
}
