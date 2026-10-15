#!/usr/bin/env bash
# Ejecuta la batería RLS contra un PostgreSQL LOCAL efímero (nunca producción). Datos 100% ficticios.
# Uso: tests/rls/run.sh   (requiere binarios de postgres 14+ y, si es root, el usuario 'postgres')
set -uo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
WORK=${RLS_TMP:-$(mktemp -d)}; PORT=${RLS_PORT:-54329}
RUN() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK" && chmod 755 "$WORK" && chmod -R a+rX tests supabase sql
RUN "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null" || exit 1
RUN "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null" || exit 1
trap 'RUN "$PGBIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null" || true' EXIT
P="$PGBIN/psql -X -q -h $WORK -p $PORT -U postgres"
M1=supabase/migrations/20261010110000_rls_p0_coach_principal.sql
M2=${M2_OVERRIDE:-supabase/migrations/20261010120000_rls_p0_lockdown.sql}
RB=supabase/rollback/20261010120000_rls_p0_rollback.sql
BF=sql/rls_p0_backfill_entrenador_principal.sql
PUID=00000000-0000-0000-0000-0000000000c1
FAIL=0
ok()  { echo "PASS  $1"; }
bad() { echo "FAIL  $1"; FAIL=1; }
mkdb() { RUN "$P -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE $1'" && RUN "$P -v ON_ERROR_STOP=1 -d $1 -f tests/rls/00_baseline.sql" && RUN "$P -v ON_ERROR_STOP=1 -d $1 -f tests/rls/01_seed.sql" >/dev/null; }
sql() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -f $2" 2>&1; }
expect_fail() { # db file pattern desc
  local out; out=$(sql "$1" "$2"); echo "$out" | grep -q "$3" && ok "$4" || { bad "$4"; echo "$out" | head -3; }; }

echo "### 1. ANTES (vulnerabilidad): anon lee y borra"
mkdb pre
RUN "$P -d pre -At -c \"SET ROLE anon; SELECT 'anon lee alumnos: '||count(*) FROM alumnos; DELETE FROM progreso; SELECT 'anon borro progreso'\"" 2>&1 | tail -2

echo "### 2. Pre-vuelos de la migración 2"
mkdb legacy; sql legacy $M1 >/dev/null
expect_fail legacy $M2 "falta public.coach_principal\|coach_principal vacio" "aborta sin coach_principal cargada"
RUN "$P -d legacy -c \"INSERT INTO coach_principal(uid) VALUES ('$PUID')\"" ; RUN "$P -d legacy -c \"UPDATE alumnos SET entrenador_id='entrenador_principal' WHERE nombre='A'\""
expect_fail legacy $M2 "RLS P0 abortada" "aborta con alumnos entrenador_principal"
mkdb nodb; expect_fail nodb $M2 "falta public.coach_principal" "aborta si falta la migración 1"

echo "### 3. Backfill: precondiciones"
mkdb bf; sql bf $M1 >/dev/null; RUN "$P -d bf -c \"UPDATE alumnos SET entrenador_id='entrenador_principal'\""
RUNBF() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -v principal_uid=$2 -v expected_alumnos=$3 -f $BF" 2>&1; }
out=$(RUNBF bf 00000000-0000-0000-0000-0000000000ff 2); echo "$out" | grep -q "precondiciones no cumplidas" && ok "backfill rechaza UID inexistente" || bad "backfill UID inexistente"
out=$(RUNBF bf $PUID 9); echo "$out" | grep -q "precondiciones no cumplidas" && ok "backfill rechaza cantidad distinta (9 != 2)" || bad "backfill cantidad"
RUN "$P -d bf -c \"UPDATE alumnos SET auth_uid='$PUID' WHERE nombre='A'\"" ; out=$(RUNBF bf $PUID 2); echo "$out" | grep -q "precondiciones no cumplidas" && ok "backfill rechaza principal vinculado como alumno" || bad "backfill principal-alumno"
RUN "$P -d bf -c \"UPDATE alumnos SET auth_uid='00000000-0000-0000-0000-0000000000a1' WHERE nombre='A'\""
RUN "$P -d bf -c \"INSERT INTO coach_principal(uid) VALUES ('00000000-0000-0000-0000-0000000000c2')\""; out=$(RUNBF bf $PUID 2); echo "$out" | grep -q "precondiciones no cumplidas" && ok "backfill rechaza otro principal ya cargado" || bad "backfill otro principal"
RUN "$P -d bf -c \"DELETE FROM coach_principal\""
RUNBF bf $PUID 2 >/dev/null && ok "backfill con datos válidos" || bad "backfill válido"
RUN "$P -d bf -At -c \"SELECT 'principal='||(SELECT uid FROM coach_principal)||' legacy_restantes='||(SELECT count(*) FROM alumnos WHERE entrenador_id='entrenador_principal')\""
sql bf $M2 >/dev/null && ok "migración 2 tras backfill" || bad "migración 2 tras backfill"

echo "### 3b. Backfill reversible (solo filas que eran legacy) y respaldo de políticas"
RV=sql/rls_p0_backfill_revert.sql; SE=sql/rls_p0_backfill_sql_editor.sql; SNAP=sql/rls_p0_snapshot_policies.sql
mkdb rv; sql rv $M1 >/dev/null
RUN "$P -d rv -c \"UPDATE alumnos SET entrenador_id='entrenador_principal'; UPDATE rutinas SET entrenador_id='entrenador_principal' WHERE nombre='RutB'; UPDATE video_overrides SET entrenador_id='entrenador_principal' WHERE entrenador_id LIKE '%c1'\""
RUNBF rv $PUID 2 >/dev/null && ok "backfill registra filas legacy" || bad "backfill rv"
n=$(RUN "$P -d rv -At -c \"SELECT count(*) FROM rls_p0_backfill_log\""); [ "$n" = "4" ] && ok "log = 2 alumnos + 1 rutina + 1 video_override ($n)" || bad "log=$n (esperado 4)"
out=$(RUN "$P -d rv -At -c \"SET ROLE anon; SELECT count(*) FROM rls_p0_backfill_log\"" 2>&1); echo "$out" | grep -q "permission denied" && ok "rls_p0_backfill_log no es accesible por anon" || bad "log expuesto"
out=$(RUN "$P -d rv -At -c \"SET ROLE authenticated; SELECT count(*) FROM rls_p0_backfill_log\"" 2>&1); echo "$out" | grep -q "permission denied" && ok "rls_p0_backfill_log no es accesible por authenticated" || bad "log expuesto (auth)"
sql rv $M2 >/dev/null
out=$(sql rv $RV); echo "$out" | grep -q "migracion RLS esta aplicada" && ok "revert aborta con la migración RLS aplicada" || bad "revert sin abortar"
sql rv $RB >/dev/null
sql rv $RV >/dev/null && ok "revert ejecuta" || bad "revert"
r=$(RUN "$P -d rv -At -c \"SELECT (SELECT count(*) FROM alumnos WHERE entrenador_id='entrenador_principal')||'/'||(SELECT count(*) FROM rutinas WHERE entrenador_id='entrenador_principal')||'/'||(SELECT count(*) FROM rutinas WHERE nombre='RutA' AND entrenador_id='$PUID')||'/'||(SELECT count(*) FROM coach_principal)||'/'||(SELECT count(*) FROM rls_p0_backfill_log)\"")
[ "$r" = "2/1/1/0/0" ] && ok "revert restaura solo lo legacy (rutina que ya tenía UUID no se toca): $r" || bad "estado tras revert: $r (esperado 2/1/1/0/0)"
# variante SQL Editor
mkdb se; sql se $M1 >/dev/null; RUN "$P -d se -c \"UPDATE alumnos SET entrenador_id='entrenador_principal'\""
sed "s/e2447231-c0ba-4f90-946f-63bf364570af/$PUID/; s/expected_legacy int := 9/expected_legacy int := 2/" $SE > "$WORK/se.sql"; chmod a+r "$WORK/se.sql"
sql se "$WORK/se.sql" >/dev/null && ok "backfill variante SQL Editor" || bad "backfill SQL Editor"
sed "s/expected_legacy int := 9/expected_legacy int := 7/; s/e2447231-c0ba-4f90-946f-63bf364570af/$PUID/" $SE > "$WORK/se2.sql"; chmod a+r "$WORK/se2.sql"
mkdb se2; sql se2 $M1 >/dev/null; RUN "$P -d se2 -c \"UPDATE alumnos SET entrenador_id='entrenador_principal'\""
out=$(sql se2 "$WORK/se2.sql"); echo "$out" | grep -q "alumnos legacy = 2 (esperado 7)" && ok "SQL Editor: cantidad distinta aborta sin cambios" || bad "SQL Editor cantidad"
n=$(RUN "$P -d se2 -At -c \"SELECT count(*) FROM alumnos WHERE entrenador_id='entrenador_principal'\""); [ "$n" = "2" ] && ok "SQL Editor: nada modificado tras abortar" || bad "SQL Editor modificó"
# respaldo de políticas reproducible
mkdb sn; RUN "$P -d sn -At -f $SNAP" > "$WORK/snap.txt" 2>&1; grep -c "^CREATE POLICY" "$WORK/snap.txt" | xargs -I{} echo "INFO políticas respaldadas: {}"
before=$(RUN "$P -d sn -At -c \"SELECT count(*) FROM pg_policies WHERE schemaname='public'\"")
RUN "$P -d sn -c \"DO \\\$\\\$ DECLARE p record; BEGIN FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' LOOP EXECUTE format('DROP POLICY %I ON %I', p.policyname, p.tablename); END LOOP; END \\\$\\\$\"" >/dev/null 2>&1
grep "^CREATE POLICY" "$WORK/snap.txt" > "$WORK/snap_restore.sql"; chmod a+r "$WORK/snap_restore.sql"
sql sn "$WORK/snap_restore.sql" >/dev/null 2>&1
after=$(RUN "$P -d sn -At -c \"SELECT count(*) FROM pg_policies WHERE schemaname='public'\"")
[ "$before" = "$after" ] && [ "$before" -gt 0 ] && ok "el respaldo de políticas regenera las $before políticas" || bad "respaldo de políticas ($before vs $after)"

echo "### 4. Migración + pruebas generales (02)"
mkdb main; sql main $M1 >/dev/null; sql main tests/rls/01b_principal.sql >/dev/null; sql main $M2 >/dev/null || bad "migración 2"
sql main $M2 >/dev/null && ok "idempotente (2ª ejecución)" || bad "idempotencia"
sql main $M1 >/dev/null && ok "migración 1 idempotente" || bad "migración 1 idempotencia"
RUN "$P -v ON_ERROR_STOP=1 -d main -f tests/rls/02_tests.sql" 2>&1 | grep -v NOTICE | tee "$WORK/out02.txt"

echo "### 5. Escalada, config, rutinas.datos y acceso cruzado (03)"
mkdb esc; sql esc $M1 >/dev/null; sql esc tests/rls/01b_principal.sql >/dev/null; sql esc $M2 >/dev/null
RUN "$P -v ON_ERROR_STOP=1 -d esc -f tests/rls/03_escalation.sql" 2>&1 | grep -v NOTICE | tee "$WORK/out03.txt"

echo "### 6. Rollback restaura estado previo"
sql main $RB >/dev/null && RUN "$P -d main -At -c \"SET ROLE anon; SELECT 'tras rollback anon lee alumnos: '||count(*) FROM alumnos\"" || bad "rollback"

for f in out02 out03; do
  n=$(grep -E '^ *[0-9]+ *\| *[0-9]+ *\| *[0-9]+ *$' "$WORK/$f.txt" | awk -F'|' '{gsub(/ /,"",$2); print $2}')
  [ "$n" = "0" ] || { echo "FALLOS en $f: ${n:-sin resumen}"; FAIL=1; }
done
[ $FAIL = 0 ] && echo "RESULTADO: TODO OK" || { echo "RESULTADO: HAY FALLOS"; exit 1; }
