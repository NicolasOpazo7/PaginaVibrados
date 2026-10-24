# Reseñas: formulario, moderación y acceso privado

El público pulsa **Agregar una reseña** y se abre una tarjeta con nombre o apodo opcional, calificación, descripción, imagen opcional y autorización de publicación. La reseña se guarda como `pending`. Solo las aprobadas y sus imágenes son públicas. El panel permite revisar la imagen ampliada, aprobar, rechazar, retirar una publicada y eliminar. La lista pública se actualiza al cargar la página, regresar a la pestaña y cada minuto mientras está visible.

## Panel sin enlaces públicos

Dirección del administrador: `https://TU-SERVIDOR/panel-resenas`. En desarrollo con `npm run dev`, también puede abrirse desde la URL local de Vite más `/panel-resenas`. `/admin` se conserva por compatibilidad. Ninguna de las dos direcciones se enlaza desde el sitio público. El panel responde con `X-Robots-Tag: noindex, nofollow, noarchive` cuando se sirve desde Node; esto no impide que alguien descubra la URL. Todos los datos y acciones de moderación requieren una sesión válida en el servidor.

El panel debe abrirse en el servidor Node. No necesita cuentas de clientes y no ofrece registro público de administradores. La contraseña jamás se compila en JavaScript. No se guardan tokens en localStorage. La sesión usa una cookie HttpOnly, SameSite=Strict y Secure en producción, caduca tras 30 minutos de inactividad o dos horas en total y se invalida al cerrar sesión o reiniciar el servidor. Hay límites de intentos de login y de envío de reseñas. La autenticación no incluye segundo factor ni recuperación por correo: por ahora hay una única cuenta administradora configurada en el servidor.

## Configurar el acceso

1. Ejecuta `npm run admin:password` en una terminal interactiva. Introduce una contraseña larga y única; no se muestra al escribirla.
2. Guarda el resultado `ADMIN_PASSWORD_HASH` en las variables privadas del servidor, junto con `ADMIN_USER`. El hash usa scrypt con sal aleatoria. No pongas secretos en variables con prefijo `VITE_`, GitHub Pages, archivos públicos ni Git.
3. Para desarrollo puedes usar `.env` (ignorado por Git). En producción se exige el hash; `ADMIN_PASSWORD` en texto solo sigue admitiéndose en desarrollo por compatibilidad.
4. Para cambiar la contraseña, genera otro hash, actualiza la variable privada y reinicia Node. Esto también revoca las sesiones anteriores.

Ejemplo de variables del servidor, con valores de muestra:

```dotenv
NODE_ENV=production
ADMIN_USER=tu-usuario
ADMIN_PASSWORD_HASH=scrypt$REEMPLAZAR_POR_EL_HASH_GENERADO
DATA_DIR=/var/lib/vibrados
HOST=0.0.0.0
PORT=3001
PUBLIC_ORIGIN=https://nicolasopazo7.github.io
# Solo cuando exactamente un proxy HTTPS de confianza reenvía a Node:
TRUST_PROXY=1
```

El proxy debe terminar HTTPS y enviar correctamente Host y X-Forwarded-Proto. No expongas HTTP directamente en producción. No actives TRUST_PROXY sin controlar el proxy que hay delante. Para ensayar localmente, omite NODE_ENV=production y usa el origen exacto de Vite como PUBLIC_ORIGIN (por ejemplo `http://127.0.0.1:5174`).

## Base de datos y archivos

SQLite es adecuado para este panel pequeño con un solo proceso Node. `DATA_DIR/site.sqlite` guarda las reseñas y `DATA_DIR/uploads/` guarda las imágenes. La base y las imágenes requieren un volumen persistente: no uses un sistema de archivos efímero ni ejecutes varias instancias independientes con este diseño.

Respalda todo DATA_DIR de forma regular y prueba su restauración. Para una copia consistente, detén Node brevemente, copia DATA_DIR a almacenamiento protegido y vuelve a iniciarlo. Mantén los respaldos fuera del sitio público. Eliminar una reseña revoca el acceso público a su imagen; el archivo físico permanece hasta el mantenimiento y puede seguir en los respaldos según la política de retención.

## Publicación con GitHub Pages

GitHub Pages no ejecuta Node ni SQLite. Se puede conservar la web allí y alojar solo Node/panel/base/imágenes en un servidor aparte con HTTPS y disco persistente:

1. En ese servidor: instala Node 22.13 o posterior, ejecuta `npm ci`, `npm run build` y `npm start`. Compila **sin** VITE_STATIC_SITE, VITE_BASE_PATH ni VITE_REVIEWS_API_URL: el panel y la API se sirven desde la raíz del servidor. Configura las variables privadas anteriores mediante el proveedor, y un proxy HTTPS si corresponde.
2. Crea en GitHub → Settings → Secrets and variables → Actions → **Variables** la variable pública `VITE_REVIEWS_API_URL=https://TU-SERVIDOR`. Solo es la URL, sin `/api`, contraseña ni tokens. El workflow de Pages ya lee esta variable.
3. Ejecuta de nuevo el workflow de Pages. El formulario público enviará las reseñas al servidor y el carrusel consultará únicamente las aprobadas. PUBLIC_ORIGIN debe ser el origen de Pages, sin `/PaginaVibrados/` al final.
4. Accede al panel desde `https://TU-SERVIDOR/panel-resenas`. Las sesiones son del mismo servidor que el panel y no dependen de cookies de terceros.

Si Pages todavía no tiene la URL del servidor configurada, el formulario se abre pero el envío aparece deshabilitado y avisa que no está disponible. No se simula una recepción ni se guardan reseñas solo en el navegador. Los comentarios sintéticos de desarrollo no pasan a producción.

También puedes alojar toda la web en ese mismo servidor y prescindir de Pages: así todas las peticiones son del mismo origen.

## Comprobaciones

`npm test`, `npm run test:components`, `npm run test:integration`, `npm run lint` y `npm run build`.

La integración usa bases temporales dentro de `.test-data/` y comprueba login con hash, cookies de producción, CORS limitado al sitio público, bloqueo de cambios administrativos desde otros orígenes, imágenes privadas antes de aprobar, publicación, rechazo, borrado y persistencia tras reiniciar. No modifica la base real.
