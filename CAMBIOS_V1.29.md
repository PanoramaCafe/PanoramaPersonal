# Cambios V1.29

## Por qué el cambio de tarifa de Andrea (30→35) salió mal
El campo de fecha de "Aplicar tarifa a jornadas desde una fecha" arrancaba lleno con
**el primer día que esa persona trabajó jamás**, no con hoy. Si no lo movías a mano al
21 de septiembre, la tarifa nueva se aplicaba desde el principio de su historial
(por eso salieron 24 ajustes en semanas de agosto).

**Ahora el campo arranca en HOY.** Si de verdad quieres retroactivo, tienes que mover
la fecha tú mismo, a propósito — ya no es el valor por defecto.

## Nueva herramienta: 🩹 Corregir tarifa aplicada por error
Para deshacer un caso como el de Andrea: en Administración → Trabajadores → Editar →
**🩹 Corregir tarifa aplicada por error**. Escribe la tarifa correcta (30) y el rango de
fechas exacto a corregir (por ejemplo, desde que empezó a trabajar hasta el 2026-09-20).
Corrige el dato de raíz (`rateAtEntry`) en esas jornadas. Si alguna ya está en una semana
revisada, se guarda como ajuste pendiente en vez de tocar esa nómina sola — igual que
con cualquier otra edición retroactiva.
