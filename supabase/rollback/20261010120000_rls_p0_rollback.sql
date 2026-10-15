-- ROLLBACK DE EMERGENCIA de 20261010120000_rls_p0_lockdown.sql.
-- Restaura el estado INSEGURO previo (acceso_total public). Usar solo si la app queda inutilizable
-- y no hay forma de corregir hacia adelante. No revierte el backfill de entrenador_id (no hace falta).
BEGIN;
DROP TRIGGER IF EXISTS it_guard_alumnos_insert ON public.alumnos;
DROP TRIGGER IF EXISTS it_guard_alumnos_update ON public.alumnos;
DROP TRIGGER IF EXISTS it_guard_rutinas_update ON public.rutinas;
DROP TRIGGER IF EXISTS it_guard_mensajes_update ON public.mensajes;
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
    EXECUTE format('CREATE POLICY acceso_total ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', t);
  END LOOP;
  -- Resto de tablas: se deja RLS activo con políticas de dueño y grants restaurados a authenticated/anon.
  EXECUTE 'GRANT ALL ON public.ejercicio_overrides, public.ejercicios_custom, public.entrenadores TO anon, authenticated';
  EXECUTE 'ALTER TABLE public.ejercicio_overrides DISABLE ROW LEVEL SECURITY'; -- estado original
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
            AND tablename IN ('ejercicio_overrides','ejercicios_custom','entrenadores') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
  EXECUTE 'CREATE POLICY entrenadores_self ON public.entrenadores FOR ALL TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
END $$;
DROP FUNCTION IF EXISTS public.it_guard_alumnos_insert(), public.it_guard_alumnos_update(), public.it_guard_rutinas_update(), public.it_guard_mensajes_update(),
  public.it_is_coach_of(text), public.it_is_alumno(text), public.it_is_my_coach(text),
  public.it_is_entrenador(), public.it_is_principal();
COMMIT;
-- coach_principal (migracion 20261010110000) se conserva: es inocua y no se usa tras el rollback.
-- Nota: ejercicios_custom queda con RLS activo y SIN políticas tras el rollback si no existía política previa;
-- restaurar su política original desde el respaldo (pg_policies guardado antes del despliegue).
