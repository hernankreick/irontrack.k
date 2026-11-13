-- IDENTIDAD REMOTA v1 — 2) VERIFICACION POSTERIOR (SOLO LECTURA). Correr tras la migracion y ANTES de activar la bandera.

-- V1. 5 columnas, tipos y nulabilidad exactos. ESPERADO: 5 filas, todas is_nullable=YES, column_default NULL:
--     progreso.bloque text | progreso.pos smallint | progreso.sesion_uid uuid | sesiones.identidad_v smallint | sesiones.sesion_uid uuid
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and ((table_name = 'progreso' and column_name in ('sesion_uid','bloque','pos')) or (table_name = 'sesiones' and column_name in ('sesion_uid','identidad_v')))
 order by 1, 2;
-- V2. Sin backfill. ESPERADO: 0 y 0.
select count(*) as progreso_con_identidad from public.progreso where sesion_uid is not null or bloque is not null or pos is not null;
select count(*) as sesiones_con_identidad from public.sesiones where sesion_uid is not null or identidad_v is not null;
-- V3. Las 4 restricciones existen y estan validadas. ESPERADO: 4 filas con convalidated = true.
select conrelid::regclass as tabla, conname, convalidated, pg_get_constraintdef(oid) as def from pg_constraint
 where conname in ('progreso_bloque_chk','progreso_pos_chk','progreso_bloque_pos_juntos_chk','sesiones_identidad_v_chk') order by 1, 2;
-- V4. Sin claves foraneas sobre las columnas nuevas. ESPERADO: 0 filas.
select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
 where contype = 'f' and conrelid in ('public.progreso'::regclass, 'public.sesiones'::regclass) and pg_get_constraintdef(oid) ~ '(sesion_uid|bloque|pos|identidad_v)';
-- V5. Indices: unico parcial en sesiones, no unico parcial en progreso. ESPERADO: 2 filas.
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and indexname in ('sesiones_sesion_uid_uidx','progreso_sesion_uid_idx');
-- V6. Indices validos (un CONCURRENTLY fallido deja indisvalid=false). ESPERADO: 0 filas.
select c.relname, i.indisvalid, i.indisready from pg_index i join pg_class c on c.oid = i.indexrelid
 where c.relname in ('sesiones_sesion_uid_uidx','progreso_sesion_uid_idx') and (not i.indisvalid or not i.indisready);
-- V7. RLS y politicas identicas a las del preflight (comparar P7 con esta salida) y RLS sigue activa. ESPERADO: relrowsecurity = true en ambas.
select relname, relrowsecurity from pg_class where oid in ('public.progreso'::regclass, 'public.sesiones'::regclass);
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename in ('progreso','sesiones') order by 1, 2;

-- V8 (MANUAL, con un alumno de PRUEBA y su JWT; no es SQL de produccion): prueba REAL de RLS que ninguna simulacion reemplaza.
--   a) POST /rest/v1/progreso con {id, alumno_id propio, ..., sesion_uid, bloque:'main', pos:0} => 201 y fila con los 3 campos.
--   b) mismo POST con otro alumno_id => rechazado por RLS (401/403/42501), igual que antes de la migracion.
--   c) POST /rest/v1/sesiones con sesion_uid + identidad_v:1 => 201; repetir el POST => 409 23505 sesiones_sesion_uid_uidx (y 0 filas nuevas).
--   d) GET de las filas propias devuelve las columnas nuevas; GET de otro alumno => 0 filas.
--   e) POST con bloque:'x' => 400/23514; con pos sin bloque => 400/23514.
--   f) POST SIN columnas nuevas (cliente antiguo) => 201 igual que antes.
