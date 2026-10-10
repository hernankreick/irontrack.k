# QA local aislado (RLS P0) — Auth + PostgREST + función + frontend, sin tocar producción

## 1. Qué base usa hoy el Preview (verificado leyendo el repo, sin revelar claves)
- `lib/supabaseClient.js` y `App.jsx` leen **solo** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. No hay URL ni clave de respaldo en el código: sin variables, `supabase` queda `null`.
- `vite.config.js` no define variables. No hay `.env.production`, `.env.development` ni `.vercel/` en el repo.
- **`.env` está versionado en git** y su host es el proyecto de producción (`ref = ilcdexckizxtcxopfxlq`; la clave es la anon, pública por diseño). Cualquier `npm run dev` o build sin variables propias usa producción.
- En Vercel ambas variables están en *All Environments* (confirmado por el propietario) ⇒ **todo Preview, incluido el del commit 6300855, habla con la base de producción**.
  Consecuencia: un Preview es un frontend nuevo sobre datos sin backfill (el coach vería 0 alumnos), y con credenciales reales escribiría en producción.
  **No usar el Preview para pruebas funcionales.** (Acción del propietario, no realizada aquí: separar variables Preview/Production o apuntar Preview a un proyecto de QA; y `git rm --cached .env`.)

## 2. Entorno aislado: dos caminos gratuitos
| | A) Nativo (sin Docker) — **verificado en esta sesión** | B) Supabase CLI + Docker — recomendado en tu máquina |
|---|---|---|
| Componentes | PostgreSQL local + GoTrue (Supabase Auth, compilado) + PostgREST + gateway Node | `supabase start` (stack oficial completo) |
| Función | Misma lógica (`core.js`) ejecutada en Node | Runtime Deno real (`supabase functions serve`) |
| Requisitos | Linux x86-64, Postgres 14+, Go ≥ 1.23, Node ≥ 20, git, curl, xz | Docker Desktop/Engine, Node ≥ 20 |
| Costo | 0 | 0 (Docker Desktop es gratis para uso personal/pequeña empresa) |
| Estado | e2e API 22/22 y UI 7/7 ejecutados | **No verificado**: Docker no pudo bajar imágenes en el sandbox (límite de descarga del registro) |

### A) Nativo
```bash
qa/stack.sh up          # descarga PostgREST, compila Auth (≈1 min la primera vez), crea la base irontrack_qa en 127.0.0.1:54322 y levanta todo en 127.0.0.1:54321
node qa/test-guard.mjs  # controles anti-producción (sin red)
node qa/e2e-api.mjs     # secuencia real: estado inseguro → M1 → backfill → M2 + permisos con JWT reales + función
node qa/e2e-ui.mjs      # Vite + Chromium (Playwright): login coach/alumno y pantallas
qa/stack.sh down
```
Cada ejecución de los e2e **recrea el esquema `public` de la base local** con datos ficticios (9 alumnos `entrenador_principal`, entrenador `entrenador@irontrack.app` local, alumnos A/B, ajeno). Las contraseñas son aleatorias, solo en memoria.

### B) CLI + Docker (en tu máquina)
```bash
npm i -D supabase && npx supabase init   # genera supabase/config.toml (no versionar)
npx supabase start                        # API 127.0.0.1:54321, DB 127.0.0.1:54322 (base `postgres`, usuario postgres/postgres)
npx supabase functions serve update-alumno-password   # en otra terminal (Deno real)
export PGPASSWORD=postgres QA_DB_NAME=postgres QA_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
node qa/e2e-api.mjs && node qa/e2e-ui.mjs   # no usar el gateway Node: Kong del CLI enruta /auth, /rest y /functions
```
(El secreto JWT por defecto del CLI es público y solo vale en local; las claves anon/service se firman con él.)

## 3. Qué cubren las pruebas
- **API (22)**: reproduce la vulnerabilidad previa (anon lee/borra); aplica M1 → backfill (variante SQL Editor) → M2; entrenador: login, lista 9 alumnos por UUID, consulta legacy = 0, crea alumno (y rechaza `entrenador_principal`), asigna rutina/plantilla, lee progreso/overrides, edita config; alumnos A/B: login, búsqueda por email, rutina, registro de series y sesión, historial, avance de `semana_activa` (no retrocede), mensajes, `onesignal_id`, acceso cruzado denegado, escalada denegada (`entrenadores`, `auth_uid`, `coach_principal`); anónimo y ajeno; **cambio de contraseña**: rechazo sin sesión de entrenador, creación + vínculo de `auth_uid`, segunda llamada, 409 por email existente, protección de la cuenta del principal.
- **UI (7)**: login del entrenador y del alumno con la app real contra Auth local; dashboard con los 9 alumnos; consultas por UUID y sin `entrenador_principal`; el alumno ve su plan y no datos ajenos; el 403 esperado del upsert en `entrenadores`; kill-switch de red.
- Hallazgo real de esta corrida (corregido): `service_role` necesitaba `GRANT SELECT` sobre `coach_principal` (los *default privileges* de cada proyecto no son una garantía).

## 4. Límites (no confundir con validación sobre producción)
- El esquema `public` es **reconstruido** (columnas inferidas del código y de los metadatos), no un `pg_dump` real: falta validar defaults, índices, FKs `ON DELETE` y tipos exactos.
- Camino A ejecuta la función en Node (no Deno) y no incluye Realtime, Storage ni OneSignal.
- Por UI no se cubren aún: alta de alumno, registro de series, cambio de contraseña desde el modal (sí por API).
- Linux x86-64 únicamente para el camino A.

## 5. Controles contra ejecución accidental sobre producción
1. `qa/guard.mjs`: toda URL debe ser loopback y no contener `*.supabase.*` ni el ref de producción; la base solo `127.0.0.1:54322/{irontrack_qa|postgres}`. Los e2e **abortan antes de conectar**; `stack.sh` aborta si `VITE_/QA_/SUPABASE_URL` apunta fuera de loopback.
2. Vite del e2e recibe las variables **por entorno** (prioridad sobre el `.env` versionado, que apunta a producción).
3. Kill-switch de red en Chromium: toda petición a un host no-loopback se aborta; si alguna fuera a Supabase, el test falla (hoy solo bloquea `fonts.googleapis.com`).
4. Los e2e destruyen/recrean solo el esquema de la base local indicada; nunca existe una cadena de conexión remota en los scripts.
5. `node qa/test-guard.mjs` prueba estos controles (URL de producción, hosts hospedados, base remota, abortos de e2e y de `stack.sh`).
6. Pendiente (propietario): separar variables de Vercel por entorno y sacar `.env` del repositorio.
