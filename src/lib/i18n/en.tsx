import type { ReactNode } from 'react';
import type { Messages } from './es';

/**
 * The same catalogue in English. The annotation is the whole mechanism: adding a
 * key to `es.tsx` and forgetting it here is a type error at `npm run typecheck`,
 * not a Spanish string leaking into an English page.
 *
 * These are translations of the argument, not of the words. The subtitles carry
 * the assumption behind each estimate and that is what has to survive.
 */
export const en: Messages = {
  app: {
    subtitle: {
      file: 'your data, without the app between you and it',
      demo: 'synthetic demo data',
      local: 'local data from data/',
    },
    loadAnother: 'Load another export',
    rangeAria: 'Date range',
    sectionsAria: 'Sections',
    langAria: 'Language',
    demoNotice: (
      <>
        <b>You are looking at synthetic data.</b> Your browser generated it with real relationships
        built in — alcohol suppresses HRV, yesterday's strain costs today's recovery — so that the
        panels show something before you load your own export. It is nobody's data, and it is not
        saved on your machine.
      </>
    ),
    footer: (
      days: string,
      from: string,
      to: string,
      cycles: string,
      workouts: string,
      journal: string,
    ): ReactNode => (
      <>
        {days} days between {from} and {to} · {cycles} cycles, {workouts} activities, {journal}{' '}
        journal answers · Everything is computed in your browser.
      </>
    ),
  },

  ranges: {
    d30: '30d',
    d90: '90d',
    d180: '6m',
    d365: '1y',
    all: 'All',
  },

  tabs: {
    overview: 'Overview',
    recovery: 'Recovery',
    sleep: 'Sleep',
    training: 'Training',
    habits: 'Habits',
    models: 'Models',
    data: 'Data',
  },

  common: {
    notEnough: (missing: string, n: string, minN: string, what: string): ReactNode => (
      <>
        <b>{missing}</b> more days with complete data are needed to estimate {what}.
        <br />
        There are {n} of the {minN} it asks for.
      </>
    ),
    thisModel: 'this model',
    noPreviousPeriod: 'no previous period',
    vsPreviousPeriod: 'vs. previous period',
    noData: 'no data',
    supportGap: (from: string, to: string, share: string): ReactNode => (
      <>
        <b>Mind the gap:</b> between {from} and {to} there is not one observation, and that is{' '}
        {share}% of the range. With the cloud split in two, the slope drawn across it is not
        describing a relationship: it is joining two groups. Every shape that passes through both
        group means fits equally well there, and the data cannot choose between them.
      </>
    ),
    days: (n: number): string => (n === 1 ? 'day' : 'days'),
  },

  charts: {
    noData: 'No data in this range',
    noDataShort: 'no data',
    noPairs: 'Not enough data to cross these variables',
    noObservations: 'Not enough observations',
    noModel: 'Not enough observations to estimate the model',
    noLags: 'Not enough observations to estimate the lags',
    noSpectrum: 'Not enough observations to estimate the spectrum',
    lagAxis: 'Lag, in days',
    periodAxis: 'Cycle period, in days',
    falseAlarm: '5% false alarm',
    effect: 'Effect',
    total: 'Total',
    lag: (n: string) => `Lag ${n}`,
    cycleOf: (days: string) => `${days}-day cycle`,
    power: 'Power',
    aboveThreshold: 'Clears the threshold',
    belowThreshold: 'Below the threshold',
    coefficientLegend: (alpha: string): ReactNode => (
      <>
        Filled point and <b>*</b>: significant at q ≤ {alpha}% after Benjamini–Hochberg. The bar is
        the 95% confidence interval.
      </>
    ),
    coefficient: 'Coefficient',
    standardError: 'Standard error',
    ci95: (low: string, high: string) => `95% CI ${low} to ${high}`,
    n: (n: string) => `n = ${n}`,
    days: (n: string) => `${n} days`,
    range: (low: string, high: string) => `${low} to ${high}`,
    binMean: (perBin: string) => `Mean per group of ${perBin} days, with 95% CI`,
    loess: (percent: string) => `LOESS, ${percent}% window`,
  },

  import: {
    heading: 'Drop your WHOOP export here.',
    lead: (
      <>
        The whole ZIP, or the loose CSVs: <code>physiological_cycles</code>, <code>sleeps</code>,{' '}
        <code>workouts</code> and <code>journal_entries</code>. Everything is processed in your
        browser; nothing leaves your machine.
      </>
    ),
    dropTitle: 'Drag the ZIP here, or click to choose files',
    dropHint: '.zip or .csv — you can drop several at once',
    reading: 'Reading…',
    notWhoop:
      'That file does not look like a WHOOP export. Look for the ZIP in the “Your WHOOP Export is Ready” email.',
    readError: (message: string) => `I could not read the file: ${message}`,
    kinds: {
      cycles: 'cycles',
      sleeps: 'sleeps',
      workouts: 'activities',
      journal: 'journal answers',
    },
    demoLink: 'try a demo with synthetic data',
    note: (demoLink: ReactNode): ReactNode => (
      <>
        Have not requested the export yet? In the app: <b>More → App Settings → Data Export</b>. It
        arrives by email in under an hour. In the meantime, {demoLink}.
      </>
    ),
  },

  overview: {
    lastRecovery: 'Latest recovery',
    hrv: 'HRV',
    rhr: 'Resting heart rate',
    sleep: 'Sleep',
    strain: 'Strain',
    heroTitle: 'Daily recovery and its 7-day rolling mean',
    heroSubtitle: 'The bars are the daily score; the line is the trend the app does not show you.',
    seriesRecovery: 'Recovery',
    seriesMean7: '7d mean',
    kpiRecovery: 'Mean recovery',
    kpiHrv: 'Mean HRV',
    kpiRhr: 'Resting heart rate',
    kpiSleep: 'Sleep per night',
    calendarTitle: 'Recovery calendar',
    calendarSubtitle:
      'Each cell is a day. It is for seeing streaks and seasonality, not isolated spikes.',
    scatterTitle: 'What does strain cost you the next day?',
    scatterSubtitle: "Each point is a day: strain accumulated against the next morning's recovery.",
    scatterWhat: 'the strain against recovery curve',
    scatterX: 'Strain that day',
    scatterY: 'Next-day recovery',
    correlation: (r: string, n: string): ReactNode => (
      <>
        Correlation r = <b>{r}</b> over {n} days.
      </>
    ),
    elasticitiesTitle: 'What each thing is worth, in recovery points',
    elasticitiesSubtitle: (
      <>
        Coefficients from the same adjusted regression as the habits tab: each is the effect of
        moving that variable while everything else in the model is held fixed, with HAC standard
        errors and starred by Benjamini–Hochberg <b>q</b>. The last row is a ratio of two
        coefficients, with a delta-method standard error — not a division of intervals, which would
        give a different number. To read any of these figures as “what would happen if I changed
        this” you have to assume nothing is left out of the model that moves both the cause and
        recovery.
      </>
    ),
    elasticitiesWhat: 'the elasticities',
    colMarginalEffect: 'Marginal effect',
    colPp: 'pp',
    colCi95: '95% CI',
    colQ: 'q',
    ciRange: (low: string, high: string) => `${low} to ${high}`,
    elasticity: {
      strain: "Per unit of yesterday's strain",
      sleep: 'Per hour of sleep',
      bedtime: 'Per hour later to bed',
    },
    substitution: (value: string, low: string, high: string, n: string): ReactNode => (
      <>
        <b>{value} extra hours of sleep offset one unit of strain.</b> 95% CI: {low} to {high}{' '}
        hours.{' '}
        <span style={{ color: 'var(--muted)' }}>That is −β(strain)/β(sleep) over {n} days.</span>
      </>
    ),
    substitutionUnidentified: (reason: string): ReactNode => (
      <>
        <b>The substitution rate is not identified over this range.</b> {reason}. A ratio whose
        denominator may be zero has no finite bound — the honest confidence set is the whole line —
        so the card switches itself off instead of inventing a narrow interval.
      </>
    ),
    ratioMissingTerm: 'One of the two coefficients is missing from the model',
    ratioDenominatorZero: (name: string) =>
      `The denominator (${name}) is not distinguishable from zero, so the ratio is not identified`,
    highlightsTitle: 'What stands out',
    highlightsSubtitle: 'Computed over the selected range.',
    highlights: {
      bestWorst: 'Best and worst day',
      bestWorstValue: (best: string, bestDay: string, worst: string, worstDay: string) =>
        `${best} on ${bestDay} · ${worst} on ${worstDay}`,
      split: 'Split of days',
      splitValue: (green: string, red: string) => `${green}% green, ${red}% red`,
      weekday: 'Strong day / weak day',
      weekdayValue: (best: string, bestValue: string, worst: string, worstValue: string) =>
        `${best} ${bestValue} against ${worst} ${worstValue}`,
      sleepRecovery: 'Sleep and recovery',
      sleepRecoveryValue: (r: string, n: string, slope: string) =>
        `r = ${r} (${n} days). One extra hour is associated with ${slope} pp.`,
      consistency: 'Schedule consistency',
      consistencyValue: (v: string) => `${v}% on average`,
      debt: 'Mean sleep debt',
      acwr: 'Acute / chronic load',
      acwrValue: (v: string, verdict: string) => `${v} — ${verdict}`,
      acwrRising: 'you are ramping load quickly',
      acwrFalling: 'you have been unloading',
      acwrStable: 'in a stable range',
    },
  },

  recovery: {
    baselineTitle: 'HRV against your own baseline',
    baselineSubtitle: (
      <>
        The thick line is the 28-day rolling mean. What matters is not the number but the distance
        from your baseline. The vertical rules are level shifts found by binary segmentation with a
        BIC criterion over that mean.{' '}
        <b>A step is not evidence that something happened that day:</b> the method looks for steps,
        and a slow rise has none, so it approximates one with a staircase and puts the date halfway
        up a slope. Read it as “the level was different around here”, not as an event.
      </>
    ),
    seriesHrv: 'HRV',
    seriesBase28: '28d baseline',
    legendDailyHrv: 'Daily HRV',
    legendBaseline28: '28-day baseline',
    legendBreakUp: 'Level shift upward',
    legendBreakDown: 'Level shift downward',
    breaksMissing: (missing: string, n: string, minN: string) =>
      `${missing} more days are needed to look for regime changes (${n} of ${minN}).`,
    breaksNone: 'No level shifts over this range: the HRV baseline stays in a single regime.',
    zTitle: 'Deviation from baseline (z-score)',
    zSubtitle: 'Below −1 are the days your nervous system is asking for a break.',
    zSeries: 'HRV z',
    rhrTitle: 'Resting heart rate',
    rhrSubtitle: (
      <>
        Sustained rises tend to lead illness, alcohol or accumulated load. The triangles are signals
        from a two-sided tabular CUSUM (k = 0.5, h = 5) against the range mean: it accumulates small
        deviations, so it flags drifts no single day would flag. Its calibration assumes independent
        days and the series is not, so it fires more than the theory says — it is a detector, not a
        test.
      </>
    ),
    seriesRhr: 'RHR',
    seriesMean7: '7d mean',
    controlMissing: (missing: string, n: string, minN: string) =>
      `${missing} more days are needed to run the control chart (${n} of ${minN}).`,
    controlNone: (h: string) =>
      `No signals over this range: the heart rate does not leave its baseline far enough to accumulate ${h} sigmas.`,
    controlSignals: (signals: number, count: string, n: string) =>
      `${count} ${signals === 1 ? 'signal' : 'signals'} over ${n} days with data.`,
    driversTitle: 'What moves your recovery',
    driversSubtitle:
      'Pearson correlation with the recovery score. Correlation is not causation, but it ranks the hypotheses.',
    drivers: {
      sleepHours: 'Hours of sleep',
      sleepEfficiency: 'Sleep efficiency',
      sleepConsistency: 'Schedule consistency',
      sleepDebt: 'Sleep debt',
      remShare: '% REM',
      deepShare: '% deep sleep',
      strainPrev: "Previous day's strain",
      workoutMinutes: 'Training minutes (yesterday)',
      respiratoryRate: 'Respiratory rate',
      skinTemp: 'Skin temperature',
    },
    rhythmTitle: (series: string) => `Rhythms in ${series}`,
    rhythmSeries: { recovery: 'recovery', hrv: 'HRV' },
    rhythmSubtitle: (
      <>
        Lomb–Scargle periodogram: how much of the series a cycle of each length explains. The red
        rule is the 5% false-alarm level, already corrected across every frequency examined — any
        series produces peaks, and only one that clears the line counts. It works with gaps without
        filling them, which is exactly how a non-existent weekly cycle gets manufactured. Only the
        mean is removed: if your series has a trend, it leaks into the long periods.
      </>
    ),
    weekMark: 'week',
    noPeak: 'No peak to report.',
    peak: (period: string, q: string, weeklyIsReal: boolean): ReactNode => (
      <>
        Peak at <b>{period} days</b> (q = {q}).{' '}
        {weeklyIsReal
          ? 'The weekly cycle clears the threshold.'
          : 'The weekly cycle does not clear it.'}
      </>
    ),
    noPeakOverThreshold: (period: string): ReactNode => (
      <>
        No cycle clears the threshold. The highest peak is at {period} days, and that is what noise
        alone produces.
      </>
    ),
    spectrumDays: (n: string) => `${n} days`,
    periodogramWhat: 'the periodogram',
    weekdayTitle: 'Recovery by day of the week',
    weekdaySubtitle: (base: string) =>
      `Difference against your range mean (${base}). This is where Fridays show up.`,
  },

  sleep: {
    doseTitle: 'Dose and response: hours of sleep against recovery',
    doseSubtitle: (
      <>
        Each grey point is a night. The coloured points are mean recovery inside equal-sized groups,
        with their 95% interval, and the curve is a locally linear LOESS. What to look at is the
        shape: if the curve flattens, hours beyond that point no longer buy recovery, and that is
        precisely what a correlation coefficient cannot show, because all it knows how to describe
        is a straight line. This is the raw association, adjusted for nothing.
      </>
    ),
    doseX: 'Hours of sleep',
    doseY: 'Recovery',
    doseWhat: 'the dose–response curve',
    architectureTitle: 'Sleep architecture',
    architectureWeekly:
      'Each bar is a week (average per night), split by stage. Drop the range to 90 days to see it night by night.',
    architectureDaily: 'Each bar is a night, split by stage.',
    stages: { deep: 'Deep', rem: 'REM', light: 'Light', awake: 'Awake' },
    kpiSleep: 'Mean sleep',
    kpiEfficiency: 'Efficiency',
    kpiConsistency: 'Consistency',
    kpiDebt: 'Mean debt',
    windowTitle: 'Your sleep window',
    windowSubtitle:
      'Time to bed and time up, night by night. The flatter the lines, the better your consistency.',
    bedtime: 'To bed',
    wakeTime: 'Up',
    bedtimeSd: (value: string): ReactNode => (
      <>
        Standard deviation of your bedtime: <b>{value}</b>.
      </>
    ),
    scatterTitle: 'Sleep and recovery',
    scatterSubtitle: "Hours slept against that same morning's score.",
    scatterX: 'Hours slept',
    scatterY: 'Recovery',
    performanceTitle: 'Sleep performance against what you needed',
    performanceSubtitle: "Sleep performance = asleep / WHOOP's computed need.",
    performanceSeries: 'Performance',
    compositionTitle: 'Composition: REM and deep',
    compositionSubtitle:
      'Percentage of time asleep, smoothed over 7 days so the trend shows rather than the noise.',
    remDaily: 'Daily REM',
    deepDaily: 'Daily deep',
  },

  training: {
    irfTitle: 'How many days a hard session lasts',
    irfSubtitle: (
      <>
        Today's recovery against the strain of each of the seven previous days, in a single
        regression and controlling for hours of sleep, day of the week and month. The point at each
        lag is the effect of that day on its own; where the band crosses zero, that lag is not
        distinguishable from no effect. HAC (Newey–West) standard errors, which is what this calls
        for because one day's residual drags the previous day's — with ordinary errors this band
        would come out about a third narrower. To read it as “what training costs” you have to
        assume nothing omitted moves both strain and recovery, and training harder precisely on the
        days you woke up well is exactly that.
      </>
    ),
    irfLabel: 'Recovery',
    irfWhat: 'the response of recovery to strain',
    cumulative: (value: string, low: string, high: string): ReactNode => (
      <>
        <b>Cumulative multiplier: {value}</b> for each point of strain sustained across the whole
        week (95% CI: {low} to {high}).
      </>
    ),
    noLagBites: 'No individual lag separates from zero over this range.',
    lastLagBites: (lag: number, days: string) => `The hit is still felt ${lag} ${days} later.`,
    irfFooter: (n: string, bandwidth: string, r2: string) =>
      `${n} days · Bartlett bandwidth of ${bandwidth} days · R² ${r2}`,
    distributionTitle: 'How your strain days are spread out',
    distributionSubtitle: (
      <>
        A histogram of daily strain with its kernel density over it. The two readings fail in
        opposite directions — the bars are honest about where the days actually are but their shape
        moves with the bin edges; the curve is smooth but its shape is a bandwidth choice — so what
        survives both is worth naming. The test below does not count humps at a bandwidth of
        somebody's choosing: it finds the widest bandwidth that still leaves two, and asks by
        bootstrap whether a sample that really had one hump would ever need one that wide.
      </>
    ),
    distributionWhat: 'the strain distribution',
    distributionAxis: 'Strain that day',
    bimodal: (low: string, high: string, p: string, separation: string): ReactNode => (
      <>
        <b>
          Your daily strain has two modes, not one: around {low} and around {high}.
        </b>{' '}
        Silverman's critical-bandwidth test rejects unimodality at p {p}, and the valley between
        them drops {separation}% below the shorter of the two. That is train-or-rest with little in
        between — and it is why any scatter with strain on the x axis comes out as two clouds.
      </>
    ),
    unimodal: (p: string): ReactNode => (
      <>
        <b>A single mode.</b> Silverman's test does not reject unimodality (p {p}): your strain days
        form one group with a tail, not two separated regimes.
      </>
    ),
    modalityShort: (modes: number, p: string) =>
      `${modes} ${modes === 1 ? 'mode' : 'modes'} at the drawn bandwidth · p ${p} against unimodality`,
    modalityBandwidth: (drawn: string, critical: string) =>
      `bandwidth ${drawn}, critical ${critical}`,
    doseTitle: "Dose and response: today's strain against tomorrow's recovery",
    doseSubtitle: (
      <>
        Each grey point is a day. The coloured points are mean recovery inside equal-sized groups,
        with their 95% interval, and the curve is a locally linear LOESS. A correlation coefficient
        summarises all of this in one number and by construction can only describe a straight line;
        here you can see where the relationship stops being one. This is the raw association: it is
        adjusted for nothing.
      </>
    ),
    doseX: 'Strain that day',
    doseY: 'Next-day recovery',
    doseWhat: 'the dose–response curve',
    acwrTitle: 'Acute load against chronic load',
    acwrSubtitle:
      '7-day mean strain over the 28-day mean. Above 1.3 the load is rising faster than you absorb it.',
    strainTitle: 'Daily strain and its rolling mean',
    strainSeries: 'Strain',
    mean7: '7d mean',
    activitiesTitle: 'Activities in range',
    activitiesEmpty: 'No activities in this range.',
    colActivity: 'Activity',
    colSessions: 'Sessions',
    colTime: 'Time',
    colMeanStrain: 'Mean strain',
    colMeanHr: 'Mean HR',
    zonesTitle: 'Split by heart-rate zone',
    zonesSubtitle: 'Total minutes in the range spent in each zone.',
    zone: (n: number) => `Zone ${n}`,
    volumeTitle: 'Weekly volume',
    volumeSubtitle: 'Activity minutes accumulated per week.',
    volumeSeries: 'Minutes',
  },

  models: {
    title: 'Model explorer',
    subtitle: (
      <>
        Build a regression and run it through the same engine as the rest of the dashboard: least
        squares with HAC standard errors, because everything you can build here is one daily series
        against another. There is no switch for the variance estimator — the only reason to want HC1
        here would be that the interval came out narrower.
      </>
    ),
    builderTitle: 'Specification',
    dependent: 'Dependent variable',
    regressors: 'Regressors',
    regressorsHint: 'What you are asking about. These are the coefficients the family counts.',
    controls: 'Controls',
    controlsHint:
      'What you are holding fixed. Adjustment, not hypotheses, so they stay out of the correction.',
    add: 'Add',
    remove: 'Remove',
    lagSameDay: 'same day',
    lagDays: (n: number) => `−${n} ${n === 1 ? 'day' : 'days'}`,
    weekdayFixedEffects: 'Day-of-week fixed effects',
    monthFixedEffects: 'Month fixed effects',
    needRegressor:
      'Add at least one regressor. The dependent variable at the same day does not count: that would be y on y.',
    familyTitle: 'Accumulated family this session',
    family: (specifications: number, tests: number): ReactNode => (
      <>
        <b>
          {specifications} {specifications === 1 ? 'specification' : 'specifications'} · {tests}{' '}
          {tests === 1 ? 'coefficient' : 'coefficients'} in the family
        </b>
        . The <b>q</b> values in the table are Benjamini–Hochberg corrected over all of them, not
        over this model alone. Every new specification makes the earlier q values worse, and it has
        to: searching over pairs until something comes out significant produces significance by
        construction. The counter resets when you reload the page, so this number is a floor on how
        much you have searched, never a ceiling.
      </>
    ),
    familyReset: 'Reset the counter',
    resultsTitle: 'Coefficients',
    colTerm: 'Term',
    colRole: 'Role',
    colCoef: 'Coef.',
    colCi: '95% CI',
    colSe: 'SE',
    colP: 'p',
    colQ: 'q',
    roleRegressor: 'regressor',
    roleControl: 'control',
    fitFooter: (n: string, k: string, r2: string, bandwidth: string) =>
      `${n} complete days · ${k} parameters · adjusted R² ${r2} · Bartlett bandwidth of ${bandwidth} days`,
    coefficientUnit: (unit: string, dependent: string) =>
      `Each coefficient is in ${unit ? unit : 'units'} of ${dependent} per unit of the term.`,
    perParameter: (value: string) => `${value} observations per parameter`,
    dropped: (terms: string) => `Dropped as collinear: ${terms}`,
    insufficientWhat: 'this model',
    guard: (perParameter: string, floor: string): ReactNode => (
      <>
        The explorer switches off below {perParameter} observations per parameter, with a floor of{' '}
        {floor}. That is the point where the real coverage of a HAC interval stops getting worse;
        below it a “95%” band is right about one time in five less often than it claims. The
        justification is measured out in <code>docs/metricas.md</code> §6.10.
      </>
    ),
    scatterTitle: (x: string, y: string) => `${x} against ${y}`,
    scatterSubtitle: (
      <>
        The first regressor against the dependent variable, over exactly the rows the fit used. This
        is the raw association: the coefficient above is adjusted for everything else in the model
        and this picture is not, so where they disagree, the difference is what the controls are
        doing.
      </>
    ),
    presetsTitle: 'Saved specifications',
    presetName: 'Name',
    presetSave: 'Save the current one',
    presetsEmpty: 'None saved yet. They are kept in your browser, like the export.',
    presetDelete: 'Delete',
    ci95: (low: string, high: string) => `${low} to ${high}`,
    groups: {
      recovery: 'Recovery',
      sleep: 'Sleep',
      training: 'Training',
    },
    units: {
      pct: 'pp',
      ms: 'ms',
      bpm: 'bpm',
      min: 'min',
      h: 'h',
      kcal: 'kcal',
      count: '',
      index: '',
      sd: 'sd',
      deg: '°',
    },
    fields: {
      recovery: 'Recovery',
      hrv: 'HRV',
      hrvZ: 'HRV z-score',
      rhr: 'Resting heart rate',
      skinTemp: 'Skin temperature',
      spo2: 'SpO₂',
      respiratoryRate: 'Respiratory rate',
      sleepHours: 'Hours of sleep',
      sleepEfficiency: 'Sleep efficiency',
      sleepConsistency: 'Schedule consistency',
      sleepPerformance: 'Sleep performance',
      sleepDebt: 'Sleep debt',
      sleepNeed: 'Sleep need',
      deep: 'Deep sleep',
      rem: 'REM sleep',
      light: 'Light sleep',
      awake: 'Time awake',
      remShare: '% REM',
      deepShare: '% deep',
      bedtime: 'Bedtime',
      wakeTime: 'Wake time',
      napMinutes: 'Naps',
      strain: 'Strain',
      acwr: 'Acute / chronic load',
      workoutMinutes: 'Activity minutes',
      workoutCount: 'Activity count',
      calories: 'Calories',
      maxHr: 'Max HR',
      avgHr: 'Mean HR',
    },
  },

  habits: {
    noJournal: (
      <>
        You did not load <code>journal_entries.csv</code>. That is the table that turns this
        dashboard into something WHOOP does not give you: the effect of each habit on your recovery.
      </>
    ),
    alignmentAria: 'Temporal alignment',
    alignmentSameDay: 'Same-day recovery',
    alignmentNextDay: 'Next-day recovery',
    adjustedTitle: 'The effect of each habit, all else equal',
    adjustedSubtitle: (
      <>
        A single regression with every habit at once, plus hours of sleep, yesterday's strain,
        bedtime, and day-of-week and month fixed effects. Each coefficient is the difference in
        percentage points between days that answer the same on everything else in the model. HAC
        standard errors, because the residual of a daily series drags the previous day's. Starred by
        Benjamini–Hochberg <b>q</b> and not by p: with a dozen questions at once, one false positive
        at p &lt; 0.05 is the expected result. To read it as “the effect of this habit” you have to
        assume nothing is left out of the model that moves both the habit and recovery.
      </>
    ),
    adjustedWhat: 'the habits regression',
    fitFooter: (n: string, k: string, r2: string, bandwidth: string) =>
      `${n} complete days · ${k} parameters · adjusted R² ${r2} · Bartlett bandwidth of ${bandwidth} days`,
    skipped: (count: number): ReactNode => (
      <>
        {' '}
        · {count} {count === 1 ? 'question was left out' : 'questions were left out'} for lack of
        variation or of answers
      </>
    ),
    rawTitle: 'And the same thing, adjusted for nothing',
    rawSubtitle: (
      <>
        A plain difference of means between the days you answered yes and the days you answered no,
        with a minimum of 8 observations per group.{' '}
        <b>It is here to be compared with the one above.</b> When the two disagree, the adjusted one
        is what separates effects: alcohol arrives together with the weekend, with a late bedtime
        and with less sleep, and a difference of means credits the drink with the combined effect of
        all four. WHOOP does not document which night each answer is scored against; the switch
        above moves both estimates at once.
      </>
    ),
    rawEmpty: 'No question yet has enough answers in both groups within this range. Try “All”.',
    detailTitle: 'Detail',
    detailSubtitle:
      'Group means and the Welch t of the unadjusted difference. The “adjusted” column is the coefficient from the model above, which is the one to believe when they disagree.',
    colQuestion: 'Question',
    colYes: 'Yes',
    colNo: 'No',
    colRawDelta: 'Δ raw',
    colAdjustedDelta: 'Δ adjusted',
    colQ: 'q',
    colN: 'n yes / n no',
  },

  data: {
    title: 'Consolidated daily table',
    subtitle: 'The four CSVs joined by day. Copy it and paste it into Excel, Stata or R.',
    copy: 'Copy as TSV',
    copied: 'Done',
    date: 'Date',
    columns: {
      recovery: 'Rec %',
      hrv: 'HRV',
      rhr: 'RHR',
      strain: 'Strain',
      calories: 'Calories',
      sleepHours: 'Sleep h',
      sleepEfficiency: 'Eff %',
      deep: 'Deep',
      rem: 'REM',
      light: 'Light',
      awake: 'Awake',
      sleepDebt: 'Debt',
      sleepConsistency: 'Consist %',
      respiratoryRate: 'Resp',
      workoutCount: 'Activities',
      workoutMinutes: 'Act. min',
    },
  },
};
