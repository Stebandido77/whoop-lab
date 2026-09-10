# Catálogo de métricas

Cada entrada define la fórmula, de dónde salen los insumos y cómo se debe (y no
se debe) leer. Los indicadores marcados como **pendiente** todavía no existen en
el código; su especificación ya está cerrada, así que implementarlos es trabajo
mecánico. El orden de prioridad está en [roadmap.md](roadmap.md).

---

## 1. Recuperación

### 1.1 Media móvil de recuperación (7 y 28 días) — implementado

Media aritmética trailing de `Recovery score %`, ignorando días sin dato. Emite
`null` mientras menos del 40 % de la ventana tenga observaciones.

Se lee como tendencia. Un día en rojo no significa nada; tres semanas de media a
la baja sí.

### 1.2 Línea base de HRV y z-score — implementado

Base = media móvil de 28 días de `Heart rate variability (ms)`.
z = (HRV del día − base) / desviación estándar móvil de 28 días.

El valor absoluto de HRV no es comparable entre personas ni entre etapas de la
vida. El z-score sí es comparable contigo mismo. Por debajo de −1 hay señal; por
debajo de −2, señal fuerte.

### 1.3 Pulso en reposo y su base — implementado

Media móvil a 7 y 28 días de `Resting heart rate (bpm)`. Subidas sostenidas del
RHR suelen anticipar enfermedad, alcohol o carga acumulada mejor que la HRV,
porque es menos ruidoso.

### 1.4 Drivers de recuperación — implementado

Correlación de Pearson entre cada candidato y el score de recuperación, pairwise
complete, con n mínimo de 8. `strainPrev` y `recoveryNext` existen en el modelo
para expresar rezagos sin desplazar arreglos en las vistas.

**Es observacional.** Ordena hipótesis, no establece causalidad.

### 1.5 Desviación por día de la semana — implementado

Media de recuperación por día de la semana menos la media del rango. Se muestra
como desviación y no como nivel porque las diferencias son de pocos puntos y en
escala absoluta todas las barras se ven iguales.

### 1.6 Coeficiente de variación de la HRV — **pendiente**

CV = desviación estándar móvil de 28 días / media móvil de 28 días, en
porcentaje.

Un CV que sube con la media estable indica un sistema autónomo inestable. Es un
complemento del z-score, no un sustituto: el z te dice dónde estás hoy, el CV te
dice qué tan errático has estado.

### 1.7 Índice compuesto de enfermedad — **pendiente**

Promedio de los z-scores a 28 días de: RHR (signo positivo), frecuencia
respiratoria (positivo), temperatura de piel (positivo) y HRV (negativo). Marcar
los días con índice > 1,5.

Sirve para responder "¿me estaba enfermando la semana pasada?" sin depender de
que hayas registrado nada en el diario. Presentarlo como marcador visual sobre
la serie de recuperación, nunca como diagnóstico.

### 1.8 Rachas — **pendiente**

Racha más larga de días con recuperación ≥ 67 % y ≥ 34 %, y la racha actual.
Barato de calcular y de las cosas que la gente más comparte.

---

## 2. Sueño

### 2.1 Arquitectura del sueño — implementado

Barras apiladas de profundo, REM, ligero y despierto. Por encima de 120 días en
el rango se agrega por semana (promedio por noche), porque 365 barras de 1 px no
comunican nada.

### 2.2 Ventana de sueño y variabilidad de la hora de acostarse — implementado

`bedtime` en minutos desde medianoche, desplazado a 720–2160 para que 00:30
quede después de 23:00. `wakeTimeAdjusted` = hora de despertar + 1440, para que
las dos líneas vivan en un eje continuo y la banda entre ellas sea la ventana
real de sueño.

La desviación estándar de la hora de acostarse es la métrica de consistencia más
legible que hay: son minutos, no un índice.

### 2.3 Composición REM y profundo — implementado

Porcentaje sobre el tiempo dormido, suavizado a 7 días con los valores diarios de
fondo en baja opacidad. El dato diario es demasiado ruidoso para leerse solo.

### 2.4 Sleep Regularity Index (SRI) — **pendiente**

Porcentaje de probabilidad de estar en el mismo estado (dormido o despierto) en
el mismo minuto de dos días consecutivos, escalado a −100..100.

```
SRI = 200 · ( (1/(M(N-1))) · Σ_i Σ_m 1[estado(i,m) = estado(i+1,m)] ) − 100
```

Requiere reconstruir el estado minuto a minuto desde `Sleep onset` y `Wake
onset` (aproximación de bloque; el export no trae hipnograma). Es la métrica de
regularidad con más respaldo en la literatura y WHOOP no la muestra.

### 2.5 Punto medio del sueño y jet lag social — **pendiente**

Punto medio = (bedtime + wakeTimeAdjusted) / 2.
Jet lag social = |punto medio de fin de semana − punto medio entre semana|, en
minutos.

Una sola cifra que resume el costo de correr el horario los fines de semana.

### 2.6 Aporte de las siestas — **pendiente**

`napMinutes` ya se calcula pero no se muestra. Panel: minutos de siesta por día,
y comparación de recuperación entre días con y sin siesta, con el mismo criterio
de n mínimo del panel de hábitos.

### 2.7 Deuda de sueño acumulada — **pendiente**

WHOOP ya entrega `Sleep debt (min)`. Falta la vista: serie con el acumulado y la
identificación de los episodios en que la deuda superó las 2 horas y cuántos días
tomó bajarla.

---

## 3. Entrenamiento

### 3.1 ACWR (carga aguda sobre crónica) — implementado

Media móvil de strain a 7 días dividida por la de 28 días. Por encima de 1,3 la
carga sube más rápido de lo que el cuerpo asimila; por debajo de 0,8 estás
descargando.

Es un indicador prestado del fútbol y el rugby y tiene críticas metodológicas
serias. Se muestra porque es útil como guardarraíl, no como verdad.

### 3.2 Reparto por zona de frecuencia cardiaca — implementado

Minutos por zona = (porcentaje de la zona / 100) × duración, sumado sobre todas
las actividades del rango.

### 3.3 Volumen semanal — implementado

Minutos de actividad agregados por semana ISO.

### 3.4 Monotonía y strain de Foster — **pendiente**

```
monotonía = media semanal de strain diario / desviación estándar semanal
strain    = media semanal · monotonía
```

Monotonía alta con volumen alto es el patrón clásico previo a una lesión por
sobreuso. Requiere agregación semanal, que `byWeek` ya provee.

### 3.5 Índice de polarización — **pendiente**

(minutos en zonas 1–2) / (minutos en zonas 4–5), por semana. Para ver si el
entrenamiento está polarizado o atrapado en la zona media.

### 3.6 Costo por tipo de actividad — **pendiente**

Para cada `Activity name` con al menos 8 sesiones: media de la recuperación del
día siguiente tras esa actividad, contra la media general. Contesta "¿qué me
cuesta más caro, el tenis o la pesa?", que es exactamente lo que WHOOP no
responde.

### 3.7 Eficiencia cardiaca — **pendiente**

Strain de la actividad / frecuencia cardiaca media, por sesión, para una misma
actividad a lo largo del tiempo. Una tendencia al alza sugiere mejora de
condición física a igual esfuerzo percibido.

---

## 4. Hábitos (diario)

### 4.1 Efecto univariado — implementado

Para cada pregunta: media de recuperación en días "sí" menos media en días "no",
en puntos porcentuales, con t de Welch y ambos tamaños de muestra. Mínimo 8
observaciones por grupo.

La alineación temporal es conmutable porque WHOOP no documenta a qué noche
asigna cada respuesta.

### 4.2 Corrección por comparaciones múltiples — **pendiente**

Con 15 preguntas evaluadas a la vez, esperar un falso positivo a p < 0,05 es lo
normal. Aplicar Benjamini–Hochberg sobre los p-valores y mostrar la columna q.
Es un cambio de dos funciones que mejora enormemente la honestidad del panel.

### 4.3 Efecto multivariado — **pendiente**

Regresión lineal de recuperación sobre todas las respuestas booleanas del diario
más horas de sueño y strain del día anterior como controles. Mostrar
coeficientes con error estándar.

El panel univariado confunde: el alcohol se correlaciona con el fin de semana,
con acostarse tarde y con dormir menos. La regresión separa esos efectos. El
estimador ya existe: `ols` de [§6.1](#61-mínimos-cuadrados-multivariados--ols),
con errores HC1. Falta la vista, y pasar los p-valores por
[§6.3](#63-corrección-por-comparaciones-múltiples--benjaminihochberg) antes de
marcar nada.

### 4.4 Interacciones — **pendiente**

Al menos una: alcohol × horas de sueño. Responde si dormir más compensa haber
tomado, que es una pregunta que la gente sí se hace.

### 4.5 Efecto sobre HRV y sueño, no solo sobre recuperación — **pendiente**

El mismo cálculo del 4.1 con la variable dependiente seleccionable: recuperación,
HRV, eficiencia del sueño, % REM.

---

## 5. Transversales

### 5.1 Comparación año contra año — **pendiente**

Superponer el mismo periodo del año anterior sobre cualquier serie temporal.
Requiere que `TimeSeriesChart` acepte una serie alineada por índice, no por
fecha.

### 5.2 Anotaciones — **pendiente**

Marcadores verticales con etiqueta sobre las series: "empecé a entrenar en
ayunas", "viaje", "COVID". Se guardan junto al export en IndexedDB.

Es lo que convierte el tablero en un cuaderno de laboratorio.

### 5.3 Simulador — **pendiente**

Con los coeficientes de la regresión de 4.3, un panel con controles deslizantes
(horas de sueño, strain, alcohol sí/no) que muestre la recuperación predicha y su
intervalo. Debe dejar claro que es una predicción del modelo ajustado a tus
datos, no una promesa.

### 5.4 Exportar gráficas — **pendiente**

Descargar cualquier panel como SVG y como PNG. Como todo se dibuja en SVG propio,
serializar el nodo y pasarlo por un canvas es directo.

---

## 6. Métodos econométricos

Esta sección especifica los estimadores de `src/lib/econ/`. No son indicadores:
son la maquinaria con la que se calculan los indicadores de las secciones
anteriores que necesitan más que una media o una correlación (§4.2, §4.3, §4.4,
§5.3). Cada uno vive en un módulo propio, no depende de ninguna librería y tiene
pruebas contra casos con respuesta conocida en `src/test/econ.*.test.ts`.

### Reglas que aplican a todos

1. **Toda estimación reporta n.** Un coeficiente sin su n no es un resultado.
2. **Por debajo del n mínimo no se estima.** Los estimadores devuelven
   `{ ok: false, n, minN, missing }` en vez de un número frágil, y `missing` es
   exactamente lo que el panel escribe: «faltan 14 días».
3. **Los intervalos de confianza son parte de la estimación**, nunca un extra
   opcional. Un coeficiente se dibuja con su intervalo o no se dibuja.
4. **Toda familia de pruebas pasa por Benjamini–Hochberg.** Se marca por q,
   nunca por p.
5. **Nada de esto es causal.** Son datos observacionales de una sola persona sin
   asignación aleatoria. Los métodos separan asociaciones de otras asociaciones;
   no separan causas.

### 6.1 Mínimos cuadrados multivariados — `ols`

Regresión de y sobre una matriz de diseño, resuelta por **descomposición QR de
Householder con pivoteo por columnas**, no por ecuaciones normales.

El motivo es de condicionamiento. Un diseño con efectos fijos de día de semana y
de mes mete decenas de columnas indicadoras casi paralelas; formar XʹX eleva al
cuadrado el número de condición y Cholesky o falla o —peor— devuelve
coeficientes equivocados en la tercera cifra sin avisar. QR trabaja sobre X
directamente. El pivoteo, además, regala la detección de rango: se puede pasar
el juego completo de indicadoras más el intercepto y la columna redundante se
descarta con nombre (`dropped`) en vez de producir una matriz singular. Una
columna se considera combinación lineal de las anteriores cuando su norma
residual cae por debajo de 10⁻¹² de la mayor norma inicial.

#### El sándwich: `vcov` es obligatorio

Los errores estándar salen de un sándwich `(XʹX)⁻¹ Ω̂ (XʹX)⁻¹ · n/(n−k)`, y lo
único que cambia entre los dos estimadores disponibles es Ω̂. **`vcov` no tiene
valor por omisión**: elegir mal no produce un error, produce intervalos del
ancho equivocado, así que quien llama tiene que declarar qué supuesto está
dispuesto a hacer. El tipo lo exige y el compilador lo cobra.

**`vcov: 'hc1'` — robusto a heterocedasticidad.**

```
Ω̂ = Σᵢ uᵢ² xᵢxᵢʹ
```

La varianza del residuo de la recuperación no es constante: los días de
recuperación baja están más dispersos que los altos. Con errores clásicos los
intervalos salen demasiado angostos justo donde importa. Correcto para un corte
transversal —una comparación entre actividades, por ejemplo— donde nada
relaciona una observación con la siguiente.

**`vcov: 'hac'` — Newey–West con núcleo de Bartlett.**

```
Ω̂ = Γ̂₀ + Σ_{ℓ=1}^{L} (1 − ℓ/(L+1)) (Γ̂_ℓ + Γ̂_ℓʹ)
Γ̂_ℓ = Σ_t u_t u_{t−ℓ} x_t x_{t−ℓ}ʹ
```

HC1 supone que cada observación aporta información propia. En una serie diaria
eso es falso: lo que quedó fuera del modelo y es persistente —un bloque de
entrenamiento, un resfriado, una racha de mal sueño— aparece en u_t y otra vez
en u_{t+1}. El «tamaño de muestra efectivo» es entonces mucho menor que n, y HC1
no lo sabe. HAC estima la varianza de largo plazo del score xᵢuᵢ en vez de su
varianza contemporánea, que es la cantidad que realmente gobierna la dispersión
del coeficiente.

El núcleo de Bartlett no es decorativo: truncar la suma con pesos iguales puede
dar un Ω̂ que no es semidefinido positivo, y por lo tanto una varianza negativa.
El taper triangular no puede.

`L` es el truncamiento de rezagos. Por omisión, la regla de Newey–West
`floor(4·(n/100)^(2/9))` — 4 rezagos para 150 días, 5 para 300, 6 para 1000.

**Los huecos cuentan como huecos.** Ω̂ se arma recorriendo pares de
observaciones separadas por menos de `L` **en el tiempo**, no en posición del
arreglo. Después de la eliminación listwise las filas ya no son consecutivas, y
emparejar los dos días a lado y lado de una quincena sin datos metería en Ω̂ una
correlación que los datos nunca mostraron. Por eso `ols` acepta `times`.

#### Qué tan mal está HC1 acá, medido

Cobertura empírica de un intervalo nominal al 95% sobre un proceso generado con
regresor persistente (AR 0,8) y errores AR(ρ), 1000 réplicas por celda:

| ρ    |   n | cobertura HC1 | cobertura HAC | SE_hac / SE_hc1 |
| ---- | --: | ------------: | ------------: | --------------: |
| 0,00 | 300 |         94,0% |         92,8% |           0,98× |
| 0,30 | 300 |         86,4% |         91,8% |           1,19× |
| 0,50 | 300 |         79,4% |         89,4% |           1,35× |
| 0,70 | 300 |         70,4% |         87,0% |           1,55× |
| 0,85 | 300 |         61,2% |         83,9% |           1,73× |

Dos lecturas. La primera: con ρ = 0,7 un intervalo «al 95%» calculado con HC1
falla tres de cada diez veces. La segunda, más importante, es que **la cobertura
de HC1 no mejora con n** —69,0% con 150 días, 69,1% con 600— porque el problema
no es falta de datos sino un estimador que converge al número equivocado. La de
HAC sí mejora (83,9% → 87,0% → 89,4%), que es como se ve un estimador
consistente.

Devuelve coeficientes, errores estándar, estadísticos t, p-valores bilaterales
contra t(n−k), intervalos al 95%, R², R² ajustado, la matriz de covarianzas,
(XʹX)⁻¹, y `vcovType` y `bandwidth` para que el panel pueda decir cuál usó.

**Filas con cualquier dato faltante se eliminan enteras** (listwise). Imputar
inventaría la covarianza que el modelo mide.

**Supuestos.** Para que un coeficiente signifique «el efecto de esta variable
manteniendo las demás fijas» hace falta que las variables omitidas relevantes no
estén correlacionadas con las incluidas. Es un supuesto fuerte y en general
falso: el alcohol viene con el fin de semana, con acostarse tarde y con dormir
menos. Controlar por lo que se puede medir acerca el número a lo que parece,
pero no lo convierte en un experimento.

Sobre el p-valor: con `hac` deja de suponer observaciones independientes, que
era el supuesto que las series diarias rompen de entrada. Lo que **no** deja de
suponer es que la muestra alcanza para estimar bien la varianza de largo plazo.
La tabla de arriba lo muestra: aun con HAC la cobertura real ronda el 87–89% y
no el 95%, porque el estimador es consistente pero sesgado hacia abajo en
muestras finitas. Subir el ancho de banda no lo arregla —medido a ρ = 0,7 y
n = 300: 87,0% con L = 5, 88,5% con L = 20, 86,9% con L = 40—; con L grande se
cambia sesgo por varianza del propio Ω̂. **Un panel que escriba «IC 95%» sobre
un ajuste HAC está escribiendo algo más cercano al 88%.** Es mucho mejor que el
70% de HC1, y sigue sin ser lo que dice la etiqueta.

### 6.2 Modelo de rezagos distribuidos — `distributedLag`

```
y_t = α + Σ_{k=minLag}^{K} β_k · x_{t−k} + controles_t + u_t
```

K configurable. `minLag` es 1 por omisión: por la convención de día del proyecto
el score de recuperación es el número que viste en la mañana, así que el strain
del mismo día calendario ocurrió después y no puede explicarlo.

Reporta cada β_k con su intervalo al 95% —qué tan rápido llega el efecto y
cuánto dura— y el **multiplicador acumulado** Σβ_k, que es la respuesta a un
cambio sostenido durante toda la ventana. El error estándar del acumulado sale
del **método delta**: para g(β) = Σβ_k el gradiente es un vector de unos, así
que

```
Var(Σβ_k) = 1ᵀ V 1     sobre el bloque de rezagos de V
```

Sumar los errores estándar en cuadratura daría otro número y estaría mal: un
driver autocorrelacionado produce coeficientes correlacionados entre sí, y esas
covarianzas tienen que estar dentro de la banda. La implementación suma el
bloque completo de rezagos de V, con sus términos fuera de la diagonal.

**Este es el único estimador de la capa con un `vcov` por omisión, y es `hac`.**
`ols` se niega a elegir porque no puede saber qué le están pasando; acá sí se
sabe exactamente qué es: una serie diaria regresada contra su propio pasado
reciente. En ese diseño los residuos quedan autocorrelacionados prácticamente
por construcción, y HC1 reportaría bandas del orden de un tercio más angostas de
lo que corresponde. Pedir HC1 acá tiene que ser un acto deliberado. El índice de
día se le pasa a `ols` como `times`, así que una racha sin datos rompe la
ventana de Bartlett en vez de cerrarse en silencio.

**Qué supuesto queda vivo aun con HAC.** El más importante, y no es el de la
varianza: **HAC corrige la inferencia, no la especificación.** Ensancha la banda
alrededor del coeficiente que sea; no lo corrige. Si el modelo está mal
especificado dinámicamente —el caso concreto acá es omitir el propio rezago de
la recuperación, que es una serie muy persistente— entonces los rezagos del
strain recogen parte de esa persistencia y los β_k están sesgados. HAC, frente a
eso, no hace absolutamente nada: da un intervalo honesto alrededor de un número
que no es el que se quería estimar. Un residuo autocorrelacionado es señal de
que puede faltar dinámica en el modelo, y tratarlo solo como un problema de
errores estándar es tapar el síntoma.

Los otros dos, ya mencionados en §6.1, siguen en pie: la cobertura real de la
banda ronda el 88% y no el 95%, y nada de esto vuelve causal a un dato
observacional.

**Supuestos.** Los de §6.1, más uno propio: la especificación asume que el
efecto se agota en K días. Si el horizonte verdadero es más largo, lo que quede
afuera se va al residuo y sesga el acumulado.

### 6.3 Corrección por comparaciones múltiples — `benjaminiHochberg`

Procedimiento step-up sobre el vector de p-valores de una familia:

```
q₍ᵢ₎ = mín sobre j ≥ i de  (m/j) · p₍ⱼ₎ ,  acotado a 1
```

El mínimo corrido desde arriba es lo que garantiza monotonía; sin él un p mayor
podría salir con un q menor.

Controla la **tasa de falsos descubrimientos**: q = 0,10 dice «de las que marqué,
espero que una de cada diez sea ruido». Bonferroni controla otra cosa —la
probabilidad de _un solo_ falso positivo en toda la familia— y con quince
preguntas del diario es tan conservador que ningún efecto real sobrevive. Con
quince pruebas a p < 0,05, un falso positivo es el resultado esperado, no mala
suerte.

Los p-valores faltantes pasan como `null` y **no cuentan en m**: una prueba que
no se pudo correr no es una prueba que salió nula.

**Supuesto.** El procedimiento controla la FDR bajo independencia o bajo
dependencia positiva de los estadísticos. Las respuestas del diario están
correlacionadas entre sí —quien tomó anoche también se acostó tarde— y esa
dependencia es en general positiva, que es el caso favorable.

### 6.4 Binscatter — `binscatter`

Agrupa x en cuantiles de **igual número de observaciones** y devuelve, por
grupo, la media de x, la media de y, el error estándar de la media y su
intervalo.

Dos años de datos diarios son setecientos puntos superpuestos en los que el ojo
encuentra lo que ya esperaba. Veinte medias condicionales con barra de error
muestran la forma de la relación sin imponerle una forma funcional y —esto es lo
que una recta ajustada esconde— muestran dónde la relación deja de ser una
recta.

Bins de igual conteo y no de igual ancho, para que cada barra de error pese lo
mismo. El costo: una variable con muchos empates (un booleano, un conteo
redondeado) reparte valores idénticos entre bins vecinos; esas variables van a
una comparación de grupos, no acá. Los bins con menos de `minPerBin`
observaciones se descartan en vez de dibujarse sin error.

### 6.5 Suavizador LOESS de grado 1 — `loess`

En cada punto de una grilla, un ajuste **lineal** local sobre la fracción
`bandwidth` de vecinos más cercanos, ponderado por el núcleo tricúbico
w = (1 − (d/d_máx)³)³.

Grado 1 y no grado 0 porque una media local está sesgada dondequiera que la
curva tenga pendiente, y de forma más visible en los dos extremos, que es
justamente donde alguien mira para preguntarse «¿sigue subiendo?». Una recta
local no tiene ese sesgo: reproduce exactamente una relación lineal, con
cualquier ancho de banda.

El ancho de banda es toda la decisión editorial. Suficientemente chico y la
curva traza el ruido; suficientemente grande y se vuelve la recta de mínimos
cuadrados. Es un parámetro y no una constante precisamente para que el panel
pueda decir cuál usó.

### 6.6 CUSUM tabular de dos colas — `cusum`

Sobre la serie estandarizada z = (x − centro) / escala:

```
C⁺ᵢ = máx(0, C⁺ᵢ₋₁ + zᵢ − k)      C⁻ᵢ = máx(0, C⁻ᵢ₋₁ − zᵢ − k)
```

Señal cuando cualquiera de los dos supera h. k es la holgura en desviaciones
estándar —la mitad del salto que interesa detectar es la elección usual— y h el
intervalo de decisión.

Una media móvil responde «dónde está el nivel ahora»; CUSUM responde **«cuándo
cambió»**, que es otra pregunta y la que vale la pena hacerle a una serie donde
el valor diario es casi todo ruido. Al acumular excursiones pequeñas detecta una
deriva de media sigma que ningún día suelto marcaría, y fecha el cruce en vez de
dejar que alguien lo calcule a ojo sobre una línea suavizada.

Los dos acumuladores **se reinician al disparar**. Sin eso, un solo cambio real
deja la gráfica saturada durante meses y cada día siguiente parece una alarma
nueva.

`reference` define cuántos días iniciales fijan la línea base. Por omisión es la
serie entera, que pregunta «¿qué días se salen del periodo como un todo?»; con
una ventana que se sabe normal, pregunta «¿algo cambió desde entonces?».

Los días sin dato no se tocan: los acumuladores pasan de largo en vez de recibir
un cero, que contaría un hueco como evidencia de control.

**Supuesto.** Calibrar k y h en desviaciones estándar supone observaciones
independientes y aproximadamente normales. La recuperación diaria está
autocorrelacionada, así que la tasa real de falsas alarmas es más alta que la
nominal. Léase como detector de cambios, no como prueba.

### 6.7 Puntos de cambio en media — `changePoints`

Segmentación binaria: sobre un segmento se busca el corte que minimiza la suma
de cuadrados agrupada de las dos mitades, se acepta si el BIC mejora, y se
recurre en cada mitad.

```
ΔBIC = n · ln(SSE_corte / SSE_entero) + 2 · ln(n)   ,  se acepta si es negativo
```

La penalización cobra **dos** parámetros por quiebre —la nueva media _y_ la
ubicación— porque el punto de corte también se estima de los datos. Cobrando
solo la media el criterio es demasiado fácil de satisfacer y una serie
estacionaria vuelve partida en una docena de regímenes falsos.

Corre solo sobre los días observados y reporta la posición en el índice
original, así que una racha sin datos ni esconde un quiebre ni inventa uno.

**Supuesto y límite.** El modelo busca **escalones**, no pendientes. Una deriva
lenta no tiene escalón y el algoritmo la aproxima con una escalera; el subtítulo
del panel tiene que decirlo, porque leer esas fechas como «el día que cambió
algo» sería inventar un evento que no ocurrió.

### 6.9 Combinaciones y razones de coeficientes — `linearCombination`, `ratio`

Dos cantidades que se derivan de un ajuste ya hecho y necesitan su propio error
estándar, porque los coeficientes de una misma regresión casi nunca son
independientes entre sí.

**Combinación lineal.** Para cualquier vector de pesos w,

```
Var(wʹβ) = wʹ V w
```

Los términos fuera de la diagonal son el punto. Sumar errores estándar en
cuadratura responde una pregunta que nadie hizo. `distributedLag` usa esta misma
identidad para el multiplicador acumulado, con w un vector de unos.

**Razón, por método delta.** Para g(β) = ±βₐ/β_b el gradiente es
(±1/β_b, ∓βₐ/β_b²), de modo que

```
Var(g) = (∂g/∂βₐ)² V_aa + (∂g/∂β_b)² V_bb + 2 (∂g/∂βₐ)(∂g/∂β_b) V_ab
```

Es lo que sostiene la tasa marginal de sustitución del panel de resumen:
−β(strain)/β(sueño), las horas de sueño de más que compensan una unidad de
strain. **Dividir dos intervalos de confianza daría otro número y estaría mal**;
el intervalo de una razón no es la razón de los intervalos.

**Cuándo se apaga, y por qué no es prudencia.** `ratio` se niega a devolver un
número cuando el intervalo del denominador cubre el cero. Una razón cuyo
denominador puede ser cero **no tiene cota finita**: el conjunto de confianza
honesto es toda la recta, o dos semirrectas disjuntas. Es el problema de
Fieller. El método delta, que solo mira una linealización local, devolvería
igual una banda simétrica y angosta, y esa banda sería una invención. No hay
tamaño de muestra que lo rescate: la cantidad simplemente no está identificada.

Incluso cuando sí lo está, el método delta es una aproximación de primer orden;
es fiable mientras el denominador esté cómodamente lejos de cero, y se degrada a
medida que se acerca. Para un caso límite lo correcto sería un intervalo de
Fieller, no éste.

### 6.8 Periodograma de Lomb–Scargle — `lombScargle`

```
P(ω) = 1/(2σ²) · [ (Σ dᵢ cos ω(tᵢ−τ))² / Σ cos²ω(tᵢ−τ)
                 + (Σ dᵢ sin ω(tᵢ−τ))² / Σ sin²ω(tᵢ−τ) ]
```

con d = y − ȳ y el desfase τ fijado por tan 2ωτ = Σ sin 2ωtᵢ / Σ cos 2ωtᵢ. Ese
desfase es lo que vuelve el estimador equivalente a ajustar una sinusoide por
mínimos cuadrados en cada frecuencia, y es la razón de que funcione sobre datos
con huecos y muestreo irregular —donde una FFT exigiría rellenar los huecos, y
rellenarlos es exactamente cómo se fabrica un ciclo semanal que no existe.

Normalización de Scargle: bajo ruido blanco la potencia en una frecuencia es
exponencial de media 1, de modo que Pr(P > z) = e⁻ᶻ y la probabilidad de falsa
alarma sobre M frecuencias independientes es 1 − (1 − e⁻ᶻ)^M. M sale de la
fórmula empírica de Horne & Baliunas sobre N y **no** del tamaño de la grilla,
para que sobremuestrear compre resolución sin inflar la significancia.

Por omisión busca periodos entre 2 días (Nyquist del muestreo diario) y la mitad
del rango observado: un solo ciclo no es evidencia de un ciclo.

**Supuesto.** Solo se le quita la media. Una serie con tendencia filtra potencia
hacia los periodos largos, así que hay que quitarle la tendencia antes de
preguntarle qué ciclos tiene tu HRV.

### 6.10 Densidad, modas y huecos en el soporte — `kernelDensity`, `silvermanModality`, `supportGaps`

Tres cosas que responden a la misma pregunta: **qué forma tiene la variable del
eje x**, antes de dibujar nada encima de ella.

#### Densidad kernel

Estimador gaussiano sobre una grilla, con el ancho de banda de Silverman
`0,9 · min(sd, IQR/1,34) · n^(−1/5)` por omisión. El `min` con el rango
intercuartílico escalado protege contra colas pesadas, **no** contra
bimodalidad: en una mezcla de dos jorobas bien separadas los cuartiles caen a
lado y lado del hueco, de modo que IQR/1,34 sale más grande que la desviación
estándar y manda la desviación estándar, que ya viene inflada por la separación.
Por eso la afirmación de bimodalidad no sale de contar jorobas a este ancho.

La grilla se extiende tres anchos de banda más allá del dato extremo. Cortarla
en el mínimo y el máximo observados dejaría un escalón ahí, y un escalón es un
máximo local para cualquier cosa que cuente máximos locales.

Se calcula por binning lineal y convolución y no evaluando el kernel contra cada
observación: el bootstrap de abajo estima unas cuantas centenas de densidades y
la vía directa serían decenas de millones de `exp`.

#### Prueba de ancho de banda crítico de Silverman

**Contar jorobas en una densidad kernel no es un hallazgo, es una elección de
ancho de banda**: agrándalo lo suficiente y todo tiene una moda, achícalo lo
suficiente y todo tiene cien. Esta prueba le quita la elección a quien mira.

Para el kernel gaussiano el número de modas es monótono no creciente en el ancho
de banda, así que existe un único **ancho de banda crítico** h₁: el más pequeño
con el que la segunda moda todavía sobrevive. Un h₁ grande dice que los datos
insisten en dos jorobas incluso bajo mucho suavizado. La monotonía es lo que
vuelve legítima la bisección con la que se le busca.

«Grande comparado con qué» lo contesta el bootstrap. Bajo la nula la muestra
viene de la densidad unimodal estimada en h₁, así que se remuestrea de ella:

```
y = x̄ + (x* − x̄ + h₁·ε) / √(1 + h₁²/σ²) ,   ε ~ N(0,1)
```

El reescalamiento mantiene la varianza del bootstrap igual a la de la muestra;
sin él, el ruido del kernel infla la dispersión y la prueba pierde casi toda su
potencia. El p-valor es la fracción de réplicas que necesitan un ancho de banda
al menos tan grande, **con suavizado de más uno**: 200 sorteos no pueden
establecer un cero, así que se reporta `(excesos + 1)/(réplicas + 1)` y el piso
del panel es «p < 0,001», nunca «p = 0».

El bootstrap se siembra con un hash de la propia muestra. Un panel cuyo p-valor
cambia en cada repintado es un panel que nadie puede citar, y una captura de
pantalla de uno es la captura de un número que ya no existe.

**Qué afirma y qué no.** Afirma que la distribución tiene más de una joroba. No
afirma que las jorobas sean «días de descanso» y «días de entreno»: eso es una
lectura de los datos, no un resultado. El panel nombra las dos modas porque son
descriptivas y deja la interpretación escrita como interpretación.

**Supuesto y límite.** La prueba tiene poca potencia con muestras cortas o
jorobas cercanas: no rechazar no es evidencia de unimodalidad. Y controla el
error de tipo I para la hipótesis «una moda» de forma aproximada —es un
bootstrap, no una distribución exacta—, con la conocida tendencia de la prueba de
Silverman a ser conservadora.

#### Huecos en el soporte

Un `supportGaps` recorre la variable ordenada y reporta cada intervalo entre dos
observaciones consecutivas que abarca más de una fracción del rango observado
(una décima por omisión).

Existe por lo que le hace a todo lo demás. **Una pendiente ajustada a través de
una banda vacía no describe una relación en esa banda: une dos grupos.** Toda
forma funcional que pase por las dos medias de grupo ajusta exactamente igual de
bien ahí, y los datos no pueden elegir entre ellas. Si además el hueco es grande,
el coeficiente está identificado casi solamente por la distancia entre los dos
grupos —es una comparación de dos puntos disfrazada de pendiente—. Que eso siga
siendo útil depende de la pregunta; que haya que decirlo, no.

Los paneles de dosis y respuesta y el explorador de modelos escriben la
advertencia con los dos extremos del hueco y su tamaño relativo, en vez de dejar
que la banda vacía se lea como un defecto de la gráfica.

---

## 7. El explorador de modelos

### 7.1 Qué es — implementado

Un constructor de especificaciones. La persona elige variable dependiente,
regresores y controles de un catálogo tipado de campos de `DayRecord`, con un
rezago de 0 a 7 días por término, y opcionalmente efectos fijos de día de la
semana y de mes. Se ajusta por `ols` con `vcov: 'hac'` y `times`, y se reporta la
tabla de coeficientes con intervalos, el R² ajustado, n, y el binscatter del
primer regresor contra la dependiente.

**Siempre HAC, sin interruptor.** Todo lo que se puede construir acá es una serie
diaria contra otra serie diaria, que es el diseño de §6.2; la única razón para
querer HC1 sería que el intervalo saliera más angosto.

#### Qué no está en el catálogo, y por qué

- **Las medias móviles** (`recovery7`, `hrv28`, `strain7`…). Regresar una serie
  contra su propia media móvil es una identidad mecánica: el lado izquierdo está
  dentro del derecho y el ajuste está garantizado. No es un hallazgo, es
  aritmética.
- **`recoveryNext` y `strainPrev`.** El selector de rezago ya los expresa, y
  ofrecer las dos formas invita a meter la misma variable dos veces en un mismo
  diseño, que es exactamente colinealidad.
- **La dependiente al rezago cero**, que sería y contra y. Al rezago 1 o más sí
  se permite: ese es un término autorregresivo legítimo y, como advierte §6.2, a
  menudo el que falta.

#### El umbral de n por parámetro

El explorador se apaga —devuelve `Insufficient`, no un ajuste frágil— por debajo
de **12 observaciones por parámetro**, con piso absoluto de **40 observaciones**.
El mínimo se calcula sobre los parámetros que pide el diseño y no sobre los que
sobreviven a QR: contarlos después dejaría comprar espacio muestral agregando una
columna colineal.

El número está medido, no supuesto. Cobertura empírica de un intervalo HAC
nominal al 95% sobre un diseño de regresores persistentes (AR 0,8) con errores
AR(0,5), 1000 réplicas por celda:

| n/k | k = 5 | k = 10 |
| --- | ----: | -----: |
| 4   | 80,4% |  83,2% |
| 6   | 80,2% |  83,6% |
| 8   | 82,7% |  86,5% |
| 12  | 86,1% |  84,9% |
| 20  | 89,4% |  89,0% |
| 30  | 86,4% |  89,5% |

HAC nunca llega al 95% en un diseño así —§6.1 documenta el techo alrededor del
88–89%—, de modo que la pregunta no es dónde se vuelve correcto sino dónde deja
de empeorar. Eso ocurre alrededor de una docena de observaciones por parámetro:
por debajo, una banda «al 95%» acierta una de cada cinco veces menos de lo que
dice; por encima, otras ocho observaciones por parámetro compran tres puntos.

El piso de 40 es aparte: por debajo de eso la regla de Newey–West da un
truncamiento de tres rezagos y Ω̂ se arma con un puñado de pares de residuos, así
que el sándwich mismo apenas está estimado.

### 7.2 La familia acumulada — implementado

**Este es el punto de la pestaña, no un detalle de presentación.**

Un explorador libre de especificaciones es una máquina de p-hacking. Con 59 días
y treinta campos en el catálogo hay cientos de pares que probar, y a p < 0,05
algo sale significativo por construcción: probar veinte pares nulos y quedarse
con el que brilló no es investigación, es escoger el máximo de veinte sorteos.
Corregir dentro de cada modelo no arregla nada, porque la búsqueda no ocurre
dentro de un modelo: ocurre entre modelos.

Por eso el explorador lleva la cuenta de **cada regresor probado en la sesión** y
aplica Benjamini–Hochberg (§6.3) sobre esa familia acumulada. Consecuencias, y
todas son deliberadas:

- **Los q de un modelo empeoran cuando se corre otro.** Un coeficiente que salía
  marcado en la tercera especificación puede dejar de estarlo en la vigésima. Así
  tiene que ser: la evidencia sobre ese coeficiente no cambió, pero la cantidad de
  búsqueda que hay detrás de él sí.
- **Los controles no entran en la familia.** Un control es lo que se está dejando
  fijo, no una hipótesis; nadie está buscando entre ellos. Solo los regresores
  cuentan.
- **Volver a correr la misma especificación no agranda la familia.** Se
  identifica por una clave canónica —dependiente, regresores, controles y efectos
  fijos, con el orden normalizado—, así que regresar a un modelo anterior no
  cuenta como una búsqueda nueva.
- **El contador se muestra siempre**, con el número de especificaciones y el de
  coeficientes en la familia. Un usuario que ve «31 especificaciones» sabe leer su
  propio q.
- **Se reinicia al recargar la página.** Es una limitación asumida: el número es
  un **piso** de cuánto se ha buscado, nunca un techo. Persistirlo entre sesiones
  sería más honesto y también volvería el tablero inusable a la semana; se
  documenta el sesgo en vez de esconderlo.

**Lo que esto no arregla.** BH controla la tasa de falsos descubrimientos de la
familia que se le declara. No sabe de las especificaciones que alguien probó,
miró y descartó antes de que el contador existiera, ni de las decisiones tomadas
mirando los datos —qué rango seleccionar, qué controles parecían razonables— que
son grados de libertad igual de reales. La corrección hace el problema visible y
lo acota; no lo elimina.
