-- D76-09 · Rollback (PROPUESTA — NO EJECUTAR sin autorización)
--
-- NIVEL 1 (preferido, instantáneo, sin DDL): desactiva rechazos y la guarda de borrado. Los clientes nuevos leen modo='off' y
-- devuelven su cuarentena a pendientes (movimiento, nunca borrado).
--   update it_private.config set modo = 'off';
--
-- NIVEL 2 (retirar la funcionalidad). Antes: modo 'off' + frontend que ya no llame a las RPC (o que tolere su ausencia: lo hace).
-- Pierde épocas y sellos: si se reinstala, los borrados anteriores dejan de estar protegidos.
-- Las COLUMNAS historial_* / reingreso_* se CONSERVAN: borrarlas haría fallar (PGRST204) los POST de clientes que envían
-- historial_token, incluidos pendientes sellados que siguen en los teléfonos.
begin;
set local lock_timeout = '3s';
drop trigger if exists it_historial_guard_insert on public.progreso;
drop trigger if exists it_historial_guard_insert on public.sesiones;
drop trigger if exists it_historial_guard_delete on public.progreso;
drop trigger if exists it_historial_guard_delete on public.sesiones;
drop trigger if exists it_alumnos_guard_auth_uid on public.alumnos;
drop function if exists public.it_historial_sello(uuid);
drop function if exists public.it_limpiar_historial_alumno(uuid, bigint, boolean);
drop function if exists public.it_historial_reingresar(uuid, bigint, jsonb, jsonb);
drop function if exists public.it_vinculo_solicitar(uuid);
drop function if exists public.it_vinculo_aprobar(uuid, uuid);
drop schema if exists it_private cascade;
notify pgrst, 'reload schema';
commit;
