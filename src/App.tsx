import { lazy, Suspense, useEffect, useMemo } from 'react';
import { ImportView, Segmented, ViewSkeleton } from '@/components';
import { count, fmtDayLong } from '@/lib/format';
import { LANGS, useMessages } from '@/lib/i18n';
import { loadExport } from '@/lib/storage';
import {
  RANGE_KEYS,
  RANGES,
  selectWindow,
  TABS,
  useStore,
  type RangeDays,
  type TabId,
} from '@/state/store';

/**
 * One chunk per tab.
 *
 * The econometric panels are the heavy half of this application and every one of
 * them sits below the fold of a tab nobody has opened yet, so paying for them on
 * first paint bought nothing. Each view is imported the first time its tab is
 * shown and cached by the browser from then on; `ViewSkeleton` holds the layout
 * in the meantime. The chunk map is in docs/arquitectura.md.
 */
const VIEWS: Record<TabId, React.LazyExoticComponent<React.ComponentType<ViewProps>>> = {
  overview: lazy(() => import('@/views/OverviewView').then((m) => ({ default: m.OverviewView }))),
  recovery: lazy(() => import('@/views/RecoveryView').then((m) => ({ default: m.RecoveryView }))),
  sleep: lazy(() => import('@/views/SleepView').then((m) => ({ default: m.SleepView }))),
  training: lazy(() => import('@/views/TrainingView').then((m) => ({ default: m.TrainingView }))),
  habits: lazy(() => import('@/views/HabitsView').then((m) => ({ default: m.HabitsView }))),
  models: lazy(() => import('@/views/ModelsView').then((m) => ({ default: m.ModelsView }))),
  data: lazy(() => import('@/views/DataView').then((m) => ({ default: m.DataView }))),
};

/**
 * Every view takes the same four props and ignores the ones it does not need,
 * which is what lets the tab table above be a plain lookup instead of six
 * branches in the JSX.
 */
interface ViewProps {
  days: import('@/lib/whoop/types').DayRecord[];
  previous: import('@/lib/whoop/types').DayRecord[];
  questions: string[];
}

/**
 * `?demo=1` — the link in the README, so a first visit lands on a full dashboard.
 *
 * `?demo=<days>` generates that many days instead of the default. It exists for
 * one reason: most of this dashboard's panels have a minimum sample, and the
 * only way to see what they look like below it — which is most of what somebody
 * with a fresh WHOOP account will see — is to ask for a short one. Anything
 * outside a sane range falls back to the default rather than trying.
 */
const DEMO_DAYS = { min: 7, max: 1500, default: 420 };

function demoDays(): number | null {
  const raw = new URLSearchParams(window.location.search).get('demo');
  if (raw == null) return null;
  if (raw === '1') return DEMO_DAYS.default;
  const days = Number(raw);
  return Number.isInteger(days) && days >= DEMO_DAYS.min && days <= DEMO_DAYS.max
    ? days
    : DEMO_DAYS.default;
}

export default function App() {
  const m = useMessages();
  const {
    allDays,
    questions,
    raw,
    range,
    tab,
    source,
    lang,
    loaded,
    setExport,
    setRange,
    setTab,
    setLang,
    reset,
  } = useStore();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // A demo link wins over everything, including a cached import: somebody
      // following it wants to see the dashboard, not their own data. Nothing is
      // written to IndexedDB — `setExport` only persists when asked to — so the
      // export already cached there is still waiting after a plain reload.
      const demo = demoDays();
      if (demo != null) {
        const { generateDemoExport } = await import('@/lib/demo');
        if (!cancelled) setExport(generateDemoExport(demo), { source: 'demo' });
        return;
      }

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

  const langSwitch = (
    <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel={m.app.langAria} />
  );

  if (!loaded || !allDays.length) {
    return (
      <div className="wrap">
        <Header subtitle={m.app.subtitle.file}>{langSwitch}</Header>
        <ImportView />
      </div>
    );
  }

  const View = VIEWS[tab];

  return (
    <div className="wrap">
      <Header subtitle={m.app.subtitle[source]}>
        <Segmented
          options={RANGES.map((value) => ({ value, label: m.ranges[RANGE_KEYS[value]] }))}
          value={range}
          onChange={(value: RangeDays) => setRange(value)}
          ariaLabel={m.app.rangeAria}
        />
        {langSwitch}
        <button type="button" className="ghost" onClick={reset}>
          {m.app.loadAnother}
        </button>
      </Header>

      {source === 'demo' && <p className="callout demo-note">{m.app.demoNotice}</p>}

      <nav className="tabs" role="tablist" aria-label={m.app.sectionsAria}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === tab}
            onClick={() => {
              setTab(id);
              window.scrollTo(0, 0);
            }}
          >
            {m.tabs[id]}
          </button>
        ))}
      </nav>

      <Suspense fallback={<ViewSkeleton tab={tab} />}>
        <View days={days} previous={previous} questions={questions} />
      </Suspense>

      <footer>
        {m.app.footer(
          count(allDays.length),
          fmtDayLong(allDays[0].day),
          fmtDayLong(allDays[allDays.length - 1].day),
          count(raw.cycles.length),
          count(raw.workouts.length),
          count(raw.journal.length),
        )}
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
