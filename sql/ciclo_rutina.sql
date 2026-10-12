-- Ciclo de rutina (reinicio de rutina conservando historial).
-- VERIFICAR ANTES DE CORRER: el schema real de sesiones/progreso no esta versionado en el repo;
-- esta migracion solo agrega una columna y es idempotente (se puede correr mas de una vez).
--
-- Retrocompatible:
--  * filas existentes quedan en ciclo 1 (DEFAULT 1 + NOT NULL se aplica a las filas viejas);
--  * un frontend viejo que inserta sin `ciclo` sigue funcionando (toma el DEFAULT 1);
--  * no se toca RLS, constraints ni datos existentes.
-- El ciclo VIGENTE de cada rutina vive en rutinas.datos.ciclo_actual (JSON, sin migracion).

ALTER TABLE public.sesiones  ADD COLUMN IF NOT EXISTS ciclo integer NOT NULL DEFAULT 1;
ALTER TABLE public.progreso  ADD COLUMN IF NOT EXISTS ciclo integer NOT NULL DEFAULT 1;

-- Consultas de Progreso por ciclo (comparar ciclo 1 vs 2).
CREATE INDEX IF NOT EXISTS sesiones_alumno_rutina_ciclo_idx ON public.sesiones (alumno_id, rutina_id, ciclo);
CREATE INDEX IF NOT EXISTS progreso_alumno_ciclo_idx        ON public.progreso (alumno_id, ciclo);

-- Verificacion rapida (debe devolver 1 fila por tabla):
-- select table_name, column_name, column_default from information_schema.columns
--  where table_schema='public' and column_name='ciclo' and table_name in ('sesiones','progreso');
