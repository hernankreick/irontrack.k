-- =============================================================================
-- VERIFICACIÓN B8 — AISLAMIENTO entre usuarios (SQL Editor de Supabase). No requiere editar nada: toma por sí misma TODOS los alumnos
-- con cuenta vinculada (alumnos.auth_uid) y al entrenador principal. No guarda nada: termina SIEMPRE con un error "VEREDICTO" a propósito
-- (eso revierte la transacción). Solo SELECT; no muestra nombres, correos ni ids: solo conteos y números de orden.
-- Para cada alumno vinculado simula su sesión (rol authenticated + JWT con su auth_uid) y exige:
--   · ve exactamente 1 alumno (él) y ningún alumno ajeno;
--   · 0 filas ajenas en rutinas, progreso, sesiones, fotos, mensajes y notas;  · 0 filas en entrenadores.
-- Entrenador principal: ve todos los alumnos.   Usuario sin datos (UUID aleatorio): no ve nada y no puede crearse una fila de entrenador.
-- Antes de la migración 2 debe dar FALLA (RLS abierta); después, OK.
-- =============================================================================
DO $$
DECLARE
  filas text[]; a text; sid text; suid text; t text; n bigint; total bigint; i int := 0;
  coach text; stranger text := gen_random_uuid()::text;
  ext text[] := ARRAY['rutinas','progreso','sesiones','fotos','mensajes','notas'];
  fallas int := 0; r text := '';
BEGIN
  SELECT count(*) INTO total FROM public.alumnos;
  SELECT array_agg(id::text || '|' || auth_uid::text ORDER BY id::text) INTO filas FROM public.alumnos WHERE auth_uid IS NOT NULL;
  IF to_regclass('public.coach_principal') IS NOT NULL THEN EXECUTE 'SELECT uid::text FROM public.coach_principal' INTO coach; END IF;

  -- 1) cada alumno vinculado
  FOREACH a IN ARRAY coalesce(filas, ARRAY[]::text[]) LOOP
    i := i + 1; sid := split_part(a, '|', 1); suid := split_part(a, '|', 2);
    PERFORM set_config('request.jwt.claim.sub', suid, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', suid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      SELECT count(*) INTO n FROM public.alumnos;
      IF n <> 1 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' alumnos (esperado 1)'; END IF;
      SELECT count(*) INTO n FROM public.alumnos WHERE id::text <> sid;
      IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' alumno(s) ajeno(s)'; END IF;
      FOREACH t IN ARRAY ext LOOP
        BEGIN
          EXECUTE format('SELECT count(*) FROM public.%I WHERE alumno_id::text IS DISTINCT FROM %L', t, sid) INTO n;
          IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' fila(s) ajena(s) en ' || t; END IF;
        EXCEPTION
          WHEN insufficient_privilege THEN NULL;   -- sin permiso = no ve nada ajeno
          WHEN undefined_table THEN NULL;
        END;
      END LOOP;
      SELECT count(*) INTO n FROM public.entrenadores;
      IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' fila(s) de entrenadores'; END IF;
    EXCEPTION WHEN OTHERS THEN
      fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': error inesperado SQLSTATE ' || SQLSTATE;
    END;
    RESET ROLE;
  END LOOP;

  -- 2) entrenador principal: ve todos los alumnos
  IF coach IS NULL THEN
    fallas := fallas + 1; r := r || E'\n  entrenador principal: coach_principal vacío';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', coach, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', coach, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      SELECT count(*) INTO n FROM public.alumnos;
      IF n <> total THEN fallas := fallas + 1; r := r || E'\n  entrenador principal: ve ' || n || ' de ' || total || ' alumnos'; END IF;
    EXCEPTION WHEN OTHERS THEN
      fallas := fallas + 1; r := r || E'\n  entrenador principal: error inesperado SQLSTATE ' || SQLSTATE;
    END;
    RESET ROLE;
  END IF;

  -- 3) usuario autenticado sin ningún dato propio (UUID aleatorio): no debe ver nada
  PERFORM set_config('request.jwt.claim.sub', stranger, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOREACH t IN ARRAY ARRAY['alumnos','rutinas','progreso','sesiones','fotos','mensajes','notas','entrenadores'] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  usuario sin datos: ve ' || n || ' fila(s) en ' || t; END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
  -- el usuario sin datos tampoco puede crearse una fila de entrenador (eso le daría privilegios de entrenador)
  BEGIN
    INSERT INTO public.entrenadores(id, email) VALUES (stranger::uuid, 'sin-datos@invalid.local');
    fallas := fallas + 1; r := r || E'\n  usuario sin datos: PUDO crearse una fila de entrenador';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- esperado: rechazado por la política RLS
    WHEN OTHERS THEN fallas := fallas + 1; r := r || E'\n  usuario sin datos: el alta de entrenador no fue rechazada por RLS (SQLSTATE ' || SQLSTATE || ')';
  END;
  RESET ROLE;

  IF r = '' THEN r := E'\n  (ninguno)'; END IF;
  RAISE EXCEPTION E'VEREDICTO: % (error esperado; no se guardó nada)\n  alumnos con cuenta vinculada probados: %  |  alumnos en total: %\n  detalle de problemas:%',
    CASE WHEN i = 0 THEN 'SIN PRUEBA - no hay alumnos con auth_uid'
         WHEN fallas = 0 THEN 'OK - cada alumno ve solo lo suyo; el entrenador ve todos; un usuario sin datos no ve nada'
         ELSE 'FALLA - ' || fallas || ' problema(s)' END, i, total, r;
END $$;
