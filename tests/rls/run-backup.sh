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
BC=sql/rls_p0_backup_create.sql; BV=sql/rls_p0_backup_verify.sql; BR=sql/rls_p0_backup_restore.sql
PUID=00000000-0000-0000-0000-0000000000c1
FAIL=0; ok() { echo "PASS  $1"; }; bad() { echo "FAIL  $1"; FAIL=1; }
sql() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -f $2" 2>&1; }
q()   { RUN "$P -d $1 -At -c \"$2\"" 2>&1; }
DB=bk
RUN "$P -d postgres -c 'CREATE DATABASE $DB'" >/dev/null && sql $DB tests/rls/00_baseline.sql >/dev/null && sql $DB tests/rls/01_seed.sql >/dev/null || exit 1
q $DB "UPDATE alumnos SET entrenador_id='entrenador_principal'; UPDATE rutinas SET entrenador_id='entrenador_principal'; UPDATE video_overrides SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'; UPDATE ejercicio_overrides SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'; UPDATE ejercicios_custom SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'" >/dev/null
sql $DB $M1 >/dev/null
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
n=$(q $DB "SELECT count(*) FROM backup_rls_p0.manifest"); [ "$n" = "14" ] && ok "manifiesto con las 14 tablas gestionadas" || bad "manifiesto=$n"
out=$(sql $DB $BC); echo "$out" | grep -q "ya existe: no se sobrescribe" && ok "no sobrescribe una copia existente" || bad "sobrescritura"
n=$(q $DB "SELECT count(*) FROM information_schema.columns WHERE table_schema='backup_rls_p0' AND column_name IN ('encrypted_password','raw_app_meta_data','confirmation_token')"); [ "$n" = "0" ] && ok "la copia de Auth no contiene contraseñas ni tokens" || bad "auth con secretos"
out=$(q $DB "SET ROLE anon; SELECT count(*) FROM backup_rls_p0.alumnos"); echo "$out" | grep -q "permission denied" && ok "anon no accede al esquema de respaldo" || bad "anon accede: $out"
out=$(q $DB "SET ROLE authenticated; SELECT count(*) FROM backup_rls_p0.alumnos"); echo "$out" | grep -q "permission denied" && ok "authenticated no accede al esquema de respaldo" || bad "authenticated accede: $out"

echo "### 2. Verificar (A) justo después de copiar"
sed -n '/^-- A)/,/^ *ORDER BY m.tbl;/p' $BV | grep -v '^--' > $WORK/blkA.sql; chmod a+r $WORK/blkA.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkA.sql" > $WORK/a.out 2>&1
lines=$(wc -l < $WORK/a.out); bad_rows=$(grep -vc '|t|t$' $WORK/a.out)
[ "$lines" = "14" ] && [ "$bad_rows" = "0" ] && ok "bloque A: 14 tablas, copia y origen idénticos (huella md5)" || { bad "bloque A ($lines filas, $bad_rows distintas)"; head -3 $WORK/a.out; }

echo "### 3. Backfill + migración 2 + datos nuevos y daños simulados"
RUN "$P -v ON_ERROR_STOP=1 -d $DB -v principal_uid=$PUID -v expected_alumnos=2 -f $BF" >/dev/null 2>&1 && sql $DB $M2 >/dev/null && ok "backfill y migración 2 aplicados" || bad "backfill/M2"
q $DB "INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES ('11111111-1111-1111-1111-111111111111','nuevo',1,1,77,'2026-02-01',2); UPDATE progreso SET kg=999 WHERE ejercicio_id='sq' AND kg=120; DELETE FROM progreso WHERE kg=100" >/dev/null
sed -n '/^WITH keys/,/^ *ORDER BY k.tbl;/p' $BV > $WORK/blkB.sql; chmod a+r $WORK/blkB.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkB.sql" > $WORK/b.out 2>&1
grep -q '^progreso|id|1|1|' $WORK/b.out && ok "bloque B: progreso faltantes=1, nuevas=1" || { bad "bloque B progreso"; grep '^progreso' $WORK/b.out; }
grep -q '^alumnos|id|0|0|2|' $WORK/b.out && ok "bloque B: alumnos 0 faltantes, 2 con cambio SOLO en entrenador_id" || { bad "bloque B alumnos"; grep '^alumnos' $WORK/b.out; }
n=$(awk -F'|' '$1!="progreso" && $3!="" && $3!="0"' $WORK/b.out | wc -l); [ "$n" = "0" ] && ok "bloque B: ninguna otra tabla con filas faltantes" || bad "otras tablas con faltantes: $n"

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
[ "$(q $DB "$SNAP")" = "$POL0" ] && ok "R2: las políticas vuelven EXACTAS al snapshot (md5 de 13 políticas originales)" || bad "R2 políticas distintas"
[ "$(q $DB "$GR")" = "$GR0" ] && ok "R2: los grants de PUBLIC/anon/authenticated vuelven exactos" || bad "R2 grants distintos"
[ "$(q $DB "SELECT string_agg(relname||relrowsecurity::text, ',' ORDER BY relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE nspname='public' AND relkind='r' AND relname NOT IN ('coach_principal','rls_p0_backfill_log')")" = "$RLS0" ] && ok "R2: banderas RLS idénticas (incl. ejercicio_overrides sin RLS)" || bad "R2 flags RLS"
echo "### 6. Verificar (C) objetos"
sed -n '/^-- C)/,$p' $BV | grep -v '^--' > $WORK/blkC.sql; chmod a+r $WORK/blkC.sql
RUN "$P -d $DB -At -F '|' -f $WORK/blkC.sql" | head -6
[ $FAIL = 0 ] && echo "RESULTADO: TODO OK" || { echo "RESULTADO: HAY FALLOS"; exit 1; }
