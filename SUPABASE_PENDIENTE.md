# Pendiente en Supabase (no ejecutado por la app)

Revisa cada bloque antes de correrlo en el SQL Editor; el esquema exacto no se pudo ver desde el código.

## 1. Borrado lógico de pagos en Finanzas (opcional, luego pon softDelete:true en supabase-config.js)
```sql
alter table public.panorama_payroll_payments add column if not exists deleted_at timestamptz;
```
Finanzas deberá ignorar filas con `deleted_at is not null`.

## 2. updated_at confiable
```sql
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_touch_panorama_personal_state on public.panorama_personal_state;
create trigger trg_touch_panorama_personal_state before update on public.panorama_personal_state
for each row execute function public.touch_updated_at();
```

## 3. Cerrar el acceso público (una sola tablet) — hacerlo EN ESTE ORDEN
La app V1.19 ya sabe iniciar sesión; sin ese paso, cerrar las políticas la deja sin sincronizar.

0. **Antes de tocar nada, confirma que ninguna otra app lee `panorama_personal_state`:** en GitHub busca ese nombre en tus repositorios, o en Supabase → Logs → API Edge Logs filtra por esa tabla. Solo esa tabla cambia; las demás apps (que usan la clave pública) no se ven afectadas.
1. *(Opcional)* **Authentication → Providers → Email → Allow new users to sign up:** NO es necesario para este cambio, porque la política restringe por UID y un usuario nuevo no tendría acceso. Déjalo como está si alguna de tus apps deja registrarse a usuarios; desactívalo solo si ninguna lo usa.
2. **Authentication → Users → Add user:** crea uno (p. ej. `tablet@tudominio.com`, contraseña larga, *Auto Confirm*). Copia su **UID**.
3. Sube V1.19 a GitHub. En la tablet: Administración → Ajustes → **🔐 Sesión de la nube** → entra con ese usuario. Verifica que la esquina diga "Sincronizado" y haz una entrada/salida de prueba.
4. Con la sesión ya iniciada, en el SQL Editor (primero mira qué hay: `select tablename, policyname, roles, cmd from pg_policies where tablename in ('panorama_personal_state','panorama_payroll_payments');`):
```sql
-- Sustituye <UID_TABLET> por el UID del paso 2
drop policy if exists "public full access panorama personal state" on public.panorama_personal_state;
create policy "personal_state solo tablet" on public.panorama_personal_state
  for all to authenticated
  using (auth.uid() = '<UID_TABLET>'::uuid) with check (auth.uid() = '<UID_TABLET>'::uuid);
```
5. Prueba en la tablet (entrada/salida y un pago). Si falla al sincronizar, casi seguro una tabla del trigger tiene política solo `to anon` (con sesión, la tablet pasa a ser `authenticated`): cambia esa política a `to public` o vuelve atrás con el SQL de abajo. **Si algo falla, vuelve atrás:**
```sql
drop policy if exists "personal_state solo tablet" on public.panorama_personal_state;
create policy "public full access panorama personal state" on public.panorama_personal_state
  for all to public using (true) with check (true);
```
6. **Después, con calma:** `panorama_payroll_payments` y `confirm_payroll_payment` los usa Finanzas; antes de cerrarlos hay que ver cómo entra Finanzas (mismo esquema de usuario). No los toques hasta entonces.

Nota sobre PIN con hash: un PIN de 4 dígitos tiene solo 10,000 combinaciones, un hash se rompe al instante. La protección real es que el acceso público a la base esté cerrado (paso 4), no cifrar el PIN.
