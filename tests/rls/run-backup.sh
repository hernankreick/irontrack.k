#!/usr/bin/env bash
# Prueba LOCAL (Postgres efimero, datos ficticios) de sql/rls_p0_backup_{create,verify,restore}.sql.   tests/rls/run-backup.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
WORK=${RLS_TMP:-$(mktemp -d)}; PORT=${RLS_PORT:-54331}
RUN() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK" && chmod 755 "$WORK" && chmod -R a+rX tests supabase sql
RUN "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null" || exit 1
RUN "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null" || exit 1
trap 'RUN "$PGBIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null" || true' EXIT
P="$PGBIN/psql -X -q -h $WORK -p $PORT -U postgres"
M1=supabase/migrations/20261010110000_rls_p0_coach_principal.sql; M2=supabase/migrations/20261010120000_rls_p0_lockdown.sql
RB=supabase/rollback/20261010120000_rls_p0_rollback.sql; BF=sql/rls_p0_backfill_entrenador_principal.sql
BC=sql/rls_p0_backup_create.sql; BV=${BV_OVERRIDE:-sql/rls_p0_backup_verify.sql}; BR=sql/rls_p0_backup_restore.sql
PUID=00000000-0000-0000-0000-0000000000c1
FAIL=0; ok() { echo "PASS  $1"; }; bad() { echo "FAIL  $1"; FAIL=1; }
sql() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -f $2" 2>&1; }
q()   { RUN "$P -d $1 -At -c \"$2\"" 2>&1; }
DB=bk
RUN "$P -d postgres -c 'CREATE DATABASE $DB'" >/dev/null && sql $DB tests/rls/00_baseline.sql >/dev/null && sql $DB tests/rls/01_seed.sql >/dev/null || exit 1
q $DB "UPDATE alumnos SET entrenador_id='entrenador_principal'; UPDATE rutinas SET entrenador_id='entrenador_principal'; UPDATE video_overrides SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'; UPDATE ejercicio_overrides SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'; UPDATE ejercicios_custom SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'" >/dev/null
sql $DB $M1 >/dev/null
# Condiciones tipo Supabase: default privileges globales para anon/authenticated (se heredan en CUALQUIER esquema nuevo)
q $DB "ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated; CREATE SCHEMA zz_prueba; CREATE TABLE zz_prueba.t(i int)" >/dev/null
[ "$(q $DB "SELECT has_table_privilege('anon','zz_prueba.t','SELECT')")" = "t" ] && ok "precondición: los default privileges SÍ se heredan en esquemas nuevos (riesgo real que el script debe cerrar)" || bad "precondición default privileges"
# tabla con ACL implícito (relacl NULL): sin default privileges para anon/authenticated
q $DB "ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM anon, authenticated; CREATE TABLE public.zz_implicito(i int); ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated" >/dev/null
[ "$(q $DB "SELECT relacl IS NULL FROM pg_class WHERE relname='zz_implicito'")" = "t" ] && ok "precondición: zz_implicito tiene ACL implícito (relacl NULL)" || bad "precondición ACL implícito"
# Privilegios HEREDADOS y por COLUMNA (casos que el ACL de tabla no refleja): anon hereda SELECT sobre alumnos de otro rol; authenticated solo tiene SELECT(contenido) en notas
q $DB "CREATE ROLE cuarto_rol NOLOGIN; GRANT SELECT ON public.alumnos TO cuarto_rol; CREATE ROLE inh_role NOLOGIN; GRANT SELECT ON public.alumnos TO inh_role; GRANT inh_role TO anon; REVOKE ALL ON public.notas FROM authenticated; GRANT SELECT (contenido) ON public.notas TO authenticated" >/dev/null
[ "$(q $DB "SELECT (SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname='inh_role')||'/'||has_column_privilege('authenticated','public.notas','contenido','SELECT')||'/'||has_table_privilege('authenticated','public.notas','SELECT')")" = "1/true/false" ] && ok "precondición: herencia (anon<-inh_role) y privilegio SOLO por columna (authenticated en notas)" || bad "precondición herencia/columna"
# tabla SIN clave única (no se debe asumir ninguna)
q $DB "ALTER TABLE mensajes DROP CONSTRAINT mensajes_pkey" >/dev/null
SNAP="SELECT md5(string_agg(format('%s|%s|%s|%s|%s|%s|%s',tablename,policyname,permissive,roles,cmd,qual,with_check), E'\n' ORDER BY tablename,policyname)) FROM pg_policies WHERE schemaname='public' AND tablename NOT IN ('coach_principal','rls_p0_backfill_log')"
GR="SELECT md5(string_agg(c.relname||a.grantee::text||a.privilege_type, ',' ORDER BY c.relname,a.grantee::text,a.privilege_type)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace, aclexplode(c.relacl) a WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN ('coach_principal','rls_p0_backfill_log') AND a.grantee IN (0,'anon'::regrole,'authenticated'::regrole)"
POL0=$(q $DB "$SNAP"); GR0=$(q $DB "$GR"); RLS0=$(q $DB "SELECT string_agg(relname||relrowsecurity::text, ',' ORDER BY relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE nspname='public' AND relkind='r' AND relname NOT IN ('coach_principal','rls_p0_backfill_log')")
AL0=$(q $DB "SELECT string_agg(id::text||entrenador_id, ',' ORDER BY id) FROM alumnos")


echo "### 0. Guarda de espacio (plan Free) y atomicidad"
RUN "$P -d postgres -c 'CREATE DATABASE bk2'" >/dev/null && sql bk2 tests/rls/00_baseline.sql >/dev/null && sql bk2 tests/rls/01_seed.sql >/dev/null
sed "s/v_limit bigint := 400::bigint \* 1024 \* 1024;/v_limit bigint := 1024;/" $BC > $WORK/bc_small.sql; chmod a+r $WORK/bc_small.sql
out=$(sql bk2 $WORK/bc_small.sql); echo "$out" | grep -q "Espacio insuficiente" && ok "aborta con aviso si la copia no cabe en el margen del plan Free" || bad "guarda de espacio: $out"
[ "$(q bk2 "SELECT to_regnamespace('backup_rls_p0') IS NULL")" = "t" ] && ok "al abortar no queda ningún esquema ni tabla a medias" || bad "quedaron restos"

echo "### 1. Crear la copia"
sql $DB $BC > $WORK/c.out && ok "create ejecuta sin errores" || { bad "create"; head -3 $WORK/c.out; }
n=$(q $DB "SELECT count(*) FROM backup_rls_p0.manifest"); [ "$n" = "14" ] && ok "manifiesto con las 14 tablas reales" || bad "manifiesto=$n"
[ "$(q $DB "SELECT count(*) FROM backup_rls_p0.manifest WHERE tbl='ejercicios_custom_backup_pre_fase1' AND row_count=2")" = "1" ] && ok "incluye ejercicios_custom_backup_pre_fase1 con sus filas" || bad "falta la tabla backup"
[ "$(q $DB "SELECT count(*) FROM backup_rls_p0.manifest WHERE tbl='coach_notification_reads'")" = "0" ] && ok "no asume coach_notification_reads (no existe)" || bad "coach_notification_reads"
n=$(q $DB "SELECT count(*) FROM backup_rls_p0.grants WHERE tbl='zz_implicito' AND acl_implicito"); [ "$n" -ge 1 ] && ok "grants: captura el ACL implícito/predeterminado (acldefault) de tablas con relacl NULL ($n filas)" || bad "ACL implícito no capturado"
n=$(q $DB "SELECT count(*) FROM backup_rls_p0.effective_privs WHERE tbl='alumnos' AND role='anon'"); [ "$n" = "7" ] && ok "effective_privs: 7 privilegios x rol por tabla" || bad "effective_privs=$n"
out=$(sql $DB $BC); echo "$out" | grep -q "ya existe: no se sobrescribe" && ok "no sobrescribe una copia existente" || bad "sobrescritura"
n=$(q $DB "SELECT count(*) FROM information_schema.columns WHERE table_schema='backup_rls_p0' AND column_name IN ('encrypted_password','raw_app_meta_data','confirmation_token')"); [ "$n" = "0" ] && ok "la copia de Auth no contiene contraseñas ni tokens" || bad "auth con secretos"
out=$(q $DB "SET ROLE anon; SELECT count(*) FROM backup_rls_p0.alumnos"); echo "$out" | grep -q "permission denied" && ok "anon no accede al esquema de respaldo (pese a default privileges globales)" || bad "anon accede: $out"
sed -n '/^-- E)/,$p' $BV | grep -v '^--' > $WORK/blkE.sql; chmod a+r $WORK/blkE.sql
e=$(RUN "$P -d $DB -At -F '|' -f $WORK/blkE.sql" 2>&1 | tr '\n' ' '); [ "$e" = "anon|f|0 authenticated|f|0 " ] && ok "bloque E: ni USAGE ni privilegios efectivos de anon/authenticated sobre backup_rls_p0" || bad "bloque E: $e"
n=$(q $DB "SELECT count(*) FROM pg_class c CROSS JOIN pg_roles r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(x) WHERE c.relnamespace='backup_rls_p0'::regnamespace AND c.relkind='r' AND r.rolname IN ('anon','authenticated') AND has_table_privilege(r.rolname,c.oid,p.x)"); [ "$n" = "0" ] && ok "0 privilegios efectivos de tablas (todas las tablas del esquema x anon/authenticated x 7 privilegios)" || bad "privilegios sobre backup: $n"
out=$(q $DB "SET ROLE authenticated; SELECT count(*) FROM backup_rls_p0.alumnos"); echo "$out" | grep -q "permission denied" && ok "authenticated no accede al esquema de respaldo" || bad "authenticated accede: $out"

echo "### 2. Verificar (A) justo después de copiar"
sed -n '/^-- A)/,/^ *ORDER BY m.tbl;/p' $BV | grep -v '^--' > $WORK/blkA.sql; chmod a+r $WORK/blkA.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkA.sql" > $WORK/a.out 2>&1
lines=$(wc -l < $WORK/a.out); bad_rows=$(grep -vc '|t|t$' $WORK/a.out)
[ "$lines" = "14" ] && [ "$bad_rows" = "0" ] && ok "bloque A: 14 tablas, copia y origen idénticos (huella md5)" || { bad "bloque A ($lines filas, $bad_rows distintas)"; head -3 $WORK/a.out; }

echo "### 2b. D no da falsos positivos por otros roles y sí detecta cambios reales del ACL directo"
sed -n '/^-- D)/,/^-- E)/p' $BV | grep -v '^--' > $WORK/blkD.sql; chmod a+r $WORK/blkD.sql
dacl() { RUN "$P -d $DB -At -F '|' -f $WORK/blkD.sql" 2>&1 | awk -F'|' '$1=="acl directo tablas"{print $2}'; }
[ "$(dacl)" = "0" ] && ok "D: ACL directo = 0 recién copiado" || bad "D inicial: $(dacl)"
q $DB "GRANT UPDATE, DELETE ON public.alumnos TO cuarto_rol; GRANT SELECT ON public.config TO cuarto_rol; REVOKE SELECT ON public.alumnos FROM cuarto_rol" >/dev/null
[ "$(dacl)" = "0" ] && ok "D: GRANT/REVOKE de un CUARTO ROL (alumnos y config) NO produce falso positivo (ACL directo = 0)" || bad "falso positivo por cuarto rol: $(dacl)"
q $DB "REVOKE SELECT ON public.alumnos FROM anon" >/dev/null
[ "$(dacl)" -ge 1 ] 2>/dev/null && ok "D: REVOKE real de anon sobre alumnos SÍ se detecta (ACL directo > 0)" || bad "no detecta REVOKE real de anon"
q $DB "GRANT SELECT ON public.alumnos TO anon" >/dev/null
[ "$(dacl)" = "0" ] && ok "D: restablecido el GRANT de anon, vuelve a 0 (los grants del cuarto rol siguen sin influir)" || bad "no vuelve a 0: $(dacl)"
q $DB "REVOKE INSERT ON public.config FROM authenticated" >/dev/null
[ "$(dacl)" -ge 1 ] 2>/dev/null && ok "D: un REVOKE real a authenticated sobre config se detecta (falta en el lado actual)" || bad "no detecta REVOKE de authenticated"
q $DB "GRANT INSERT ON public.config TO authenticated" >/dev/null
[ "$(dacl)" = "0" ] && ok "D: vuelve a 0 tras restablecerlo" || bad "no vuelve a 0 (2): $(dacl)"
q $DB "GRANT TRUNCATE ON public.config TO PUBLIC" >/dev/null
[ "$(dacl)" -ge 1 ] 2>/dev/null && ok "D: un GRANT nuevo a PUBLIC (extra en el lado actual) se detecta" || bad "no detecta GRANT a PUBLIC"
q $DB "REVOKE TRUNCATE ON public.config FROM PUBLIC" >/dev/null
[ "$(dacl)" = "0" ] && ok "D: vuelve a 0 tras revertir el GRANT a PUBLIC" || bad "no vuelve a 0 (3): $(dacl)"
q $DB "REVOKE ALL ON public.alumnos FROM cuarto_rol; REVOKE ALL ON public.config FROM cuarto_rol" >/dev/null

echo "### 3. Backfill + migración 2 + datos nuevos y daños simulados"
RUN "$P -v ON_ERROR_STOP=1 -d $DB -v principal_uid=$PUID -v expected_alumnos=2 -f $BF" >/dev/null 2>&1 && sql $DB $M2 >/dev/null && ok "backfill y migración 2 aplicados" || bad "backfill/M2"
sed -n '/^-- D)/,/^-- E)/p' $BV | grep -v '^--' > $WORK/blkD.sql; chmod a+r $WORK/blkD.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkD.sql" > $WORK/d1.out 2>&1
[ "$(wc -l < $WORK/d1.out)" = "5" ] && ok "bloque D devuelve 5 verificaciones (efectivos x3, ACL directo tablas, ACL columnas)" || { bad "bloque D formato"; cat $WORK/d1.out; }
awk -F'|' '$1=="acl directo tablas" && $2>0 {f=1} END{exit !f}' $WORK/d1.out && ok "tras la migración 2: D detecta que el ACL directo de tablas CAMBIÓ (esperado)" || bad "D no detecta ACL directo tras M2"
awk -F'|' '$1=="efectivos anon" && $2>0 {f=1} END{exit !f}' $WORK/d1.out && ok "tras la migración 2: D detecta cambio de privilegios efectivos de anon" || bad "D no detecta efectivos tras M2"
awk -F'|' '$1=="acl columnas" && $2>0 {f=1} END{exit !f}' $WORK/d1.out && ok "tras la migración 2: D detecta que el privilegio por columna de authenticated cambió (REVOKE de tabla lo elimina)" || { bad "D no detecta columnas tras M2"; cat $WORK/d1.out; }
[ "$(q $DB "SELECT has_table_privilege('anon','public.alumnos','SELECT')")" = "t" ] && ok "la herencia mantiene SELECT efectivo de anon sobre alumnos aunque M2 revocó su ACL directo (por eso D compara también el ACL directo)" || bad "herencia no enmascara"
q $DB "INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES ('11111111-1111-1111-1111-111111111111','nuevo',1,1,77,'2026-02-01',2); UPDATE progreso SET kg=999 WHERE ejercicio_id='sq' AND kg=120; DELETE FROM progreso WHERE kg=100" >/dev/null
sed -n '/^WITH keys/,/^ *ORDER BY k.tbl;/p' $BV > $WORK/blkB.sql; chmod a+r $WORK/blkB.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkB.sql" > $WORK/b.out 2>&1
grep -q '^progreso|id|1|1|' $WORK/b.out && ok "bloque B: progreso faltantes=1, nuevas=1" || { bad "bloque B progreso"; grep '^progreso' $WORK/b.out; }
grep -q '^alumnos|id|0|0|2|' $WORK/b.out && ok "bloque B: alumnos 0 faltantes, 2 con cambio SOLO en entrenador_id" || { bad "bloque B alumnos"; grep '^alumnos' $WORK/b.out; }
grep -q '^mensajes|(sin clave unica)|0|0||' $WORK/b.out && ok "bloque B: mensajes sin clave única -> no se asume clave, compara por huella (0 faltantes)" || { bad "bloque B mensajes"; grep '^mensajes' $WORK/b.out; }
grep -q '^video_overrides|id|0|0|' $WORK/b.out && ok "bloque B: clave detectada desde el catálogo (video_overrides.id)" || bad "clave video_overrides"
n=$(awk -F'|' '$1!="progreso" && $1!="politicas" && $1!="triggers" && $1!="funciones" && $1!="constraints" && $1!="auth.users" && $3!="" && $3!="0"' $WORK/b.out | wc -l); [ "$n" = "0" ] && ok "bloque B: ninguna otra tabla con filas faltantes" || bad "otras tablas con faltantes: $n"
q $DB "DELETE FROM mensajes WHERE id=(SELECT min(id) FROM mensajes)" >/dev/null
RUN "$P -d $DB -At -F '|' -f $WORK/blkB.sql" 2>&1 | grep -q '^mensajes|(sin clave unica)|1|0||' && ok "sin clave: una fila borrada se detecta por huella (faltantes=1)" || bad "mensajes sin clave no detecta"
sed -n '/^-- ───────── R4/,/^-- ───────── R5/p' $BR | sed "s/tablas text\[\] := ARRAY\[\]::text\[\];/tablas text[] := ARRAY['mensajes'];/" > $WORK/r4m.sql; chmod a+r $WORK/r4m.sql
out=$(sql $DB $WORK/r4m.sql); echo "$out" | grep -q "no tiene clave unica" && ok "R4 se niega a restaurar una tabla sin clave única (evita duplicar filas)" || bad "R4 mensajes: $out"

echo "### 4. R4: recuperar filas faltantes sin pisar datos nuevos"
sed -n '/^-- ───────── R4/,/^-- ───────── R5/p' $BR | sed "s/tablas text\[\] := ARRAY\[\]::text\[\];/tablas text[] := ARRAY['progreso'];/" > $WORK/r4.sql; chmod a+r $WORK/r4.sql
sql $DB $WORK/r4.sql >/dev/null; r=$(q $DB "SELECT (SELECT count(*) FROM progreso WHERE kg=100)||'/'||(SELECT count(*) FROM progreso WHERE kg=999)||'/'||(SELECT count(*) FROM progreso WHERE kg=77)||'/'||(SELECT count(*) FROM progreso)")
[ "$r" = "1/1/1/3" ] && ok "R4 recupera la fila borrada (kg=100) y NO pisa la modificada (999) ni la nueva (77): $r" || bad "R4 resultado $r"
out=$(sql $DB $BR 2>&1); echo "$out" | grep -qi "migración RLS sigue aplicada" && ok "R1 se niega a correr con la migración 2 aplicada" || bad "R1 sin guarda"

echo "### 5. Rollback de M2 + R1 (deshacer backfill) + R2 (políticas/grants exactos)"
sql $DB $RB >/dev/null && ok "rollback genérico de M2" || bad "rollback"
sql $DB $BR >/dev/null && ok "R1/R2 ejecutan (R1 tras revertir la migración)" || bad "restore"
AL1=$(q $DB "SELECT string_agg(id::text||entrenador_id, ',' ORDER BY id) FROM alumnos")
[ "$AL1" = "$AL0" ] && ok "R1: entrenador_id de alumnos vuelve a su valor original" || bad "R1 alumnos distintos"
q $DB "SELECT 1" >/dev/null
[ "$(q $DB "$SNAP")" = "$POL0" ] && ok "R2: las políticas vuelven EXACTAS al snapshot (md5 de las políticas originales)" || bad "R2 políticas distintas"
[ "$(q $DB "$GR")" = "$GR0" ] && ok "R2: los grants de PUBLIC/anon/authenticated vuelven exactos" || bad "R2 grants distintos"
[ "$(q $DB "SELECT string_agg(relname||relrowsecurity::text, ',' ORDER BY relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE nspname='public' AND relkind='r' AND relname NOT IN ('coach_principal','rls_p0_backfill_log')")" = "$RLS0" ] && ok "R2: banderas RLS idénticas (incl. ejercicio_overrides sin RLS)" || bad "R2 flags RLS"
RUN "$P -d $DB -At -F '|' -f $WORK/blkD.sql" > $WORK/d2.out 2>&1
[ "$(wc -l < $WORK/d2.out)" = "5" ] && [ "$(awk -F'|' '$2!="0"' $WORK/d2.out | wc -l)" = "0" ] && ok "bloque D tras R2: las 5 verificaciones en 0 (efectivos anon/authenticated/service_role, ACL directo, ACL columnas)" || { bad "bloque D tras R2"; cat $WORK/d2.out; }
[ "$(q $DB "SELECT has_column_privilege('authenticated','public.notas','contenido','SELECT')||'/'||has_table_privilege('authenticated','public.notas','SELECT')")" = "true/false" ] && ok "R2 restauró el privilegio SOLO por columna (sin privilegio de tabla)" || bad "columna no restaurada"
[ "$(q $DB "SELECT has_table_privilege('anon','public.alumnos','SELECT')")" = "t" ] && ok "tras R2 la herencia de anon sobre alumnos sigue intacta (R2 no toca otros roles)" || bad "herencia alterada"
echo "### 6. Verificar (C) objetos"
sed -n '/^-- C)/,$p' $BV | grep -v '^--' > $WORK/blkC.sql; chmod a+r $WORK/blkC.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkC.sql" | head -6
[ $FAIL = 0 ] && echo "RESULTADO: TODO OK" || { echo "RESULTADO: HAY FALLOS"; exit 1; }
