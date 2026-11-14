-- RLS v1 — 3) ROLLBACK (ESCRITURA; SOLO EMERGENCIA y con autorizacion del dueño). ADVERTENCIA: restituye la politica PERMISIVA `acceso_total` (el estado inseguro
-- anterior: cualquier usuario autenticado, y con anon key cualquier visitante, accede a todo). Usar unicamente si la app queda inutilizable y mientras se corrige el
-- vinculo de cuentas / el padron; volver a aplicar 1_migracion.sql apenas se resuelva. Alternativa preferible: agregar el uid al padron o vincular la cuenta.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE t text; r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'it\_rls\_%' LOOP EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename); END LOOP;
  FOREACH t IN ARRAY ARRAY['alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS acceso_total ON public.%I', t);
    EXECUTE format('CREATE POLICY acceso_total ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS it_guard_alumnos ON public.alumnos;
DROP TRIGGER IF EXISTS it_guard_mensajes ON public.mensajes;
DROP TRIGGER IF EXISTS it_guard_rutinas ON public.rutinas;
-- Las funciones y el padron de it_authz se CONSERVAN (el padron cargado no se pierde; sin politicas que las usen no tienen efecto).
COMMIT;
NOTIFY pgrst, 'reload schema';
