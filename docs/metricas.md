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
con acostarse tarde y con dormir menos. La regresión separa esos efectos. Se
puede resolver con mínimos cuadrados por ecuaciones normales sobre una matriz
pequeña; no hace falta librería.

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
