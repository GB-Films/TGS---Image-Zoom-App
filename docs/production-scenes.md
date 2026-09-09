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

Se definieron posiciones iniciales de entrada según las nuevas ilustraciones; se pueden afinar con «Ajustar máscaras». Los ajustes usan la clave `tgs-zoom-mask-settings-production-8-v1` para no reutilizar las máscaras de la demo anterior ni borrar esos valores del navegador.

Se conservan el feather, los controles de ambos modos y sus políticas de precarga: secuencia completa antes de comenzar en guiado y ventana progresiva en libre. La geometría del visor sigue usando un lienzo 16:9 que cubre la pantalla; un teléfono vertical muestra una porción horizontal de la ilustración y permite explorarla con el zoom libre.

```powershell
node --test tests/scene-assets.test.mjs
```

La comprobación verifica orden, dimensiones 4K, opacidad, enlaces de precarga y presupuesto de descarga (menos de 6 MiB para las ocho imágenes).
