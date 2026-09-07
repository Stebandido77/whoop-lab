# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- Importación de ZIP y CSV del export de WHOOP, con detección automática de los
  cuatro archivos y mapeo tolerante de encabezados.
- Modelo diario que une ciclos, sueños, actividades y diario en una fila por día,
  con medias móviles, z-score de HRV, ACWR y columnas rezagadas.
- Vistas: Resumen, Recuperación, Sueño, Entrenamiento, Hábitos y Datos.
- Componentes de gráfica propios: series temporales, barras apiladas, dispersión
  con ajuste, barras horizontales divergentes, calendario y sparkline.
- Panel de efecto de hábitos con t de Welch y alineación temporal conmutable.
- Generador de datos sintéticos determinista para demo y pruebas.
- Persistencia local en IndexedDB.
- Paleta clara y oscura resuelta desde tokens CSS.
