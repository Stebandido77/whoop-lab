import type { ReactNode } from 'react';

/**
 * Every string the reader sees, in Spanish. This module is the source of truth
 * for the shape of a catalogue: `Messages` is `typeof es`, so `en.tsx` stops
 * compiling the moment a key is added here and not there.
 *
 * Values that interpolate are functions rather than templates with `{count}`
 * placeholders, because a placeholder inside a string cannot carry a `<b>` and
 * half of these subtitles need one. A function widens to its signature, not to
 * a literal, which is exactly the checking we want out of `typeof`.
 */
export const es = {
  app: {
    subtitle: {
      file: 'tus datos, sin el filtro de la app',
      demo: 'datos sintéticos de demostración',
      local: 'datos locales de data/',
    },
    loadAnother: 'Cargar otro export',
    rangeAria: 'Rango de fechas',
    sectionsAria: 'Secciones',
    langAria: 'Idioma',
    demoNotice: (
      <>
        <b>Estás viendo datos sintéticos.</b> Los generó tu navegador con relaciones reales
        incorporadas —el alcohol baja la HRV, el strain de ayer cuesta la recuperación de hoy— para
        que los paneles muestren algo antes de que cargues tu export. No son los datos de nadie, y
        no se guardan en tu equipo.
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
        {days} días entre {from} y {to} · {cycles} ciclos, {workouts} actividades, {journal}{' '}
        respuestas de diario · Todo se calcula en tu navegador.
      </>
    ),
  },

  ranges: {
    d30: '30d',
    d90: '90d',
    d180: '6m',
    d365: '1a',
    all: 'Todo',
  },

  tabs: {
    overview: 'Resumen',
    recovery: 'Recuperación',
    sleep: 'Sueño',
    training: 'Entrenamiento',
    habits: 'Hábitos',
    models: 'Modelos',
    data: 'Datos',
  },

  common: {
    notEnough: (missing: string, n: string, minN: string, what: string): ReactNode => (
      <>
        Faltan <b>{missing}</b> días con datos completos para estimar {what}.
        <br />
        Hay {n} de los {minN} que pide.
      </>
    ),
    thisModel: 'este modelo',
    noPreviousPeriod: 'sin periodo previo',
    vsPreviousPeriod: 'vs. periodo anterior',
    noData: 'sin dato',
    supportGap: (from: string, to: string, share: string): ReactNode => (
      <>
        <b>Ojo con el hueco:</b> entre {from} y {to} no hay ni una observación, y eso es el {share}%
        del rango. Con la nube partida en dos, la pendiente que se dibuja ahí no describe una
        relación: une dos grupos. Cualquier forma que pase por las dos medias ajusta igual de bien,
        y los datos no pueden elegir entre ellas.
      </>
    ),
    days: (n: number): string => (n === 1 ? 'día' : 'días'),
  },

  /**
   * Strings the chart components print themselves: empty states, tooltips, axis
   * captions and legends. They live with the charts rather than with the views
   * because the same chart says the same thing wherever it is mounted.
   */
  charts: {
    noData: 'Sin datos en este rango',
    noDataShort: 'sin datos',
    noPairs: 'Faltan datos para cruzar estas variables',
    noObservations: 'Sin suficientes observaciones',
    noModel: 'Sin suficientes observaciones para estimar el modelo',
    noLags: 'Sin suficientes observaciones para estimar los rezagos',
    noSpectrum: 'Sin suficientes observaciones para estimar el espectro',
    lagAxis: 'Días de rezago',
    periodAxis: 'Periodo del ciclo, en días',
    falseAlarm: 'Falsa alarma 5%',
    effect: 'Efecto',
    total: 'Total',
    lag: (n: string) => `Rezago ${n}`,
    cycleOf: (days: string) => `Ciclo de ${days} días`,
    power: 'Potencia',
    aboveThreshold: 'Supera el umbral',
    belowThreshold: 'Por debajo del umbral',
    clock: {
      bedtime: 'Hora de acostarse',
      wake: 'Hora de levantarse',
      median: (value: string) => `Mediana ${value}`,
      iqr: (q1: string, q3: string) => `La mitad de las noches entre ${q1} y ${q3}`,
      nights: (n: string) => `${n} noches con dato`,
      startedAt: 'Empezó a las',
      strain: 'Strain',
      wokeAt: (hour: string) => `Despertaste entre las ${hour} y la hora siguiente`,
      meanRecovery: 'Recuperación media',
      againstRange: (delta: string) => `${delta} frente a tu media del rango`,
      mornings: (n: string) => `${n} mañanas`,
      tooFewMornings: (n: string) =>
        `Solo ${n} mañanas: muy pocas para promediar, así que la casilla queda vacía.`,
      centreLabel: 'Ventana típica de sueño',
      keyNight: 'La noche',
      keySessions: 'Sesiones',
      keyRing: 'Anillo exterior',
      legendAbove: 'Por encima de tu media',
      legendBelow: 'Por debajo de tu media',
      legendTooFew: 'Muy pocas mañanas',
      legendSleep: 'Ventana de sueño (mediana y cuartiles)',
      legendOther: (n: string) => `otras ${n}`,
    },
    heatmap: {
      weekOf: (week: string) => `Semana del ${week}`,
      strain: 'Strain acumulado',
      sessions: (n: string) => `${n} ${n === '1' ? 'sesión' : 'sesiones'}`,
      noSession: 'sin sesión',
      scale: 'Strain de la semana:',
    },
    coefficientLegend: (alpha: string): ReactNode => (
      <>
        Punto lleno y <b>*</b>: significativo con q ≤ {alpha}% tras Benjamini–Hochberg. La barra es
        el intervalo de confianza al 95%.
      </>
    ),
    coefficient: 'Coeficiente',
    standardError: 'Error estándar',
    ci95: (low: string, high: string) => `IC 95% ${low} a ${high}`,
    n: (n: string) => `n = ${n}`,
    days: (n: string) => `${n} días`,
    range: (low: string, high: string) => `${low} a ${high}`,
    binMean: (perBin: string) => `Media por grupo de ${perBin} días, con IC 95%`,
    loess: (percent: string) => `LOESS, ventana del ${percent}%`,
  },

  import: {
    heading: 'Suelta aquí tu export de WHOOP.',
    lead: (
      <>
        El ZIP completo o los CSV sueltos: <code>physiological_cycles</code>, <code>sleeps</code>,{' '}
        <code>workouts</code> y <code>journal_entries</code>. Todo se procesa en tu navegador; nada
        sale de tu equipo.
      </>
    ),
    dropTitle: 'Arrastra el ZIP o haz clic para elegir archivos',
    dropHint: '.zip o .csv — puedes soltar varios a la vez',
    reading: 'Leyendo…',
    notWhoop:
      'Ese archivo no parece un export de WHOOP. Busca el ZIP del correo “Your WHOOP Export is Ready”.',
    readError: (message: string) => `No pude leer el archivo: ${message}`,
    kinds: {
      cycles: 'ciclos',
      sleeps: 'sueños',
      workouts: 'actividades',
      journal: 'respuestas de diario',
    },
    demoLink: 'mira una demo con datos sintéticos',
    note: (demoLink: ReactNode): ReactNode => (
      <>
        ¿Todavía no pediste el export? En la app: <b>More → App Settings → Data Export</b>. Llega
        por correo en menos de una hora. Mientras tanto, {demoLink}.
      </>
    ),
  },

  overview: {
    lastRecovery: 'Última recuperación',
    hrv: 'HRV',
    rhr: 'Pulso en reposo',
    sleep: 'Sueño',
    strain: 'Strain',
    heroTitle: 'Recuperación diaria y su media móvil de 7 días',
    heroSubtitle:
      'Las barras son el score del día; la línea es la tendencia que la app no te muestra.',
    seriesRecovery: 'Recuperación',
    seriesMean7: 'Media 7d',
    kpiRecovery: 'Recuperación media',
    kpiHrv: 'HRV media',
    kpiRhr: 'Pulso en reposo',
    kpiSleep: 'Sueño por noche',
    calendarTitle: 'Calendario de recuperación',
    calendarSubtitle:
      'Cada celda es un día. Sirve para ver rachas y estacionalidad, no picos aislados.',
    scatterTitle: '¿Cuánto te cuesta el strain al día siguiente?',
    scatterSubtitle:
      'Cada punto es un día: strain acumulado frente a la recuperación de la mañana siguiente.',
    scatterWhat: 'la curva de strain contra recuperación',
    scatterX: 'Strain del día',
    scatterY: 'Recuperación al día siguiente',
    correlation: (r: string, n: string): ReactNode => (
      <>
        Correlación r = <b>{r}</b> sobre {n} días.
      </>
    ),
    clockTitle: 'Tu día, en un reloj de 24 horas',
    clockSubtitle: (
      <>
        Tres lecturas del mismo eje —la hora del día— que el resto del tablero solo muestra por
        separado. La banda es la ventana de sueño: el arco va de la mediana de acostarte a la
        mediana de levantarte, y las cuñas más oscuras cubren la mitad central de las noches, que es
        el ancho honesto de la afirmación. Cada radio es <b>una sesión</b> en el minuto en que
        empezó, tan largo como su strain y coloreado por disciplina; donde se amontonan están las
        horas a las que entrenas. El anillo exterior es la recuperación media de las mañanas que
        despertaron en esa hora, comparada con tu media del rango. Todo sale de columnas que el
        export trae —inicio y fin del sueño, hora de inicio de cada actividad, strain y score—: acá
        no se modela ni se rellena nada.
      </>
    ),
    clockWhat: 'el reloj circadiano',
    clockRingCaveat: (mean: string): ReactNode => (
      <>
        El anillo es <b>descriptivo, no causal</b>. Las mañanas tempranas no son mañanas al azar:
        suelen venir con acostarse a la misma hora y, por lo tanto, con dormir menos, así que lo que
        se ve ahí incluye el efecto de la duración y no solo el de la hora. Para separarlos hace
        falta la regresión de la pestaña de modelos. La media del rango es {mean}.
      </>
    ),
    elasticitiesTitle: 'Cuánto vale, en puntos de recuperación, cada cosa',
    elasticitiesSubtitle: (
      <>
        Coeficientes de la misma regresión ajustada de la pestaña de hábitos: cada uno es el efecto
        de mover esa variable dejando fija toda la demás del modelo, con errores HAC y marcado por{' '}
        <b>q</b> de Benjamini–Hochberg. La última fila es una razón de dos coeficientes, con error
        estándar por método delta —no dividiendo intervalos, que daría otro número—. Para leer
        cualquiera de estas cifras como «lo que pasaría si cambio esto» hace falta suponer que no
        queda nada fuera del modelo que mueva a la vez la causa y la recuperación.
      </>
    ),
    elasticitiesWhat: 'las elasticidades',
    colMarginalEffect: 'Efecto marginal',
    colPp: 'pp',
    colCi95: 'IC 95%',
    colQ: 'q',
    ciRange: (low: string, high: string) => `${low} a ${high}`,
    elasticity: {
      strain: 'Por unidad de strain de ayer',
      sleep: 'Por hora de sueño',
      bedtime: 'Por hora más tarde de acostarse',
    },
    substitution: (value: string, low: string, high: string, n: string): ReactNode => (
      <>
        <b>{value} horas de sueño de más compensan una unidad de strain.</b> IC 95%: {low} a {high}{' '}
        horas. <span style={{ color: 'var(--muted)' }}>Es −β(strain)/β(sueño) sobre {n} días.</span>
      </>
    ),
    substitutionUnidentified: (reason: string): ReactNode => (
      <>
        <b>La tasa de sustitución no está identificada en este rango.</b> {reason}. Una razón cuyo
        denominador puede ser cero no tiene cota finita —el conjunto de confianza honesto es toda la
        recta—, así que la tarjeta se apaga en vez de inventar un intervalo angosto.
      </>
    ),
    ratioMissingTerm: 'Falta uno de los dos coeficientes en el modelo',
    ratioDenominatorZero: (name: string) =>
      `El denominador (${name}) no se distingue de cero, así que la razón no está identificada`,
    highlightsTitle: 'Lo que salta a la vista',
    highlightsSubtitle: 'Cálculos sobre el rango seleccionado.',
    highlights: {
      bestWorst: 'Mejor y peor día',
      bestWorstValue: (best: string, bestDay: string, worst: string, worstDay: string) =>
        `${best} el ${bestDay} · ${worst} el ${worstDay}`,
      split: 'Reparto de días',
      splitValue: (green: string, red: string) => `${green}% en verde, ${red}% en rojo`,
      weekday: 'Día fuerte / día flojo',
      weekdayValue: (best: string, bestValue: string, worst: string, worstValue: string) =>
        `${best} ${bestValue} frente a ${worst} ${worstValue}`,
      sleepRecovery: 'Sueño y recuperación',
      sleepRecoveryValue: (r: string, n: string, slope: string) =>
        `r = ${r} (${n} días). Una hora más se asocia a ${slope} pp.`,
      consistency: 'Consistencia de horarios',
      consistencyValue: (v: string) => `${v}% en promedio`,
      debt: 'Deuda de sueño media',
      acwr: 'Carga aguda / crónica',
      acwrValue: (v: string, verdict: string) => `${v} — ${verdict}`,
      acwrRising: 'estás subiendo carga rápido',
      acwrFalling: 'vienes descargando',
      acwrStable: 'en rango estable',
    },
  },

  recovery: {
    baselineTitle: 'HRV contra tu propia línea base',
    baselineSubtitle: (
      <>
        La línea gruesa es la media móvil de 28 días. Lo que importa no es el número, sino la
        distancia a tu base. Las rayas verticales son cambios de nivel detectados por segmentación
        binaria con criterio BIC sobre esa media.{' '}
        <b>Un escalón no es evidencia de que ese día pasara algo:</b> el método busca escalones y
        una subida lenta no tiene ninguno, así que la aproxima con una escalera y pone la fecha en
        medio de una pendiente. Léelo como «por aquí el nivel era otro», no como un evento.
      </>
    ),
    seriesHrv: 'HRV',
    seriesBase28: 'Base 28d',
    legendDailyHrv: 'HRV diaria',
    legendBaseline28: 'Línea base 28 días',
    legendBreakUp: 'Cambio de nivel al alza',
    legendBreakDown: 'Cambio de nivel a la baja',
    breaksMissing: (missing: string, n: string, minN: string) =>
      `Faltan ${missing} días para buscar cambios de régimen (${n} de ${minN}).`,
    breaksNone:
      'Sin cambios de nivel en este rango: la base de HRV se mantiene en un solo régimen.',
    zTitle: 'Desviación de la base (z-score)',
    zSubtitle: 'Por debajo de −1 son días en los que tu sistema nervioso pide calma.',
    zSeries: 'z HRV',
    rhrTitle: 'Pulso en reposo',
    rhrSubtitle: (
      <>
        Subidas sostenidas suelen adelantarse a enfermedad, alcohol o carga acumulada. Los
        triángulos son señales de un CUSUM tabular de dos colas (k = 0,5, h = 5) contra la media del
        rango: acumula desviaciones pequeñas, así que marca derivas que ningún día suelto marcaría.
        Su calibración supone días independientes y la serie no lo es, de modo que dispara más de lo
        que dice la teoría — es un detector, no una prueba.
      </>
    ),
    seriesRhr: 'RHR',
    seriesMean7: 'Media 7d',
    controlMissing: (missing: string, n: string, minN: string) =>
      `Faltan ${missing} días para correr la carta de control (${n} de ${minN}).`,
    controlNone: (h: string) =>
      `Sin señales en este rango: el pulso no se aparta de su base lo suficiente como para acumular ${h} sigmas.`,
    controlSignals: (signals: number, count: string, n: string) =>
      `${count} ${signals === 1 ? 'señal' : 'señales'} sobre ${n} días con dato.`,
    driversTitle: 'Qué mueve tu recuperación',
    driversSubtitle:
      'Correlación de Pearson con el score de recuperación. Correlación no es causalidad, pero ordena las hipótesis.',
    drivers: {
      sleepHours: 'Horas de sueño',
      sleepEfficiency: 'Eficiencia del sueño',
      sleepConsistency: 'Consistencia horaria',
      sleepDebt: 'Deuda de sueño',
      remShare: '% REM',
      deepShare: '% sueño profundo',
      strainPrev: 'Strain del día anterior',
      workoutMinutes: 'Minutos de entreno (ayer)',
      respiratoryRate: 'Frecuencia respiratoria',
      skinTemp: 'Temperatura de piel',
    },
    rhythmTitle: (series: string) => `Ritmos en ${series}`,
    rhythmSeries: { recovery: 'la recuperación', hrv: 'la HRV' },
    rhythmSubtitle: (
      <>
        Periodograma de Lomb–Scargle: cuánta de la serie explica un ciclo de cada duración. La raya
        roja es el umbral de falsa alarma al 5%, ya corregido por todas las frecuencias examinadas —
        cualquier serie produce picos, y solo cuenta el que la supere. Funciona con huecos sin
        rellenarlos, que es como se fabrica un ciclo semanal inexistente. Solo se le quita la media:
        si tu serie tiene tendencia, se filtra hacia los periodos largos.
      </>
    ),
    weekMark: 'semana',
    noPeak: 'Sin pico que reportar.',
    peak: (period: string, q: string, weeklyIsReal: boolean): ReactNode => (
      <>
        Pico en <b>{period} días</b> (q = {q}).{' '}
        {weeklyIsReal ? 'El ciclo semanal supera el umbral.' : 'El ciclo semanal no lo supera.'}
      </>
    ),
    noPeakOverThreshold: (period: string): ReactNode => (
      <>
        Ningún ciclo supera el umbral. El pico más alto está en {period} días y es lo que el ruido
        produce solo.
      </>
    ),
    spectrumDays: (n: string) => `${n} días`,
    periodogramWhat: 'el periodograma',
    weekdayTitle: 'Recuperación por día de la semana',
    weekdaySubtitle: (base: string) =>
      `Diferencia frente a tu media del rango (${base}). Aquí es donde se ven los viernes.`,
  },

  sleep: {
    doseTitle: 'Dosis y respuesta: horas de sueño contra recuperación',
    doseSubtitle: (
      <>
        Cada punto gris es una noche. Los puntos de color son la media de recuperación dentro de
        grupos de igual tamaño, con su intervalo al 95%, y la curva es un LOESS local lineal. Lo que
        hay que mirar es la forma: si la curva se aplana, las horas de más allá de ese punto ya no
        compran recuperación, y eso es justo lo que un coeficiente de correlación no puede mostrar
        porque solo sabe describir rectas. Es la asociación cruda, sin ajustar por nada más.
      </>
    ),
    doseX: 'Horas de sueño',
    doseY: 'Recuperación',
    doseWhat: 'la curva de dosis y respuesta',
    architectureTitle: 'Arquitectura del sueño',
    architectureWeekly:
      'Cada barra es una semana (promedio por noche), partida por fase. Baja el rango a 90 días para ver noche a noche.',
    architectureDaily: 'Cada barra es una noche, partida por fase.',
    stages: { deep: 'Profundo', rem: 'REM', light: 'Ligero', awake: 'Despierto' },
    kpiSleep: 'Sueño medio',
    kpiEfficiency: 'Eficiencia',
    kpiConsistency: 'Consistencia',
    kpiDebt: 'Deuda media',
    windowTitle: 'Tu ventana de sueño',
    windowSubtitle:
      'Hora de acostarte y de levantarte, noche por noche. Mientras más planas las líneas, mejor tu consistencia.',
    bedtime: 'Me acuesto',
    wakeTime: 'Me levanto',
    bedtimeSd: (value: string): ReactNode => (
      <>
        Desviación estándar de la hora de acostarte: <b>{value}</b>.
      </>
    ),
    scatterTitle: 'Sueño y recuperación',
    scatterSubtitle: 'Horas dormidas frente al score de esa misma mañana.',
    scatterX: 'Horas dormidas',
    scatterY: 'Recuperación',
    performanceTitle: 'Rendimiento del sueño frente a lo que necesitabas',
    performanceSubtitle: 'Sleep performance = dormido / necesidad calculada por WHOOP.',
    performanceSeries: 'Rendimiento',
    compositionTitle: 'Composición: REM y profundo',
    compositionSubtitle:
      'Porcentaje del tiempo dormido, suavizado a 7 días para que se vea la tendencia y no el ruido.',
    remDaily: 'REM diario',
    deepDaily: 'Profundo diario',
  },

  training: {
    irfTitle: 'Cuántos días te dura una sesión dura',
    irfSubtitle: (
      <>
        Recuperación de hoy contra el strain de cada uno de los siete días anteriores, en una sola
        regresión y controlando por horas de sueño, día de la semana y mes. El punto de cada rezago
        es el efecto de ese día por separado; donde la banda cruza el cero, ese rezago no se
        distingue de no tener efecto. Errores estándar HAC (Newey–West), que es lo que corresponde
        porque el residuo de un día arrastra el del anterior — con errores corrientes esta banda
        saldría alrededor de un tercio más angosta. Para leerlo como «lo que cuesta entrenar» hace
        falta suponer que no hay nada omitido que mueva a la vez el strain y la recuperación, y
        entrenar más justo los días en que amaneciste bien es exactamente eso.
      </>
    ),
    irfLabel: 'Recuperación',
    irfWhat: 'la respuesta de la recuperación al strain',
    cumulative: (value: string, low: string, high: string): ReactNode => (
      <>
        <b>Multiplicador acumulado: {value}</b> por cada punto de strain sostenido durante toda la
        semana (IC 95%: {low} a {high}).
      </>
    ),
    noLagBites: 'Ningún rezago individual se separa de cero en este rango.',
    lastLagBites: (lag: number, days: string) => `El golpe todavía se nota ${lag} ${days} después.`,
    irfFooter: (n: string, bandwidth: string, r2: string) =>
      `${n} días · banda de Bartlett de ${bandwidth} días · R² ${r2}`,
    distributionTitle: 'Cómo se reparten tus días de strain',
    distributionSubtitle: (
      <>
        Histograma de strain diario con su densidad kernel encima. Las dos lecturas fallan en
        direcciones opuestas —las barras son honestas sobre dónde están los días pero su forma se
        mueve con los bordes de los grupos; la curva es suave pero su forma es una elección de ancho
        de banda— así que lo que sobrevive a las dos vale la pena nombrarlo. La prueba de abajo no
        cuenta jorobas a un ancho de banda elegido: busca el ancho más grande que todavía deja dos,
        y pregunta por bootstrap si una muestra realmente de una sola joroba necesitaría uno así.
      </>
    ),
    distributionWhat: 'la distribución del strain',
    distributionAxis: 'Strain del día',
    bimodal: (low: string, high: string, p: string, separation: string): ReactNode => (
      <>
        <b>
          Tu strain diario tiene dos modas, no una: alrededor de {low} y de {high}.
        </b>{' '}
        La prueba de ancho de banda crítico de Silverman rechaza la unimodalidad con p {p}, y el
        valle entre las dos baja al {separation}% por debajo de la más baja de ellas. Eso es
        entrenar o descansar, con poco en medio — y es la razón de que cualquier dispersión con el
        strain en el eje x salga partida en dos nubes.
      </>
    ),
    unimodal: (p: string): ReactNode => (
      <>
        <b>Una sola moda.</b> La prueba de Silverman no rechaza la unimodalidad (p {p}): tus días de
        strain forman un solo grupo con cola, no dos regímenes separados.
      </>
    ),
    modalityShort: (modes: number, p: string) =>
      `${modes} ${modes === 1 ? 'moda' : 'modas'} al ancho de banda dibujado · p ${p} contra unimodalidad`,
    modalityBandwidth: (drawn: string, critical: string) =>
      `ancho de banda ${drawn}, crítico ${critical}`,
    doseTitle: 'Dosis y respuesta: strain de hoy contra recuperación de mañana',
    doseSubtitle: (
      <>
        Cada punto gris es un día. Los puntos de color son la media de recuperación dentro de grupos
        de igual tamaño, con su intervalo al 95%, y la curva es un LOESS local lineal. Un
        coeficiente de correlación resume todo esto en un solo número y por construcción solo puede
        describir una recta; acá se ve dónde la relación deja de serlo. Es la asociación cruda: no
        está ajustada por nada.
      </>
    ),
    doseX: 'Strain del día',
    doseY: 'Recuperación al día siguiente',
    doseWhat: 'la curva de dosis y respuesta',
    heatmapTitle: 'Qué disciplinas entran y salen',
    heatmapSubtitle: (
      <>
        Una fila por actividad, una columna por semana, y el color es el strain que esa disciplina
        acumuló esa semana. Es lo que ningún otro panel muestra: la serie de strain las suma todas y
        la tabla de actividades aplana el rango entero en una media, así que un bloque que termina
        en marzo y uno que empieza en abril se ven idénticos en las dos. Acá son dos bloques. Las
        semanas van seguidas, de la primera a la última, para que un mes sin entrenar se lea como un
        mes sin entrenar.
      </>
    ),
    heatmapWhat: 'el mapa de carga por actividad',
    heatmapHidden: (activities: string, strain: string) =>
      `${activities} actividades más quedaron fuera del mapa, con ${strain} de strain entre todas.`,
    acwrTitle: 'Carga aguda contra carga crónica',
    acwrSubtitle:
      'Media de strain a 7 días sobre la de 28 días. Por encima de 1,3 la carga sube más rápido de lo que la aguantas.',
    strainTitle: 'Strain diario y su media móvil',
    strainSeries: 'Strain',
    mean7: 'Media 7d',
    activitiesTitle: 'Actividades del rango',
    activitiesEmpty: 'No hay actividades en este rango.',
    colActivity: 'Actividad',
    colSessions: 'Sesiones',
    colTime: 'Tiempo',
    colMeanStrain: 'Strain medio',
    colMeanHr: 'FC media',
    zonesTitle: 'Reparto por zona de frecuencia cardiaca',
    zonesSubtitle: 'Minutos totales del rango en cada zona.',
    zone: (n: number) => `Zona ${n}`,
    volumeTitle: 'Volumen semanal',
    volumeSubtitle: 'Minutos de actividad acumulados por semana.',
    volumeSeries: 'Minutos',
  },

  models: {
    title: 'Explorador de modelos',
    subtitle: (
      <>
        Arma una regresión y córrela por el mismo motor que el resto del tablero: mínimos cuadrados
        con errores HAC, porque todo lo que se puede construir acá es una serie diaria contra otra.
        No hay interruptor para cambiar el estimador de varianza — la única razón para querer HC1
        acá sería que el intervalo saliera más angosto.
      </>
    ),
    builderTitle: 'Especificación',
    dependent: 'Variable dependiente',
    regressors: 'Regresores',
    regressorsHint:
      'Lo que estás preguntando. Estos son los coeficientes que cuentan en la familia.',
    controls: 'Controles',
    controlsHint:
      'Lo que estás dejando fijo. Son ajuste, no hipótesis, así que no entran en la corrección.',
    add: 'Agregar',
    remove: 'Quitar',
    lagSameDay: 'mismo día',
    lagDays: (n: number) => `−${n} ${n === 1 ? 'día' : 'días'}`,
    weekdayFixedEffects: 'Efectos fijos de día de la semana',
    monthFixedEffects: 'Efectos fijos de mes',
    needRegressor:
      'Agrega al menos un regresor. La variable dependiente al mismo día no cuenta: sería y contra y.',
    familyTitle: 'Familia acumulada de esta sesión',
    family: (specifications: number, tests: number): ReactNode => (
      <>
        <b>
          {specifications} {specifications === 1 ? 'especificación' : 'especificaciones'} · {tests}{' '}
          {tests === 1 ? 'coeficiente' : 'coeficientes'} en la familia
        </b>
        . Los <b>q</b> de la tabla están corregidos por Benjamini–Hochberg sobre todos ellos, no
        sobre este modelo solo. Cada especificación nueva empeora los q de las anteriores, y así
        tiene que ser: buscar entre pares hasta que algo salga significativo produce significancia
        por construcción. El contador se reinicia al recargar la página, así que este número es un
        piso de cuánto has buscado, nunca un techo.
      </>
    ),
    familyReset: 'Reiniciar el contador',
    resultsTitle: 'Coeficientes',
    colTerm: 'Término',
    colRole: 'Papel',
    colCoef: 'Coef.',
    colCi: 'IC 95%',
    colSe: 'EE',
    colP: 'p',
    colQ: 'q',
    roleRegressor: 'regresor',
    roleControl: 'control',
    fitFooter: (n: string, k: string, r2: string, bandwidth: string) =>
      `${n} días completos · ${k} parámetros · R² ajustado ${r2} · banda de Bartlett de ${bandwidth} días`,
    coefficientUnit: (unit: string, dependent: string) =>
      `Cada coeficiente está en ${unit ? unit : 'unidades'} de ${dependent} por unidad del término.`,
    perParameter: (value: string) => `${value} observaciones por parámetro`,
    dropped: (terms: string) => `Descartados por colinealidad: ${terms}`,
    insufficientWhat: 'este modelo',
    guard: (perParameter: string, floor: string): ReactNode => (
      <>
        El explorador se apaga por debajo de {perParameter} observaciones por parámetro, con piso de{' '}
        {floor}. Es el punto donde la cobertura real del intervalo HAC deja de empeorar; por debajo,
        una banda «al 95%» acierta una de cada cinco veces menos de lo que dice. La justificación
        está medida en <code>docs/metricas.md</code> §6.10.
      </>
    ),
    scatterTitle: (x: string, y: string) => `${x} contra ${y}`,
    scatterSubtitle: (
      <>
        El primer regresor contra la dependiente, sobre exactamente las filas que usó el ajuste. Es
        la asociación cruda: el coeficiente de arriba está ajustado por todo lo demás del modelo y
        este dibujo no, así que si discrepan, la diferencia es lo que hacen los controles.
      </>
    ),
    presetsTitle: 'Especificaciones guardadas',
    presetName: 'Nombre',
    presetSave: 'Guardar la actual',
    presetsEmpty: 'Todavía no has guardado ninguna. Se guardan en tu navegador, como el export.',
    presetDelete: 'Borrar',
    ci95: (low: string, high: string) => `${low} a ${high}`,
    groups: {
      recovery: 'Recuperación',
      sleep: 'Sueño',
      training: 'Entrenamiento',
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
      recovery: 'Recuperación',
      hrv: 'HRV',
      hrvZ: 'z de HRV',
      rhr: 'Pulso en reposo',
      skinTemp: 'Temperatura de piel',
      spo2: 'SpO₂',
      respiratoryRate: 'Frecuencia respiratoria',
      sleepHours: 'Horas de sueño',
      sleepEfficiency: 'Eficiencia del sueño',
      sleepConsistency: 'Consistencia horaria',
      sleepPerformance: 'Rendimiento del sueño',
      sleepDebt: 'Deuda de sueño',
      sleepNeed: 'Necesidad de sueño',
      deep: 'Sueño profundo',
      rem: 'Sueño REM',
      light: 'Sueño ligero',
      awake: 'Tiempo despierto',
      remShare: '% REM',
      deepShare: '% profundo',
      bedtime: 'Hora de acostarse',
      wakeTime: 'Hora de levantarse',
      napMinutes: 'Siestas',
      strain: 'Strain',
      acwr: 'Carga aguda / crónica',
      workoutMinutes: 'Minutos de actividad',
      workoutCount: 'Número de actividades',
      calories: 'Calorías',
      maxHr: 'FC máxima',
      avgHr: 'FC media',
    },
  },

  habits: {
    noJournal: (
      <>
        No cargaste <code>journal_entries.csv</code>. Esa es la tabla que convierte el tablero en
        algo que WHOOP no te da: el efecto de cada hábito sobre tu recuperación.
      </>
    ),
    alignmentAria: 'Alineación temporal',
    alignmentSameDay: 'Recuperación del mismo día',
    alignmentNextDay: 'Recuperación del día siguiente',
    adjustedTitle: 'Efecto de cada hábito, con todo lo demás igual',
    adjustedSubtitle: (
      <>
        Una sola regresión con todos los hábitos a la vez, más horas de sueño, strain de ayer, hora
        de acostarte y efectos fijos de día de la semana y mes. Cada coeficiente es la diferencia en
        puntos porcentuales entre días que responden igual en todo lo demás del modelo. Errores
        estándar HAC, porque el residuo de una serie diaria arrastra el del día anterior. Se marca
        por <b>q</b> de Benjamini–Hochberg y no por p: con una docena de preguntas a la vez, un
        falso positivo a p &lt; 0,05 es el resultado esperado. Para leerlo como «el efecto de este
        hábito» hace falta suponer que no queda fuera del modelo nada que mueva a la vez el hábito y
        la recuperación.
      </>
    ),
    adjustedWhat: 'la regresión de hábitos',
    fitFooter: (n: string, k: string, r2: string, bandwidth: string) =>
      `${n} días completos · ${k} parámetros · R² ajustado ${r2} · banda de Bartlett de ${bandwidth} días`,
    skipped: (count: number): ReactNode => (
      <>
        {' '}
        · {count} {count === 1 ? 'pregunta quedó fuera' : 'preguntas quedaron fuera'} por falta de
        variación o de respuestas
      </>
    ),
    rawTitle: 'Y lo mismo sin ajustar por nada',
    rawSubtitle: (
      <>
        Diferencia simple de medias entre los días que respondiste sí y los que respondiste no, con
        mínimo 8 observaciones por grupo. <b>Está aquí para compararlo con el de arriba.</b> Cuando
        los dos difieren, el ajustado es el que separa efectos: el alcohol llega junto con el fin de
        semana, con acostarse tarde y con dormir menos, y la diferencia de medias le atribuye a la
        bebida el efecto conjunto de las cuatro cosas. WHOOP no documenta a qué noche asigna cada
        respuesta; el botón de arriba mueve las dos estimaciones a la vez.
      </>
    ),
    rawEmpty:
      'Aún no hay preguntas con suficientes respuestas en ambos grupos dentro de este rango. Prueba con “Todo”.',
    detailTitle: 'Detalle',
    detailSubtitle:
      'Medias por grupo y la t de Welch de la diferencia sin ajustar. La columna «ajustado» es el coeficiente del modelo de arriba, que es el que hay que creerle cuando discrepan.',
    colQuestion: 'Pregunta',
    colYes: 'Sí',
    colNo: 'No',
    colRawDelta: 'Δ simple',
    colAdjustedDelta: 'Δ ajustado',
    colQ: 'q',
    colN: 'n sí / n no',
  },

  data: {
    title: 'Tabla diaria consolidada',
    subtitle: 'Los cuatro CSV unidos por día. Cópiala y pégala en Excel, Stata o R.',
    copy: 'Copiar como TSV',
    copied: 'Listo',
    date: 'Fecha',
    columns: {
      recovery: 'Recup %',
      hrv: 'HRV',
      rhr: 'RHR',
      strain: 'Strain',
      calories: 'Calorías',
      sleepHours: 'Sueño h',
      sleepEfficiency: 'Efic %',
      deep: 'Profundo',
      rem: 'REM',
      light: 'Ligero',
      awake: 'Despierto',
      sleepDebt: 'Deuda',
      sleepConsistency: 'Consist %',
      respiratoryRate: 'Resp',
      workoutCount: 'Actividades',
      workoutMinutes: 'Min activ.',
    },
  },
};

export type Messages = typeof es;
