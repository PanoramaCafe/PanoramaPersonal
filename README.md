# Panorama Personal V1.19

App web/PWA para reloj checador, asistencia, nómina y pagos de Panorama Café.

## Archivos
- `index.html` — aplicación (interfaz + lógica local).
- `panorama-core-integration.js` — sincronización con Supabase (`panorama_personal_state`, fila `personal-main`).
- `panorama-session.js` — sesión de la nube (Supabase Auth): la tablet inicia sesión una vez; los empleados nunca la ven.
- `panorama-auth.js` — puente de pagos hacia `panorama_payroll_payments` (único publicador; el nombre es histórico, no autentica).
- `supabase-config.js` — URL y clave publicable. `softDelete:true` activa el borrado lógico en Finanzas (ver `docs/`).
- `service-worker.js`, `manifest.json`, `icons/` — PWA y funcionamiento offline.
- `rescate.html` — página de solo lectura para recuperar copias locales.
- `docs/` — auditorías y plan de seguridad.

## Reglas de sincronización
- Una sola copia de datos en memoria; el sync reemplaza ese mismo `db`.
- Si un cambio borraría más de la mitad de empleados/jornadas/pagos en la nube, la sincronización se detiene y no toca el remoto. Solo "Importar respaldo" y "Borrar todos los datos" (con confirmación escrita y respaldo automático) lo autorizan.

## Publicación
Sube todos los archivos a la raíz del repositorio (GitHub Pages). Al cambiar código, sube también el número de `CACHE_NAME` en `service-worker.js`.
