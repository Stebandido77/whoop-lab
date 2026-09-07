# `data/` — tu export, solo en tu máquina

Aquí va la carpeta descomprimida de tu export de WHOOP. Nada de lo que pongas
en este directorio se sube al repositorio.

## Qué poner

Descomprime el ZIP que te llega por correo y deja la carpeta aquí. Lo normal es
que queden cuatro CSV:

| Archivo                                 | Qué trae                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `physiological_cycles.csv`              | Una fila por ciclo: recuperación, HRV, RHR, strain, calorías y resumen de sueño |
| `sleeps.csv` (o `sueño.csv`)            | Cada sueño y siesta, con fases                                                  |
| `workouts.csv` (o `entrenamientos.csv`) | Actividades clásicas. No incluye sesiones de Strength Trainer                   |
| `journal_entries.csv`                   | Todas tus respuestas del diario                                                 |

Los nombres cambian según el idioma de tu cuenta. No hace falta renombrarlos: el
parser detecta cada archivo por sus encabezados además de por su nombre, en
inglés y en español. Tampoco importa si quedan dentro de subcarpetas.

```
data/
  my_whoop_data_2026_09_07/
    physiological_cycles.csv
    sueño.csv
    entrenamientos.csv
    journal_entries.csv
```

## Para qué sirve

Con `npm run dev`, si hay CSV aquí la app arranca directamente con esos datos y
se salta la pantalla de importación. El encabezado dice **«datos locales de
data/»** para que sepas de dónde vienen. Con `npm run build` no se incluye ni un
byte de esta carpeta en el bundle.

También es la fuente de `npm run fixture`, que genera los CSV anonimizados de
`src/test/fixtures/`. Ver [docs/arquitectura.md](../docs/arquitectura.md),
sección «Desarrollo con datos reales».

## Cómo pedir el export

En la app de WHOOP: **More → App Settings → Data Export** (en Android,
**More → Data Export**). Confirmas el correo, le das a _Create Export_ y llega
un correo con asunto _Your WHOOP Export is Ready_ con el enlace de descarga.

- Un export cada 24 horas, sin excepción.
- El enlace caduca; descárgalo apenas llegue.
- En la práctica llega en menos de una hora, aunque la app avise que puede
  tardar 24.

## Privacidad

`.gitignore` ignora `data/*` completo, con excepción de este README y del
`.gitkeep`. Además ignora `*.csv` en todo el repositorio. Son dos redes
distintas para el mismo error, porque un export de WHOOP es un historial de
salud: sueño, frecuencia cardiaca y cada respuesta que hayas dado en el diario.

Si quieres comprobarlo tú:

```bash
git check-ignore -v data/mi_export/physiological_cycles.csv
git status --short
```

Lo primero debe imprimir la regla que lo bloquea; lo segundo no debe mencionar
ningún CSV.
