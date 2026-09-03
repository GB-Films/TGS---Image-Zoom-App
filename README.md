# TGS · Zoom infinito para iPad

Prototipo de una experiencia interactiva para eventos presenciales. Después de
la portada de TGS, el visitante puede hacer un gesto de zoom para entrar de
forma continua en una secuencia de imágenes.

## Funcionamiento actual

- Zoom con dos dedos en iPad y pantallas táctiles.
- Rueda del mouse o trackpad como alternativa en computadoras.
- La persona controla la profundidad, mientras la cámara se centra
  automáticamente en el punto correcto de cada escena.
- Las imágenes iniciales se solicitan y decodifican antes de habilitar
  **Comenzar**. Los niveles posteriores se preparan de forma escalonada.
- En modo usuario, todas las escenas visibles se componen en un único lienzo.
  No hay árboles visuales superpuestos, fundidos entre copias ni reemplazos al
  cruzar una unión.
- Cada imagen insertada usa una máscara fija con feather que crece junto con el
  nivel y mantiene estable la fusión durante el zoom.
- El botón **Ajustar máscaras** abre un modo desarrollador visual. Para cada
  unión permite arrastrar, agregar y quitar puntos; regular suavizado y feather;
  mover y escalar la imagen; y ajustar la posición y tamaño de la entrada.
- Las máscaras usan coordenadas propias de la imagen sobre un lienzo 16:9. La
  rotación del iPad cambia el recorte visible, no el polígono.
- Los puntos conservan un área táctil amplia. El editor incluye formas iniciales
  de círculo, cuadrado y triángulo.
- El control central verde mueve la máscara completa y también actualiza el
  objetivo real de la cámara.
- En pantallas anchas, el lienzo puede desplazarse para dejar libre el panel. En
  pantallas angostas, el panel pasa a una bandeja inferior desplazable.
- Los ajustes se guardan automáticamente en el navegador.
- Siete escenas 4K WebP reales forman el recorrido de prueba actual.
- Botón **Reiniciar**, manifest, iconos y metadatos básicos de PWA.

Las imágenes definitivas podrán reemplazarse sin cambiar la mecánica. La
configuración se encuentra en `app/page.tsx` y los recursos visuales en
`public/scenes/`.

## Continuidad y rendimiento

La estructura contempla hasta 15 imágenes 4K. La reproducción pública usa un
compositor Canvas 2D persistente: cada cuadro se dibuja con una sola cámara y
solo mantiene el nivel anterior y los tres siguientes. La resolución interna se
limita para no saturar la GPU del iPad. El feather se rasteriza una sola vez por
configuración y luego la máscara resultante se reutiliza durante todo el gesto.

La memoria usa una ventana deslizante de hasta cinco escenas: dos niveles por
detrás y dos por delante del nivel actual. Las imágenes se decodifican como
`ImageBitmap` cuando el navegador lo permite y se cierran explícitamente al
salir de esa ventana. Nunca se procesan más de dos decodificaciones a la vez.

Los siete WebP se descargan progresivamente a la caché HTTP sin abrirlos todos
en memoria. De esa manera, las escenas futuras suelen estar disponibles
localmente al llegar a ellas, pero solo las cercanas consumen memoria gráfica.

La posición de la cámara y el logaritmo de su escala recorren una spline cúbica
de tangentes cortas. El recorrido se mantiene cerca de la línea directa entre
centros sin producir un quiebre al atravesar una unión. Al normalizar las coordenadas, los niveles
anteriores se recuperan mediante la transformación inversa exacta; la spline no
cambia de centro, escala ni velocidad.

El editor conserva la estructura HTML necesaria para seleccionar y arrastrar
los puntos, pero esa estructura no se monta en modo usuario. Así no puede
aparecer una segunda copia semitransparente durante la reproducción.

Los eventos táctiles se agrupan por cuadro de pantalla para que una ráfaga de
movimientos no provoque más actualizaciones de las que puede mostrar el iPad.
El guardado local también se agrupa para evitar escrituras durante cada
movimiento del dedo.

## Uso local

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3000`.

Para verla desde un iPad conectado a la misma red Wi-Fi, abrir en Safari la IP
local de la computadora seguida de `:3000`. Ejemplo:
`http://192.168.1.20:3000`.

## Verificación

```bash
npm run build
npm test
npm run lint
```

## Próximas imágenes

Para que la fusión final resulte perfecta, cada imagen debe contener visualmente
el entorno donde aparecerá la escena siguiente. Conviene registrar las
coordenadas del objetivo y procurar continuidad de color, luz, perspectiva y
textura en ambos lados de la unión.
