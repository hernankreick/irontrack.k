#!/usr/bin/env bash
# Ejecuta el index.ts REAL de update-alumno-password en Deno (127.0.0.1:8099) y apunta el gateway QA a esa funcion.
#   qa/functions-deno.sh up | down        (requiere `deno` en el PATH o DENO_BIN=/ruta/a/deno, y el stack arriba: qa/stack.sh up)
# Unica sustitucion: el import https://esm.sh/@supabase/supabase-js@2 se resuelve como npm:@supabase/supabase-js@2 (qa/deno-import-map.json).
set -euo pipefail
cd "$(dirname "$0")/.."
QA_HOME=${QA_HOME:-$HOME/.irontrack-qa}; mkdir -p "$QA_HOME"
DENO=${DENO_BIN:-deno}
case "${1:-}" in
  up)
    for pid in $(pgrep -f "qa/gateway" || true); do [ "$pid" != "$$" ] && kill "$pid" 2>/dev/null || true; done
    pkill -f "deno run .*update-alumno-password" 2>/dev/null || true
    KEY=$(node qa/keys.mjs | python3 -c 'import sys,json;print(json.load(sys.stdin)["service_role"])')
    ( SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY="$KEY" DENO_SERVE_ADDRESS=tcp:127.0.0.1:8099 \
      setsid nohup "$DENO" run --allow-net --allow-env --allow-read --import-map=qa/deno-import-map.json \
      supabase/functions/update-alumno-password/index.ts > "$QA_HOME/deno.log" 2>&1 < /dev/null & )
    ( QA_FUNCTION_URL=http://127.0.0.1:8099 setsid nohup node qa/gateway.mjs > "$QA_HOME/gateway.log" 2>&1 < /dev/null & )
    for i in $(seq 1 30); do curl -s -o /dev/null -X OPTIONS http://127.0.0.1:8099/ && curl -s -o /dev/null http://127.0.0.1:54321/rest/v1/ && { echo "✔ funcion en Deno (8099) + gateway listos"; exit 0; }; sleep 1; done
    echo "✘ no arrancó; ver $QA_HOME/deno.log" >&2; exit 1;;
  down) pkill -f "deno run .*update-alumno-password" 2>/dev/null || true; echo "funcion Deno detenida (el gateway vuelve a usar Node al reiniciarlo con qa/stack.sh)";;
  *) echo "uso: $0 up|down" >&2; exit 1;;
esac
