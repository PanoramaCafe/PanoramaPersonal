# Cambios V1.28

## Bug corregido: la tarifa nueva no se aplicaba, seguía usando la vieja
Al editar un trabajador, escribir la nueva tarifa (p. ej. 35) y dar clic directo en
**"💰 Aplicar tarifa a jornadas desde una fecha"** sin antes pulsar "Guardar", la ventana
de ajuste leía la tarifa **todavía guardada en la base de datos** (30), no la que acababas
de escribir en el campo — por eso el mensaje de confirmación y el resultado seguían en 30.

Ahora, al pulsar ese botón, primero se guarda la tarifa escrita en el campo y luego se abre
la ventana de ajuste, ya con el número correcto. Ejemplo real: Andrea $30 → $35, aplicado
desde el 1-jun-2020 en la prueba automática, quedó en 35, no en 30.

## Consistencia con el periodo cerrado (V1.27)
Si el cambio de tarifa retroactivo toca una jornada que ya estaba en una semana con
"✓ Revisión guardada", ahora se registra como **ajuste pendiente** (igual que editar o
borrar una jornada) en vez de alterar en silencio esa nómina ya congelada. Se revisa desde
el mismo aviso ⚠️ de "Ajustes de periodos cerrados".
