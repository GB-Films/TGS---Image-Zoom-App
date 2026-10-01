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

`node scripts/fit-masks.mjs` recalcula encajes sin modificar contornos. `node scripts/preview-masks.mjs` produce detalles de las 25 uniones en `outputs/masks`, fuera de Git. Las pruebas cubren orden, alpha, resolución, proporciones, encajes opacos, zona central, rellenos, aislamiento del historial y pellizco hasta la última unión. La lámina no sustituye la revisión de movimiento en navegador ni en un dispositivo real.
