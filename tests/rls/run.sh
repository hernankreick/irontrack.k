#!/usr/bin/env bash
# Ejecuta la batería RLS contra un PostgreSQL LOCAL efímero (solo socket unix, sin TCP; nunca Supabase ni producción). Datos 100% ficticios.
# Uso: tests/rls/run.sh      (requiere binarios de postgres 14+; si es root usa el usuario 'postgres')
set -uo pipefail
cd "$(dirname "$0")/../.."
unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGPASSFILE PGDATABASE PGUSER PGPORT PGOPTIONS PGSSLMODE
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
WORK=${RLS_TMP:-$(mktemp -d /tmp/rls-data.XXXXXX)}; PORT=${RLS_PORT:-54329}
case "$WORK" in /*) ;; *) echo "RLS_TMP debe ser una ruta absoluta"; exit 1;; esac
SOCK=$(mktemp -d /tmp/rls.XXXXXX)   # el socket unix necesita una ruta corta (<107 bytes); los datos van en $WORK
RUN() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- bash -c "$*"; else bash -c "$*"; fi; }
if [ "$(id -u)" = 0 ]; then chown postgres "$WORK" "$SOCK" && chmod 755 "$WORK" && chmod -R a+rX tests supabase; fi
RUN "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null" || exit 1
RUN "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $SOCK -c listen_addresses=' -l $WORK/log -w start >/dev/null" || exit 1
trap 'RUN "$PGBIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null" || true; rm -rf "$SOCK" "$WORK"' EXIT
P="$PGBIN/psql -X -q -h $SOCK -p $PORT -U postgres"      # -h = socket unix local
M1=${M1_OVERRIDE:-supabase/migrations/20261025100000_rls_p0_identity.sql}
M2=supabase/migrations/20261025110000_rls_p0_lockdown.sql
RB=supabase/rollback/20261025110000_rls_p0_rollback.sql
SNAP=supabase/rollback/20261025110000_rls_p0_snapshot_readonly.sql
FAIL=0; NPASS=0
ok()  { echo "PASS  $1"; NPASS=$((NPASS+1)); }
bad() { echo "FAIL  $1"; FAIL=1; }
q()   { RUN "$P -At -d $1 -c \"$2\"" 2>&1; }                      # db sql
sql() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -f $2" 2>&1; }            # db file
mkdb() { RUN "$P -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE $1'" && RUN "$P -v ON_ERROR_STOP=1 -d $1 -f tests/rls/00_baseline.sql" && RUN "$P -v ON_ERROR_STOP=1 -d $1 -f tests/rls/01_seed.sql" >/dev/null; }
coaches() { q "$1" "INSERT INTO coach_accounts(uid) VALUES ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000c2')" >/dev/null; }
expect_fail() { local out; out=$(sql "$1" "$2"); echo "$out" | grep -q "$3" && ok "$4" || { bad "$4"; echo "$out" | head -3; }; }
expect_ok()   { local out; out=$(sql "$1" "$2"); [ $? -eq 0 ] && ! echo "$out" | grep -q "ERROR" && ok "$3" || { bad "$3"; echo "$out" | head -3; }; }

echo "### 1. ANTES (vulnerabilidad reconstruida): anon lee y borra"
mkdb pre
out=$(RUN "$P -d pre -At -c \"SET ROLE anon; SELECT 'anon lee alumnos: '||count(*) FROM alumnos; DELETE FROM progreso; SELECT 'anon borro progreso'\"" 2>&1 | tr '\n' ' ')
echo "$out" | grep -q "anon lee alumnos: 3" && ok "estado inicial vulnerable reproducido ($out)" || bad "no se reprodujo la vulnerabilidad: $out"

echo "### 2. Pre-vuelos de la migración B (deben ABORTAR)"
mkdb nodb; expect_fail nodb $M2 "falta la migración de identidades" "aborta sin migración de identidades"
mkdb empty; sql empty $M1 >/dev/null
expect_fail empty $M2 "coach_accounts. está vacía\|coach_accounts.* vac" "aborta con coach_accounts vacía"
mkdb unl; sql unl $M1 >/dev/null; coaches unl
q unl "UPDATE auth.users SET raw_app_meta_data='{}' WHERE email='a@test.local'" >/dev/null
expect_fail unl $M2 "sin vincular" "aborta si un alumno con cuenta de Auth no está vinculado"
out=$(RUN "$P -v ON_ERROR_STOP=1 -d unl -c \"SET it.rls_p0_force='on'\" -f $M2" 2>&1); echo "$out" | grep -q "NO podrán ingresar" && ok "con it.rls_p0_force continúa avisando (WARNING)" || { bad "force no avisa"; echo "$out"|head -3; }
mkdb cas; sql cas $M1 >/dev/null; coaches cas
q cas "UPDATE auth.users SET raw_app_meta_data=jsonb_build_object('alumno_id','11111111-1111-1111-1111-111111111111') WHERE email='coach@test.local'" >/dev/null
expect_fail cas $M2 "figuran vinculadas como alumno" "aborta si un entrenador figura vinculado como alumno"
mkdb forg; sql forg $M1 >/dev/null; coaches forg
q forg "UPDATE alumnos SET entrenador_id='00000000-0000-0000-0000-0000000000d1' WHERE nombre='A'" >/dev/null
expect_fail forg $M2 "entrenador_id que no es un entrenador" "aborta si entrenador_id apunta a una cuenta que no es entrenador"
mkdb noacc; sql noacc $M1 >/dev/null; coaches noacc
q noacc "DELETE FROM auth.users WHERE email IN ('a@test.local','b@test.local')" >/dev/null
q noacc "UPDATE alumnos SET auth_uid=NULL" >/dev/null
expect_ok noacc $M2 "alumnos SIN cuenta de Auth no bloquean la migración"

echo "### 3. Migraciones A y B sobre el estado reconstruido"
mkdb main; expect_ok main $M1 "migración A (identidades) aplica"; coaches main
expect_ok main $M2 "migración B (lockdown) aplica"
expect_ok main $M1 "migración A es idempotente (re-aplicar)"
expect_ok main $M2 "migración B es idempotente (re-aplicar)"
n=$(q main "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND (policyname='acceso_total' OR policyname LIKE 'por_email%' OR policyname='ent_self')"); [ "$n" = "0" ] && ok "no quedan políticas acceso_total / por_email / ent_self" || bad "políticas inseguras restantes: $n"
n=$(q main "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND (qual='true' OR with_check='true')"); [ "$n" = "0" ] && ok "ninguna política con USING/CHECK true" || bad "políticas con true: $n"
n=$(q main "SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','PUBLIC')"); [ "$n" = "0" ] && ok "anon/PUBLIC sin ningún grant de tabla en public" || bad "grants de anon: $n"
n=$(q main "SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity"); [ "$n" = "0" ] && ok "todas las tablas de public con RLS activo" || bad "tablas sin RLS: $n"
n=$(q main "SELECT count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND p.prosecdef"); [ "$n" = "0" ] && ok "sin funciones SECURITY DEFINER en public" || bad "SECURITY DEFINER: $n"
n=$(q main "SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='coach_accounts' AND grantee='authenticated' AND privilege_type<>'SELECT'"); [ "$n" = "0" ] && ok "authenticated no puede escribir coach_accounts" || bad "coach_accounts escribible"
n=$(q main "SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='ejercicios_custom_backup_pre_fase1' AND grantee IN ('anon','authenticated')"); [ "$n" = "0" ] && ok "respaldo ejercicios_custom_backup_pre_fase1 sin grants" || bad "respaldo expuesto"
out=$(RUN "$P -v ON_ERROR_STOP=1 -d main -f $SNAP" 2>&1); echo "$out" | grep -q "CREATE POLICY" && ok "snapshot de políticas (solo lectura) genera SQL de restauración" || bad "snapshot sin salida"

echo "### 4. Batería: anon / alumnos / entrenadores / escalación / regresión"
for f in 02_tests 03_escalation 04_regression; do
  out=$(RUN "$P -v ON_ERROR_STOP=1 -d main -f tests/rls/$f.sql" 2>&1)
  echo "$out" | grep -E "RESULT|ERROR|\|" | head -40
  echo "$out" | grep -q "RESULT .*: [0-9]* pass / 0 fail" && ok "tests/rls/$f.sql sin fallos" || bad "tests/rls/$f.sql con fallos"
done

echo "### 5. Rollback de emergencia y reaplicación"
mkdb rbk; sql rbk $M1 >/dev/null; coaches rbk; sql rbk $M2 >/dev/null
expect_ok rbk $RB "rollback ejecuta"
out=$(RUN "$P -d rbk -At -c \"SET ROLE anon; SELECT count(*) FROM alumnos\"" 2>&1); [ "$out" = "3" ] && ok "tras el rollback se restaura el acceso previo (estado inseguro documentado)" || bad "rollback no restauró: $out"
n=$(q rbk "SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'it_guard_%'"); [ "$n" = "0" ] && ok "rollback quitó los triggers de guarda" || bad "triggers restantes: $n"
expect_ok rbk $M2 "reaplicar B tras el rollback"
out=$(RUN "$P -d rbk -At -c \"SET ROLE anon; SELECT count(*) FROM alumnos\"" 2>&1); echo "$out" | grep -q "permission denied" && ok "tras reaplicar, anon vuelve a estar bloqueado" || bad "anon no bloqueado: $out"

echo; echo "RESUMEN run.sh: $NPASS checks ok; $([ $FAIL = 0 ] && echo 'SIN FALLOS' || echo 'CON FALLOS')"
exit $FAIL
