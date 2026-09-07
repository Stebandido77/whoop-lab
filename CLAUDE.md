# Guía para Claude Code

Este archivo es el brief permanente del proyecto. Léelo antes de tocar código.

## Qué es esto

Un tablero de análisis para el export de WHOOP, 100% en el navegador. React 19 +
TypeScript estricto + Vite. Sin backend, sin telemetría, sin peticiones de red
después de cargar la página. Esa restricción no es negociable: es la propuesta
de valor del proyecto.

## Idioma

- **Código, nombres de variables, tipos y comentarios: inglés.**
- **Texto visible para la persona usuaria y documentación en `docs/`: español.**
- README raíz en inglés; `README.es.md` en español. Si cambias uno, cambia el otro.

## Reglas de arquitectura

1. **Las vistas no calculan.** Toda métrica derivada se computa una sola vez en
   `buildDayRecords` (`src/lib/whoop/model.ts`) y se guarda en `DayRecord`. Si
   una vista necesita algo nuevo, el campo se agrega al tipo y al modelo, no se
   calcula en el JSX. Los agregados que dependen del rango seleccionado
   (correlaciones, efectos, resúmenes) van en `src/lib/metrics.ts`.
2. **Un color, un lugar.** Todos los colores son custom properties definidas en
   `src/styles/tokens.css`. Los componentes de gráfica reciben el nombre del
   token (`'--hi'`, `'--strain'`) y lo resuelven con `useResolvedColor`. Nunca
   escribas un hex dentro de un componente.
3. **`null` significa "no hay dato", nunca `0`.** El export tiene huecos. Las
   ventanas móviles emiten `null` mientras no haya suficientes observaciones, y
   las correlaciones devuelven `r: null` por debajo de `minN`. No rellenes.
4. **Las fechas son locales.** Nunca uses `toISOString()` para derivar un día:
   corre la fecha a UTC y mueve las noches de día. Usa `dayKey` de
   `src/lib/format.ts`.
5. **El día de un ciclo es la mañana en que viste el score.** Se toma de
   `Wake onset`; si falta, se desplaza el `Cycle start time` de la noche. Esa
   convención está en `cycleDay` y de ella dependen todos los lags.
6. **Sin dependencias nuevas sin justificación.** El bundle actual está por
   debajo de 130 kB gzip. Si una librería nueva no gana más de lo que pesa, no
   entra.

## Antes de dar por terminado un cambio

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Los cuatro tienen que pasar. Si tocaste parseo o estadística, agrega la prueba
correspondiente en `src/test/`: ese código es el que no se puede romper en
silencio, porque un error ahí produce gráficas que se ven bien y están mal.

## Cómo agregar un indicador nuevo

1. Si es un valor por día, agrégalo a `DayRecord` en `src/lib/whoop/types.ts`,
   calcúlalo en `finalize` o `attachWindows` de `model.ts` y escribe una prueba.
2. Si es un agregado sobre el rango, ponlo en `src/lib/metrics.ts` con su tipo
   de retorno explícito.
3. Móntalo en la vista con `<Panel>` y el componente de gráfica que corresponda.
   Si ninguno sirve, primero pregúntate si un `TimeSeriesChart` con otra serie
   resuelve; recién después crea un componente nuevo en `src/charts/`.
4. Escribe el subtítulo del panel diciendo **qué significa el número y qué no**.
   Los subtítulos son parte del producto, no decoración: el objetivo es que la
   persona interprete bien, no que se impresione.

## Cómo hablarle a la persona usuaria

Los textos de la interfaz son directos y sin humo. Nada de "¡Excelente
recuperación!". Se dice qué mide el gráfico, con qué supuesto y con cuántas
observaciones. Cuando algo es observacional, se dice que es observacional.
Cuando WHOOP no documenta algo (por ejemplo a qué noche asigna una respuesta del
diario), se expone la ambigüedad y se le da control a la persona en vez de
esconderla.

## Trabajo pendiente

`docs/roadmap.md` tiene la lista de indicadores especificados y todavía no
construidos, ordenada por relación valor/esfuerzo. `docs/metricas.md` define la
fórmula de cada uno. Empieza por ahí antes de inventar métricas nuevas.

## Cosas que no hay que hacer

- No agregar analítica, telemetría ni ninguna llamada de red en tiempo de
  ejecución. Rompe la promesa del proyecto.
- No subir CSV de ejemplo con datos reales de nadie. Para pruebas está el
  generador sintético en `src/lib/demo.ts`.
- No convertir esto en "coach con IA". El valor está en mostrar la serie y el
  supuesto, no en dar veredictos.
