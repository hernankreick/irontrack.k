#!/usr/bin/env bash
# Stack LOCAL de QA sin Docker (Linux x86-64): PostgreSQL + GoTrue (Supabase Auth) + PostgREST + gateway Node.
# Todo escucha en 127.0.0.1. Base: 127.0.0.1:54322/irontrack_qa. API: http://127.0.0.1:54321.
#   qa/stack.sh up | down | status
# Requisitos: Postgres 14+ (binarios initdb/pg_ctl/psql), Go >= 1.23, Node >= 20, git, curl, tar con xz. Costo: 0.
set -euo pipefail
cd "$(dirname "$0")/.."
QA_HOME=${QA_HOME:-$HOME/.irontrack-qa}
PGBIN=${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | tail -1)")}
POSTGREST_VERSION=v12.2.12
AUTH_TAG=v2.170.0
JWT_SECRET=${QA_JWT_SECRET:-local-qa-only-secret-0123456789abcdef0123456789} # descartable, sin relacion con ningun proyecto real
mkdir -p "$QA_HOME/bin" "$QA_HOME/src"

# ── Controles anti-produccion ────────────────────────────────────────────────
for v in QA_SUPABASE_URL VITE_SUPABASE_URL SUPABASE_URL; do
  val="${!v:-}"
  if [ -n "$val" ] && ! [[ "$val" =~ ^https?://(127\.0\.0\.1|localhost|\[::1\])(:|/|$) ]]; then
    echo "[QA GUARD] $v apunta fuera de loopback ($v definido en el entorno). Se aborta." >&2; exit 2
  fi
  if [[ "$val" == *ilcdexckizxtcxopfxlq* ]]; then echo "[QA GUARD] $v contiene el ref de PRODUCCION. Se aborta." >&2; exit 2; fi
done

as_pg() { # ejecuta un script como el usuario del servidor de base (postgres si somos root)
  if [ "$(id -u)" = 0 ]; then local f; f=$(mktemp /var/lib/postgresql/qa-XXXXXX.sh); cat > "$f"; chown postgres "$f"; su postgres -s /bin/bash "$f"; rm -f "$f"
  else bash; fi
}
if [ "$(id -u)" = 0 ]; then PGDATA=/var/lib/postgresql/irontrack_qa; else PGDATA="$QA_HOME/pgdata"; fi
PSQL="$PGBIN/psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 -U postgres"

export DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:54322/irontrack_qa?sslmode=disable"
export GOTRUE_DB_DRIVER=postgres GOTRUE_DB_DATABASE_URL="$DATABASE_URL" GOTRUE_DB_NAMESPACE=auth
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
export GOTRUE_SITE_URL=http://127.0.0.1:5173 API_EXTERNAL_URL=http://127.0.0.1:54321
export GOTRUE_API_HOST=127.0.0.1 GOTRUE_API_PORT=9999
export GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_DB_MIGRATIONS_PATH="$QA_HOME/src/auth/migrations"

# Lanza un proceso en segundo plano totalmente desacoplado (sin heredar stdout/stderr: no cuelga pipes como `| tail`).
daemon() { local dir="$1" log="$2"; shift 2; ( cd "$dir" && exec setsid "$@" ) > "$log" 2>&1 < /dev/null & }

up() {
  [ -x "$QA_HOME/bin/postgrest" ] || { echo "→ descargando PostgREST $POSTGREST_VERSION"
    curl -sSL -o "$QA_HOME/pgrst.tar.xz" "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz"
    tar -xJf "$QA_HOME/pgrst.tar.xz" -C "$QA_HOME/bin"; }
  [ -x "$QA_HOME/bin/gotrue" ] || { echo "→ compilando Supabase Auth $AUTH_TAG (≈1 min)"
    [ -d "$QA_HOME/src/auth" ] || git clone --quiet --depth 1 --branch "$AUTH_TAG" https://github.com/supabase/auth.git "$QA_HOME/src/auth"
    (cd "$QA_HOME/src/auth" && GOFLAGS=-mod=mod go build -o "$QA_HOME/bin/gotrue" .); }
  if [ ! -d "$PGDATA" ]; then
    echo "→ inicializando PostgreSQL local en $PGDATA"
    as_pg <<EOF
set -euo pipefail
mkdir -p "$PGDATA"; "$PGBIN/initdb" -D "$PGDATA" -A trust -U postgres >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o '-p 54322 -c listen_addresses=127.0.0.1' -l "$PGDATA/pg.log" -w start </dev/null >/dev/null 2>&1
$PSQL -d postgres -c 'CREATE DATABASE irontrack_qa'
$PSQL -d irontrack_qa <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT; GRANT anon, authenticated, service_role TO authenticator;
CREATE USER supabase_auth_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
ALTER USER supabase_auth_admin SET search_path = 'auth';
GRANT CREATE ON DATABASE irontrack_qa TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
EOF
    (cd "$QA_HOME/src/auth" && "$QA_HOME/bin/gotrue" migrate >/dev/null 2>&1) && echo "→ migraciones de Auth aplicadas"
  else
    as_pg <<EOF || true
"$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 || "$PGBIN/pg_ctl" -D "$PGDATA" -o '-p 54322 -c listen_addresses=127.0.0.1' -l "$PGDATA/pg.log" -w start </dev/null >/dev/null 2>&1
EOF
  fi
  cat > "$QA_HOME/postgrest.conf" <<EOF
db-uri = "postgres://authenticator@127.0.0.1:54322/irontrack_qa"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3000
EOF
  curl -s -o /dev/null http://127.0.0.1:9999/health || daemon "$QA_HOME/src/auth" "$QA_HOME/gotrue.log" "$QA_HOME/bin/gotrue" serve
  curl -s -o /dev/null http://127.0.0.1:3000/ || daemon "$PWD" "$QA_HOME/postgrest.log" "$QA_HOME/bin/postgrest" "$QA_HOME/postgrest.conf"
  curl -s -o /dev/null http://127.0.0.1:54321/rest/v1/ || daemon "$PWD" "$QA_HOME/gateway.log" node qa/gateway.mjs
  for i in $(seq 1 40); do
    if curl -s -o /dev/null http://127.0.0.1:9999/health && curl -s -o /dev/null http://127.0.0.1:3000/ && curl -s -o /dev/null http://127.0.0.1:54321/rest/v1/; then echo "✔ stack listo: http://127.0.0.1:54321 (DB 127.0.0.1:54322/irontrack_qa)"; return 0; fi
    sleep 1
  done
  echo "✘ el stack no respondió; ver $QA_HOME/*.log" >&2; return 1
}
down() {
  pkill -f "$QA_HOME/bin/gotrue" 2>/dev/null || true; pkill -f "$QA_HOME/bin/postgrest" 2>/dev/null || true; pkill -f "qa/gateway.mjs" 2>/dev/null || true
  as_pg <<EOF || true
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1
EOF
  echo "stack detenido (los datos locales quedan en $PGDATA)"
}
status() { for p in "Auth:9999/health" "PostgREST:3000/" "Gateway:54321/rest/v1/"; do printf "%-10s " "${p%%:*}"; curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:${p#*:}" || echo down; done; }
case "${1:-}" in up) up;; down) down;; status) status;; *) echo "uso: $0 up|down|status" >&2; exit 1;; esac
