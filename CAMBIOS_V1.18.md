# Cambios V1.18

**Sincronización (crítico)**
- El sync ahora reemplaza el mismo `db` que usa la pantalla (antes escribía en `window.db`, otra copia). Un dispositivo ya no puede borrar/revertir datos que no vio.
- Si se guarda algo mientras se sincroniza, el cambio se conserva y se reintenta.
- Freno: si un cambio borraría >50% de empleados/jornadas/pagos en la nube, no se envía (el remoto no se toca). Solo importar/reset lo autorizan.
- `recover` guarda lo que se sobrescribe (3 copias), no lo nuevo. Sync inmediato (~0.7 s) tras guardar.

**Importar / Borrar todo**: confirmación escrita (IMPORTAR / BORRAR TODO), muestra conteos, descarga respaldo automático antes, el borrado conserva el PIN de admin. Importar normaliza los datos.

**Pagos / Finanzas**: un solo publicador (`panorama-auth.js`), en lote; borrado lógico opcional (`softDelete`, ver docs/SUPABASE_PENDIENTE.md). Corregido `deletePayment` (función inexistente).

**Otros**: PIN admin con doble captura; pagos sin fecha ya no rompen la pantalla; `save()` ya no muestra error falso; CSV con BOM UTF-8, comillas correctas y sin "null"; descargas compatibles con Safari; CSS (`\n` roto, `.muted`, `.hidden`, `.form-grid`); código muerto eliminado; íconos PNG + apple-touch-icon; service worker v9 (4 s de límite de red, Supabase sin interceptar); versión unificada V1.18.

**No incluido (requiere Supabase/decisiones)**: cierre de políticas RLS, hash de PIN, migración de `employee_id` histórico, pagos antiguos sin `allocations`.
