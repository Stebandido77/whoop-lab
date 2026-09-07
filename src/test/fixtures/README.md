# Fixture de pruebas

Copia anonimizada de un export real de WHOOP, generada por
[`scripts/make-fixture.ts`](../../../scripts/make-fixture.ts):

```bash
npm run fixture     # lee data/, escribe aquí
```

Esto **sí** se versiona. No son los datos de nadie.

## Para qué está

`src/lib/demo.ts` genera datos sintéticos con las relaciones correctas, pero no
con la **forma** correcta. Nunca produce un encabezado en español, un ciclo en
curso con media fila vacía, una siesta mezclada en el archivo de sueño ni un
entrenamiento con todas las zonas de FC en cero. Justo eso es lo que rompe el
parser, y lo rompe en silencio: las gráficas siguen dibujándose, con los números
equivocados. `fixture.test.ts` corre el pipeline completo sobre estos archivos.

Los nombres son los originales (`sueño.csv`, `entrenamientos.csv`): una cuenta
en español recibe el export traducido, nombres y encabezados, y esa es
precisamente la variante que hay que mantener cubierta.

## Qué se le hizo a los datos

| Transformación                                                        | Por qué                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Fechas desplazadas a 1987, en semanas completas                       | Año ficticio, pero los patrones por día de la semana sobreviven   |
| Horas con unos minutos de ruido, nunca suficiente para cambiar de día | El modelo asigna el día por `Inicio de la vigilia`                |
| Ruido en cada valor fisiológico, acotado a un rango plausible         | Que no sean las cifras de nadie                                   |
| Un solo factor de ruido por noche para las fases de sueño             | Que ligero + profundo + REM sigan cuadrando con el tiempo en cama |
| Preguntas del diario recortadas a una lista neutra; notas borradas    | Qué preguntas tiene activadas una persona ya es información suya  |
| Una parte de las respuestas del diario invertida                      | Que no sea su bitácora de hábitos                                 |

El ruido está direccionado por clave, no tomado de una secuencia: un mismo valor
de origen recibe el mismo ruido en los cuatro archivos. Por eso la clave
`Hora de inicio del ciclo` sigue uniendo los cuatro y el resumen de sueño de
`physiological_cycles` sigue coincidiendo con la noche de `sueño.csv`, como en
el export de verdad.

## Si lo regeneras

El generador es determinista: correrlo dos veces sobre el mismo `data/` produce
byte por byte lo mismo. Con otro export cambia todo, y entonces hay que revisar
que `fixture.test.ts` siga teniendo sentido: sus umbrales (más de 50 días, más
de 10 días con entrenamiento) suponen una ventana de unos dos meses.
