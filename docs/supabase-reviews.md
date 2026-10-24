# Activar las reseñas con Supabase y GitHub Pages

La web usa el proyecto `qipekwkbxdfdvuvafkoj`. `content/supabase.json` contiene únicamente su URL y la clave **publishable**, que está diseñada para llegar al navegador. No contiene contraseñas ni claves secret/service_role. El formulario y el panel conservan su diseño. No hace falta alojar Node para esta modalidad.

## 1. Crear la base y el almacenamiento

En el dashboard de **ese mismo proyecto**, abre SQL Editor → New query. Copia y ejecuta todo `supabase/reviews.sql`.

El script crea las reseñas, una lista explícita de administradores, un bucket privado `review-images` y políticas de acceso. No añade usuarios administradores, no publica opiniones y no borra tablas existentes. Las imágenes admitidas son JPG/PNG/WebP de hasta 5 MB.

Solo las aprobadas son legibles por los visitantes. Las reseñas nuevas empiezan como borrador durante la subida y pasan a pendientes cuando se confirma la recepción de la imagen. Los borradores no aparecen en el panel. Los visitantes no pueden publicar directamente ni modificar reseñas existentes. El nombre/apodo es opcional y el consentimiento se comprueba también en la función de la base.

## 2. Crear tu cuenta administradora

En Authentication → Users crea una cuenta para tu correo e introduce tú la contraseña. Usa una contraseña larga y única, idealmente 16 caracteres o más. Confirma ese correo; si lo creas manualmente desde el dashboard, comprueba que la cuenta figure confirmada.

Después ejecuta `supabase/register-admin.sql`, reemplazando `TU_CORREO` por el correo de **esa cuenta**. Esto agrega su identificador a la lista privada de administradores. Solo estar registrado o conocer la clave pública no concede permisos de moderación.

Para impedir registros de clientes, desactiva las altas públicas en la configuración de Auth. No agregues una interfaz de registro a la web. La lista de administradores protege la moderación incluso si hubiera otros usuarios registrados. La contraseña nunca se introduce en el código, `.env` de Vite, GitHub ni una consulta SQL.

## 3. Entrar al panel

- Web en Pages: `https://nicolasopazo7.github.io/PaginaVibrados/?panel-resenas`
- Vista local Vite: `http://127.0.0.1:5174/?panel-resenas`

El panel no está enlazado desde la web pública. La URL puede descubrirse: la seguridad depende de Supabase Auth y las políticas de la base, no de ocultarla. Se entra con correo y contraseña. El token se conserva solo en memoria, por lo que al recargar o cerrar la pestaña hay que iniciar sesión de nuevo. No se almacenan contraseñas ni tokens en localStorage.

## 4. Publicar en Pages

No hace falta añadir claves privadas en GitHub Actions: el proyecto y la clave pública ya están declarados en `content/supabase.json`. Ejecuta las comprobaciones y sube los cambios a `main` para actualizar Pages. Para cambiar de proyecto se pueden usar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY; nunca uses una secret/service_role key en variables VITE_.

Si todavía no se ejecutó el SQL, el formulario y el panel avisan de que el servicio está en configuración. No se simulan envíos correctos. Los comentarios de demostración de desarrollo no se publican.

## Funcionamiento y límites

Las imágenes son privadas y la web genera enlaces firmados de dos minutos solo cuando las políticas permiten leerlas. Al rechazar una reseña no se generan nuevos enlaces públicos; uno ya emitido puede seguir funcionando hasta dos minutos. Las imágenes ya descargadas no pueden recuperarse del dispositivo del visitante.

Para limitar el abuso del formulario sin cuentas se admiten hasta cinco inicios de envío por minuto, cien por día y cien borradores/pendientes acumulados en el proyecto. Son límites globales para esta empresa pequeña, no un CAPTCHA ni una defensa completa contra bots. Revisa el uso en Supabase; si se recibe spam, añade CAPTCHA y validación en una Edge Function antes de ampliar los límites.

Una subida fallida puede dejar un borrador y, si la interrupción ocurrió después de subir, un archivo huérfano. La limpieza debe realizarse desde el dashboard, borrando primero el archivo mediante Storage y luego su borrador. No elimines objetos directamente con SQL: eso no garantiza borrar sus bytes de Storage. La eliminación normal desde el panel borra primero la imagen mediante la API de Storage y después la reseña.

El plan gratuito tiene cuotas y puede pausarse por inactividad. Mantén copias de seguridad antes de cualquier mantenimiento o cambio de plan. La base Node/SQLite anterior no se migra automáticamente; sus datos locales permanecen intactos.

## Pruebas

`npm test` ejecuta el SQL real de las políticas en PostgreSQL local (PGlite), con roles anon/authenticated simulados, y comprueba que los visitantes no puedan ver pendientes, alterar textos, aprobar ni acceder a imágenes privadas. Verifica además el acceso del administrador, aprobación, rechazo y límites de envíos. No modifica el proyecto real.

Después de aplicar el SQL y crear tu cuenta, realiza también una prueba real: enviar un comentario identificado como prueba con imagen, comprobar que no aparece públicamente, aprobarlo desde el panel y verificar su aparición. Elimina esa prueba al terminar.
