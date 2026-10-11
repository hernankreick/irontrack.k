-- =============================================================================
-- VERIFICACIÓN B8 — acceso ANÓNIMO (SQL Editor de Supabase). No requiere editar nada. No guarda nada: termina SIEMPRE con un error
-- "RESULTADO" a propósito (eso revierte la transacción); el error es lo ESPERADO, el veredicto está en su primera línea.
-- Simula una petición sin sesión (rol anon) y cuenta qué filas puede leer. Solo SELECT; no muestra contenido, solo conteos.
-- Antes de la migración 2 debe dar FALLA (es la exposición que esa migración cierra); después, OK.
-- =============================================================================
DO $$
DECLARE
  t text; n bigint; r text := ''; fallas int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','mensajes','fotos','notas','config','entrenadores',
                           'video_overrides','ejercicio_overrides','ejercicios_custom','coach_calendar_assignments','coach_principal'] LOOP
    BEGIN
      SET LOCAL ROLE anon;
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      RESET ROLE;
      IF n > 0 THEN fallas := fallas + 1; r := r || E'\n  ' || t || ': anon LEE ' || n || ' fila(s)  <-- FALLA';
      ELSE r := r || E'\n  ' || t || ': 0 filas visibles (OK)'; END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN RESET ROLE; r := r || E'\n  ' || t || ': permiso denegado (OK)';
      WHEN undefined_table THEN RESET ROLE; r := r || E'\n  ' || t || ': no existe (omitida)';
    END;
  END LOOP;
  RAISE EXCEPTION E'VEREDICTO: % (error esperado; no se guardó nada)%',
    CASE WHEN fallas = 0 THEN 'OK - el anónimo no lee ninguna tabla' ELSE 'FALLA - ' || fallas || ' tabla(s) legibles sin sesión' END, r;
END $$;
