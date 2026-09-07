# Política de seguridad

## Modelo de amenaza

WHOOP Lab es una aplicación estática sin servidor. Los datos de salud se parsean
en el navegador y se guardan en IndexedDB del dispositivo. No hay transmisión de
datos, así que la superficie de ataque se reduce a:

1. **La cadena de dependencias.** Un paquete comprometido podría exfiltrar datos.
   Por eso el proyecto tiene pocas dependencias, Dependabot activo y CI que
   corre en cada PR.
2. **El hosting.** Si despliegas esta app, sírvela por HTTPS. Una versión
   manipulada en tránsito sí podría robar datos.
3. **El dispositivo compartido.** Los datos quedan en IndexedDB hasta que le des
   a "Cargar otro export", que los borra. En un equipo compartido, úsalo en una
   ventana privada.

## Reportar una vulnerabilidad

Abre un _security advisory_ privado en GitHub. Si es algo que permita exfiltrar
datos de salud, trátalo como crítico y no lo publiques en un issue abierto.

## Lo que este proyecto no protege

No cifra los datos en reposo dentro del navegador ni protege contra malware en
tu propio equipo.
