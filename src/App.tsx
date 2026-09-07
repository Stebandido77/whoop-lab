import { useEffect, useMemo } from 'react';
import { ImportView, Segmented } from '@/components';
import { fmtDayLong } from '@/lib/format';
import { loadExport } from '@/lib/storage';
import { RANGES, selectWindow, TABS, useStore, type ExportSource, type TabId } from '@/state/store';
import { DataView, HabitsView, OverviewView, RecoveryView, SleepView, TrainingView } from '@/views';

const SUBTITLES: Record<ExportSource, string> = {
  file: 'tus datos, sin el filtro de la app',
  demo: 'datos sintéticos de demostración',
  local: 'datos locales de data/',
};

export default function App() {
  const {
    allDays,
    questions,
    raw,
    range,
    tab,
    source,
    loaded,
    setExport,
    setRange,
    setTab,
    reset,
  } = useStore();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // In `npm run dev`, an export sitting in `data/` wins over the cache, so
      // the folder is the single source of truth while hacking. `import.meta.env.DEV`
      // is a compile-time constant: in a build this whole branch is dead code and
      // `@/lib/localData` never enters the bundle. See vite.config.ts.
      if (import.meta.env.DEV) {
        const { readLocalData } = await import('@/lib/localData');
        const local = readLocalData();
        if (local) {
          // Deliberately not persisted: `data/` is already the durable copy, and
          // caching it would outlive deleting the folder.
          if (!cancelled) setExport(local.data, { source: 'local' });
          console.info(`[whoop-lab] datos locales de data/: ${local.files.join(', ')}`);
          return;
        }
      }

      // Restore the last import so returning to the page is not a re-upload.
      const stored = await loadExport();
      if (stored && !cancelled) setExport(stored);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [setExport]);

  const { days, previous } = useMemo(() => selectWindow(allDays, range), [allDays, range]);

  if (!loaded || !allDays.length) {
    return (
      <div className="wrap">
        <Header subtitle={SUBTITLES.file} />
        <ImportView />
      </div>
    );
  }

  return (
    <div className="wrap">
      <Header subtitle={SUBTITLES[source]}>
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
