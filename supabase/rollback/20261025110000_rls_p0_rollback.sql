-- ROLLBACK DE EMERGENCIA de 20261025110000_rls_p0_lockdown.sql.
-- Restaura el estado INSEGURO previo conocido (acceso_total para todos, grants amplios). Usar SOLO si la app queda inutilizable y no se puede
-- corregir hacia adelante. Preferible: restaurar el SQL generado por 20261025110000_rls_p0_snapshot_readonly.sql (estado exacto previo).
-- No toca datos. Conserva la migración de identidades (coach_accounts y funciones it_*): son inocuas sin las políticas.
BEGIN;
DROP TRIGGER IF EXISTS it_guard_alumnos_update ON public.alumnos;
DROP TRIGGER IF EXISTS it_guard_rutinas_update ON public.rutinas;
DROP TRIGGER IF EXISTS it_guard_mensajes_update ON public.mensajes;
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides',
                           'ejercicios_custom','entrenadores','coach_calendar_assignments','coach_notification_reads'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
    IF t = 'ejercicio_overrides' THEN
      EXECUTE 'ALTER TABLE public.ejercicio_overrides DISABLE ROW LEVEL SECURITY'; -- estado original auditado
    ELSIF t = 'entrenadores' THEN
      EXECUTE 'CREATE POLICY entrenadores_self ON public.entrenadores FOR ALL TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
    ELSIF t IN ('coach_calendar_assignments','coach_notification_reads') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.uid() = entrenador_id) WITH CHECK (auth.uid() = entrenador_id)', t || '_owner', t);
    ELSE
      EXECUTE format('CREATE POLICY acceso_total ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.it_guard_alumnos_update(), public.it_guard_rutinas_update(), public.it_guard_mensajes_update();
COMMIT;
