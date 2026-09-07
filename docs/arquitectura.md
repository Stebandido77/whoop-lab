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
   ▼
vistas                         src/views/*.tsx
```

La regla que sostiene todo: **las vistas no calculan**. Si una vista necesita un
número, ese número ya existe en `DayRecord` o sale de una función de
`metrics.ts`. Eso hace que cada indicador tenga exactamente un lugar donde vive,
un lugar donde se prueba y un lugar donde se corrige.

## Las tres capas

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
suficientes, en vez de inventar un número.

`metrics.ts` sí sabe de WHOOP, pero solo a nivel de rango: la tabla de drivers de
recuperación, el efecto de los hábitos, el resumen de actividades, los minutos
por zona y la desviación por día de la semana.

`format.ts` es el único lugar donde se decide cómo se ve un número. Locale
`es-CO`, coma decimal, y helpers específicos (`hoursMinutes`, `clockTime`) para
que no se repitan conversiones en las vistas.

### `src/charts/` — píxeles

Componentes SVG propios. `d3-scale` y `d3-shape` ponen escalas y trayectorias;
todo lo demás (ejes, grilla, tooltip, colores, responsive) es del componente.

Dos detalles que hay que respetar:

- **Los colores se resuelven, no se escriben.** Los atributos de presentación SVG
  no aceptan `var()` de forma confiable, así que `useResolvedColor` lee el valor
  computado del token y lo cachea, e invalida el caché cuando cambia el esquema
  del sistema.
- **El ancho se mide con `ResizeObserver`.** Un `viewBox` calculado con un ancho
  equivocado produce letterboxing: el SVG se escala para caber y queda flotando
  en el centro del panel. `useElementWidth` no repinta por cambios menores a 3 px
  para no entrar en bucles.

El eje X es categórico, no temporal: los días se reparten en bandas iguales. Un
hueco en el export se lee como hueco, no estira las barras vecinas.

### `src/views/` y `src/components/`

Una vista por pestaña. Cada panel es un `<Panel>` con título, subtítulo y una
gráfica. Los subtítulos explican qué mide el gráfico y bajo qué supuesto; son
contenido, no adorno.

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
