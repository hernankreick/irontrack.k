-- PRESCRIPCION-COPIAS v1 — 1) TABLA (ESCRITURA; requiere aprobacion del dueño; NO ejecutada en Supabase). Probada solo en PostgreSQL local descartable.
-- Guarda la copia HISTORICA de la prescripcion que vio el alumno al iniciar un entrenamiento (lib/prescripcionSnapshot.js). Sin esta tabla no hay con que
-- comparar: toda sesion queda "sin_copia" (estado explicito) y nunca se compara con la rutina actual.
-- Segura por diseño: tabla nueva (no toca progreso/sesiones/rutinas), sin FK, sin backfill, sin triggers, sin politicas.
-- RLS: se habilita SIN politicas => nadie (salvo service_role) lee ni escribe hasta que el carril de RLS defina las politicas por alumno/entrenador.
--      NO se agregan GRANT ni politicas aqui a proposito (no mezclar con la correccion pendiente de acceso_total).
BEGIN;
SET LOCAL lock_timeout = '3s';
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
CREATE INDEX IF NOT EXISTS prescripcion_copias_alumno_idx ON public.prescripcion_copias (alumno_id, rutina_id, ciclo, semana);
COMMIT;
NOTIFY pgrst, 'reload schema';
