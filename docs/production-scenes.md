# Secuencia transparente — 26 imágenes (1 de octubre de 2026)

La colección activa está en `app/scenes.json`: 26 WebP con alpha, ancho 3840 px y proporciones originales. El orden sigue el último PowerPoint; incluye la portada, los hitos actualizados y ambos cierres. Las versiones aprobadas de Telcosur (7), NYSE (16) y acuerdos NGLs (22) incluyen los elementos de transición nuevos.

Solo los WebP finales están en `public/scenes`. Los originales, maestros PNG, pruebas y recursos antiguos no se publican. Los ocho recursos anteriores tienen respaldo local en `work/previous-app-scenes`; las nueve imágenes demo ya tenían su archivo histórico de producción. No usar `images:prepare` para esta colección: es el proceso histórico opaco de ocho escenas.

## Encuadre y transiciones

El mundo usa un rectángulo estable 16:9. Cada ilustración se contiene proporcionalmente dentro de él, con espacio transparente cuando corresponde: no se recorta ni se deforma. Las 25 entradas centrales están en `app/transition-presets.json`, ajustadas desde las propuestas aprobadas a ese mismo sistema de coordenadas. La imagen siguiente cabe completa dentro de la máscara y su feather, sin apertura progresiva ni salto a pantalla completa.

El fondo general del visor es blanco; esto no aplana el alpha del archivo ni agrega un relleno a los portales. Cada máscara empieza con `matte: null`. El editor permite activar un fondo blanco o conservar transparencia. El encaje completo protege los textos; cambiar manualmente la escala puede recortarlos y se recupera con «Encajar imagen completa».

## Movimiento y carga

Solo Zoom libre está disponible. El pellizco usa la relación real entre distancias de los dedos, manteniendo el foco de contacto. La cámara cambia de origen local en cada nivel, para no perder precisión en las últimas imágenes. Ese cambio no altera la composición en pantalla. La rueda conserva su control independiente.

Antes de iniciar se preparan las 26 versiones transparentes de 768 px en `public/scenes/previews` y los primeros dos 4K. Las versiones livianas permanecen decodificadas durante todo el recorrido: 4,10 MB descargados y aproximadamente 41,4 MiB de píxeles. El compositor sigue dibujando solo dos niveles anteriores y tres siguientes, con un máximo de dos cargas/decodificaciones simultáneas. Las escenas actual, siguiente y anterior también se preparan en 4K; una vecina recientemente requerida se retiene para evitar liberar y volver a decodificar las mismas imágenes al oscilar por un cruce. El plan admite hasta cuatro 4K, solo a dos niveles o menos de distancia y dentro de 256 MiB de píxeles decodificados. Ese presupuesto no incluye blobs, texturas, superficies de dibujo ni memoria del navegador. Los 26 recursos 4K permanecen intactos.

El dibujo usa la versión pequeña mientras ocupa hasta 512 píxeles de ancho en el canvas (768 / 1,5); al superar ese tamaño usa el 4K ya preparado. La resolución no cambia las coordenadas ni las máscaras. Si el 4K aún no terminó de cargar se mantiene la imagen pequeña, y al retirar un 4K se conserva hasta que exista su reemplazo. Las precargas del HTML coinciden con las cuatro fuentes iniciales para evitar descargar recursos grandes lejanos.

Las 25 máscaras se rasterizan en tareas breves antes de habilitar «Comenzar», utilizando una superficie de CPU y una sola lectura de píxeles por máscara. El feather y la tabla de opacidad quedan en caché. Al editar se preparan las máscaras nuevas antes de volver a dibujar el visor.

El compositor comprueba todas las máscaras ancestrales contra el rectángulo visible de cada imagen y su relleno explícito. Si ese rectángulo está completamente en su interior opaco, dibuja directamente. Si necesita recorte, compone solo el área afectada; una única máscara no necesita una segunda superficie intermedia. Los cambios conservan rellenos transparentes/blancos, feather, encuadres y cámara local.

La revisión del 2 de octubre utilizó las máscaras publicadas versión 11 sin cambiarlas. En una prueba aislada del motor a 390×844, 351 pasos, los dibujados de más de 16,7 ms bajaron de 63 a 16 y la caché decodificada máxima de 285,0 a 147,5 MiB. Son tiempos de las llamadas de dibujo en un PC, no FPS garantizados ni medición de un celular físico. Las pruebas y comparaciones visuales están en `work/fluidez-2026-10-02`, fuera de Git. Sigue siendo necesaria la revisión de fluidez en el dispositivo del usuario.

La prueba posterior de precarga completa de previews y retención responde a saltos repetidos observados por el usuario en Safari/iPad Pro. La política anterior hizo ocho decodificaciones 4K y cuatro de previews en cuatro idas y vueltas por el mismo cruce, en una simulación de tablet de escritorio. Las pruebas de la nueva política verifican que las fuentes se reutilizan al oscilar por cualquiera de las 25 uniones y que la retención permanece acotada al recorrer, retroceder y reiniciar. No implica una medición física de Safari ni garantiza eliminar el costo del primer dibujo 4K. Las cifras de 147,5 MiB del párrafo anterior corresponden a la política previa, no a este nuevo presupuesto.

## Guardado compartido

La colección `tgs-2026-10-01` usa 25 máscaras y un historial separado de la colección antigua de ocho imágenes. Los datos antiguos quedan intactos. Los borradores también usan una clave nueva y nunca se aplican automáticamente a visitantes. El servicio y el visor se publican por separado; el servicio debe actualizarse antes del visor para que el editor pueda publicar las nuevas máscaras.

Las publicaciones requieren la contraseña del proyecto, mantienen control de versiones y permiten reintentos sin duplicación. GitHub Pages sigue alojando imágenes y visor; el servicio existente guarda solo las máscaras.

## Revisión

La revisión de contenido del 1 de octubre detectó que preparar el estilo y el alpha no había aplicado todas las notas del PowerPoint. Las escenas 2 y 5 se regeneraron con sus datos corregidos y la marca histórica de la 5, conservando dimensiones, transiciones y transparencia. Usan nombres de archivo nuevos para evitar imágenes viejas en caché. Los recursos sustituidos tienen respaldo local en `work/audit-ppt-2026-10-01/Version anterior app`.

Las 11 correcciones claras restantes (3, 4, 8, 9, 11, 12, 13, 14, 15, 17 y 19) se regeneraron y se incorporaron como WebP transparentes de 3840 px de ancho, conservando las dimensiones de cada escena. Reescalado local Real-ESRGAN x4, sin servicios de créditos; compresión calidad 90 con alpha preservado exactamente respecto del maestro. No se recorta ninguna imagen ni se aplana el fondo. Los nombres nuevos terminan en `-corregida.webp` para invalidar las versiones anteriores en caché. Solo los 26 archivos activos permanecen en `public/scenes`.

Las versiones anteriores de esta tanda quedan en `work/correcciones-ppt-11-2026-10-01/Version anterior app`; originales generados, maestros, informe de procesamiento y pruebas visuales se conservan allí y en la producción de Dropbox, fuera de Git. No se modificaron contornos, encajes, feather, rellenos ni la colección compartida de máscaras para esta actualización.

Queda revisión visual/editorial en 10, 16 y 21. No declarar todas las notas del PowerPoint incorporadas. La revisión completa de las 26 diapositivas y seis notas, con las decisiones abiertas de los cierres, se conserva en la documentación local de producción.

`node scripts/fit-masks.mjs` recalcula encajes sin modificar contornos. `node scripts/preview-masks.mjs` produce detalles de las 25 uniones en `outputs/masks`, fuera de Git. Las pruebas cubren orden, alpha, resolución, proporciones, encajes opacos, zona central, rellenos, aislamiento del historial y pellizco hasta la última unión. La lámina no sustituye la revisión de movimiento en navegador ni en un dispositivo real.
