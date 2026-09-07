<div align="center">

# WHOOP Lab

**Tu export de WHOOP, analizado en serio. En tu navegador. Nada se sube a ningún lado.**

[Demo](https://USER.github.io/whoop-lab/) · [Read this in English](README.md)

![Vista general de WHOOP Lab](docs/img/overview-light.png)

</div>

## Por qué

WHOOP te da un número cada mañana y esconde la serie detrás de sus propias
vistas. El export, en cambio, trae todo: recuperación, HRV, pulso en reposo,
strain, arquitectura completa del sueño y cada respuesta del diario que hayas
dado.

WHOOP Lab lee ese export y muestra lo que la app no:

- **Líneas base móviles.** Tendencia de recuperación a 7 días y base de HRV a 28
  días con z-score. Un dato de HRV aislado no dice nada sin tu propia
  distribución.
- **Strain de hoy contra recuperación de mañana.** Dispersión con recta ajustada
  y correlación, para ver cuánto te cuesta de verdad una sesión dura.
- **Efecto de los hábitos.** Para cada pregunta del diario, la diferencia en
  recuperación entre los días que respondiste sí y los que respondiste no, con
  tamaños de muestra y un estadístico t de Welch. Este es el análisis que hace
  que valga la pena pedir el export.
- **Carga aguda sobre carga crónica.** Strain a 7 días sobre strain a 28 días,
  el indicador estándar para detectar que estás subiendo volumen demasiado
  rápido.
- **Tabla diaria consolidada** para copiar y pegar en Excel, R o Stata.

## Privacidad

Todo corre en el cliente. Los CSV se parsean en el navegador, se guardan en
IndexedDB de tu propia máquina y no viajan a ningún servidor. No hay backend, no
hay analítica y no hay una sola petición de red después de cargar la página. Lo
puedes verificar leyendo `src/lib/whoop/` en unos diez minutos.

El `.gitignore` además bloquea `*.csv` para que no subas tus datos de salud por
accidente mientras trabajas en el repo.

## Cómo sacar tus datos

En la app de WHOOP: **More → App Settings → Data Export** (en Android, **More →
Data Export**). Te llega un correo con un ZIP con cuatro archivos:

| Archivo                    | Qué trae                                                                       |
| -------------------------- | ------------------------------------------------------------------------------ |
| `physiological_cycles.csv` | Una fila por ciclo: recuperación, HRV, RHR, strain, calorías, resumen de sueño |
| `sleeps.csv`               | Cada sueño y siesta, con fases                                                 |
| `workouts.csv`             | Actividades clásicas. **No incluye sesiones de Strength Trainer**              |
| `journal_entries.csv`      | Todas tus respuestas del diario                                                |

Límites que conviene tener presentes: un export cada 24 horas, y a inicios de
2026 el export no trae actividades de recuperación, stress diario, pasos ni
VO2 Max. En [docs/formato-export-whoop.md](docs/formato-export-whoop.md) está la
referencia completa de columnas y las decisiones de parseo que se derivan de
ella.

## Cómo correrlo

```bash
git clone https://github.com/USER/whoop-lab.git
cd whoop-lab
npm install
npm run dev
```

Suelta tu ZIP en la página, o dale a **mira una demo con datos sintéticos** para
explorar con datos generados que tienen relaciones reales incorporadas.

```bash
npm run build      # typecheck + bundle de producción
npm test           # pruebas del parser y de la estadística
npm run lint
npm run format
```

## Decisiones técnicas

| Decisión                                           | Razón                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 + TypeScript estricto + Vite              | Aburrido, rápido, y el sistema de tipos hace trabajo real en `src/lib/whoop/types.ts`                                                  |
| Gráficas SVG propias sobre `d3-scale` / `d3-shape` | Una librería de charts habría que pelearla para conservar esta estética. d3 pone la matemática; los componentes ponen los píxeles      |
| CSS plano con custom properties                    | Toda la paleta vive en `src/styles/tokens.css`. Las gráficas resuelven colores de los mismos tokens, así claro y oscuro no se duplican |
| Zustand                                            | Un store pequeño, sin ceremonia                                                                                                        |
| IndexedDB con `idb-keyval`                         | Un diario de varios años se pasa del presupuesto de localStorage                                                                       |

## Estructura

```
src/
  lib/whoop/     mapeo de columnas, parseo de CSV, modelo de día
  lib/           estadística, formato, métricas derivadas, demo, storage
  charts/        TimeSeries, StackedBar, Scatter, HBar, CalendarHeatmap, Sparkline
  components/    Panel, KpiCard, Legend, Segmented, ImportView
  views/         un archivo por pestaña
  state/         store de zustand y el selector de rango
```

Lee [docs/arquitectura.md](docs/arquitectura.md) antes de tu primer cambio. La
regla que importa: **las vistas no calculan**. Toda métrica se deriva una vez en
`buildDayRecords` y de ahí se lee.

## Contribuir

Issues y PRs bienvenidos. [docs/roadmap.md](docs/roadmap.md) lista los
indicadores ya especificados pero todavía sin construir; es el mejor punto de
entrada. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Aviso

Esto es una herramienta de visualización, no un dispositivo médico, y no está
afiliada ni respaldada por WHOOP. Las correlaciones que muestra son
observacionales. Nada de esto es consejo médico.

## Licencia

MIT
