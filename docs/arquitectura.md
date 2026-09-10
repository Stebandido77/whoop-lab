# Arquitectura

## El flujo, de punta a punta

```
archivos (.zip / .csv)
   │  readExportFiles          src/lib/whoop/parse.ts
   ▼
WhoopExport                    cycles[] · sleeps[] · workouts[] · journal[]
   │  buildDayRecords          src/lib/whoop/model.ts
   ▼
DayRecord[]                    una fila por día, con TODAS las derivadas
   │  selectWindow(range)      src/state/store.ts
   ▼
{ days, previous }
   │  métricas del rango       src/lib/metrics.ts
   │  o una especificación     src/lib/explorer.ts + src/lib/fields.ts
   │      └─ estimadores       src/lib/econ/*
   ▼
vistas                         src/views/*.tsx  (una por pestaña, React.lazy)
   │  textos                   src/lib/i18n/{es,en}.tsx
   ▼
pantalla
```

La regla que sostiene todo: **las vistas no calculan**. Si una vista necesita un
número, ese número ya existe en `DayRecord` o sale de una función de
`metrics.ts`. Eso hace que cada indicador tenga exactamente un lugar donde vive,
un lugar donde se prueba y un lugar donde se corrige.

## Las cuatro capas

### `src/lib/whoop/` — todo lo que sabe de WHOOP

`columns.ts` traduce encabezados a campos. WHOOP ha renombrado columnas más de
una vez y el texto cambia entre idiomas y niveles de membresía, así que el mapeo
normaliza el encabezado (sin acentos, minúsculas, sin caracteres no
alfanuméricos) y busca subcadenas. **El orden de `FIELD_MATCHERS` importa**: el
primer matcher que acepta un encabezado se lo queda. Por eso las duraciones de
fase de sueño están listadas antes del `duration` genérico de actividades; si
no, "Asleep duration (min)" se leería como la duración de un entrenamiento.

Cada campo lista su fragmento en inglés y su fragmento en español, porque una
cuenta en español recibe el export **entero** traducido: `sueño.csv`,
`entrenamientos.csv` y todos los encabezados. Los fragmentos en español son
largos a propósito (`duraciondelsueno`, no `sueno`): el export repite los mismos
sustantivos en una docena de columnas y un fragmento corto le robaría el
encabezado a otro campo. `detectKind` tiene, además de la detección por nombre,
un respaldo por encabezado para cada uno de los cuatro archivos, porque el
nombre deja de servir apenas cambia el idioma.

`parse.ts` convierte texto a valores. Dos decisiones que parecen menores y no lo
son:

- **Los timestamps se parsean a mano.** `new Date(string)` arrastra la fecha a
  UTC y en Bogotá (GMT-5) eso mueve las noches un día. Se extraen las partes con
  una expresión regular y se construye un `Date` local.
- **El día de un ciclo es la mañana en que viste el score**, no la noche en que
  empezó. Se toma de `Wake onset`; si falta, un ciclo que arranca a las 18:00 o
  más tarde se asigna al día siguiente. Todos los rezagos del proyecto
  (`recoveryNext`, `strainPrev`) dependen de esa convención.

`model.ts` hace el join y las derivadas. Materializa también los días sin datos,
para que las ventanas móviles y el calendario corran sobre un eje temporal real
en vez de comprimir los huecos.

`types.ts` es la definición de qué existe. Si agregas un indicador diario,
empieza por acá.

### `src/lib/` — matemática y presentación de números

`stats.ts` no sabe nada de WHOOP: medias, desviaciones, Pearson con p-valor por
la distribución t, regresión lineal, t de Welch y ventanas móviles. Todo ignora
nulos de forma pairwise-complete y devuelve `null` cuando no hay datos
suficientes, en vez de inventar un número. Exporta además la distribución t
—`studentCdf`, `tTest` y `tQuantile` por bisección— porque es de donde salen los
p-valores y los valores críticos de toda la capa `econ/`, y la convención de
colas se decide una sola vez.

`metrics.ts` sí sabe de WHOOP, pero solo a nivel de rango: la tabla de drivers de
recuperación, el efecto de los hábitos, el resumen de actividades, los minutos
por zona, la desviación por día de la semana y la distribución del strain.

`fields.ts` y `explorer.ts` son la excepción a la regla de que los agregados de
rango viven en `metrics.ts`, y es deliberada. El explorador de modelos no es un
indicador: es un subsistema con su propio catálogo tipado de columnas, su propia
gramática de especificaciones, su propia persistencia y su propia contabilidad de
multiplicidad. Meterlo en `metrics.ts` habría llevado ese archivo a novecientas
líneas sin que nada de eso fuera reutilizable desde fuera de una pestaña. La
regla que sigue en pie, y es la que importa, es que **la vista no calcula**:
`ModelsView` arma una `Specification` y llama a `runSpecification`.

`fields.ts` define qué columnas de `DayRecord` puede tocar el explorador, con su
escala de presentación. Es una lista curada y no `keyof DayRecord`: las medias
móviles quedan fuera porque regresar una serie contra su propia media móvil es
una identidad mecánica, y `recoveryNext`/`strainPrev` quedan fuera porque el
selector de rezago ya los expresa. El razonamiento completo está en
[metricas.md §7.1](metricas.md#71-qué-es--implementado).

`format.ts` es el único lugar donde se decide cómo se ve un número. El locale es
**mutable**: `setFormatLocale` lo cambia a `es-CO` o a `en-GB` y vacía los cachés
de `Intl`. Los formateadores se llaman desde el render y leen el locale en el
momento de la llamada, así que basta con que el conmutador de idioma mueva el
locale **antes** de disparar el re-render, que es lo que hace `setLang` en el
store. Un contexto de React habría obligado a pasar un hook por cada hoja que
imprime un número, que son casi todas.

Los nombres de mes y de día salen de `Intl` y no de un arreglo, pero las etiquetas
se **componen** (`11 sept`, `jue 10 sept 26`) en vez de pedirle el patrón entero a
`Intl.DateTimeFormat`: los patrones de locale son frases —`es-CO` devuelve
«11 de sept» y le mete una coma al día de la semana— y estas etiquetas van debajo
de un eje cada pocos píxeles. También se le quita el punto final a la
abreviatura, que el español pone y el inglés no. Lo único que asume la composición
es que el día va antes del mes, cierto en los dos idiomas que habla la app.

Los helpers específicos (`hoursMinutes`, `clockTime`) siguen ahí para que no se
repitan conversiones en las vistas.

### `src/lib/econ/` — el motor econométrico

La capa que estima. `stats.ts` responde preguntas de una o dos variables;
`econ/` responde las que necesitan un modelo, y cada estimador vive en su propio
módulo con sus propias pruebas:

| módulo            | qué estima                                                    |
| ----------------- | ------------------------------------------------------------- |
| `ols.ts`          | mínimos cuadrados multivariados por QR, con errores HC1 o HAC |
| `lag.ts`          | rezagos distribuidos y el multiplicador acumulado             |
| `delta.ts`        | combinaciones lineales y razones de coeficientes por delta    |
| `multiplicity.ts` | q-valores de Benjamini–Hochberg                               |
| `smooth.ts`       | binscatter y LOESS de grado 1                                 |
| `breaks.ts`       | CUSUM tabular y puntos de cambio por segmentación binaria     |
| `spectral.ts`     | periodograma de Lomb–Scargle con nivel de falsa alarma        |
| `density.ts`      | histograma, densidad kernel, prueba de modalidad y huecos     |

Las fórmulas y los supuestos de cada uno están en
[metricas.md §6](metricas.md#6-métodos-econométricos). Acá van las decisiones de
diseño que no son estadística sino arquitectura:

- **`econ/` no sabe de WHOOP.** Recibe arreglos de números y nombres de columna.
  Quien traduce `DayRecord` a una matriz de diseño es `metrics.ts`, igual que
  hoy traduce a los argumentos de `pearson`. Un estimador que conociera
  `recoveryNext` sería imposible de probar contra un caso con respuesta
  conocida, que es exactamente lo que estos módulos tienen que permitir.
- **Sin dependencias.** QR de Householder con pivoteo, la beta incompleta que ya
  estaba en `stats.ts` y trigonometría. Nada de esto pesa lo que pesaría una
  librería de álgebra lineal.
- **Un estimador nunca devuelve un número frágil.** El tipo de retorno es
  `Resultado | Insufficient`, donde `Insufficient` lleva `{ n, minN, missing }`.
  Eso es lo que permite la regla del proyecto: por debajo del n mínimo el panel
  se apaga con «faltan 14 días» en vez de dibujar una estimación que se ve igual
  de convincente con doce observaciones que con doscientas. Un `null` no
  alcanzaría, porque no sabe cuántas faltan.
- **El intervalo viaja con el coeficiente.** El tipo `Estimate` es
  `{ coef, se, t, p, ciLow, ciHigh }` y no hay forma de obtener un coeficiente
  sin su intervalo. Es una restricción de tipos a propósito: lo que es fácil de
  omitir se omite.
- **`vcov` es obligatorio en `ols`, por la misma razón.** Elegir el estimador de
  varianza equivocado no falla: devuelve intervalos del ancho equivocado, que se
  dibujan igual de convincentes. Poner un valor por omisión sería elegir por
  quien llama y no decírselo, así que el tipo obliga a escribir `hc1` o `hac`.
  `distributedLag` sí tiene un default —`hac`— porque a diferencia de `ols` sabe
  exactamente qué diseño está estimando; está argumentado en metricas.md §6.2.
- **Los p-valores que salen de acá están sin corregir**, y eso está documentado
  en el tipo. Cualquier vista que muestre más de una prueba a la vez tiene que
  pasarlas por `benjaminiHochberg` y marcar por q.

Las pruebas están en `src/test/econ.*.test.ts` y todas siguen el mismo patrón:
generar datos con la respuesta metida a mano —coeficientes conocidos, un salto
en una posición conocida, una sinusoide de periodo conocido— y exigir que el
estimador la recupere. El ruido sale de `src/test/random.ts`, un generador
congruencial con semilla, porque una prueba numérica que falla una vez de cada
veinte enseña a ignorarla. Donde la afirmación es estadística y no exacta, se
compara contra el propio error estándar del estimador y no contra una tolerancia
inventada: una cota más angosta que una desviación estándar solo estaría
probando la semilla.

Esta es la parte del proyecto que no se puede romper en silencio. Un error de
parseo se ve; un error en la matriz de covarianzas produce intervalos que se
dibujan perfectos y son mentira.

### `src/charts/` — píxeles

Componentes SVG propios. `d3-scale` y `d3-shape` ponen escalas y trayectorias;
todo lo demás (ejes, grilla, tooltip, colores, responsive) es del componente.

Tres detalles que hay que respetar:

- **Los colores se resuelven, no se escriben.** Los atributos de presentación SVG
  no aceptan `var()` de forma confiable, así que `useResolvedColor` lee el valor
  computado del token y lo cachea, e invalida el caché cuando cambia el esquema
  del sistema. Para categorías sin orden —tipos de actividad— está
  `CATEGORICAL_TOKENS` en `primitives.ts`: ocho tokens ordenados para que dos
  vecinos de la lista queden lejos en tono, y un token apagado para todo lo que
  pase de ocho. El corte en ocho es real y no un marcador: pasando de ahí nadie
  empareja un cuadrito con su entrada de leyenda, y lo honesto es escribir «otras
  cuatro» en vez de repartir cuatro colores que se ven iguales. Quien llama ordena
  las categorías primero, así que la novena siempre es la más pequeña.
- **El ancho se mide con `ResizeObserver`.** Un `viewBox` calculado con un ancho
  equivocado produce letterboxing: el SVG se escala para caber y queda flotando
  en el centro del panel. `useElementWidth` no repinta por cambios menores a 3 px
  para no entrar en bucles.
- **El elemento medido tiene que ser el mismo nodo en todos los estados.** El
  observador se engancha una sola vez, en un efecto con dependencias vacías. Si el
  retorno temprano de «todavía no sé mi ancho» devuelve un elemento distinto del
  que devuelve el render real, React monta otro nodo, el observador se queda
  midiendo el que quedó desconectado y el ancho nunca se corrige. Pasó en
  `CircadianClock`: el marcador de posición era el contenedor entero y el dibujo
  real una columna de 560 px, así que el `viewBox` se quedó en 1170 y el SVG se
  pintó a la mitad de tamaño. El arreglo es que el `ref` no cambie de sitio nunca;
  lo que cambia es lo que va adentro.

El eje X es categórico, no temporal: los días se reparten en bandas iguales. Un
hueco en el export se lee como hueco, no estira las barras vecinas.

Las tres gráficas de estimación siguen las mismas reglas y agregan una propia:
**el intervalo se dibuja siempre**, y la forma del punto dice si el efecto se
separó de cero.

- `CoefficientPlot` — forest plot horizontal, ordenado por magnitud, con línea
  en cero. El punto va lleno y con asterisco solo cuando el **q** de
  Benjamini–Hochberg pasa el umbral; marcar por p en una gráfica que es una
  familia de pruebas por construcción garantizaría una estrella sobre ruido.
- `IrfChart` — coeficiente por rezago con banda sombreada al 95%. La banda es
  una sola forma continua y no barras sueltas: lo que se lee es la _forma_ de la
  respuesta —cuándo llega, qué tan rápido decae— y una fila de barras invita a
  leer cada rezago como un hallazgo propio.
- `BinScatterChart` — nube cruda en baja opacidad, medias por bin con su
  intervalo, y curva LOESS encima. Calcula sus propios bins y su propia curva a
  partir de los puntos, igual que `ScatterChart` ajusta su propia recta: son
  lecturas de los mismos datos, no métricas nuevas, así que no le deben nada a
  `metrics.ts`.
- `HistogramChart` — barras y densidad kernel sobre el mismo eje, con las modas
  marcadas y la antimoda como raya vertical. Las dos capas y no una: las barras
  son honestas sobre dónde están las observaciones pero su forma se mueve con los
  bordes de los grupos, y la curva es suave pero su forma es una elección de
  ancho de banda. Las barras se dibujan como densidad y no como conteo para que
  la curva pueda compartirles el eje sin una segunda escala que malinterpretar.
- `CircadianClock` — polar de 24 horas con la ventana de sueño, cada sesión en su
  hora de inicio y un anillo de recuperación por hora de despertar. Es la única
  gráfica del proyecto con su leyenda **al lado** y no debajo: la esfera es
  cuadrada, así que en un panel ancho dejaría dos columnas vacías, y una leyenda
  bajo un círculo queda lejos de la marca que explica. Los radios de cada anillo
  están en una sola constante (`RING`), de modo que mover un anillo es cambiar un
  número.
- `ActivityHeatmap` — actividad contra semana ISO, sombreada por el strain
  acumulado. Las celdas conservan su tamaño y la rejilla hace scroll, por la misma
  razón que el calendario: un año exprimido en el ancho del panel es una fila de
  astillas de un píxel.
- `SpectrumChart` — periodograma con eje x logarítmico en el periodo y la línea
  de falsa alarma. El eje es logarítmico porque ahí la resolución del estimador
  es aproximadamente uniforme; en lineal, todo ciclo más corto que una quincena
  queda aplastado en el primer centímetro, que es justo la zona que importa para
  un hábito diario.

`TimeSeriesChart` acepta además `markers`: anotaciones fechadas que se dibujan
**sobre la serie que anotan** y no en un panel aparte, porque una fecha solo
significa algo al lado de la línea que interrumpe. `break` es una raya vertical
para un cambio de régimen; `high` y `low` son banderines para una señal de carta
de control.

`useResolvedColor` invalida su caché por dos vías, y hacen falta las dos: el
`change` de `matchMedia('(prefers-color-scheme: dark)')` para el esquema del
sistema, y un `MutationObserver` sobre el atributo `data-theme` del elemento raíz
para una elección explícita. Con solo la primera —como estuvo hasta ahora— las
gráficas ya montadas seguían pintando con la paleta anterior hasta que algo las
remontara. `tokens.css` ya declara las tres variantes (claro, oscuro del sistema,
oscuro explícito), así que un conmutador de tema en el encabezado no necesita nada
más que escribir el atributo.

### `src/lib/i18n/` — los dos idiomas

Un objeto por idioma y un hook. Sin librería: `es.tsx` es la fuente de verdad de
la **forma** del catálogo y `en.tsx` está anotado con `Messages = typeof es`, así
que una clave agregada de un lado y olvidada del otro no es una cadena en español
colándose en una página en inglés, es un error de `npm run typecheck`.

Los valores que interpolan son funciones y no plantillas con `{count}`, porque un
marcador dentro de una cadena no puede llevar un `<b>` y la mitad de estos
subtítulos lo necesitan. Una función se ensancha a su firma y no a un literal, que
es justo la verificación que queremos sacarle a `typeof`. Por eso los catálogos son
`.tsx`.

`core.ts` está separado a propósito —detección, persistencia y el tipo `Lang`, sin
React y sin el store— para que `state/store.ts` lo pueda importar sin un ciclo;
`index.ts` es el que trae `useMessages`, y ese sí importa el store.

Reglas del flujo:

- **`econ/` y `metrics.ts` no escriben prosa.** Donde antes había una etiqueta hay
  un id (`DriverId`, `ElasticityId`) y donde había un motivo en español hay un
  código (`RatioProblem`). La capa que estima no puede tener idioma; si lo tuviera,
  agregar el segundo obligaría a tocarla.
- **Las gráficas traducen lo suyo.** Los estados vacíos, los tooltips y las
  leyendas viven en `messages.charts` y los componentes llaman a `useMessages()`
  ellos mismos, porque la misma gráfica dice lo mismo donde sea que se monte. Las
  props de texto siguen existiendo para sobreescribir un caso puntual.
- **Español es el default.** `navigator.language` solo concede inglés cuando lo
  pide; una elección manual gana y sobrevive al recargar, en `localStorage`.

### El mapa de chunks

Cada pestaña es un `React.lazy` con su propio chunk, y `<Suspense>` muestra
`ViewSkeleton`, que dibuja cajas con la altura de los paneles reales de esa
pestaña. Un spinner sobre una página vacía colapsaría el documento a la altura del
encabezado y empujaría el pie de página un instante después, que se lee como que
el layout se rompió y no como que el contenido está llegando.

| chunk             | gzip       | cuándo se descarga                           |
| ----------------- | ---------- | -------------------------------------------- |
| `index` + CSS     | 82 kB      | siempre (React son 61 de esos)               |
| `parse`           | 40 kB      | al soltar un archivo, nunca antes            |
| `metrics`         | 15 kB      | con la primera pestaña (metrics + econ + d3) |
| `TimeSeriesChart` | 3,6 kB     | compartido por cuatro pestañas               |
| una vista         | 0,8–3,4 kB | al abrir su pestaña                          |
| `demo`            | 1,7 kB     | con `?demo=1` o el botón de la demo          |

Lo que hay que cuidar al tocar esto:

- **No importes `@/views` como barril.** Se borró justamente por eso: un import del
  barril vuelve a meter las seis vistas en quien lo importe y deshace la partición.
- **`ImportView` importa `@/lib/whoop/parse` de forma dinámica.** JSZip y PapaParse
  son 40 kB gzip y no hacen falta hasta que cae un archivo; para entonces la
  pantalla ya dice «Leyendo…».
- **Los dos catálogos viajan en el chunk de entrada** (16 kB gzip entre los dos).
  Es el precio de que `useMessages()` sea síncrono, y con el presupuesto en 130 kB
  sobra margen para pagarlo.

### `src/views/` y `src/components/`

Una vista por pestaña. Cada panel es un `<Panel>` con título, subtítulo y una
gráfica. Los subtítulos explican qué mide el gráfico y bajo qué supuesto; son
contenido, no adorno.

#### La retícula se recompone: `PanelGrid`

**Ningún estado de la aplicación puede dejar un hueco.** Con una muestra corta
—que es la de cualquiera que acabe de comprar la pulsera— media docena de paneles
se apagan a la vez, y una retícula escrita a mano en cada vista producía dos
cosas que se leen como error de maquetación y no como decisión: un panel vivo de
5 columnas al lado de uno apagado de 7, con media pantalla vacía, y el panel
apagado estirado a la altura de la gráfica que no dibuja para mostrar dos líneas.

`PanelGrid` resuelve eso en un solo lugar. La regla es una sola y de ella sale
todo lo demás: **una fila siempre mide doce columnas exactas.** Los paneles se
empacan en orden en filas que quepan y lo que a una fila le falte se reparte
entre sus miembros. Un panel vivo varado junto a uno apagado queda solo en su
fila —una frontera entre encendidos y apagados cierra la fila— y crece hasta
llenarla. Una racha de apagados se redeclara angosta para que compartan fila,
porque su contenido ya no es una gráfica sino una barra de progreso y una tabla
corta. El orden nunca se toca: la secuencia de paneles es el argumento que hace
la vista, y reordenarla para empacar mejor sería reescribir ese argumento.

El algoritmo puro vive en `components/panelLayout.ts` con sus pruebas, incluida
una que recorre cuatrocientas combinaciones de anchos y estados y exige que toda
fila mida doce.

**Cómo se declara un panel apagable.** La vista sigue escribiendo JSX; lo que
cambia es que el `<Panel>` recibe el resultado del estimador:

```tsx
<Panel span={12} state={irf} needs={['recovery', 'strain', 'sleepHours']} what={…}>
  {irf.ok && <IrfChart points={irf.lags} … />}
</Panel>
```

`PanelGrid` lee `span` y `state` de sus hijos directos en vez de recibir una
lista de descriptores. La versión con descriptores fue la otra candidata y pierde
algo real: el cuerpo de un panel es JSX que estrecha su propio tipo
(`{irf.ok && …}`), y meterlo en un objeto de datos convierte cada cuerpo en un
thunk o en un cast. El costo es que **un panel tiene que ser hijo directo**: un
componente que esconda un `<Panel>` adentro es invisible para la retícula. Por eso
`Elasticities` y `Highlights` de la vista de resumen devuelven el contenido y no
el panel.

El ancho resuelto viaja como custom property `--span` y no como clase, porque el
resolvedor produce cualquier ancho de 1 a 12. La clase `.grid-panel` es la que
limita la regla a los paneles que la retícula sí gobierna: `.grid > .panel` a
secas también agarraba las tarjetas de KPI —que son `.panel` dentro de su propia
retícula anidada, con clase `.span-3`— y les ganaba en especificidad, así que
cada tarjeta salía a ancho completo.

#### El estado apagado tiene contenido: `PanelOff`

Un panel que solo dice «faltan 94 días» desperdicia el espacio y, peor, deja sin
responder la pregunta que el lector sí tiene: qué **se puede** decir con lo que ya
hay. `PanelOff` usa ese espacio para tres cosas:

1. **Una barra de progreso** hacia el n mínimo, con el conteo.
2. **Cuándo se enciende.** No es «hoy más los días que faltan»: la ventana es
   móvil, así que si es más corta que el mínimo no se enciende nunca —y lo que
   corresponde decir es que se amplíe el rango— y si ya está llena, un día nuevo
   empuja uno viejo y esperar no la agranda. Solo cuando la ventana tiene sitio
   un día más significa una fila más, y aun ahí se dice el supuesto: que cada día
   a partir de hoy traiga un registro completo.
3. **Descriptivos de las variables que el panel habría usado**: media, desviación,
   n y cuántos días faltan por cada una. Ninguna de esas cuatro necesita mínimo,
   así que son verdad hoy. Y cuando una sola columna es la que cuesta las filas
   —la eliminación listwise hace que una variable rala decida la muestra de
   todo— se nombra: «sin ella habría 142 días completos».

Las tres salen de `metrics.ts` §10 y se prueban ahí. `PanelOff` necesita las filas
del rango y las recibe por contexto desde `PanelGrid`, no por prop: pasar `days`
por cuarenta `<Panel>` sería cargar en todos una prop que solo importa en un
estado.

`NotEnough` sigue existiendo para un resultado insuficiente **anidado dentro** de
un panel encendido —la prueba de modalidad dentro del histograma de strain—, donde
una barra de progreso y una tabla serían desproporcionadas.

## Estado

Un store de Zustand con el export crudo, los `DayRecord`, las preguntas del
diario, el rango y la pestaña. `selectWindow` corta la ventana visible y la
ventana inmediatamente anterior del mismo tamaño, que es lo que hace posible el
"vs. periodo anterior" de las tarjetas.

## Persistencia

IndexedDB con `idb-keyval`. localStorage no alcanza: un diario de tres años son
varios miles de filas. Al leer se revive cualquier fecha que haya vuelto como
string, porque no todos los navegadores conservan `Date` en el structured clone.

## Desarrollo con datos reales

Con `npm run dev`, si hay CSV en `data/` la app arranca directamente con ellos y
se salta la pantalla de importación. El encabezado dice **«datos locales de
data/»**, con el mismo mecanismo que anuncia la demo sintética: el store guarda
un campo `source` (`'file' | 'demo' | 'local'`) y `App.tsx` elige el subtítulo.

```
data/**/*.csv
   │  import.meta.glob(query: '?raw')   src/lib/localData.ts
   ▼
readLocalData()  ->  ingestCsv (el mismo del drop zone)
   ▼
setExport(data, { source: 'local' })
```

Reglas del flujo:

`?demo=<días>` genera esa cantidad de días en vez de los 420 por omisión. Existe
por una razón: casi todos los paneles tienen muestra mínima, y la única forma de
ver cómo se ven por debajo de ella —que es lo que ve cualquiera con una cuenta
recién estrenada— es pedir una muestra corta. `?demo=58` es el escenario contra
el que se revisó la retícula.

- **`data/` gana sobre IndexedDB.** Mientras haya CSV en la carpeta, esa es la
  fuente. «Cargar otro export» sigue funcionando y sobreescribe lo cargado
  durante la sesión, pero al recargar la página vuelve a mandar `data/`. Si
  quieres volver al export guardado, vacía la carpeta.
- **Lo que sale de `data/` no se persiste.** La carpeta ya es la copia durable;
  cachearla en IndexedDB solo serviría para que sobreviva a borrarla.
- **Si `data/` está vacía no cambia nada:** se restaura el último import desde
  IndexedDB, exactamente como antes.

### Por qué esto no puede llegar a producción

`src/lib/localData.ts` inlinea el texto de los CSV. Un bundle que los cargara
publicaría el historial de salud de alguien, así que hay **dos guardas
independientes** y cada una basta por sí sola:

1. El único import del módulo está detrás de `import.meta.env.DEV` en `App.tsx`.
   Vite lo reemplaza por el literal `false`, así que la rama y su import dinámico
   son código muerto antes de que Rollup empiece.
2. `stripLocalData` en `vite.config.ts` (`apply: 'build'`) reemplaza el
   contenido del módulo por un stub vacío durante `vite build`.

Comprobado desactivando cada una: con la guarda 1 sola el módulo no aparece en
`dist/`; con la guarda 2 sola aparece un chunk de 0,05 kB sin un solo dato;
desactivando ambas, el bundle se lleva los CSV completos en un chunk de 256 kB.

Si tocas cualquiera de las dos, vuelve a verificar:

```bash
npm run build
grep -rE '2026-|Duración del sueño|Inicio de la vigilia|UTC-05:00' dist/
```

No debe imprimir nada. Ajusta el año y los encabezados a los de tu export.

### El fixture

`npm run fixture` lee `data/`, toma la ventana de ciclos más reciente y escribe
en `src/test/fixtures/` una copia anonimizada que **sí** se versiona: fechas
desplazadas a 1987, ruido en los valores fisiológicos, preguntas del diario
recortadas a una lista neutra. `src/test/fixtures/README.md` detalla qué se
transforma y por qué; `src/test/fixture.test.ts` corre el pipeline completo
sobre ella y verifica las invariantes que ninguna fila escrita a mano
reproduce: un registro por día sin huecos, `recoveryNext` alineado con el día
siguiente y ni un `NaN`.

El script corre con `node --experimental-strip-types`, así que lo único que
importa de `src/` es `columns.ts`, que no tiene dependencias. Necesita Node
22.6 o superior; el `.nvmrc` ya apunta a 22.
