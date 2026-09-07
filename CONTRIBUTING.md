# Cómo contribuir

Gracias por pasar. Este proyecto es pequeño a propósito y prefiere pocos cambios
bien pensados a muchos apurados.

## Antes de abrir un PR

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Los cuatro comandos tienen que pasar. CI corre exactamente eso.

## Qué se acepta con gusto

- Indicadores de `docs/roadmap.md`. Ya están especificados en `docs/metricas.md`,
  así que la discusión de diseño ya ocurrió.
- Correcciones de parseo: si tu export tiene una columna con otro nombre y el
  mapeo falla, un PR con el matcher nuevo y una prueba es muy bienvenido. Pega el
  **encabezado**, nunca los datos.
- Traducciones de la interfaz.
- Accesibilidad y comportamiento en móvil.

## Qué probablemente se rechace

- Cualquier cosa que mande datos a un servidor, incluida analítica anónima.
- Librerías de gráficas. La razón está en el README.
- Interpretaciones automáticas tipo "tu recuperación está mal, descansa". El
  proyecto muestra series y supuestos; no da veredictos.

## Estilo

- Código y comentarios en inglés; texto de interfaz y `docs/` en español.
- Prettier decide el formato: `npm run format`.
- TypeScript estricto, sin `any`. Si necesitas un `as`, deja un comentario con el
  motivo.
- Commits en imperativo y en inglés (`add sleep regularity index`). No hace falta
  Conventional Commits, pero si los usas, mejor.

## Reportar un bug de parseo

Incluye: la fila de encabezados del CSV, el nombre del archivo, y qué esperabas
ver. **No adjuntes tus datos.** Si necesitas un ejemplo, invéntalo con valores
falsos.
