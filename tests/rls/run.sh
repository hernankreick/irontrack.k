#!/usr/bin/env bash
# Ejecuta la batería RLS contra un PostgreSQL LOCAL efímero (nunca producción).
# Uso: tests/rls/run.sh   (requiere binarios de postgres 14+ y, si es root, el usuario 'postgres')
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
WORK=${RLS_TMP:-$(mktemp -d)}; PORT=${RLS_PORT:-54329}
RUN() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK" && chmod 755 "$WORK" && chmod -R a+rX tests supabase sql
RUN "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null"
RUN "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null"
trap 'RUN "$PGBIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null" || true' EXIT
P="$PGBIN/psql -X -q -h $WORK -p $PORT -U postgres -v ON_ERROR_STOP=1"
MIG=supabase/migrations/20261010120000_rls_p0_lockdown.sql
RB=supabase/rollback/20261010120000_rls_p0_rollback.sql
mkdb() { RUN "$P -d postgres -c 'CREATE DATABASE $1' && $P -d $1 -f tests/rls/00_baseline.sql" ; }
echo "### 1. ANTES de la migración (demuestra la vulnerabilidad)"
mkdb pre; RUN "$P -d pre -f tests/rls/01_seed.sql"
RUN "$P -d pre -At -c \"SET ROLE anon; SELECT 'anon lee alumnos: '||count(*) FROM alumnos; DELETE FROM progreso; SELECT 'anon borro progreso OK'\"" || true
echo "### 2. Preflight: debe ABORTAR con 'entrenador_principal'"
mkdb legacy; RUN "$P -d legacy -f tests/rls/01_seed.sql"
RUN "$P -d legacy -c \"UPDATE alumnos SET entrenador_id='entrenador_principal' WHERE nombre='A'\""
OUT=$(RUN "$P -d legacy -f $MIG" 2>&1 || true); echo "$OUT" | head -3
if echo "$OUT" | grep -q "RLS P0 abortada"; then echo "PASS preflight aborta"; else echo "FAIL preflight no abortó"; exit 1; fi
echo "### 3. Backfill + migración sobre datos legacy"
RUN "$P -d legacy -v principal_uid=00000000-0000-0000-0000-0000000000c1 -f sql/rls_p0_backfill_entrenador_principal.sql"
RUN "$P -d legacy -f $MIG" && echo "PASS migración tras backfill"
echo "### 4. Backfill con UID inexistente debe fallar"
mkdb legacy2; RUN "$P -d legacy2 -f tests/rls/01_seed.sql"
OUT=$(RUN "$P -d legacy2 -v principal_uid=00000000-0000-0000-0000-0000000000ff -f sql/rls_p0_backfill_entrenador_principal.sql" 2>&1 || true)
if echo "$OUT" | grep -q "no existe en entrenadores"; then echo "PASS backfill valida UID"; else echo "FAIL"; exit 1; fi
echo "### 5. Migración + batería de pruebas"
mkdb main; RUN "$P -d main -f tests/rls/01_seed.sql"
RUN "$P -d main -f $MIG"
echo "### 6. Idempotencia (segunda ejecución)"
RUN "$P -d main -f $MIG" && echo "PASS idempotente"
RUN "$P -d main -f tests/rls/02_tests.sql" | tee "$WORK/out.txt"
echo "### 7. Rollback restaura estado previo"
RUN "$P -d main -f $RB" && RUN "$P -d main -At -c \"SET ROLE anon; SELECT 'tras rollback anon lee alumnos: '||count(*) FROM alumnos\""
grep -qE '^ *0 *\| *0|\| +0 +\|' "$WORK/out.txt" || true
FAILS=$(grep -E '^ *[0-9]+ *\| *[0-9]+ *\| *[0-9]+ *$' "$WORK/out.txt" | awk -F'|' '{gsub(/ /,"",$2); print $2}')
[ "$FAILS" = "0" ] && echo "RESULTADO: TODAS LAS PRUEBAS PASARON" || { echo "RESULTADO: HAY FALLOS ($FAILS)"; exit 1; }
