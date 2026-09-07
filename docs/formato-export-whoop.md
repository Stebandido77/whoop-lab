# El export de WHOOP

## Cómo pedirlo

En la app: **More → App Settings → Data Export**. En Android el menú es
**More → Data Export**. Confirmas el correo, le das a _Create Export_ y llega un
correo con asunto _Your WHOOP Export is Ready_ con un enlace de descarga.

- Un export cada 24 horas, sin excepción.
- El enlace caduca; descárgalo apenas llegue.
- En la práctica llega en menos de una hora, aunque la app avise que puede tardar 24.

## Qué trae el ZIP

Cuatro CSV. Los nombres pueden variar levemente, por eso el parser detecta el
tipo por encabezados además de por nombre.

### El export sale en el idioma de tu cuenta

Esto no está documentado en ningún lado y es la primera cosa que rompe un
parser. Una cuenta en español no recibe los archivos de abajo: recibe
`physiological_cycles.csv`, `sueño.csv`, `entrenamientos.csv` y
`journal_entries.csv` — dos traducidos y dos no — con **todos** los encabezados
en español:

```
Hora de inicio del ciclo · Puntuación de recuperación (%)
Frecuencia cardíaca en reposo (lpm) · Variabilidad de la frecuencia cardíaca (ms)
Temp. cutánea (grados centígrados) · Oxígeno en sangre % · Esfuerzo del día
Inicio del sueño · Inicio de la vigilia · Duración del sueño (min) · Siesta
Nombre de la actividad · Esfuerzo de actividad · Zona FC 1% · Duración (min)
Texto de la pregunta · Respondió "Sí" · Notas
```

Por eso `normalizeHeader` pliega los acentos antes de comparar (`ñ` -> `n`,
`ó` -> `o`) y cada matcher de `FIELD_MATCHERS` lista las dos variantes. Si
aparece un export en un tercer idioma, ese es el único archivo que hay que
tocar.

### `physiological_cycles.csv`

Una fila por **ciclo fisiológico**, que va desde que te duermes hasta que te
duermes la noche siguiente, no por día calendario. Es el archivo más importante:
trae recuperación, HRV, pulso en reposo, strain, calorías y el resumen del sueño
del ciclo.

Columnas observadas:

```
Cycle start time · Cycle end time · Cycle timezone
Recovery score % · Resting heart rate (bpm) · Heart rate variability (ms)
Skin temp (celsius) · Blood oxygen % · Day Strain · Energy burned (cal)
Max HR (bpm) · Average HR (bpm) · Sleep onset · Wake onset
Sleep performance % · Respiratory rate (rpm)
Asleep duration (min) · In bed duration (min) · Light sleep duration (min)
Deep (SWS) duration (min) · REM duration (min) · Awake duration (min)
Sleep need (min) · Sleep debt (min) · Sleep efficiency % · Sleep consistency %
```

### `sleeps.csv`

Una fila por sueño, incluidas las siestas (columna `Nap`). En el modelo se usa
para separar siestas y como respaldo si por alguna razón faltan los ciclos.

### `workouts.csv`

Una fila por actividad, con duración, strain de la actividad, frecuencias
cardiacas y el reparto porcentual por zona. **No incluye sesiones de Strength
Trainer**, solo las actividades del estilo clásico. Tampoco trae la serie de
frecuencia cardiaca dentro de la sesión.

### `journal_entries.csv`

Una fila por respuesta: `Question text`, `Answered yes` y `Notes`. Es la tabla
que hace posible el panel de hábitos.

## Lo que el export NO trae

A inicios de 2026: actividades de recuperación, stress diario, pasos y VO2 Max.
Si necesitas esos campos, toca la API v2. WHOOP apagó la v1 el 1 de octubre de
2025; la v2 usa UUID y OAuth 2.0, así que cualquier script viejo dejó de
funcionar en esa fecha.

## Ambigüedades conocidas

**A qué noche pertenece una respuesta del diario.** WHOOP no lo documenta y la
respuesta razonable depende de cómo interpretes el ciclo. Por eso el panel de
hábitos tiene un conmutador entre "recuperación del mismo día" y "recuperación
del día siguiente", y el texto le pide a la persona que compare con lo que
muestra la app. Esconder la ambigüedad detrás de una sola cifra sería peor que
mostrarla.

**Zonas horarias.** `Cycle timezone` existe pero los timestamps ya vienen en hora
local. El parser los trata como hora de pared. Si viajas con frecuencia entre
husos, las horas de acostarte van a reflejar la hora local de cada lugar, que es
casi siempre lo que quieres, pero puede inflar la variabilidad de tu hora de
dormir.
