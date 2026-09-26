# Cambios V1.30

## Corregido: un ajuste "pendiente" se quedaba pegado aunque ya lo hubieras arreglado
Si una jornada de una semana revisada se corregía (por ejemplo con
🩹 "Corregir tarifa aplicada por error") y volvía a coincidir exactamente con lo que ya
estaba revisado, el aviso de "ajuste pendiente" seguía apareciendo igual — había que
entrar y darle "Descartar" a mano, semana por semana.

Ahora, si una corrección posterior deja la jornada igual a lo ya revisado, el aviso se
cierra solo (queda guardado como resuelto, no desaparece del historial, solo deja de
pedirte una decisión).
