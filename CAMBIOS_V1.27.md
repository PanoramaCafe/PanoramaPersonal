# Cambios V1.27 — Periodo de nómina realmente cerrado

Corrige el bug reportado: editar una jornada de una semana con "✓ Revisión guardada"
cambiaba esa nómina y generaba deuda falsa (caso Yescas, 14–20 sep).

## Qué cambia
- **La revisión guardada ahora congela el monto de cada jornada**, no solo el total.
  `sessionOutstanding`/`employeePaymentSummary` usan ese monto congelado para las jornadas
  que ya estaban en una semana revisada; una edición posterior ya NO cambia esa nómina ni
  genera deuda o pendiente por sí sola.
- **Editar o eliminar una jornada de una semana revisada ya no pasa en silencio.** Se avisa
  y se guarda un **ajuste pendiente** (antes → ahora) aparte, sin tocar la nómina congelada.
- **Nueva pantalla "Ajustes de periodos cerrados"** (aviso ⚠️ en Revisión de nómina): por cada
  ajuste, aplicarlo (actualiza esa jornada dentro de la nómina ya revisada) o descartarlo
  (se queda como estaba, tal como se revisó).
- **"🔓 Reabrir y recalcular esta semana"**: vuelve a construir la revisión completa con las
  jornadas actuales (para cuando de verdad hay que corregir una semana entera). No toca pagos.
- **Reemplazado el parche fijo de Edwin/Andrea** (vivía escrito en el código) por un
  **"🧮 Corte de saldo"** editable por trabajador, en Administración → Trabajadores. Se migró
  automáticamente una sola vez a datos editables; después se administra desde ahí, sin tocar código.

## Importante sobre los datos ya existentes
Las semanas que ya estaban "revisadas" ANTES de subir esta versión no tenían el detalle por
jornada, así que se completó una sola vez usando los valores **actuales** de esas jornadas.
Si alguna quedó con un número editado antes de subir esta versión (por ejemplo si la prueba de
Yescas no se revirtió), esa semana se congelará con ese número, no con el original.

**Después de subir esta versión, revisa la semana 14–20 sep:**
1. Corrige (si hace falta) la jornada de Yescas a sus horas correctas.
2. Ve a Administración → Revisión de nómina → esa semana → **🔓 Reabrir y recalcular esta semana**.
3. Confirma que los totales coincidan con lo esperado (Yescas $298.35, Andrea $567.66, Edwin $978.37).
