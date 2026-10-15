-- =============================================================================
-- PREFLIGHT DE SOLO LECTURA para RLS P0 — SQL Editor de Supabase (producción). NO escribe nada, NO devuelve datos personales.
-- Solo catálogos y conteos. Pegar el resultado completo (tabla) para decidir APTO / NO APTO.
-- Decisión: si no hay filas con ok = false y gate = 'BLOQUEANTE', las migraciones/backfill son aplicables sobre este esquema.
-- UID del entrenador principal (verificado por el propietario): ver CTE p.
-- =============================================================================
WITH p(uid) AS (VALUES ('e2447231-c0ba-4f90-946f-63bf364570af')),
req_tables(t, optional) AS (VALUES
  ('alumnos',false),('rutinas',false),('progreso',false),('sesiones',false),('fotos',false),('mensajes',false),
  ('config',false),('entrenadores',false),('video_overrides',false),('ejercicio_overrides',false),('ejercicios_custom',false),
  ('notas',true),('coach_calendar_assignments',true),('coach_notification_reads',true),('ejercicios_custom_backup_pre_fase1',true)),
req_cols(t, c) AS (VALUES
  ('alumnos','id'),('alumnos','entrenador_id'),('alumnos','auth_uid'),('alumnos','onesignal_id'),('alumnos','email'),
  ('rutinas','id'),('rutinas','alumno_id'),('rutinas','entrenador_id'),('rutinas','datos'),
  ('progreso','alumno_id'),('sesiones','alumno_id'),('fotos','alumno_id'),
  ('mensajes','alumno_id'),('mensajes','de_entrenador'),('mensajes','leido'),
  ('config','id'),('entrenadores','id'),
  ('video_overrides','entrenador_id'),('video_overrides','ejercicio_id'),
  ('ejercicio_overrides','entrenador_id'),('ejercicio_overrides','ejercicio_id'),
  ('ejercicios_custom','entrenador_id'),('ejercicios_custom','id')),
checks AS (
  -- 1. Tablas
  SELECT 'tabla ' || t AS check_name, 'existe' AS expected,
         CASE WHEN to_regclass('public.' || t) IS NOT NULL THEN 'existe' ELSE 'NO existe' END AS actual,
         (to_regclass('public.' || t) IS NOT NULL OR optional) AS ok,
         CASE WHEN optional THEN 'INFO' ELSE 'BLOQUEANTE' END AS gate
    FROM req_tables
  UNION ALL
  -- 2. Columnas usadas por las políticas/triggers
  SELECT 'columna ' || r.t || '.' || r.c, 'existe',
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=r.t AND k.column_name=r.c) THEN 'existe' ELSE 'NO existe' END,
         EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name=r.t AND k.column_name=r.c)
           OR to_regclass('public.' || r.t) IS NULL,
         'BLOQUEANTE'
    FROM req_cols r
  UNION ALL
  -- 3. Tipos clave
  SELECT 'tipo rutinas.datos', 'jsonb', coalesce((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='rutinas' AND column_name='datos'), 'n/a'),
         coalesce((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='rutinas' AND column_name='datos'), '') = 'jsonb', 'BLOQUEANTE'
  UNION ALL
  SELECT 'tipo ' || c.table_name || '.' || c.column_name, 'uuid|text', c.data_type, c.data_type IN ('uuid','text','character varying'), 'BLOQUEANTE'
    FROM information_schema.columns c
   WHERE c.table_schema='public' AND ((c.table_name='alumnos' AND c.column_name IN ('id','entrenador_id','auth_uid'))
      OR (c.table_name IN ('progreso','sesiones','fotos','mensajes','rutinas') AND c.column_name='alumno_id')
      OR (c.table_name IN ('rutinas','video_overrides','ejercicio_overrides','ejercicios_custom') AND c.column_name='entrenador_id'))
  UNION ALL
  -- 4. Infraestructura de Supabase
  SELECT 'roles anon/authenticated/service_role', '3', (SELECT count(*)::text FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
         (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) = 3, 'BLOQUEANTE'
  UNION ALL
  SELECT 'funcion auth.uid()', 'existe', CASE WHEN to_regprocedure('auth.uid()') IS NOT NULL THEN 'existe' ELSE 'NO existe' END, to_regprocedure('auth.uid()') IS NOT NULL, 'BLOQUEANTE'
  UNION ALL
  SELECT 'tabla auth.users', 'existe', CASE WHEN to_regclass('auth.users') IS NOT NULL THEN 'existe' ELSE 'NO existe' END, to_regclass('auth.users') IS NOT NULL, 'BLOQUEANTE'
  UNION ALL
  -- 5. Identidad del entrenador principal
  SELECT 'principal en auth.users', '1', (SELECT count(*)::text FROM auth.users u, p WHERE u.id::text = p.uid), (SELECT count(*) FROM auth.users u, p WHERE u.id::text = p.uid) = 1, 'BLOQUEANTE'
  UNION ALL
  SELECT 'principal en entrenadores (mismo id)', '1', (SELECT count(*)::text FROM public.entrenadores e, p WHERE e.id::text = p.uid), (SELECT count(*) FROM public.entrenadores e, p WHERE e.id::text = p.uid) = 1, 'BLOQUEANTE'
  UNION ALL
  SELECT 'principal NO figura como alumnos.auth_uid', '0', (SELECT count(*)::text FROM public.alumnos a, p WHERE a.auth_uid::text = p.uid), (SELECT count(*) FROM public.alumnos a, p WHERE a.auth_uid::text = p.uid) = 0, 'BLOQUEANTE'
  UNION ALL
  -- 6. Datos: alumnos y propiedad (solo conteos)
  SELECT 'alumnos con entrenador_principal (esperado 9)', '9', (SELECT count(*)::text FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal'),
         (SELECT count(*) FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal') = 9, 'BLOQUEANTE'
  UNION ALL
  SELECT 'alumnos con entrenador_id que no es legacy ni el principal', '0',
         (SELECT count(*)::text FROM public.alumnos a, p WHERE a.entrenador_id::text NOT IN ('entrenador_principal', p.uid)),
         (SELECT count(*) FROM public.alumnos a, p WHERE a.entrenador_id::text NOT IN ('entrenador_principal', p.uid)) = 0, 'BLOQUEANTE'
  UNION ALL
  SELECT 'alumnos sin auth_uid (no podrian entrar)', '0', (SELECT count(*)::text FROM public.alumnos WHERE auth_uid IS NULL), (SELECT count(*) FROM public.alumnos WHERE auth_uid IS NULL) = 0, 'BLOQUEANTE'
  UNION ALL
  SELECT 'alumnos con auth_uid repetido', '0', (SELECT count(*)::text FROM (SELECT auth_uid FROM public.alumnos WHERE auth_uid IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d),
         (SELECT count(*) FROM (SELECT auth_uid FROM public.alumnos WHERE auth_uid IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d) = 0, 'BLOQUEANTE'
  UNION ALL
  SELECT 'alumnos con auth_uid sin cuenta en auth.users', '0', (SELECT count(*)::text FROM public.alumnos a WHERE a.auth_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.auth_uid)),
         (SELECT count(*) FROM public.alumnos a WHERE a.auth_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.auth_uid)) = 0, 'BLOQUEANTE'
  UNION ALL
  -- 7. Backfill: conflictos de unicidad (mismo ejercicio con legacy y con el UUID)
  SELECT 'ejercicio_overrides: conflicto legacy vs UUID', '0',
         (SELECT count(*)::text FROM public.ejercicio_overrides l, p WHERE l.entrenador_id::text='entrenador_principal' AND EXISTS (SELECT 1 FROM public.ejercicio_overrides u WHERE u.entrenador_id::text = p.uid AND u.ejercicio_id = l.ejercicio_id)),
         (SELECT count(*) FROM public.ejercicio_overrides l, p WHERE l.entrenador_id::text='entrenador_principal' AND EXISTS (SELECT 1 FROM public.ejercicio_overrides u WHERE u.entrenador_id::text = p.uid AND u.ejercicio_id = l.ejercicio_id)) = 0, 'BLOQUEANTE'
  UNION ALL
  SELECT 'video_overrides: conflicto legacy vs UUID (ejercicio_id unico)', '0',
         (SELECT count(*)::text FROM public.video_overrides l, p WHERE l.entrenador_id::text='entrenador_principal' AND EXISTS (SELECT 1 FROM public.video_overrides u WHERE u.entrenador_id::text = p.uid AND u.ejercicio_id = l.ejercicio_id)),
         (SELECT count(*) FROM public.video_overrides l, p WHERE l.entrenador_id::text='entrenador_principal' AND EXISTS (SELECT 1 FROM public.video_overrides u WHERE u.entrenador_id::text = p.uid AND u.ejercicio_id = l.ejercicio_id)) = 0, 'BLOQUEANTE'
  UNION ALL
  -- 8. Informativo (no bloquea)
  SELECT 'entrenadores que son alumnos (upsert del cliente)', 'info', (SELECT count(*)::text FROM public.entrenadores e JOIN public.alumnos a ON a.auth_uid::text = e.id::text), true, 'INFO'
  UNION ALL
  SELECT 'rutinas con entrenador_principal', 'info', (SELECT count(*)::text FROM public.rutinas WHERE entrenador_id::text = 'entrenador_principal'), true, 'INFO'
  UNION ALL
  SELECT 'rutinas con alumno_id sin alumno (huerfanas)', '0', (SELECT count(*)::text FROM public.rutinas r WHERE r.alumno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)),
         (SELECT count(*) FROM public.rutinas r WHERE r.alumno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)) = 0, 'INFO'
  UNION ALL
  SELECT 'politicas actuales en public', 'info', (SELECT count(*)::text FROM pg_policies WHERE schemaname='public'), true, 'INFO'
  UNION ALL
  SELECT 'politicas con USING(true) (se eliminan)', 'info', (SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND qual IN ('true','(true)')), true, 'INFO'
  UNION ALL
  SELECT 'triggers de usuario en public', 'info', (SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal), true, 'INFO'
  UNION ALL
  SELECT 'funciones/tablas de la migracion ya existentes (it_*, coach_principal)', '0',
         ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'it\_%') + (CASE WHEN to_regclass('public.coach_principal') IS NOT NULL THEN 1 ELSE 0 END))::text,
         true, 'INFO'
  UNION ALL
  SELECT 'columnas que no esperaba en rutinas.entrenador_id (nullable)', 'info', coalesce((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='rutinas' AND column_name='entrenador_id'), 'n/a'), true, 'INFO'
)
SELECT CASE WHEN ok THEN 'OK' ELSE 'FALLA' END AS resultado, gate, check_name, expected, actual
  FROM checks
 ORDER BY ok, (gate = 'INFO'), check_name;
-- Resumen rápido: SELECT count(*) FILTER (WHERE NOT ok AND gate='BLOQUEANTE') bloqueantes ... (ver la columna resultado = FALLA)
