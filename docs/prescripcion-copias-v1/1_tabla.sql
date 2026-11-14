-- PRESCRIPCION-COPIAS v1 — 1) TABLA (ESCRITURA; requiere aprobacion del dueño; NO ejecutada en Supabase). Probada solo en PostgreSQL local descartable.
-- Guarda la copia HISTORICA de la prescripcion que vio el alumno al iniciar un entrenamiento (lib/prescripcionSnapshot.js). Sin esta tabla no hay con que
-- comparar: toda sesion queda "sin_copia" (estado explicito) y nunca se compara con la rutina actual.
-- Segura por diseño: tabla nueva (no toca progreso/sesiones/rutinas), sin FK, sin backfill, sin triggers, sin politicas.
-- RLS: DEPENDE de docs/rls-v1/1_migracion.sql (funciones it_authz.*). Politicas: el alumno (app_metadata.alumno_id) inserta y lee SUS copias, solo de una rutina
--      que es suya; el entrenador autorizado lee las de sus alumnos; nadie actualiza ni borra (la copia es inmutable). anon: nada.
--      LIMITE CONOCIDO: el contenido de la copia (snapshot) lo calcula el cliente: un alumno podria falsear la copia de SU PROPIA sesion. No afecta a otros alumnos
--      ni al entrenador (las ve etiquetadas como lo que son); una captura del lado del servidor (RPC) la haria a prueba de falsificacion. Ver README.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $$ BEGIN
  IF to_regprocedure('it_authz.es_alumno(text)') IS NULL OR to_regprocedure('it_authz.gestiona_alumno(text)') IS NULL THEN
    RAISE EXCEPTION 'prescripcion_copias: falta la migracion RLS (docs/rls-v1/1_migracion.sql); aplicarla primero';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.prescripcion_copias (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id        text        NOT NULL,
  rutina_id        text        NOT NULL,
  ciclo            integer     NOT NULL DEFAULT 1 CHECK (ciclo >= 1),
  semana           smallint    NOT NULL CHECK (semana BETWEEN 1 AND 4),
  dia_idx          smallint    NOT NULL CHECK (dia_idx >= 0),
  fecha_dia        date        NOT NULL,
  prescripcion_hash text       NOT NULL CHECK (prescripcion_hash ~ '^sha256:[0-9a-f]{64}$'),
  snapshot         jsonb       NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Reintento del mismo inicio (misma clave y misma huella) => 23505, no una segunda fila. Huella distinta para la misma clave SI se permite:
  -- la lectura la trata como "ambigua" y no elige ninguna (lib/prescripcionSnapshot.js: estadoCopiaDeSesion).
  CONSTRAINT prescripcion_copias_clave_hash_uq UNIQUE (alumno_id, rutina_id, ciclo, semana, dia_idx, fecha_dia, prescripcion_hash)
);
ALTER TABLE public.prescripcion_copias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prescripcion_copias FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.prescripcion_copias TO authenticated;
DROP POLICY IF EXISTS it_rls_prescripcion_copias_select ON public.prescripcion_copias;
CREATE POLICY it_rls_prescripcion_copias_select ON public.prescripcion_copias FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id) OR it_authz.gestiona_alumno(alumno_id));
DROP POLICY IF EXISTS it_rls_prescripcion_copias_insert ON public.prescripcion_copias;
CREATE POLICY it_rls_prescripcion_copias_insert ON public.prescripcion_copias FOR INSERT TO authenticated WITH CHECK (
  it_authz.es_alumno(alumno_id) AND EXISTS (SELECT 1 FROM public.rutinas r WHERE r.id::text = rutina_id AND r.alumno_id::text = alumno_id));
CREATE INDEX IF NOT EXISTS prescripcion_copias_alumno_idx ON public.prescripcion_copias (alumno_id, rutina_id, ciclo, semana);
COMMIT;
NOTIFY pgrst, 'reload schema';
