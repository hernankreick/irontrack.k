-- IDENTIDAD REMOTA v1 — 1) MIGRACION (ESCRITURA; requiere aprobacion del dueño; NO ejecutada). Primero en un entorno de prueba.
-- Segura por diseño: columnas nullable sin DEFAULT (solo metadatos, sin reescribir tabla), sin backfill, sin FK, sin tocar RLS/RPC/triggers/datos.
-- Correr en DOS pasos separados: PASO A (transaccion) y PASO B (indices, FUERA de transaccion, CONCURRENTLY: no bloquea escrituras).

-- ───────── PASO A ─────────
BEGIN;
SET LOCAL lock_timeout = '3s';        -- si hay una transaccion larga sobre la tabla, falla rapido en vez de encolar bloqueos; reintentar luego
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS sesion_uid  uuid;
ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS bloque      text;
ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS pos         smallint;
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS sesion_uid  uuid;
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS identidad_v smallint;

-- NOT VALID: no escanea la tabla bajo bloqueo fuerte; se aplica a filas nuevas. Se valida despues (VALIDATE solo toma SHARE UPDATE EXCLUSIVE).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progreso_bloque_chk' AND conrelid = 'public.progreso'::regclass) THEN
    ALTER TABLE public.progreso ADD CONSTRAINT progreso_bloque_chk CHECK (bloque IS NULL OR bloque IN ('warmup', 'main')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progreso_pos_chk' AND conrelid = 'public.progreso'::regclass) THEN
    ALTER TABLE public.progreso ADD CONSTRAINT progreso_pos_chk CHECK (pos IS NULL OR pos >= 0) NOT VALID;
  END IF;
  -- bloque y pos van juntos (ambos o ninguno).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progreso_bloque_pos_juntos_chk' AND conrelid = 'public.progreso'::regclass) THEN
    ALTER TABLE public.progreso ADD CONSTRAINT progreso_bloque_pos_juntos_chk CHECK ((bloque IS NULL) = (pos IS NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sesiones_identidad_v_chk' AND conrelid = 'public.sesiones'::regclass) THEN
    ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_identidad_v_chk CHECK (identidad_v IS NULL OR identidad_v >= 1) NOT VALID;
  END IF;
END $$;
COMMIT;

-- Validacion (las filas existentes tienen las columnas en NULL, asi que pasa; no bloquea lecturas/escrituras).
ALTER TABLE public.progreso VALIDATE CONSTRAINT progreso_bloque_chk;
ALTER TABLE public.progreso VALIDATE CONSTRAINT progreso_pos_chk;
ALTER TABLE public.progreso VALIDATE CONSTRAINT progreso_bloque_pos_juntos_chk;
ALTER TABLE public.sesiones VALIDATE CONSTRAINT sesiones_identidad_v_chk;

-- ───────── PASO B (fuera de transaccion; cada sentencia sola) ─────────
-- Unico y PARCIAL: las filas sin uid (historicas, v1) no cuentan. Un reintento de finalizar no crea otra fila (23505).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sesiones_sesion_uid_uidx ON public.sesiones (sesion_uid) WHERE sesion_uid IS NOT NULL;
-- Lectura de las series de una sesion (NO unico).
CREATE INDEX CONCURRENTLY IF NOT EXISTS progreso_sesion_uid_idx ON public.progreso (sesion_uid) WHERE sesion_uid IS NOT NULL;
-- Si un CONCURRENTLY falla deja un indice INVALIDO: ver 2_verificacion.sql (V6) y borrarlo con DROP INDEX CONCURRENTLY antes de reintentar.

-- ───────── PASO C ─────────
-- PostgREST cachea el esquema: sin recarga responde PGRST204 aunque la columna exista. Supabase suele recargar solo tras DDL; se fuerza por seguridad.
NOTIFY pgrst, 'reload schema';
