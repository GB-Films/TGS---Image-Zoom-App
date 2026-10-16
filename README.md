# TGS · Zoom infinito

Experiencia de Zoom libre para iPad, celulares y computadoras, publicada en GitHub Pages.

## Colección actual

26 ilustraciones WebP con transparencia, ancho 3840 px y proporciones originales. El orden y los recursos están en `app/scenes.json`; las 25 transiciones centrales, en `app/transition-presets.json`. Cada imagen se encaja completa dentro de su máscara fija y feather. La persona decide la dirección del zoom y el pellizco sigue la apertura real de sus dedos.

Antes de habilitar «Comenzar» se preparan las 26 versiones transparentes de 768 px y los dos primeros 4K. Las versiones livianas permanecen en memoria durante toda la experiencia; solo se dibujan las capas cercanas. La actual, la siguiente y la anterior se preparan en 4K, conservando además una vecina recientemente usada para evitar descartarla y decodificarla de nuevo al avanzar y retroceder por un cruce. Se mantienen hasta cuatro 4K dentro de un presupuesto de 256 MiB de píxeles decodificados, no todas las imágenes grandes. El dibujo elige la fuente según su tamaño en pantalla, conservando el 4K para acercarse. La cámara trabaja en coordenadas locales para conservar precisión en los niveles profundos. Los PNG maestros, pruebas y originales quedan fuera de los archivos publicados.

Las máscaras se preparan antes de habilitar «Comenzar». El compositor evita copias intermedias cuando la imagen cabe en la zona opaca de sus máscaras y procesa solo su zona visible cuando necesita feather o relleno. `npm run images:previews` actualiza las versiones livianas a partir de los 4K aprobados, sin regenerar ilustraciones.

Durante el movimiento se dibujan fuentes de hasta 2048 px desde `public/scenes/motion`; las lejanas siguen usando 768 px. Tras 350 ms sin cambios de cámara se recupera el 4K en las imágenes cercanas, sin cambiar escala, contornos ni coordenadas. Las nuevas cargas 4K se posponen hasta el reposo; las versiones intermedias también se retienen para reutilizarlas al retroceder. El presupuesto de 256 MiB incluye los tres tamaños. `npm run images:motion` genera los derivados intermedios sin modificar los originales.

## Portada, apertura y cierre

La portada adapta la composición a celular vertical y horizontal, con áreas seguras y botones táctiles. Las órbitas y las transiciones usan CSS, sin nuevas imágenes ni dependencias. Los estilos están en `app/experience.css`.

«Comenzar» abre un mensaje con una entrada de luz y órbitas. Tras nueve segundos de lectura continúa automáticamente; «Entrar al recorrido» permite adelantarlo. Al regresar de otra pestaña se reinicia el tiempo de lectura. En la última imagen, seis segundos en reposo abren el agradecimiento; retroceder, mover la cámara, editar u ocultar la pestaña cancela esa espera. El cierre aparece una vez por visita y ofrece volver a la portada o seguir explorando. Reiniciar permite verlo de nuevo.

Los mensajes son diálogos modales que aíslan los gestos del visor y restauran el foco al continuar. Respetan la preferencia de movimiento reducido y permiten continuar con Escape. No cambian los recursos, máscaras ni encuadres de las escenas.

## Edición y guardado

«Ajustar máscaras» requiere la contraseña del proyecto. Los cambios son una vista previa hasta «Publicar para todos»; se guardan en el servicio existente y se ven en cualquier dispositivo. Cada máscara puede tener fondo blanco o no tener relleno. La colección nueva conserva un historial independiente de las siete uniones antiguas; no borra publicaciones anteriores.

Ver [secuencia y revisión](docs/production-scenes.md) y [servicio compartido](docs/mask-service.md).

## Desarrollo y pruebas

### Recorrido 3D

`/recorrido` abre una experiencia independiente en primera persona: carro sobre un gasoducto con curvas y elevaciones suaves. Comienza frente al logo en acuarela y sigue con las 26 imágenes completas de «Orden Final», incluida la portada y ambos cierres. Se conservan las versiones corregidas disponibles en producción. Los 27 carteles alternan derecha e izquierda, empezando por la derecha. Cada tramo dura 4 segundos de movimiento; «Siguiente parada» inicia cada viaje y la llegada frena automáticamente hasta la próxima acción. La línea de tiempo se desplaza para seguir la parada y el año. Se puede ampliar cada ilustración, pausar, continuar o reiniciar. Ocultar la pestaña pausa el viaje para evitar saltos al regresar.

El paisaje, las estaciones y el carro son geometría de Three.js; se reutilizan las ilustraciones existentes y el logo en acuarela suministrado, sin generar imágenes, modelos o sonidos. Las estaciones quedan al costado del caño para poder seguir avanzando. El motor se carga únicamente al abrir esta ruta. Requiere WebGL. La portada ofrece «Recorrido 3D», además de la experiencia original de zoom. Se publica en `/TGS---Image-Zoom-App/recorrido/`; `npm run build` prepara también su índice de directorio para GitHub Pages. Para probar localmente: `npm run dev` y abrir `/recorrido/` en el puerto indicado por Vite.

La dirección visual usa celeste y azul de TGS y carteles sobre dos postes grises, sin plataformas ni barandas. Las imágenes y sus marcos están ampliados un 15%; la comprobación de espacio libre contempla ese tamaño. Los soportes del caño aparecen cada seis uniones, la mitad de la densidad inicial. Cada marco se ajusta a la proporción de su imagen; los travesaños tienen el mismo espesor y un pequeño avance para evitar caras coplanares en las esquinas. Las ilustraciones conservan el color sRGB sin exposición ni niebla del mundo. Tres capas de montañas facetadas a ambos lados acompañan todo el trayecto. Las piezas repetidas del paisaje y del caño se dibujan con instancias. La interfaz conserva la línea de tiempo, el título y los controles de avance, imagen y reinicio; no muestra etiquetas de prototipo ni leyendas redundantes.

Los recursos de este modo están separados en `public/ride`: 27 WebP opacos de hasta 1600 px y vistas previas de 384 px, sin recortes ni ampliaciones artificiales. Se conservan las versiones pequeñas y solo tres texturas grandes cercanas al carro. Las precargas 4K pertenecen únicamente a la página de zoom. `node scripts/prepare-ride-images.mjs "RUTA/Trabajo de Imagenes"` prepara los derivados y su manifiesto `app/recorrido/ride-scenes.json`; el informe local de fuentes queda en `outputs/recorrido/image-sources.json`. Los originales y los recursos transparentes del zoom no se sustituyen.

```powershell
npm ci
npm run dev
npm run build
node --test tests/*.test.mjs
npm run preview
```

GitHub Actions compila y publica Pages al actualizar `main`. `npm run build:service` genera un artefacto separado del servicio y reemplaza `dist`; volver a compilar el visor antes de ejecutar sus pruebas de HTML. En Windows, el cierre del proceso de prerenderizado puede fallar por una aserción nativa de libuv después de generar los archivos: no confundirlo con un build verificado de código cero; la publicación se comprueba también en el entorno Linux de GitHub.

`npm run preview` sirve la compilación en `http://127.0.0.1:5173` y lee las máscaras publicadas mediante un relay local de solo lectura. Así evita usar por error los presets de respaldo cuando el servicio rechaza el origen local. No permite iniciar sesión ni publicar máscaras; esos ajustes se hacen en la app online.

Para revisar los encajes iniciales:

```powershell
node scripts/fit-masks.mjs
node scripts/preview-masks.mjs
```

Los detalles se generan en `outputs/masks`, ignorado por Git. La revisión de fluidez en un celular físico sigue siendo necesaria además de las pruebas automatizadas.
