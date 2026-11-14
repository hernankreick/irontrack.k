-- RLS v1 — 2) VERIFICACION POSTERIOR (SOLO LECTURA). Correr tras la migracion y ANTES de abrir la app a los usuarios.
-- V1. RLS activa en las 12 tablas. ESPERADO: 12 filas true.
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
   and c.relname in ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom') order by 1;
-- V2. Solo existen politicas it_rls_* y NINGUNA es incondicional. ESPERADO: 0 filas.
select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public'
   and tablename in ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom')
   and (policyname not like 'it_rls\_%' or coalesce(qual, '') in ('true', '(true)') or coalesce(with_check, '') in ('true', '(true)') or 'public' = any (roles::text[]) or 'anon' = any (roles::text[]));
-- V3. anon sin privilegios sobre esas tablas; authenticated sin TRUNCATE/REFERENCES/TRIGGER. ESPERADO: 0 filas.
select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public'
   and table_name in ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom')
   and ((grantee = 'anon') or (grantee = 'authenticated' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')));
-- V4. Funciones de decision: SECURITY DEFINER con search_path fijo y sin EXECUTE para anon. ESPERADO: es_entrenador, es_dueno, gestiona_alumno, entrenador_de_mi_alumno definer=true con config; anon_ejecuta=false en todas.
select p.proname, p.prosecdef as definer, p.proconfig, has_function_privilege('anon', p.oid, 'execute') as anon_ejecuta, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_ejecuta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'it_authz' order by 1;
-- V5. Padron de entrenadores cargado. ESPERADO: >= 1 fila (los uids de COACH_UIDS). Sin esto el entrenador no tiene acceso.
select count(*) as entrenadores_autorizados from it_authz.entrenadores_autorizados;
-- V6. El padron NO es legible ni escribible por la API. ESPERADO: false, false, false.
select has_table_privilege('anon', 'it_authz.entrenadores_autorizados', 'select') as anon_lee, has_table_privilege('authenticated', 'it_authz.entrenadores_autorizados', 'select') as auth_lee, has_table_privilege('authenticated', 'it_authz.entrenadores_autorizados', 'insert') as auth_escribe;
-- V7. Triggers de columnas. ESPERADO: it_guard_alumnos, it_guard_mensajes, it_guard_rutinas.
select event_object_table, trigger_name from information_schema.triggers where trigger_schema = 'public' and trigger_name like 'it\_guard\_%' order by 1;
-- V8. RPC/SECURITY DEFINER de public ejecutables por anon/authenticated: revisar a mano que validen al llamador (R5). ESPERADO: ninguna que escriba datos sin validar.
with f as materialized (select p.oid, p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f','p'))
select proname from f where prosecdef and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute')) order by 1;
-- V9 (MANUAL, con CUENTAS DE PRUEBA y su JWT real de Supabase Auth; ninguna simulacion lo reemplaza):
--   a) alumno A vinculado: GET alumnos/progreso/sesiones/rutinas/mensajes propios => filas; GET de B => 0 filas; POST progreso con alumno_id de B => 401/403 (42501).
--   b) alumno A: PATCH alumnos?id=eq.A {onesignal_id} => 200; {entrenador_id} => 403 (42501); PATCH rutinas datos con semana_activa+1 => 200; con otra clave o retroceso => 403.
--   c) usuario autenticado SIN vinculo ni padron: todo => 0 filas / 403. Peticion SIN sesion (anon key): todo => 401/403.
--   d) entrenador: lista sus alumnos, rutinas, progreso; crea alumno/rutina/nota/mensaje; no ve alumnos con otro entrenador_id.
--   e) it_authz.entrenadores_autorizados no es accesible por la API (404/403 en /rest/v1/ y en rpc).
