# Servicio de máscaras compartidas

## Arquitectura y publicación

- El visor conserva su dirección de GitHub Pages y su flujo habitual `npm run build`.
- `public/mask-service.json` contiene solo la dirección pública del servicio, sin credenciales.
- `npm run build:service` genera un Worker ESM independiente en `dist/server/index.js` y copia las migraciones y el manifiesto de Sites a `dist/.openai`. Reemplaza únicamente el directorio generado `dist`; ejecutar otra vez el build del visor antes de publicar Pages manualmente. GitHub Actions construye el visor desde cero.
- `.openai/hosting.json` identifica el servicio de Sites y su binding lógico D1 `DB`. El servicio necesita acceso público para que el visor pueda leerlo sin una cuenta de ChatGPT. La escritura sigue protegida por la sesión validada en el servidor.
- Configurar `MASK_EDITOR_PASSWORD` como secreto de producción y `MASK_ALLOWED_ORIGINS` con los orígenes permitidos, separados por coma. Nunca incluir la contraseña ni un token de GitHub en los archivos, la URL, los ejemplos o el bundle.
- Las migraciones de `drizzle/` se generan desde `db/schema.ts`; Sites las aplica antes del Worker. No editar migraciones ya aplicadas. No hay inicialización de tablas en los handlers.

## Contrato

- `GET /masks`: versión, fecha y las siete máscaras publicadas. Si no hay publicaciones, devuelve las máscaras aprobadas con versión cero.
- `POST /session`: recibe la contraseña por HTTPS; devuelve una sesión aleatoria de ocho horas. Diez intentos por dirección en diez minutos. Se persiste únicamente un hash de la dirección y de cada token, nunca la contraseña recibida.
- `PUT /masks`: requiere `Authorization: Bearer …`, máscaras válidas, `baseVersion` y un `requestId` UUID. Una operación SQL condicional evita sobrescribir una publicación más reciente; el identificador permite reintentos seguros.
- `DELETE /session`: revoca la sesión. Todas las respuestas llevan `Cache-Control: no-store`. CORS permite los orígenes configurados; no es el mecanismo de autenticación.

El editor tiene una contraseña compartida, no cuentas personales. No identifica autores. Es suficiente para el alcance interno solicitado; no usar esta clave sencilla para datos sensibles ni otros servicios.

## Comprobación

`node --test tests/mask-service.test.mjs` ejecuta el Worker contra SQLite en memoria con la migración real: lectura pública, CORS, acceso inválido, expiración, revocación, guardado compartido, historial, reintentos, conflictos, validación y errores de almacenamiento. Usa una contraseña aleatoria de prueba.

`node --test tests/mask-editor-access.test.mjs` verifica la conexión del editor al servidor y la separación de borradores y publicación. Las demás pruebas conservan los controles de geometría, textos completos y recursos 4K.

No registrar cuerpos de solicitudes ni encabezados de autorización. Los fallos de base de datos muestran un mensaje recuperable y no descartan el borrador. Si se pierde la respuesta de publicación, volver a presionar el botón reutiliza el identificador hasta que cambien los datos o la versión base.
