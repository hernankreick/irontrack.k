-- =============================================================================
-- IronTrack — RLS P0: reemplaza las políticas acceso_total (USING true) por
-- autorización por UID verificado + propiedad comprobada.
--
-- Identidad canónica:
--   entrenador : auth.uid() = entrenadores.id  (y alumnos.entrenador_id = auth.uid())
--   alumno     : auth.uid() = alumnos.auth_uid  (NO alumnos.id, NO email)
-- No se usa user_metadata, email del cliente ni 'entrenador_principal'.
--
-- PRE-REQUISITO: todas las filas de alumnos deben tener entrenador_id = id real
-- de un entrenador. Si no, esta migración ABORTA (ver sql/rls_p0_backfill_entrenador_principal.sql).
-- Sin SECURITY DEFINER. Idempotente (se puede re-ejecutar).
-- =============================================================================
BEGIN;

-- 0) Pre-vuelo: abortar si hay alumnos sin entrenador real (quedarían inaccesibles).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.alumnos a
   WHERE NOT EXISTS (SELECT 1 FROM public.entrenadores e WHERE e.id::text = a.entrenador_id::text);
  IF n > 0 THEN
    RAISE EXCEPTION 'RLS P0 abortada: % alumnos con entrenador_id que no existe en entrenadores (p.ej. entrenador_principal). Ejecutar antes sql/rls_p0_backfill_entrenador_principal.sql', n;
  END IF;
  SELECT count(*) INTO n FROM public.alumnos WHERE auth_uid IS NULL;
  IF n > 0 THEN
    RAISE WARNING '% alumnos sin auth_uid: no podrán acceder como alumno hasta vincularlos', n;
  END IF;
END $$;

-- 1) Funciones auxiliares (SECURITY INVOKER: respetan RLS de alumnos).
CREATE OR REPLACE FUNCTION public.it_is_coach_of(p_alumno_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.alumnos a
                  WHERE a.id::text = p_alumno_id
                    AND a.entrenador_id::text = auth.uid()::text)
$$;

CREATE OR REPLACE FUNCTION public.it_is_alumno(p_alumno_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.alumnos a
                  WHERE a.id::text = p_alumno_id
                    AND a.auth_uid::text = auth.uid()::text)
$$;

-- ¿el entrenador_id (de una tabla de overrides/custom) es el coach de este alumno autenticado?
CREATE OR REPLACE FUNCTION public.it_is_my_coach(p_entrenador_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.alumnos a
                  WHERE a.entrenador_id::text = p_entrenador_id
                    AND a.auth_uid::text = auth.uid()::text)
$$;

-- ¿el usuario autenticado tiene fila en entrenadores? (las filas de alumnos vinculados no pueden crearla: ver entrenadores_insert_self)
CREATE OR REPLACE FUNCTION public.it_is_entrenador()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.entrenadores e WHERE e.id::text = auth.uid()::text)
$$;

REVOKE ALL ON FUNCTION public.it_is_entrenador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.it_is_entrenador() TO authenticated;
REVOKE ALL ON FUNCTION public.it_is_coach_of(text), public.it_is_alumno(text), public.it_is_my_coach(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.it_is_coach_of(text), public.it_is_alumno(text), public.it_is_my_coach(text) TO authenticated;

-- 2) Triggers de guarda: lo que un alumno puede cambiar en un UPDATE.
--    (auth.uid() NULL = service_role/postgres: no se restringe.)
CREATE OR REPLACE FUNCTION public.it_guard_alumnos_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.entrenador_id::text IS DISTINCT FROM auth.uid()::text THEN
    IF (to_jsonb(NEW) - 'onesignal_id') IS DISTINCT FROM (to_jsonb(OLD) - 'onesignal_id') THEN
      RAISE EXCEPTION 'alumno solo puede modificar onesignal_id' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.it_guard_rutinas_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.it_is_coach_of(OLD.alumno_id::text)
     AND OLD.entrenador_id::text IS DISTINCT FROM auth.uid()::text THEN
    IF (to_jsonb(NEW) - 'datos') IS DISTINCT FROM (to_jsonb(OLD) - 'datos') THEN
      RAISE EXCEPTION 'alumno solo puede modificar datos de la rutina' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.it_guard_mensajes_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.it_is_coach_of(OLD.alumno_id::text) THEN
    IF (to_jsonb(NEW) - 'leido') IS DISTINCT FROM (to_jsonb(OLD) - 'leido') THEN
      RAISE EXCEPTION 'alumno solo puede marcar mensajes como leidos' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.it_guard_alumnos_update(), public.it_guard_rutinas_update(), public.it_guard_mensajes_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS it_guard_alumnos_update ON public.alumnos;
CREATE TRIGGER it_guard_alumnos_update BEFORE UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.it_guard_alumnos_update();
DROP TRIGGER IF EXISTS it_guard_rutinas_update ON public.rutinas;
CREATE TRIGGER it_guard_rutinas_update BEFORE UPDATE ON public.rutinas
  FOR EACH ROW EXECUTE FUNCTION public.it_guard_rutinas_update();
DROP TRIGGER IF EXISTS it_guard_mensajes_update ON public.mensajes;
CREATE TRIGGER it_guard_mensajes_update BEFORE UPDATE ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.it_guard_mensajes_update();

-- 3) Barrido: eliminar TODAS las políticas existentes de las tablas gestionadas,
--    activar RLS y quitar grants amplios. Tablas opcionales se omiten si no existen.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas',
                           'video_overrides','ejercicio_overrides','ejercicios_custom','entrenadores',
                           'coach_calendar_assignments','coach_notification_reads']
  LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE NOTICE 'tabla public.% no existe, se omite', t; CONTINUE;
    END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- 4) Grants mínimos (RLS decide las filas). anon: nada.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alumnos, public.rutinas, public.mensajes,
      public.fotos, public.video_overrides, public.ejercicio_overrides, public.ejercicios_custom TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progreso, public.sesiones TO authenticated; -- DELETE solo lo habilita RLS al coach
GRANT SELECT, UPDATE ON public.config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.entrenadores TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.coach_calendar_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.coach_notification_reads TO authenticated;

-- 5) Políticas ---------------------------------------------------------------
-- entrenadores: solo la propia fila.
CREATE POLICY entrenadores_select_self ON public.entrenadores FOR SELECT TO authenticated USING (id::text = auth.uid()::text);
-- Un usuario vinculado como alumno (alumnos.auth_uid) no puede auto-registrarse como entrenador.
CREATE POLICY entrenadores_insert_self ON public.entrenadores FOR INSERT TO authenticated
  WITH CHECK (id::text = auth.uid()::text
              AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = auth.uid()::text));
CREATE POLICY entrenadores_update_self ON public.entrenadores FOR UPDATE TO authenticated
  USING (id::text = auth.uid()::text) WITH CHECK (id::text = auth.uid()::text);

-- alumnos: el entrenador gestiona los suyos; el alumno ve su fila y (por trigger) solo cambia onesignal_id.
CREATE POLICY alumnos_coach_select ON public.alumnos FOR SELECT TO authenticated USING (entrenador_id::text = auth.uid()::text);
CREATE POLICY alumnos_coach_insert ON public.alumnos FOR INSERT TO authenticated
  WITH CHECK (entrenador_id::text = auth.uid()::text
              AND public.it_is_entrenador());
CREATE POLICY alumnos_coach_update ON public.alumnos FOR UPDATE TO authenticated
  USING (entrenador_id::text = auth.uid()::text) WITH CHECK (entrenador_id::text = auth.uid()::text);
CREATE POLICY alumnos_coach_delete ON public.alumnos FOR DELETE TO authenticated USING (entrenador_id::text = auth.uid()::text);
CREATE POLICY alumnos_self_select ON public.alumnos FOR SELECT TO authenticated USING (auth_uid::text = auth.uid()::text);
CREATE POLICY alumnos_self_update ON public.alumnos FOR UPDATE TO authenticated
  USING (auth_uid::text = auth.uid()::text) WITH CHECK (auth_uid::text = auth.uid()::text);

-- rutinas: filas de alumno -> por propiedad del alumno; plantillas (alumno_id NULL) -> entrenador_id = uid.
CREATE POLICY rutinas_coach_all ON public.rutinas FOR ALL TO authenticated
  USING      (public.it_is_coach_of(alumno_id::text) OR (alumno_id IS NULL AND entrenador_id::text = auth.uid()::text))
  WITH CHECK (public.it_is_coach_of(alumno_id::text)
              OR (alumno_id IS NULL AND entrenador_id::text = auth.uid()::text AND public.it_is_entrenador()));
CREATE POLICY rutinas_alumno_select ON public.rutinas FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY rutinas_alumno_update ON public.rutinas FOR UPDATE TO authenticated
  USING (public.it_is_alumno(alumno_id::text)) WITH CHECK (public.it_is_alumno(alumno_id::text)); -- columnas: trigger (solo datos)

-- progreso / sesiones: el alumno lee e inserta lo suyo (no edita ni borra: los PRs no se pisan); el entrenador todo.
CREATE POLICY progreso_coach_all ON public.progreso FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY progreso_alumno_select ON public.progreso FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY progreso_alumno_insert ON public.progreso FOR INSERT TO authenticated WITH CHECK (public.it_is_alumno(alumno_id::text));

CREATE POLICY sesiones_coach_all ON public.sesiones FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY sesiones_alumno_select ON public.sesiones FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY sesiones_alumno_insert ON public.sesiones FOR INSERT TO authenticated WITH CHECK (public.it_is_alumno(alumno_id::text));

-- fotos: el alumno gestiona las suyas; el entrenador todo sobre sus alumnos.
CREATE POLICY fotos_coach_all ON public.fotos FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY fotos_alumno_select ON public.fotos FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY fotos_alumno_insert ON public.fotos FOR INSERT TO authenticated WITH CHECK (public.it_is_alumno(alumno_id::text));
CREATE POLICY fotos_alumno_delete ON public.fotos FOR DELETE TO authenticated USING (public.it_is_alumno(alumno_id::text));

-- mensajes: el alumno solo inserta como alumno (de_entrenador=false) y solo marca leidos los del entrenador.
CREATE POLICY mensajes_coach_all ON public.mensajes FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY mensajes_alumno_select ON public.mensajes FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY mensajes_alumno_insert ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (public.it_is_alumno(alumno_id::text) AND de_entrenador IS NOT TRUE);
CREATE POLICY mensajes_alumno_update ON public.mensajes FOR UPDATE TO authenticated
  USING (public.it_is_alumno(alumno_id::text) AND de_entrenador IS TRUE)
  WITH CHECK (public.it_is_alumno(alumno_id::text) AND de_entrenador IS TRUE); -- columnas: trigger (solo leido)

-- notas (opcional)
DO $$ BEGIN
  IF to_regclass('public.notas') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO authenticated';
    EXECUTE 'CREATE POLICY notas_coach_all ON public.notas FOR ALL TO authenticated USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text))';
    EXECUTE 'CREATE POLICY notas_alumno_select ON public.notas FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text))';
  END IF;
END $$;

-- config (fila global 'pagos'): lectura para usuarios identificados (entrenador o alumno vinculado); escritura solo entrenadores.
CREATE POLICY config_read_known_users ON public.config FOR SELECT TO authenticated
  USING (public.it_is_entrenador()
      OR EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = auth.uid()::text));
CREATE POLICY config_coach_update ON public.config FOR UPDATE TO authenticated
  USING (public.it_is_entrenador()) WITH CHECK (public.it_is_entrenador());

-- video_overrides / ejercicio_overrides / ejercicios_custom: dueño = entrenador_id = uid; el alumno lee los de su entrenador.
CREATE POLICY video_overrides_owner ON public.video_overrides FOR ALL TO authenticated
  USING (entrenador_id::text = auth.uid()::text)
  WITH CHECK (entrenador_id::text = auth.uid()::text AND public.it_is_entrenador());
CREATE POLICY video_overrides_alumno_select ON public.video_overrides FOR SELECT TO authenticated USING (public.it_is_my_coach(entrenador_id::text));
CREATE POLICY ejercicio_overrides_owner ON public.ejercicio_overrides FOR ALL TO authenticated
  USING (entrenador_id::text = auth.uid()::text)
  WITH CHECK (entrenador_id::text = auth.uid()::text AND public.it_is_entrenador());
CREATE POLICY ejercicio_overrides_alumno_select ON public.ejercicio_overrides FOR SELECT TO authenticated USING (public.it_is_my_coach(entrenador_id::text));
CREATE POLICY ejercicios_custom_owner ON public.ejercicios_custom FOR ALL TO authenticated
  USING (entrenador_id::text = auth.uid()::text)
  WITH CHECK (entrenador_id::text = auth.uid()::text AND public.it_is_entrenador());
CREATE POLICY ejercicios_custom_alumno_select ON public.ejercicios_custom FOR SELECT TO authenticated USING (public.it_is_my_coach(entrenador_id::text));

-- coach_* (ya versionadas en sql/): mismas reglas, ahora TO authenticated.
CREATE POLICY coach_calendar_select ON public.coach_calendar_assignments FOR SELECT TO authenticated USING (auth.uid() = entrenador_id);
CREATE POLICY coach_calendar_insert ON public.coach_calendar_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = entrenador_id);
CREATE POLICY coach_calendar_delete ON public.coach_calendar_assignments FOR DELETE TO authenticated USING (auth.uid() = entrenador_id);
CREATE POLICY coach_reads_select ON public.coach_notification_reads FOR SELECT TO authenticated USING (auth.uid() = entrenador_id);
CREATE POLICY coach_reads_insert ON public.coach_notification_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = entrenador_id);
CREATE POLICY coach_reads_update ON public.coach_notification_reads FOR UPDATE TO authenticated
  USING (auth.uid() = entrenador_id) WITH CHECK (auth.uid() = entrenador_id);

COMMIT;
