#!/usr/bin/env bash
# Prueba LOCAL (Postgres efimero, datos ficticios) de la rotación de la copia interna (sql/rls_p0_backup_rotar.sql) y de la exportación externa en JSON.   tests/rls/run-backup-rotate.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
WORK=${RLS_TMP:-$(mktemp -d)}; PORT=${RLS_PORT:-54333}
RUN() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK" && chmod 755 "$WORK" && chmod -R a+rX tests supabase sql
RUN "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null" || exit 1
RUN "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null" || exit 1
trap 'RUN "$PGBIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null" || true' EXIT
P="$PGBIN/psql -X -q -h $WORK -p $PORT -U postgres"
BC=sql/rls_p0_backup_create.sql; BV=sql/rls_p0_backup_verify.sql; BR=sql/rls_p0_backup_restore.sql; RO=sql/rls_p0_backup_rotar.sql
FAIL=0; ok() { echo "PASS  $1"; }; bad() { echo "FAIL  $1"; FAIL=1; }
sql() { RUN "$P -v ON_ERROR_STOP=1 -d $1 -f $2" 2>&1; }
q()   { RUN "$P -d $1 -At -c \"$2\"" 2>&1; }
# extrae una sección de rotar.sql (desde "-- NOMBRE ·" hasta el siguiente "-- XXX ·")
sec() { awk -v n="$1" '$0 ~ "^-- " n " · " {on=1; next} on && /^-- [A-Z0-9-]+ · / {exit} on' $RO > $WORK/sec_$1.sql; chmod a+r $WORK/sec_$1.sql; echo $WORK/sec_$1.sql; }
DB=r
RUN "$P -d postgres -c 'CREATE DATABASE $DB'" >/dev/null && sql $DB tests/rls/00_baseline.sql >/dev/null && sql $DB tests/rls/01_seed.sql >/dev/null || exit 1
sed -n '/^-- A)/,/^ *ORDER BY m.tbl;/p' $BV | grep -v '^--' > $WORK/blkA.sql
sed -n '/^-- E)/,$p' $BV | grep -v '^--' > $WORK/blkE.sql
sed "s/v_limit bigint := 400::bigint \* 1024 \* 1024;/v_limit bigint := 1024;/" $BC > $WORK/bc_small.sql
chmod a+r $WORK/*.sql
okA() { RUN "$P -d $DB -At -f $WORK/blkA.sql" | grep -c '|t|t$'; }
LIVE="SELECT (SELECT count(*) FROM alumnos)||'/'||(SELECT count(*) FROM progreso)||'/'||(SELECT count(*) FROM mensajes)||'/'||(SELECT md5(string_agg(texto,',' ORDER BY id)) FROM mensajes)"

echo "## Copia 1 (la 'actual' de producción)"
sql $DB $BC >/dev/null && ok "create de la copia 1" || { bad "create 1"; exit 1; }
[ "$(q $DB "SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'backup_rls_p0%'")" = "1" ] && ok "hay un único esquema de respaldo" || bad "esquemas iniciales"
N1=$(q $DB "SELECT sum(row_count) FROM backup_rls_p0.manifest")

echo "## El sistema sigue usándose: cambian los datos vivos"
q $DB "INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES ('11111111-1111-1111-1111-111111111111','dl',3,5,140,'2026-02-01',2); UPDATE mensajes SET texto='editado' WHERE id=(SELECT min(id) FROM mensajes)" >/dev/null
L0=$(q $DB "$LIVE")

echo "## Rotación: ROTAR-1, create fresco, ROTAR-2"
sql $DB $(sec ROTAR-1) >/dev/null && ok "ROTAR-1 ejecuta" || bad "ROTAR-1"
[ "$(q $DB "SELECT to_regnamespace('backup_rls_p0') IS NULL AND to_regnamespace('backup_rls_p0_prev') IS NOT NULL")" = "t" ] && ok "la copia 1 pasó a backup_rls_p0_prev y ya no existe backup_rls_p0" || bad "renombre"
out=$(sql $DB $(sec ROTAR-1)); grep -q "No existe backup_rls_p0" <<<"$out" && ok "ROTAR-1 repetido se niega (no hay nada que rotar)" || bad "ROTAR-1 repetido"
sql $DB $BC >/dev/null && ok "create fresco ejecuta (el nombre estaba libre)" || bad "create fresco"
sql $DB $(sec ROTAR-2) >/dev/null && ok "ROTAR-2 etiqueta la fresca" || bad "ROTAR-2"
N2=$(q $DB "SELECT sum(row_count) FROM backup_rls_p0.manifest"); N1p=$(q $DB "SELECT sum(row_count) FROM backup_rls_p0_prev.manifest")
[ "$N1p" = "$N1" ] && [ "$N2" = "$((N1+1))" ] && ok "prev conserva el estado antiguo ($N1p filas) y la fresca incluye el uso posterior ($N2 filas)" || bad "conteos prev=$N1p fresca=$N2 original=$N1"
[ "$(q $DB "$LIVE")" = "$L0" ] && ok "rotar/crear no tocó los datos vivos" || bad "datos vivos modificados"

echo "## Identificación sin confusión (IDENTIFICAR)"
awk '/^-- IDENTIFICAR · /{on=1;next} on && /^-- [A-Z0-9-]+ · /{exit} on' $RO > $WORK/ident.sql; chmod a+r $WORK/ident.sql
IDOUT=$(RUN "$P -d $DB -At -F '|' -f $WORK/ident.sql")
echo "$IDOUT" | sed 's/^/      /'
[ "$(echo "$IDOUT" | wc -l)" = "2" ] && ok "IDENTIFICAR lista exactamente 2 copias" || bad "IDENTIFICAR filas"
echo "$IDOUT" | grep -q "^backup_rls_p0|COPIA FRESCA.*|14|$N2|t|f|f|0$" && ok "backup_rls_p0: 'COPIA FRESCA', 14 tablas, $N2 filas, usada por verify/restore, sin acceso anon/authenticated" || bad "fila fresca"
echo "$IDOUT" | grep -q "^backup_rls_p0_prev|COPIA ANTERIOR.*|14|$N1|f|f|f|0$" && ok "backup_rls_p0_prev: 'COPIA ANTERIOR', 14 tablas, $N1 filas, NO usada, sin acceso anon/authenticated" || bad "fila prev"

echo "## verify sobre la copia fresca"
[ "$(okA)" = "14" ] && ok "bloque A: 14/14 con ok_copia y ok_origen" || bad "bloque A fresca: $(okA)"
out=$(RUN "$P -d $DB -At -f $WORK/blkE.sql"); [ "$(echo "$out" | grep -c '|f|0$')" = "2" ] && ok "bloque E: anon y authenticated sin acceso" || bad "bloque E: $out"

echo "## Emergencia: restaurar desde la copia ANTERIOR (intercambio de nombres)"
q $DB "DELETE FROM progreso WHERE ejercicio_id='sq' AND kg=100" >/dev/null     # fila borrada por error: existe en AMBAS copias
sql $DB $(sec INTERCAMBIAR-A-ANTERIOR) >/dev/null && ok "INTERCAMBIAR-A-ANTERIOR ejecuta" || bad "intercambio"
[ "$(q $DB "SELECT (SELECT sum(row_count) FROM backup_rls_p0.manifest)||'/'||(SELECT sum(row_count) FROM backup_rls_p0_fresca.manifest)")" = "$N1/$N2" ] && ok "ahora backup_rls_p0 es la anterior ($N1) y la fresca quedó como backup_rls_p0_fresca ($N2)" || bad "estado tras intercambio"
sed -n '/^-- ───────── R4/,/^-- ───────── R5/p' $BR | sed "s/tablas text\[\] := ARRAY\[\]::text\[\];/tablas text[] := ARRAY['progreso'];/" > $WORK/r4.sql; chmod a+r $WORK/r4.sql
sql $DB $WORK/r4.sql >/dev/null; [ "$(q $DB "SELECT count(*) FROM progreso WHERE ejercicio_id='sq' AND kg=100")" = "1" ] && ok "R4 desde la copia anterior recupera la fila borrada" || bad "R4 desde prev"
[ "$(q $DB "SELECT count(*) FROM progreso WHERE ejercicio_id='dl'")" = "1" ] && ok "R4 no pisó la fila nueva posterior a la copia anterior" || bad "R4 pisó datos"
sql $DB $(sec INTERCAMBIAR-A-FRESCA) >/dev/null && ok "INTERCAMBIAR-A-FRESCA ejecuta" || bad "intercambio inverso"
[ "$(q $DB "SELECT (SELECT sum(row_count) FROM backup_rls_p0.manifest)||'/'||(SELECT sum(row_count) FROM backup_rls_p0_prev.manifest)")" = "$N2/$N1" ] && ok "nombres de vuelta: backup_rls_p0 = fresca, backup_rls_p0_prev = anterior" || bad "estado tras intercambio inverso"
out=$(sql $DB $(sec INTERCAMBIAR-A-FRESCA)); grep -q "Faltan backup_rls_p0 y/o backup_rls_p0_fresca" <<<"$out" && ok "el intercambio inverso repetido se niega" || bad "intercambio inverso repetido"

echo "## Exportación externa en JSON (sql/rls_p0_export_json.sql): ida y vuelta sin pérdida"
EX=sql/rls_p0_export_json.sql
q $DB "INSERT INTO mensajes(alumno_id,texto,de_entrenador,leido) VALUES ('11111111-1111-1111-1111-111111111111', E'it''s \$j\$ raro: ñ, \"comillas\", salto\nde línea', false, true)" >/dev/null
RUN "$P -d $DB -At -F '|' -f $EX" > $WORK/export.txt; chmod a+r $WORK/export.txt
[ "$(wc -l < $WORK/export.txt)" = "14" ] && ok "la exportación devuelve 14 filas (una por tabla)" || bad "filas de la exportación: $(wc -l < $WORK/export.txt)"
grep -qiE "^(update|insert|delete|drop|alter|create|truncate)" $EX && bad "el export no es de solo lectura" || ok "el export es solo SELECT"
# estado de referencia (huellas por tabla), vaciado de las tablas sin dependientes, y restauración desde el texto exportado
python3 - "$WORK" <<'PY'
import sys
w=sys.argv[1]
for line in open(f"{w}/export.txt",encoding="utf-8"):
    tabla,filas,huella,datos=line.rstrip("\n").split("|",3)
    open(f"{w}/ref_{tabla}.txt","w").write(f"{filas}|{huella}")
    open(f"{w}/imp_{tabla}.sql","w",encoding="utf-8").write(f"INSERT INTO public.{tabla} SELECT * FROM jsonb_populate_recordset(null::public.{tabla}, $irontrack_json${datos}$irontrack_json$::jsonb);\n")
PY
chmod a+r $WORK/imp_*.sql
for T in progreso mensajes fotos sesiones notas config; do
  q $DB "DELETE FROM public.$T" >/dev/null
  sql $DB $WORK/imp_$T.sql >/dev/null
  cur=$(RUN "$P -d $DB -At -F '|' -f $EX" | grep "^$T|" | cut -d'|' -f2,3)
  [ "$cur" = "$(cat $WORK/ref_$T.txt)" ] && ok "JSON ida y vuelta de $T: mismas filas y misma huella (${cur%%|*} filas)" || bad "JSON $T: $cur vs $(cat $WORK/ref_$T.txt)"
done
[ "$(q $DB "SELECT count(*) FROM mensajes WHERE texto LIKE '%\$j\$%' AND texto LIKE '%it''s%' AND texto LIKE '%ñ%'")" = "1" ] && ok "la fila con apóstrofe, \$j\$, comillas, ñ y salto de línea sobrevivió" || bad "fila especial perdida"

echo "## Si el create falla después de ROTAR-1 (simulado con un límite de espacio mínimo)"
RUN "$P -d postgres -c 'CREATE DATABASE r2'" >/dev/null && sql r2 tests/rls/00_baseline.sql >/dev/null && sql r2 tests/rls/01_seed.sql >/dev/null || exit 1
sql r2 $BC >/dev/null && sql r2 $(sec ROTAR-1) >/dev/null
out=$(sql r2 $WORK/bc_small.sql); grep -q "Espacio insuficiente" <<<"$out" && ok "el create aborta por espacio" || bad "create no abortó: $out"
[ "$(q r2 "SELECT to_regnamespace('backup_rls_p0') IS NULL AND to_regnamespace('backup_rls_p0_prev') IS NOT NULL")" = "t" ] && ok "no quedó ninguna copia a medias; la anterior sigue intacta como _prev" || bad "estado tras create fallido"
out=$(sql r2 $(sec ROTAR-1)); grep -q "No existe backup_rls_p0" <<<"$out" && ok "ROTAR-1 no se puede repetir sin copia con el nombre original" || bad "ROTAR-1 sin copia"
sql r2 $(sec DESHACER) >/dev/null && ok "DESHACER devuelve el nombre original" || bad "DESHACER"
[ "$(q r2 "SELECT to_regnamespace('backup_rls_p0') IS NOT NULL AND to_regnamespace('backup_rls_p0_prev') IS NULL")" = "t" ] && ok "backup_rls_p0 vuelve a existir y _prev ya no" || bad "estado tras DESHACER"
out=$(sql r2 $(sec DESHACER)); grep -q "backup_rls_p0 existe" <<<"$out" && ok "DESHACER repetido se niega" || bad "DESHACER repetido"
[ "$(q r2 "SELECT count(*) FROM backup_rls_p0.manifest")" = "14" ] && ok "la copia original conserva su manifiesto (14 tablas)" || bad "manifiesto"
[ $FAIL = 0 ] && echo "TODO OK" || { echo "HAY FALLAS"; exit 1; }
