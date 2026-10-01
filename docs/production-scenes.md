# Secuencia transparente — 26 imágenes (1 de octubre de 2026)

La colección activa está en `app/scenes.json`: 26 WebP con alpha, ancho 3840 px y proporciones originales. El orden sigue el último PowerPoint; incluye la portada, los hitos actualizados y ambos cierres. Las versiones aprobadas de Telcosur (7), NYSE (16) y acuerdos NGLs (22) incluyen los elementos de transición nuevos.

Solo los WebP finales están en `public/scenes`. Los originales, maestros PNG, pruebas y recursos antiguos no se publican. Los ocho recursos anteriores tienen respaldo local en `work/previous-app-scenes`; las nueve imágenes demo ya tenían su archivo histórico de producción. No usar `images:prepare` para esta colección: es el proceso histórico opaco de ocho escenas.

## Encuadre y transiciones

El mundo usa un rectángulo estable 16:9. Cada ilustración se contiene proporcionalmente dentro de él, con espacio transparente cuando corresponde: no se recorta ni se deforma. Las 25 entradas centrales están en `app/transition-presets.json`, ajustadas desde las propuestas aprobadas a ese mismo sistema de coordenadas. La imagen siguiente cabe completa dentro de la máscara y su feather, sin apertura progresiva ni salto a pantalla completa.

El fondo general del visor es blanco; esto no aplana el alpha del archivo ni agrega un relleno a los portales. Cada máscara empieza con `matte: null`. El editor permite activar un fondo blanco o conservar transparencia. El encaje completo protege los textos; cambiar manualmente la escala puede recortarlos y se recupera con «Encajar imagen completa».

## Movimiento y carga

Solo Zoom libre está disponible. El pellizco usa la relación real entre distancias de los dedos, manteniendo el foco de contacto. La cámara cambia de origen local en cada nivel, para no perder precisión en las últimas imágenes. Ese cambio no altera la composición en pantalla. La rueda conserva su control independiente.

Se preparan cuatro imágenes al inicio. La ventana conserva dos niveles anteriores y tres siguientes, más la portada, con un máximo de dos decodificaciones simultáneas. No se descarga toda la secuencia de entrada. El compositor mantiene las máscaras de los ancestros y limita resolución de pantalla en móvil sin reducir los archivos 4K.

## Guardado compartido

La colección `tgs-2026-10-01` usa 25 máscaras y un historial separado de la colección antigua de ocho imágenes. Los datos antiguos quedan intactos. Los borradores también usan una clave nueva y nunca se aplican automáticamente a visitantes. El servicio y el visor se publican por separado; el servicio debe actualizarse antes del visor para que el editor pueda publicar las nuevas máscaras.

Las publicaciones requieren la contraseña del proyecto, mantienen control de versiones y permiten reintentos sin duplicación. GitHub Pages sigue alojando imágenes y visor; el servicio existente guarda solo las máscaras.

## Revisión

La revisión de contenido del 1 de octubre detectó que preparar el estilo y el alpha no había aplicado todas las notas del PowerPoint. Las escenas 2 y 5 se regeneraron con sus datos corregidos y la marca histórica de la 5, conservando dimensiones, transiciones y transparencia. Usan nombres de archivo nuevos para evitar imágenes viejas en caché. Los recursos sustituidos tienen respaldo local en `work/audit-ppt-2026-10-01/Version anterior app`.

Las 11 correcciones claras restantes (3, 4, 8, 9, 11, 12, 13, 14, 15, 17 y 19) se regeneraron y se incorporaron como WebP transparentes de 3840 px de ancho, conservando las dimensiones de cada escena. Reescalado local Real-ESRGAN x4, sin servicios de créditos; compresión calidad 90 con alpha preservado exactamente respecto del maestro. No se recorta ninguna imagen ni se aplana el fondo. Los nombres nuevos terminan en `-corregida.webp` para invalidar las versiones anteriores en caché. Solo los 26 archivos activos permanecen en `public/scenes`.

Las versiones anteriores de esta tanda quedan en `work/correcciones-ppt-11-2026-10-01/Version anterior app`; originales generados, maestros, informe de procesamiento y pruebas visuales se conservan allí y en la producción de Dropbox, fuera de Git. No se modificaron contornos, encajes, feather, rellenos ni la colección compartida de máscaras para esta actualización.

Queda revisión visual/editorial en 10, 16 y 21. No declarar todas las notas del PowerPoint incorporadas. La revisión completa de las 26 diapositivas y seis notas, con las decisiones abiertas de los cierres, se conserva en la documentación local de producción.

`node scripts/fit-masks.mjs` recalcula encajes sin modificar contornos. `node scripts/preview-masks.mjs` produce detalles de las 25 uniones en `outputs/masks`, fuera de Git. Las pruebas cubren orden, alpha, resolución, proporciones, encajes opacos, zona central, rellenos, aislamiento del historial y pellizco hasta la última unión. La lámina no sustituye la revisión de movimiento en navegador ni en un dispositivo real.
