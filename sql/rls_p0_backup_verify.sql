-- =============================================================================
-- VERIFICACIÓN de la copia interna backup_rls_p0 — SOLO LECTURA (SQL Editor). Devuelve conteos y ids faltantes, nunca contenido.
-- Se ejecuta DOS veces: (1) justo después de crear la copia  →  todo debe dar OK en el bloque A.
--                       (2) después de backfill/migración 2/uso real  →  el bloque B debe mostrar faltantes = 0.
-- Si ejecutás cada SELECT por separado en el SQL Editor, usá un resultado por vez.
-- =============================================================================

-- A) Integridad de la copia: cuenta y huella (md5) idénticas al manifiesto y, si nada cambió desde la copia, a las tablas vivas.
--    OK_COPIA   = la copia coincide con el manifiesto (la copia no se corrompió).
--    OK_ORIGEN  = la tabla viva sigue idéntica a la copia (esperable solo inmediatamente después de copiar).
SELECT m.tbl,
       m.row_count AS filas_manifiesto,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM backup_rls_p0.%I', m.tbl), false, true, '')))[1]::text::bigint AS filas_copia,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', m.tbl), false, true, '')))[1]::text::bigint AS filas_vivas,
       ((xpath('/row/h/text()', query_to_xml(format($f$SELECT md5(coalesce(string_agg(x::text, E'\n' ORDER BY x::text), '')) AS h FROM backup_rls_p0.%I x$f$, m.tbl), false, true, '')))[1]::text = m.md5) AS ok_copia,
       ((xpath('/row/h/text()', query_to_xml(format($f$SELECT md5(coalesce(string_agg(x::text, E'\n' ORDER BY x::text), '')) AS h FROM public.%I x$f$, m.tbl), false, true, '')))[1]::text = m.md5) AS ok_origen
  FROM backup_rls_p0.manifest m
 ORDER BY m.tbl;

-- B) Cambios desde la copia, por clave primaria (solo ids, sin contenido):
--    faltantes = filas de la copia que YA NO existen vivas (borradas o cambiaron de id)  → debe ser 0 salvo borrados intencionales.
--    nuevas    = filas vivas que no estaban en la copia (datos nuevos de alumnos/entrenador)  → informativo; NUNCA se pisan al restaurar.
--    solo_entrenador_id = filas distintas ÚNICAMENTE en la columna entrenador_id (efecto esperado del backfill).
WITH keys(tbl, k) AS (VALUES
  ('alumnos','id'),('rutinas','id'),('progreso','id'),('sesiones','id'),('fotos','id'),('mensajes','id'),('notas','id'),('config','id'),
  ('entrenadores','id'),('ejercicio_overrides','id'),('ejercicios_custom','id'),('video_overrides','ejercicio_id'),
  ('coach_calendar_assignments','id'),('coach_notification_reads','id'))
SELECT k.tbl, k.k AS clave,
       CASE WHEN has.ok THEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM backup_rls_p0.%1$I b WHERE NOT EXISTS (SELECT 1 FROM public.%1$I s WHERE s.%2$I::text = b.%2$I::text)', k.tbl, k.k), false, true, '')))[1]::text::bigint END AS faltantes,
       CASE WHEN has.ok THEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%1$I s WHERE NOT EXISTS (SELECT 1 FROM backup_rls_p0.%1$I b WHERE s.%2$I::text = b.%2$I::text)', k.tbl, k.k), false, true, '')))[1]::text::bigint END AS nuevas,
       CASE WHEN has.ok AND has_ent.ok THEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%1$I s JOIN backup_rls_p0.%1$I b ON s.%2$I::text = b.%2$I::text WHERE to_jsonb(s) <> to_jsonb(b) AND (to_jsonb(s) - ''entrenador_id'') = (to_jsonb(b) - ''entrenador_id'')', k.tbl, k.k), false, true, '')))[1]::text::bigint END AS solo_entrenador_id,
       CASE WHEN has.ok THEN '' ELSE 'sin clave ' || k.k || ' o sin copia: comparar solo conteos (bloque A)' END AS nota
  FROM keys k
  CROSS JOIN LATERAL (SELECT to_regclass('backup_rls_p0.' || k.tbl) IS NOT NULL AND to_regclass('public.' || k.tbl) IS NOT NULL
                             AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=k.tbl AND c.column_name=k.k) AS ok) has
  CROSS JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=k.tbl AND c.column_name='entrenador_id') AS ok) has_ent
 ORDER BY k.tbl;

-- C) Objetos: ¿el snapshot tiene lo esperado? (conteos del snapshot vs estado actual; difieren tras las migraciones, es normal)
SELECT 'politicas' AS objeto, (SELECT count(*) FROM backup_rls_p0.policies) AS en_copia, (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS actuales
UNION ALL SELECT 'triggers', (SELECT count(*) FROM backup_rls_p0.triggers), (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal)
UNION ALL SELECT 'funciones', (SELECT count(*) FROM backup_rls_p0.functions), (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f')
UNION ALL SELECT 'constraints', (SELECT count(*) FROM backup_rls_p0.constraints), (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace)
UNION ALL SELECT 'auth.users', (SELECT count(*) FROM backup_rls_p0.auth_users_min), (SELECT count(*) FROM auth.users);
