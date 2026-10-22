# Vibrados Lagunilla

Sitio comercial React + TypeScript + Vite, con API Express y base SQLite persistente. Conserva cotizaciones por WhatsApp, reseñas moderadas, administración y proyectos anteriores. El rediseño usa CSS e iconos existentes, sin dependencias nuevas.

## Ejecutar localmente

1. Usa Node.js 22.13 o posterior y ejecuta `npm install`.
2. Copia `.env.example` a `.env`.
3. Define `ADMIN_USER` y una `ADMIN_PASSWORD` única de al menos 16 caracteres. No publiques `.env`.
4. Ejecuta `npm run dev` y abre la URL de Vite (normalmente `http://127.0.0.1:5173`).
5. Entra a `/admin` con tus credenciales.

Para revisar la compilación: `npm run build`, luego `npm start` y abre `http://127.0.0.1:3001`.

## Agregar fotografías y videos reales (sin editar código)

1. En `/admin`, ve a **Proyectos**.
2. Escribe un título breve; categoría y descripción son opcionales.
3. En **Fotos y videos autorizados**, selecciona uno o varios archivos, incluyendo fotos y videos en la misma selección.
4. Pulsa **Agregar proyecto**. Se publica automáticamente en la galería y en su filtro de categoría.
5. Abre el proyecto en el panel para editarlo o usar **Agregar archivos** posteriormente.
6. Usa las flechas junto a cada archivo para cambiar su orden. El **primer archivo es la portada**.
7. Escribe una descripción accesible para cada archivo y pulsa **Guardar descripción**.
8. Para cada video puedes cargar una **miniatura opcional**. Si no existe, la tarjeta intenta mostrar el primer fotograma; conserva el botón de reproducción.
9. Usa **Orden del proyecto** para ordenar las tarjetas (menor número primero). **Quitar** retira un archivo; debe permanecer al menos uno. Puedes eliminar el proyecto completo.

### Formatos y límites

| Archivo | Formatos | Límite por archivo |
| --- | --- | --- |
| Fotografías y miniaturas | JPG, PNG, WebP | 5 MB |
| Videos | MP4, WebM | 40 MB |

Hasta **8 archivos y 120 MB por carga**. Puedes agregar más archivos al mismo proyecto en otra carga. El servidor valida contenido y tamaño, no solo la extensión. SVG y archivos ejecutables no se aceptan.

Para compatibilidad, exporta MP4 con H.264/AAC o WebM con VP8/VP9 y Opus. El servidor almacena los videos, no los transcodifica: un códec no compatible puede impedir la reproducción. Recomendada una resolución de 720p/1080p y videos breves comprimidos. Los videos no se reproducen automáticamente y solo hay un reproductor activo en el lightbox.

Los archivos se guardan automáticamente en `DATA_DIR/uploads/` y sus datos en `DATA_DIR/site.sqlite`. **No necesitas copiar archivos a public ni modificar componentes.** No copies manualmente archivos a uploads esperando que aparezcan: debes asociarlos desde el panel. Los archivos retirados dejan de ser públicos, pero permanecen físicamente hasta mantenimiento; respalda los datos antes de limpiar almacenamiento.

### Proyectos anteriores

La migración añade `project_media` sin borrar proyectos ni cambiar IDs. Cada imagen anterior se convierte en el primer archivo de su proyecto. Al reiniciar, SQLite conserva descripciones, medios, miniaturas y orden.

## Reseñas y carrusel

El formulario público sigue enviando reseñas pendientes. En `/admin`, aprueba, rechaza, elimina o responde. Solo las aprobadas aparecen en el sitio.

- Con varias reseñas: desplazamiento continuo de derecha a izquierda; grupos idénticos evitan reinicios visibles.
- Pausa al pasar el mouse, usar teclado o arrastrar; reanuda tras la interacción. Los botones **Pausar/Reanudar** permiten detenerlo sin límite de tiempo.
- Arrastre con mouse, deslizamiento táctil, flechas de teclado y botones anterior/siguiente.
- Con movimiento reducido: sin reproducción automática ni copias; recorrido manual.
- Con una reseña: tarjeta estática. Sin reseñas: invitación a publicar la primera.
- Velocidad ajustable en `src/components/ReviewsCarousel.tsx`: recorrido de grupo de al menos 32 s, limitado a 42 px/s.

## Comprobaciones

```text
npm test
npm run test:components
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Las pruebas de componentes cubren movimiento reducido, duplicación accesible, reseña única, placeholders y carga múltiple. Las de integración comprueban migración desde el esquema anterior, permisos, moderación, persistencia tras reiniciar, imágenes/videos, solicitudes Range, miniaturas, orden, formatos inválidos y eliminación.

Para QA visual con datos sintéticos aislados:

```text
node server/integration-check.js --preview
```

Abre `http://127.0.0.1:3002`. Todo el contenido está identificado como PRUEBA. Guarda sus datos en una carpeta única dentro de `.test-data/`, nunca en `data/`. Termina con Ctrl+C. No publiques esta instancia ni uses sus testimonios en la página comercial. El fixture `server/fixtures/test.webm` es un video técnico sintético de cuatro segundos; no es un proyecto de cliente.

## Archivos principales

- `src/main.tsx`: página existente, navegación, formularios y panel.
- `src/style.css`: composición responsive, estados y animaciones.
- `src/components/ReviewsCarousel.tsx`: carrusel con pausa, teclado y arrastre.
- `src/components/ProjectGallery.tsx`: filtros, placeholders y lightbox de fotos/videos.
- `src/components/ProjectManager.tsx`: carga múltiple, miniaturas y orden desde el panel.
- `src/components/Modal.tsx`: cierre con Escape, bloqueo de scroll y foco contenido.
- `src/hooks/usePageMotion.ts`: aparición de secciones, sección activa y preferencia de movimiento.
- `src/config.ts`: contacto y tipos reutilizables `Project` / `ProjectMedia`.
- `server/index.js`: API, sesiones, persistencia, migración y archivos.
- `server/validation.js`: validación de reseñas, proyectos y formatos multimedia.

## Producción

Ejecuta `npm run build` y `npm start`. Configura un proxy HTTPS hacia `127.0.0.1:3001`, `NODE_ENV=production` y `PUBLIC_ORIGIN` con el origen público. La cookie de sesión es HttpOnly, SameSite=Strict y Secure en producción. Las sesiones caducan en ocho horas y se invalidan al reiniciar.

Requiere un servidor Node con almacenamiento persistente y una sola instancia. Respaldar toda la carpeta DATA_DIR. No desplegar únicamente `dist` si se necesitan administración y datos. Este almacenamiento local no funciona en Vercel serverless; para ese destino se requiere migrar la persistencia a un servicio externo.

Pendientes de la empresa antes de publicar: dominio definitivo, imágenes/videos autorizados, validación del texto de privacidad y coordenadas si se quiere un mapa exacto. El enlace de Maps busca la dirección proporcionada. No se agregaron reseñas, clientes ni proyectos inventados, y el despliegue de GitHub Pages se gestiona mediante Actions. El SEO existente se conserva; canonical, sitemap y URLs absolutas de Open Graph requieren el dominio definitivo.

## Material real y portada en video

Los archivos entregados el 21 de octubre están preparados en `public/media/`:

- `hero-desktop.mp4`: textura de placas, encuadre horizontal, 960×540, 24 fps, 12 s, aproximadamente 960 KB.
- `hero-mobile.mp4`: encuadre vertical independiente, 480×720, 24 fps, 12 s, aproximadamente 671 KB.
- `materiales-instalacion.mp4` y `cierre-instalado.mp4`: clips de galería convertidos a H.264, con miniaturas propias, aproximadamente 2,5 y 3 MB.
- `montaje-cierre.jpg`: fotografía original de la instalación, sin alteraciones.

La portada usa reproducción silenciosa, inline y en bucle. Pausa al salir de pantalla o cambiar de pestaña; incluye un botón para pausarla. Con ahorro de datos, conexión 2G o movimiento reducido muestra el poster estático y no carga el MP4. Si el navegador impide el autoplay o falla el archivo, conserva la imagen. El clip recorre seis segundos en ambos sentidos para suavizar la unión del bucle. Se aplicaron reducción suave de ruido, contraste y enfoque moderados; no se generaron detalles ni se promete recuperar resolución ausente en la grabación.

El contenido real se declara en `content/projects.json`. El servidor lo importa automáticamente una sola vez (registro `content_imports`), conservando proyectos anteriores y las posteriores modificaciones o eliminaciones del administrador. Para entornos de pruebas usa `IMPORT_PROVIDED_MEDIA=false`. Si no existe una API, la galería utiliza este catálogo estático de material real; las reseñas y el panel siguen requiriendo backend.

La preparación es reproducible con `scripts/prepare-supplied-media.py` y FFmpeg mediante el paquete Python `imageio-ffmpeg`. No es una dependencia del sitio desplegado ni se necesitan las grabaciones originales para ejecutarlo. Los originales nunca se sobrescriben.

En móvil se usan campos de formulario de 16 px para evitar zoom de entrada en iOS, campos apilados, controles de al menos 44 px y un control del video separado del WhatsApp flotante. El contenido inicial se muestra sin esperar a que termine la petición de configuración.

Para volver a generar las versiones optimizadas desde los originales (opcional): `python scripts/prepare-supplied-media.py --source-dir "D:/Descargas"`, con `imageio-ffmpeg` instalado. Los encuadres y ajustes están definidos en ese script.


## GitHub Pages

La publicación se realiza mediante .github/workflows/pages.yml: instala dependencias, ejecuta comprobaciones, compila React y publica únicamente dist. Pages debe usar GitHub Actions como origen, no main / (que contiene código fuente TypeScript). Cada push a main actualiza la web automáticamente.

El workflow configura VITE_BASE_PATH=/PaginaVibrados/ y VITE_STATIC_SITE=true. Las rutas de JavaScript, CSS, imágenes y videos respetan ese prefijo. La versión local conserva la raíz / y el backend.

En Pages funcionan la portada, los videos, los trabajos, los filtros, el lightbox y la cotización por WhatsApp. La opción de compartir una reseña abre WhatsApp. La base de datos, moderación, formularios de reseña persistentes y administración siguen disponibles en la versión con servidor Node; no se simulan en el hosting estático.
