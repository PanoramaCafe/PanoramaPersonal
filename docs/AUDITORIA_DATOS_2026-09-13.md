# Auditoría de datos reales — 2026-09-13

## Resultado

Auditoría no destructiva. No se eliminaron registros ni tablas.

### Estado remoto actual

`public.panorama_personal_state` contiene:

- 4 empleados activos.
- 49 jornadas/sesiones.
- 9 pagos dentro del estado principal.
- 3 periodos semanales de nómina.
- 2 aprobaciones.
- 3 semanas finalizadas/revisadas.
- 49 de 49 jornadas cerradas.

Las jornadas remotas abarcan entradas del **20 de agosto al 13 de septiembre de 2026**. No aparecen jornadas remotas con entrada del 17 al 19 de agosto.

Esto no demuestra que no existan datos locales de esos días; solamente significa que no están presentes en el estado remoto consultado. No deben eliminarse datos locales para intentar igualar este rango.

### Jornadas

- Promedio: aproximadamente 5.41 horas.
- Máxima: aproximadamente 8.88 horas.
- Jornadas de más de 12 horas: 0.
- Jornadas abiertas sin salida: 0.

### Nómina

Los periodos semanales registrados comienzan el 17, 24 y 31 de agosto de 2026. Los snapshots conservan jornadas e importes históricos.

### Hallazgo pendiente

Se detectó una **inconsistencia de identidad histórica en pagos**: existen pagos asociados a un `employee_id` anterior para un trabajador que actualmente usa otro identificador. El nombre coincide, pero el UUID no coincide con el empleado activo actual.

Esto debe tratarse como un problema de integridad/migración, **no como motivo para borrar o recrear pagos**. Los pagos se conservan intactos hasta definir una migración segura que mantenga trazabilidad del identificador anterior.

## Código

La versión actual incluye protección para evitar que un dispositivo con un snapshot anterior sobrescriba información más reciente y evita eliminaciones remotas automáticas durante la reconciliación.

## Regla para próximas modificaciones

1. Identificar el registro histórico.
2. Comparar UUID, nombre y contexto del periodo.
3. Preservar el registro original.
4. Crear una relación explícita si es necesaria.
5. Verificar totales antes y después.
6. No borrar registros reales para corregir inconsistencias.
