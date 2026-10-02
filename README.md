# TGS · Zoom infinito

Experiencia de Zoom libre para iPad, celulares y computadoras, publicada en GitHub Pages.

## Colección actual

26 ilustraciones WebP con transparencia, ancho 3840 px y proporciones originales. El orden y los recursos están en `app/scenes.json`; las 25 transiciones centrales, en `app/transition-presets.json`. Cada imagen se encaja completa dentro de su máscara fija y feather. La persona decide la dirección del zoom y el pellizco sigue la apertura real de sus dedos.

Se preparan cuatro imágenes al inicio y tres por delante durante el recorrido. Las escenas lejanas usan WebP transparentes de 768 px; la actual, la siguiente y la anterior se preparan en 4K. El dibujo elige la fuente según su tamaño en pantalla, conservando el 4K para acercarse. La cámara trabaja en coordenadas locales para conservar precisión en los niveles profundos. Los PNG maestros, pruebas y originales quedan fuera de los archivos publicados.

Las máscaras se preparan antes de habilitar «Comenzar». El compositor evita copias intermedias cuando la imagen cabe en la zona opaca de sus máscaras y procesa solo su zona visible cuando necesita feather o relleno. `npm run images:previews` actualiza las versiones livianas a partir de los 4K aprobados, sin regenerar ilustraciones.

## Edición y guardado

«Ajustar máscaras» requiere la contraseña del proyecto. Los cambios son una vista previa hasta «Publicar para todos»; se guardan en el servicio existente y se ven en cualquier dispositivo. Cada máscara puede tener fondo blanco o no tener relleno. La colección nueva conserva un historial independiente de las siete uniones antiguas; no borra publicaciones anteriores.

Ver [secuencia y revisión](docs/production-scenes.md) y [servicio compartido](docs/mask-service.md).

## Desarrollo y pruebas

```powershell
npm ci
npm run dev
npm run build
node --test tests/*.test.mjs
```

GitHub Actions compila y publica Pages al actualizar `main`. `npm run build:service` genera un artefacto separado del servicio y reemplaza `dist`; volver a compilar el visor antes de ejecutar sus pruebas de HTML. En Windows, el cierre del proceso de prerenderizado puede fallar por una aserción nativa de libuv después de generar los archivos: no confundirlo con un build verificado de código cero; la publicación se comprueba también en el entorno Linux de GitHub.

Para revisar los encajes iniciales:

```powershell
node scripts/fit-masks.mjs
node scripts/preview-masks.mjs
```

Los detalles se generan en `outputs/masks`, ignorado por Git. La revisión de fluidez en un celular físico sigue siendo necesaria además de las pruebas automatizadas.
