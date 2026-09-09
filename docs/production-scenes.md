# Secuencia de producción — primeras ocho imágenes

Orden: Oficina → Operario y cartelera → Bolsa de Nueva York → Gasoducto → Planta Cerri → Antena → Más plantas → Gasoducto submarino.

Los archivos `public/scenes/tgs-01-*.webp` a `tgs-08-*.webp` reemplazan la secuencia de demostración en el modo libre. Los archivos anteriores se conservan, pero ya no se precargan ni forman parte del recorrido.

## Preparación

Las ocho salidas son WebP opaco sRGB de 3840 × 2160, calidad 88. Se realizó un recorte a 16:9 autorizado, priorizando títulos y carteleras; se pierde parte del contenido inferior de las imágenes más altas. El reescalado Lanczos con enfoque leve mantiene el dibujo y el texto de origen: es una ampliación, no detalle 4K nativo ni una reinterpretación generativa. No se modifican las fechas, logos ni los textos provisionales `XXX` que ya contienen los originales.

Los PNG originales quedan fuera del repositorio, intactos en la carpeta de producción. Para regenerar las versiones optimizadas:

```powershell
npm run images:prepare -- "RUTA_A_LA_CARPETA_DE_ORIGINALES"
```

El script contiene los nombres originales y el recorte específico de cada imagen. Genera también `outputs/scenes/report.json` y `outputs/scenes/contact-sheet.png` (ignorados por Git), con dimensiones, pesos y una vista de las ocho imágenes en orden.

## Integración

«Ajustar máscaras» valida la contraseña en el servicio antes de abrir el editor. Cancelar o presionar Escape vuelve a la experiencia; «Modo usuario» y recargar vuelven a bloquear el acceso. La clave se configura como secreto de producción, no se incluye en este repositorio ni en los archivos del visor. La sesión temporal vive solo en memoria y vence a las ocho horas; al salir se solicita su revocación.

El visor de GitHub Pages consulta la configuración publicada en el servicio indicado por `public/mask-service.json`. «Publicar para todos» guarda las siete máscaras en D1 y crea una versión con historial. Las publicaciones concurrentes se rechazan si parten de una versión anterior, sin sobrescribir cambios ajenos. Reintentar una publicación con la misma identificación no duplica versiones.

Los cambios sin publicar son una vista previa. Se conserva un borrador local solo para el editor; nunca reemplaza automáticamente la configuración pública. «Recuperar borrador» también permite recuperar los ajustes antiguos de este navegador. «Cargar publicada» conserva el borrador y carga la versión compartida. Al salir del editor, el visor vuelve a la versión publicada.

Cada visita consulta la versión vigente sin caché. Las pestañas abiertas verifican novedades cada treinta segundos y al recuperar el foco. Se avisa de una actualización y se ofrece cargarla reiniciando el recorrido, sin cambiar máscaras en mitad del zoom. Si falla el servicio se informa y se conserva la última versión cargada (o las máscaras iniciales si todavía no se pudo cargar ninguna).

Ver `docs/mask-service.md` para el servicio, las pruebas y las dos publicaciones independientes. GitHub Pages sigue alojando el visor; Sites aloja solo el servicio de máscaras, sin las ilustraciones.

Las siete entradas tienen ahora contornos propios en `app/transition-presets.json`. Se pueden afinar con «Ajustar máscaras» y recuperar por unión con «Restablecer». La clave `tgs-zoom-mask-settings-production-8-v3` activa esta propuesta sin borrar los ajustes anteriores del navegador.

| Unión | Entrada propuesta | Tratamiento |
| --- | --- | --- |
| Oficina → Operario | Tapa del cuaderno | Cuadrilátero siguiendo la perspectiva, borde corto |
| Operario → Bolsa | Reflejo en la parte superior del casco | Contorno redondeado, sin cubrir el logo |
| Bolsa → Gasoducto | Monitor derecho sin texto | Trapecio dentro del marco de la pantalla |
| Gasoducto → Cerri | Ventana de la excavadora | Máscara pequeña ajustada al vidrio |
| Cerri → Antena | Cielo entre las torres | Borde orgánico de acuarela |
| Antena → Más plantas | Interior de la parábola | Óvalo inclinado, preservando el aro |
| Más plantas → Magallanes | Agua del lago | Contorno irregular para conectar ambos paisajes de agua |

Las ilustraciones no se deforman en perspectiva ni se retocan: la forma pertenece a la máscara. Es una propuesta de composición para revisión artística, no una reconstrucción de las ilustraciones como escenas originalmente anidadas.

## Encuadre permanente y textos completos

Solo se ofrece **Zoom libre** en la bienvenida. El modo guiado queda fuera de uso; no hay un control que lo active.

Cada imagen se reduce proporcionalmente hasta caber entera en una zona completamente opaca de su máscara. El ajuste se calcula a partir del mismo contorno y los mismos tres pases de feather que usa Canvas, con margen adicional de dos píxeles en la máscara de 512 × 288. Las ubicaciones, tamaños de portal y puntos aprobados se conservan. Solo cambian la escala y el desplazamiento del contenido interior.

El espacio restante es un reborde de composición: blanco para las escenas de fondo blanco, gris claro en la parábola y celeste en el lago. Se dibuja en la app, sin modificar o regenerar las imágenes ni sus textos. La ventana pequeña de la excavadora requiere acercarse más para leer; ningún texto se elimina para hacerla encajar. En un teléfono vertical se puede ampliar y desplazar horizontalmente para leer las carteleras.

Se eliminó la apertura progresiva. La máscara no depende de la profundidad ni se transforma en un rectángulo al cruzar de nivel. El render aplica también los contornos de los ancestros tras cambiar el marco de coordenadas. Solo omite una operación cuando una comprobación de píxeles demuestra que esa máscara es completamente opaca sobre toda la pantalla: el contorno vuelve a aplicarse al desplazar la vista hacia su borde.

El recorte técnico de las llamadas de dibujo al tamaño visible evita enviar coordenadas gigantes a Canvas en niveles profundos. Se conservan la precarga de tres niveles por delante, cuatro imágenes al inicio, y la composición por fotograma del modo libre.

Para recalcular el encaje tras modificar los contornos:

```powershell
node scripts/fit-masks.mjs
```

También está disponible «Encajar imagen completa» en el editor. Los ajustes anteriores se conservan bajo sus claves anteriores; la versión v3 empieza con estos encajes. Cambiar a mano la escala del contenido puede volver a recortarlo: el botón permite restaurar un encaje seguro.

Para generar una lámina de detalle de los encajes iniciales (no representa la animación ni es una captura del renderer):

```powershell
node scripts/preview-masks.mjs
node --test tests/mask-presets.test.mjs
```

La lámina se guarda en `outputs/masks/mask-proof.png`, fuera de Git. Las pruebas verifican que las ubicaciones aprobadas no cambian y que el rectángulo completo de cada imagen queda dentro de píxeles opacos de la máscara, incluido el margen de seguridad. También verifican el cálculo de opacidad y la ausencia de apertura automática. La apariencia durante el movimiento se revisa aparte en el navegador.

Se conservan el feather y los controles manuales de desplazamiento y zoom, con carga progresiva. La geometría del visor sigue usando un lienzo 16:9 que cubre la pantalla; un teléfono vertical muestra una porción horizontal de la ilustración y permite explorarla con el zoom libre.

```powershell
node --test tests/scene-assets.test.mjs
```

La comprobación verifica orden, dimensiones 4K, opacidad, enlaces de precarga y presupuesto de descarga (menos de 6 MiB para las ocho imágenes).
