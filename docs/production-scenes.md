# Secuencia de producción — primeras ocho imágenes

Orden: Oficina → Operario y cartelera → Bolsa de Nueva York → Gasoducto → Planta Cerri → Antena → Más plantas → Gasoducto submarino.

Los archivos `public/scenes/tgs-01-*.webp` a `tgs-08-*.webp` reemplazan la secuencia de demostración en ambos modos. Los archivos anteriores se conservan, pero ya no se precargan ni forman parte del recorrido.

## Preparación

Las ocho salidas son WebP opaco sRGB de 3840 × 2160, calidad 88. Se realizó un recorte a 16:9 autorizado, priorizando títulos y carteleras; se pierde parte del contenido inferior de las imágenes más altas. El reescalado Lanczos con enfoque leve mantiene el dibujo y el texto de origen: es una ampliación, no detalle 4K nativo ni una reinterpretación generativa. No se modifican las fechas, logos ni los textos provisionales `XXX` que ya contienen los originales.

Los PNG originales quedan fuera del repositorio, intactos en la carpeta de producción. Para regenerar las versiones optimizadas:

```powershell
npm run images:prepare -- "RUTA_A_LA_CARPETA_DE_ORIGINALES"
```

El script contiene los nombres originales y el recorte específico de cada imagen. Genera también `outputs/scenes/report.json` y `outputs/scenes/contact-sheet.png` (ignorados por Git), con dimensiones, pesos y una vista de las ocho imágenes en orden.

## Integración

Las siete entradas tienen ahora contornos propios en `app/transition-presets.json`. Se pueden afinar con «Ajustar máscaras» y recuperar por unión con «Restablecer». La clave `tgs-zoom-mask-settings-production-8-v2` activa esta propuesta sin borrar los ajustes anteriores del navegador.

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

En el último 12% de cada unión guiada, la apertura se amplía de forma continua para que la máscara estrecha no desaparezca de golpe cuando la imagen pasa a ser la base. Se mantiene un borde de imagen suavizado hasta el último tramo; en el punto de llegada la máscara es opaca. En libre, además se exige que la imagen cubra la pantalla: la apertura aumenta con un margen de cobertura del 8%, y vuelve al contorno original al desplazarse fuera de ella. Así, hacer zoom en otra dirección no abre un rectángulo sobre el fondo. No se animan las opacidades de las imágenes ni se cambia la trayectoria de cámara. Canvas reutiliza una sola superficie auxiliar de 512 × 288, sin ejecutar desenfoques ni crear superficies 4K por fotograma. El editor usa las mismas curvas de apertura, con máscaras CSS intersectadas.

Para generar una lámina de detalle de los encajes iniciales (no representa la animación ni es una captura del renderer):

```powershell
node scripts/preview-masks.mjs
node --test tests/mask-presets.test.mjs
```

La lámina se guarda en `outputs/masks/mask-proof.png`, fuera de Git. Las pruebas comprueban contornos, áreas de texto protegidas, soporte central para el desenfoque y continuidad/reversibilidad de las curvas. La apariencia durante el movimiento se revisa aparte en el navegador.

Se conservan el feather, los controles de ambos modos y sus políticas de precarga: secuencia completa antes de comenzar en guiado y ventana progresiva en libre. La geometría del visor sigue usando un lienzo 16:9 que cubre la pantalla; un teléfono vertical muestra una porción horizontal de la ilustración y permite explorarla con el zoom libre.

```powershell
node --test tests/scene-assets.test.mjs
```

La comprobación verifica orden, dimensiones 4K, opacidad, enlaces de precarga y presupuesto de descarga (menos de 6 MiB para las ocho imágenes).
