-- =============================================================================
-- IronTrack — RLS P0, unidad B: reemplaza las políticas acceso_total (USING true) y los grants amplios por autorización
-- verificada. Modelo y funciones: 20261025100000_rls_p0_identity.sql (entrenador = coach_accounts; alumno = app_metadata.alumno_id).
--
-- PRE-REQUISITOS (la migración ABORTA si no se cumplen; ver docs/rls-p0-despliegue.md):
--   1. aplicada la migración de identidades y cargada public.coach_accounts con los MISMOS UIDs del secreto COACH_UIDS;
--   2. todos los alumnos con cuenta de Auth están vinculados (auth.users.raw_app_meta_data->>'alumno_id' = alumnos.id).
--      Un alumno sin vínculo perdería el acceso. Solo se puede continuar a sabiendas con:  SET it.rls_p0_force = 'on';
--   3. todo alumnos.entrenador_id es el UID de un entrenador de coach_accounts o 'entrenador_principal'.
-- No toca datos (solo políticas, grants y triggers). anon queda sin ningún privilegio. Idempotente.
-- =============================================================================
BEGIN;

-- 0) Pre-vuelo ----------------------------------------------------------------
DO $$
DECLARE n int; force boolean := coalesce(current_setting('it.rls_p0_force', true), '') = 'on'; r record;
BEGIN
  IF to_regclass('public.coach_accounts') IS NULL OR to_regprocedure('public.it_is_coach()') IS NULL THEN
    RAISE EXCEPTION 'RLS P0 abortada: falta la migración de identidades (20261025100000_rls_p0_identity.sql)';
  END IF;
  SELECT count(*) INTO n FROM public.coach_accounts;
  IF n < 1 THEN
    RAISE EXCEPTION 'RLS P0 abortada: public.coach_accounts está vacía (cargar los UIDs de COACH_UIDS con sql de despliegue; sin entrenadores nadie administraría los datos)';
  END IF;

  -- Alumnos que HOY pueden ingresar (existe una cuenta de Auth con su email) pero cuya cuenta NO está vinculada: perderían el acceso.
  -- (Un alumno sin ninguna cuenta no pierde nada: la función crea la cuenta ya vinculada al asignarle contraseña.)
  -- El email solo se usa para DETECTAR; nunca para vincular.
  SELECT count(*) INTO n FROM public.alumnos a
   WHERE EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(a.email))
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.raw_app_meta_data ->> 'alumno_id' = a.id::text);
  IF n > 0 THEN
    IF force THEN RAISE WARNING 'RLS P0: % alumnos con cuenta de Auth sin vincular (app_metadata.alumno_id) NO podrán ingresar hasta vincularlos', n;
    ELSE RAISE EXCEPTION 'RLS P0 abortada: % alumnos con cuenta de Auth sin vincular por app_metadata.alumno_id (perderían el acceso). Vincularlos de a uno con scripts/admin/link-alumno.mjs tras verificar la titularidad o, a sabiendas, SET it.rls_p0_force = ''on''', n; END IF;
  END IF;

  SELECT count(*) INTO n FROM auth.users u
   WHERE u.raw_app_meta_data ->> 'alumno_id' IS NOT NULL AND EXISTS (SELECT 1 FROM public.coach_accounts c WHERE c.uid = u.id);
  IF n > 0 THEN RAISE EXCEPTION 'RLS P0 abortada: % cuenta(s) de entrenador figuran vinculadas como alumno (app_metadata.alumno_id)', n; END IF;

  SELECT count(*) INTO n FROM public.alumnos a
   WHERE a.entrenador_id::text <> 'entrenador_principal'
     AND NOT EXISTS (SELECT 1 FROM public.coach_accounts c WHERE c.uid::text = a.entrenador_id::text);
  IF n > 0 THEN
    IF force THEN RAISE WARNING 'RLS P0: % alumnos con entrenador_id fuera de coach_accounts/entrenador_principal: ningún entrenador los verá', n;
    ELSE RAISE EXCEPTION 'RLS P0 abortada: % alumnos con entrenador_id que no es un entrenador de coach_accounts ni entrenador_principal (quedarían inaccesibles)', n; END IF;
  END IF;

  -- Datos con dueño por UID (ejercicios personalizados, overrides, rutinas, videos) cuyo dueño NO es un entrenador de coach_accounts ni
  -- 'entrenador_principal': tras el bloqueo ningún entrenador los vería (siguen en la base, pero invisibles). Suele ser un UID mal cargado.
  FOR r IN SELECT o.tbl, count(*) AS c FROM (
             SELECT 'ejercicios_custom' AS tbl, entrenador_id::text AS v FROM public.ejercicios_custom
             UNION ALL SELECT 'ejercicio_overrides', entrenador_id::text FROM public.ejercicio_overrides
             UNION ALL SELECT 'video_overrides', entrenador_id::text FROM public.video_overrides
             UNION ALL SELECT 'rutinas', entrenador_id::text FROM public.rutinas) o
            WHERE o.v IS NOT NULL AND o.v <> 'entrenador_principal'
              AND NOT EXISTS (SELECT 1 FROM public.coach_accounts c WHERE c.uid::text = o.v)
            GROUP BY o.tbl LOOP
    IF force THEN RAISE WARNING 'RLS P0: % filas de % pertenecen a un UID que no está en coach_accounts: quedarán invisibles', r.c, r.tbl;
    ELSE RAISE EXCEPTION 'RLS P0 abortada: % filas de % pertenecen a un UID que no está en coach_accounts (quedarían invisibles). Cargar ese UID en coach_accounts (si es el entrenador) o, a sabiendas, SET it.rls_p0_force = ''on''', r.c, r.tbl; END IF;
  END LOOP;

  -- Avisos (no abortan): filas huérfanas que el entrenador dejaría de ver y tablas no gestionadas expuestas.
  SELECT count(*) INTO n FROM public.rutinas ru WHERE ru.alumno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = ru.alumno_id::text);
  IF n > 0 THEN RAISE WARNING 'RLS P0: % rutinas con alumno_id inexistente: quedarán inaccesibles para el entrenador', n; END IF;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
            WHERE s.nspname = 'public' AND c.relkind IN ('r','p','v','m')
              AND c.relname <> ALL (ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides',
                    'ejercicio_overrides','ejercicios_custom','entrenadores','coach_calendar_assignments','coach_notification_reads',
                    'ejercicios_custom_backup_pre_fase1','coach_accounts'])
              AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT')) LOOP
    RAISE WARNING 'RLS P0: public.% NO está gestionada por esta migración y es legible por anon/authenticated: revisarla a mano', r.relname;
  END LOOP;
END $$;

-- 1) Triggers de guarda: qué puede cambiar quien NO es entrenador (auth.uid() NULL = service_role/postgres: sin restricción).
CREATE OR REPLACE FUNCTION public.it_guard_alumnos_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.it_is_coach() THEN
    IF (to_jsonb(NEW) - 'onesignal_id') IS DISTINCT FROM (to_jsonb(OLD) - 'onesignal_id') THEN
      RAISE EXCEPTION 'el alumno solo puede modificar onesignal_id' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Alumno: solo datos.semana_activa (entero 1..4), nunca hacia atrás; ni otras columnas ni otras claves de datos.
CREATE OR REPLACE FUNCTION public.it_guard_rutinas_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o jsonb; n jsonb; nv jsonb; ov jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.it_is_coach() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'datos') IS DISTINCT FROM (to_jsonb(OLD) - 'datos') THEN
    RAISE EXCEPTION 'el alumno solo puede modificar datos.semana_activa' USING ERRCODE = '42501';
  END IF;
  o := to_jsonb(OLD)->'datos'; n := to_jsonb(NEW)->'datos';
  IF n IS NOT DISTINCT FROM o THEN RETURN NEW; END IF;
  IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR jsonb_typeof(n) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'datos invalido' USING ERRCODE = '42501';
  END IF;
  IF (n - 'semana_activa') IS DISTINCT FROM (o - 'semana_activa') THEN
    RAISE EXCEPTION 'el alumno solo puede modificar datos.semana_activa' USING ERRCODE = '42501';
  END IF;
  nv := n->'semana_activa'; ov := o->'semana_activa';
  IF nv IS NULL OR jsonb_typeof(nv) <> 'number' OR (nv #>> '{}') !~ '^[1-4]$' THEN
    RAISE EXCEPTION 'semana_activa debe ser un entero 1..4' USING ERRCODE = '42501';
  END IF;
  IF ov IS NOT NULL AND jsonb_typeof(ov) = 'number' AND (ov #>> '{}') ~ '^[1-4]$' AND (nv #>> '{}')::int < (ov #>> '{}')::int THEN
    RAISE EXCEPTION 'semana_activa no puede retroceder' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.it_guard_mensajes_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL OR public.it_is_coach() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'leido') IS DISTINCT FROM (to_jsonb(OLD) - 'leido') THEN
    RAISE EXCEPTION 'el alumno solo puede marcar mensajes como leidos' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.it_guard_alumnos_update(), public.it_guard_rutinas_update(), public.it_guard_mensajes_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS it_guard_alumnos_update ON public.alumnos;
CREATE TRIGGER it_guard_alumnos_update BEFORE UPDATE ON public.alumnos FOR EACH ROW EXECUTE FUNCTION public.it_guard_alumnos_update();
DROP TRIGGER IF EXISTS it_guard_rutinas_update ON public.rutinas;
CREATE TRIGGER it_guard_rutinas_update BEFORE UPDATE ON public.rutinas FOR EACH ROW EXECUTE FUNCTION public.it_guard_rutinas_update();
DROP TRIGGER IF EXISTS it_guard_mensajes_update ON public.mensajes;
CREATE TRIGGER it_guard_mensajes_update BEFORE UPDATE ON public.mensajes FOR EACH ROW EXECUTE FUNCTION public.it_guard_mensajes_update();

-- 2) Barrido: eliminar TODAS las políticas de las tablas gestionadas, activar RLS y quitar grants amplios. Tablas opcionales se omiten.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides',
                           'ejercicio_overrides','ejercicios_custom','entrenadores','coach_calendar_assignments',
                           'coach_notification_reads','ejercicios_custom_backup_pre_fase1']
  LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE NOTICE 'tabla public.% no existe, se omite', t; CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- 3) Grants mínimos (RLS decide las filas). anon: nada. ejercicios_custom_backup_pre_fase1: RLS sin políticas y sin grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alumnos, public.rutinas, public.mensajes, public.fotos, public.progreso, public.sesiones,
      public.video_overrides, public.ejercicio_overrides, public.ejercicios_custom TO authenticated;
GRANT SELECT, UPDATE ON public.config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.entrenadores TO authenticated;

-- 4) Políticas ---------------------------------------------------------------
-- entrenadores: solo un entrenador autorizado y solo su propia fila (el login de main hace upsert de la propia fila).
CREATE POLICY entrenadores_self_select ON public.entrenadores FOR SELECT TO authenticated
  USING (public.it_is_coach() AND id::text = auth.uid()::text);
CREATE POLICY entrenadores_self_insert ON public.entrenadores FOR INSERT TO authenticated
  WITH CHECK (public.it_is_coach() AND id::text = auth.uid()::text);
CREATE POLICY entrenadores_self_update ON public.entrenadores FOR UPDATE TO authenticated
  USING (public.it_is_coach() AND id::text = auth.uid()::text) WITH CHECK (public.it_is_coach() AND id::text = auth.uid()::text);

-- alumnos: el entrenador gestiona los de su alcance; el alumno ve su ficha y (trigger) solo cambia onesignal_id.
CREATE POLICY alumnos_coach_all ON public.alumnos FOR ALL TO authenticated
  USING (public.it_coach_scope(entrenador_id::text)) WITH CHECK (public.it_coach_scope(entrenador_id::text));
CREATE POLICY alumnos_self_select ON public.alumnos FOR SELECT TO authenticated USING (public.it_is_alumno(id::text));
CREATE POLICY alumnos_self_update ON public.alumnos FOR UPDATE TO authenticated
  USING (public.it_is_alumno(id::text)) WITH CHECK (public.it_is_alumno(id::text));

-- rutinas: filas de alumno -> por propiedad; plantillas (alumno_id NULL) -> alcance del entrenador. El alumno: leer y (trigger) avanzar semana_activa.
CREATE POLICY rutinas_coach_all ON public.rutinas FOR ALL TO authenticated
  USING      (public.it_is_coach_of(alumno_id::text) OR (alumno_id IS NULL AND public.it_coach_scope(entrenador_id::text)))
  WITH CHECK (public.it_is_coach_of(alumno_id::text) OR (alumno_id IS NULL AND public.it_coach_scope(entrenador_id::text)));
CREATE POLICY rutinas_alumno_select ON public.rutinas FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY rutinas_alumno_update ON public.rutinas FOR UPDATE TO authenticated
  USING (public.it_is_alumno(alumno_id::text)) WITH CHECK (public.it_is_alumno(alumno_id::text));

-- progreso / sesiones: el alumno lee e inserta lo suyo (no edita ni borra: los PRs no se pisan); el entrenador todo en su alcance.
CREATE POLICY progreso_coach_all ON public.progreso FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY progreso_alumno_select ON public.progreso FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY progreso_alumno_insert ON public.progreso FOR INSERT TO authenticated WITH CHECK (public.it_is_alumno(alumno_id::text));

CREATE POLICY sesiones_coach_all ON public.sesiones FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY sesiones_alumno_select ON public.sesiones FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY sesiones_alumno_insert ON public.sesiones FOR INSERT TO authenticated WITH CHECK (public.it_is_alumno(alumno_id::text));

-- fotos: el alumno gestiona las suyas; el entrenador todo en su alcance.
CREATE POLICY fotos_coach_all ON public.fotos FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY fotos_alumno_select ON public.fotos FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY fotos_alumno_insert ON public.fotos FOR INSERT TO authenticated WITH CHECK (public.it_is_alumno(alumno_id::text));
CREATE POLICY fotos_alumno_delete ON public.fotos FOR DELETE TO authenticated USING (public.it_is_alumno(alumno_id::text));

-- mensajes: el alumno inserta solo como alumno (de_entrenador no verdadero) y solo marca leídos los del entrenador (trigger: solo leido).
CREATE POLICY mensajes_coach_all ON public.mensajes FOR ALL TO authenticated
  USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text));
CREATE POLICY mensajes_alumno_select ON public.mensajes FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text));
CREATE POLICY mensajes_alumno_insert ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (public.it_is_alumno(alumno_id::text) AND de_entrenador IS NOT TRUE);
CREATE POLICY mensajes_alumno_update ON public.mensajes FOR UPDATE TO authenticated
  USING (public.it_is_alumno(alumno_id::text) AND de_entrenador IS TRUE)
  WITH CHECK (public.it_is_alumno(alumno_id::text) AND de_entrenador IS TRUE);

-- notas (opcional): entrenador todo en su alcance; el alumno lee las suyas.
DO $$ BEGIN
  IF to_regclass('public.notas') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO authenticated';
    EXECUTE 'CREATE POLICY notas_coach_all ON public.notas FOR ALL TO authenticated USING (public.it_is_coach_of(alumno_id::text)) WITH CHECK (public.it_is_coach_of(alumno_id::text))';
    EXECUTE 'CREATE POLICY notas_alumno_select ON public.notas FOR SELECT TO authenticated USING (public.it_is_alumno(alumno_id::text))';
  END IF;
END $$;

-- config (fila global 'pagos'): la leen entrenadores y alumnos vinculados; la escribe un entrenador autorizado.
CREATE POLICY config_read_known_users ON public.config FOR SELECT TO authenticated
  USING (public.it_is_coach() OR public.it_alumno_id() IS NOT NULL);
CREATE POLICY config_coach_update ON public.config FOR UPDATE TO authenticated
  USING (public.it_is_coach()) WITH CHECK (public.it_is_coach());

-- video_overrides / ejercicio_overrides / ejercicios_custom: el entrenador gestiona los de su alcance; el alumno lee los de su entrenador.
CREATE POLICY video_overrides_coach_all ON public.video_overrides FOR ALL TO authenticated
  USING (public.it_coach_scope(entrenador_id::text)) WITH CHECK (public.it_coach_scope(entrenador_id::text));
CREATE POLICY video_overrides_alumno_select ON public.video_overrides FOR SELECT TO authenticated USING (public.it_is_my_coach(entrenador_id::text));
CREATE POLICY ejercicio_overrides_coach_all ON public.ejercicio_overrides FOR ALL TO authenticated
  USING (public.it_coach_scope(entrenador_id::text)) WITH CHECK (public.it_coach_scope(entrenador_id::text));
CREATE POLICY ejercicio_overrides_alumno_select ON public.ejercicio_overrides FOR SELECT TO authenticated USING (public.it_is_my_coach(entrenador_id::text));
CREATE POLICY ejercicios_custom_coach_all ON public.ejercicios_custom FOR ALL TO authenticated
  USING (public.it_coach_scope(entrenador_id::text)) WITH CHECK (public.it_coach_scope(entrenador_id::text));
CREATE POLICY ejercicios_custom_alumno_select ON public.ejercicios_custom FOR SELECT TO authenticated USING (public.it_is_my_coach(entrenador_id::text));

-- coach_* (sql/*.sql): solo el entrenador autorizado dueño de la fila. Tablas opcionales.
DO $$ BEGIN
  IF to_regclass('public.coach_calendar_assignments') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.coach_calendar_assignments TO authenticated';
    EXECUTE 'CREATE POLICY coach_calendar_select ON public.coach_calendar_assignments FOR SELECT TO authenticated USING (public.it_is_coach() AND auth.uid() = entrenador_id)';
    EXECUTE 'CREATE POLICY coach_calendar_insert ON public.coach_calendar_assignments FOR INSERT TO authenticated WITH CHECK (public.it_is_coach() AND auth.uid() = entrenador_id)';
    EXECUTE 'CREATE POLICY coach_calendar_delete ON public.coach_calendar_assignments FOR DELETE TO authenticated USING (public.it_is_coach() AND auth.uid() = entrenador_id)';
  END IF;
  IF to_regclass('public.coach_notification_reads') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.coach_notification_reads TO authenticated';
    EXECUTE 'CREATE POLICY coach_reads_select ON public.coach_notification_reads FOR SELECT TO authenticated USING (public.it_is_coach() AND auth.uid() = entrenador_id)';
    EXECUTE 'CREATE POLICY coach_reads_insert ON public.coach_notification_reads FOR INSERT TO authenticated WITH CHECK (public.it_is_coach() AND auth.uid() = entrenador_id)';
    EXECUTE 'CREATE POLICY coach_reads_update ON public.coach_notification_reads FOR UPDATE TO authenticated USING (public.it_is_coach() AND auth.uid() = entrenador_id) WITH CHECK (public.it_is_coach() AND auth.uid() = entrenador_id)';
  END IF;
END $$;

COMMIT;
