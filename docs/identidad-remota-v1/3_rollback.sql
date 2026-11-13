-- IDENTIDAD REMOTA v1 — 3) ROLLBACK (ESCRITURA; solo con autorizacion del dueño).
-- ORDEN: 1º desactivar la bandera en el frontend (ver RUNBOOK.md). El SQL solo se revierte si hace falta (la bandera apagada ya devuelve los payloads antiguos).
-- Un cliente con la bandera aun activa que encuentre las columnas borradas recibe PGRST204 y reenvia sin ellas (degradacion segura).
-- ANTES: respaldar la identidad guardada (se pierde al borrar columnas). Ejecutar y guardar el resultado:
--   select id, sesion_uid, bloque, pos from public.progreso where sesion_uid is not null or bloque is not null or pos is not null;
--   select id, sesion_uid, identidad_v from public.sesiones where sesion_uid is not null or identidad_v is not null;

BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE public.progreso DROP CONSTRAINT IF EXISTS progreso_bloque_pos_juntos_chk, DROP CONSTRAINT IF EXISTS progreso_pos_chk, DROP CONSTRAINT IF EXISTS progreso_bloque_chk;
ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_identidad_v_chk;
ALTER TABLE public.progreso DROP COLUMN IF EXISTS pos, DROP COLUMN IF EXISTS bloque, DROP COLUMN IF EXISTS sesion_uid;  -- borra tambien progreso_sesion_uid_idx
ALTER TABLE public.sesiones DROP COLUMN IF EXISTS identidad_v, DROP COLUMN IF EXISTS sesion_uid;                        -- borra tambien sesiones_sesion_uid_uidx
COMMIT;
NOTIFY pgrst, 'reload schema';
-- Rollback PARCIAL (mantener columnas, quitar solo el riesgo de la unicidad): DROP INDEX CONCURRENTLY IF EXISTS public.sesiones_sesion_uid_uidx;  (fuera de transaccion)
