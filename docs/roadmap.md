# Roadmap

Ordenado por relación valor/esfuerzo. Cada punto está especificado en
[metricas.md](metricas.md); acá solo está el orden y el porqué.

## Ahora — alto valor, bajo esfuerzo

1. **Corrección de Benjamini–Hochberg en el panel de hábitos** (§4.2). Dos
   funciones y una columna. Es lo que separa un panel honesto de uno que invita a
   sobreinterpretar quince pruebas simultáneas.
2. **Rachas de recuperación** (§1.8). Una pasada sobre el arreglo. De lo que más
   se comparte en redes, así que trabaja a favor del proyecto.
3. **Costo por tipo de actividad** (§3.6). Los datos ya están unidos; es un
   `groupBy` y una media. Contesta la pregunta que motiva a la mayoría a bajar su
   export.
4. **Punto medio del sueño y jet lag social** (§2.5). Dos campos derivados y una
   tarjeta.
5. **Vista de deuda de sueño** (§2.7). WHOOP ya calcula la deuda; solo falta
   mostrarla como serie con sus episodios.

## Después — el diferenciador real

6. **Regresión multivariada de hábitos** (§4.3) y la **interacción
   alcohol × sueño** (§4.4). Acá está el foso del proyecto: nadie más lo hace, y
   es lo que convierte correlaciones sueltas en algo que de verdad separa
   efectos. El motor ya está construido y probado (§6.1, §6.3) junto con
   `CoefficientPlot`; lo que falta es armar la matriz de diseño en `metrics.ts`
   y montar el panel.
7. **Sleep Regularity Index** (§2.4). Requiere reconstruir el estado minuto a
   minuto desde los bloques de sueño. Es el indicador de regularidad con más
   respaldo académico y WHOOP no lo muestra.
8. **Índice compuesto de enfermedad** (§1.7). Cuatro z-scores promediados y un
   marcador sobre la serie.
9. **Anotaciones** (§5.2). Persistencia en IndexedDB junto al export. Convierte
   el tablero en cuaderno de laboratorio.

## Más adelante

10. **Comparación año contra año** (§5.1), que requiere tocar `TimeSeriesChart`.
11. **Monotonía y strain de Foster** (§3.4) e **índice de polarización** (§3.5).
12. **Simulador con los coeficientes ajustados** (§5.3).
13. **Exportar gráficas a SVG y PNG** (§5.4).
14. **Variable dependiente seleccionable en hábitos** (§4.5).

## Fuera de alcance

- Sincronización automática vía la API v2 de WHOOP. Es un proyecto distinto:
  necesita OAuth, y OAuth necesita un servidor, y un servidor rompe la promesa de
  que nada sale de tu navegador. Si alguien lo quiere, que sea un repo aparte que
  produzca los mismos CSV.
- Interpretación automática con LLM. El valor de esto es mostrar la serie y el
  supuesto.
- Soporte multiusuario o de entrenadores. Hay productos comerciales para eso.

## Deuda técnica conocida

- El parseo corre en el hilo principal. Con exports de más de tres años se nota
  el bloqueo; moverlo a un Web Worker es el arreglo.
- `TimeSeriesChart` reparte los días en bandas iguales. Es lo correcto para
  detectar huecos, pero impide superponer series con calendarios distintos (ver
  §5.1).
- No hay pruebas de los componentes de gráfica, solo del parseo y la estadística.
  Un par de pruebas de snapshot del SVG sobre datos fijos serían suficientes.
