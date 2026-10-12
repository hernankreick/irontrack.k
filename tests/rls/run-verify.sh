#!/usr/bin/env bash
# Prueba LOCAL (Postgres efimero, datos ficticios) de sql/rls_p0_verify_anon.sql y sql/rls_p0_verify_aislamiento.sql.   tests/rls/run-verify.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
WORK=${RLS_TMP:-$(mktemp -d)}; PORT=${RLS_PORT:-54332}
RUN() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK" && chmod 755 "$WORK" && chmod -R a+rX tests supabase sql
RUN "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null" || exit 1
RUN "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null" || exit 1
trap 'RUN "$PGBIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null" || true' EXIT
P="$PGBIN/psql -X -q -h $WORK -p $PORT -U postgres"
M1=supabase/migrations/20261010110000_rls_p0_coach_principal.sql; M2=supabase/migrations/20261010120000_rls_p0_lockdown.sql
VA=sql/rls_p0_verify_anon.sql; VI=sql/rls_p0_verify_aislamiento.sql
FAIL=0; ok() { echo "PASS  $1"; }; bad() { echo "FAIL  $1"; FAIL=1; }
sql() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -f $2" 2>&1; }
q()   { RUN "$P -d $1 -At -c \"$2\"" 2>&1; }
# NOTA: capturar la salida antes de filtrar (con pipefail, `grep -q` cierra la tuberia y la hace fallar)
has()  { local o; o=$(sql v "$1"); grep -q -- "$2" <<<"$o"; }
hasE() { local o; o=$(sql v "$1"); grep -qiE -- "$2" <<<"$o"; }
verdict() { sql v "$1" | grep -o "VEREDICTO: [A-Z]*\( [A-Z]*\)\?" | head -1 | sed 's/ *$//'; }     # OK | FALLA | SIN PRUEBA
RUN "$P -d postgres -c 'CREATE DATABASE v'" >/dev/null && sql v tests/rls/00_baseline.sql >/dev/null && sql v tests/rls/01_seed.sql >/dev/null || exit 1
PUID=00000000-0000-0000-0000-0000000000c1
q v "UPDATE alumnos SET entrenador_id='entrenador_principal'" >/dev/null
sql v $M1 >/dev/null
sed -e "s/e2447231-c0ba-4f90-946f-63bf364570af/$PUID/" -e "s/expected_legacy int := 9/expected_legacy int := 2/" sql/rls_p0_backfill_sql_editor.sql > $WORK/bf.sql; chmod a+r $WORK/bf.sql
sql v $WORK/bf.sql >/dev/null || { bad "backfill local"; exit 1; }

snap() { q v "SELECT (SELECT count(*) FROM alumnos)||'/'||(SELECT count(*) FROM progreso)||'/'||(SELECT count(*) FROM mensajes)||'/'||(SELECT count(*) FROM rutinas)||'/'||(SELECT md5(string_agg(entrenador_id,',' ORDER BY id)) FROM alumnos)"; }
S0=$(snap)
echo "## Consultas de verificación de B1/B2 (solo lectura)"
sed "s/e2447231-c0ba-4f90-946f-63bf364570af/$PUID/" sql/rls_p0_verify_backfill.sql > $WORK/vb.sql; chmod a+r $WORK/vb.sql
[ "$(RUN "$P -d v -At -F '|' -f $WORK/vb.sql")" = "0|2|0|0|0|0|1|2" ] && ok "verify_backfill: 0 legacy, 2 con el UID (los 2 alumnos ficticios), principal=1, 2 filas en el registro" || bad "verify_backfill: $(RUN "$P -d v -At -F '|' -f $WORK/vb.sql")"
grep -qiE "^(update|insert|delete|drop|alter|create|truncate)" sql/rls_p0_verify_backfill.sql && bad "verify_backfill no es solo lectura" || ok "verify_backfill es solo SELECT"
[ "$(q v "SELECT count(*) AS filas_coach_principal, to_regclass('public.coach_principal') IS NOT NULL AS tabla_existe FROM public.coach_principal")" = "1|t" ] && ok "consulta de B1 ejecuta (1 fila tras el backfill; 0 antes)" || bad "consulta B1"

echo "## Verificación de filas de entrenadores previa a la migración 2 (solo lectura)"
VE=sql/rls_p0_verify_entrenadores.sql
grep -qiE "^(update|insert|delete|drop|alter|create|truncate)" $VE && bad "verify_entrenadores no es solo lectura" || ok "verify_entrenadores es solo SELECT"
r=$(RUN "$P -d v -At -F '|' -f $VE"); echo "      estado inicial (filas|principal|de_alumnos|otras; el seed trae un 2º entrenador) -> $r"
q v "INSERT INTO entrenadores(id,email) VALUES ('00000000-0000-0000-0000-0000000000c2','coach2@test.local') ON CONFLICT DO NOTHING" >/dev/null
r=$(RUN "$P -d v -At -F '|' -f $VE")
echo "$r" | grep -q "|1|0|1$" && ok "detecta 1 fila de entrenador que no es el principal ni de un alumno (otras_con_privilegios=1)" || bad "verify_entrenadores: $r"
q v "DELETE FROM entrenadores WHERE id='00000000-0000-0000-0000-0000000000c2'" >/dev/null
r=$(RUN "$P -d v -At -F '|' -f $VE"); echo "$r" | grep -q "|1|0|0$" && ok "con solo el principal: principal=1, otras_con_privilegios=0" || bad "verify_entrenadores limpio: $r"

echo "## sin ediciones manuales"
! grep -qiE "PEGAR|<UID|REEMPLAZ|TU_UID" $VA $VI && ok "los scripts no piden reemplazar identificadores" || bad "los scripts contienen marcadores a editar"

echo "## ANTES de la migración 2 (RLS abierta): deben DETECTAR el problema"
[ "$(verdict $VA)" = "VEREDICTO: FALLA" ] && ok "anon: FALLA (lee tablas sin sesión)" || bad "anon antes de M2: $(verdict $VA)"
[ "$(verdict $VI)" = "VEREDICTO: FALLA" ] && ok "aislamiento: FALLA (alumnos ven datos ajenos)" || bad "aislamiento antes de M2: $(verdict $VI)"
has $VI "alumno #1: ve 2 alumnos" && ok "aislamiento: el detalle nombra el problema (alumno #1 ve 2 alumnos)" || bad "detalle de aislamiento"
sql v $M2 >/dev/null || { bad "M2 local"; exit 1; }

echo "## DESPUÉS de la migración 2"
[ "$(verdict $VA)" = "VEREDICTO: OK" ] && ok "anon: OK" || bad "anon después de M2: $(verdict $VA)"
[ "$(verdict $VI)" = "VEREDICTO: OK" ] && ok "aislamiento: OK" || bad "aislamiento después de M2: $(verdict $VI)"
has $VI "probados: 2  |  alumnos en total: 2" && ok "aislamiento: probó los 2 alumnos vinculados sin que nadie indique ids" || bad "conteo de alumnos probados"
has $VA "alumnos: permiso denegado (OK)" && ok "anon: detalle por tabla" || bad "detalle anon"
hasE $VA "@|a\.jpg|nota A|hola" && bad "el resultado expone datos personales" || ok "el resultado no contiene datos personales (solo conteos)"
hasE $VI "@|11111111|a\.jpg|nota A|hola" && bad "aislamiento expone datos/ids" || ok "aislamiento: sin correos ni ids ni contenido"
[ "$(snap)" = "$S0" ] && ok "ninguno de los scripts modificó datos (conteos y huella iguales)" || bad "los datos cambiaron"
[ "$(q v "SELECT current_setting('role')")" = "none" ] && ok "el rol de la sesión no quedó cambiado" || bad "rol colgado"

echo "## Mutaciones: deben DETECTAR cada fuga"
q v "CREATE POLICY zz_fuga ON progreso FOR SELECT TO authenticated USING (true)" >/dev/null
has $VI "ve 1 fila(s) ajena(s) en progreso" && ok "fuga de progreso entre alumnos detectada" || bad "no detectó fuga en progreso"
q v "DROP POLICY zz_fuga ON progreso" >/dev/null
q v "CREATE POLICY zz_fuga ON mensajes FOR SELECT TO authenticated USING (true)" >/dev/null
has $VI "usuario sin datos: ve 2 fila(s) en mensajes" && ok "fuga hacia un usuario sin datos detectada" || bad "no detectó fuga a usuario sin datos"
q v "DROP POLICY zz_fuga ON mensajes" >/dev/null
q v "CREATE POLICY zz_fuga ON entrenadores FOR SELECT TO authenticated USING (true)" >/dev/null
[ "$(verdict $VI)" = "VEREDICTO: FALLA" ] && ok "fuga de entrenadores detectada" || bad "no detectó fuga de entrenadores"
q v "DROP POLICY zz_fuga ON entrenadores" >/dev/null
q v "GRANT SELECT ON alumnos TO anon; CREATE POLICY zz_anon ON alumnos FOR SELECT TO anon USING (true)" >/dev/null
has $VA "alumnos: anon LEE 2 fila(s)" && ok "lectura anónima de alumnos detectada" || bad "no detectó lectura anónima"
q v "DROP POLICY zz_anon ON alumnos; REVOKE SELECT ON alumnos FROM anon" >/dev/null
[ "$(verdict $VA)" = "VEREDICTO: OK" ] && [ "$(verdict $VI)" != "VEREDICTO: SIN PRUEBA" ] && ok "tras retirar las mutaciones el anon sigue en OK" || bad "estado tras mutaciones"

echo "## Contexto JWT: auth.uid() que lee SOLO request.jwt.claims (JSON), como en versiones nuevas de Supabase"
q v "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid \$\$" >/dev/null
[ "$(verdict $VI)" = "VEREDICTO: OK" ] && ok "aislamiento OK usando solo request.jwt.claims" || bad "aislamiento con claims JSON: $(verdict $VI)"
q v "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$" >/dev/null
[ "$(verdict $VI)" = "VEREDICTO: OK" ] && ok "aislamiento OK usando solo request.jwt.claim.sub (forma antigua)" || bad "aislamiento con claim.sub: $(verdict $VI)"

echo "## Caso límite: sin alumnos vinculados"
q v "UPDATE alumnos SET auth_uid = NULL" >/dev/null
[ "$(verdict $VI)" = "VEREDICTO: SIN PRUEBA" ] && ok "sin auth_uid no afirma OK: informa SIN PRUEBA" || bad "caso sin alumnos: $(verdict $VI)"
[ $FAIL = 0 ] && echo "TODO OK" || { echo "HAY FALLAS"; exit 1; }
