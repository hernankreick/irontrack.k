# RLS v1 — corrección de `acceso_total` (preparada, NO aplicada)

Estado: migración, preflight, verificación y rollback **versionados y probados en PostgreSQL local** (`scripts/test-pgRlsV1.mjs`, 26 pruebas con ids `text` y `uuid`). **No se ejecutó nada en Supabase.** La prueba de Supabase Auth real (JWT firmados) y de PostgREST sigue pendiente: es el paso V9 de `2_verificacion.sql`, con cuentas de prueba.

## 1. Modelo de autorización real (auditoría del código)
| Hecho | Evidencia | Consecuencia para RLS |
|---|---|---|
| Hoy todas las tablas de datos tienen `acceso_total` (`USING true`); con la clave anon cualquier visitante lee y escribe todo. | Informado por el dueño; reproducido en `test-pgRlsV1` («ANTES»). | Brecha crítica de aislamiento entre alumnos. |
| Entrenador: cuenta de Auth (`entrenador@irontrack.app`); la app **no** guarda su rol en ninguna fuente confiable. La única lista confiable es el secreto `COACH_UIDS` de la Edge Function. | `App.jsx` (login), `supabase/functions/update-alumno-password/README.md`. | El rol se decide con un padrón que el cliente no puede leer ni escribir: `it_authz.entrenadores_autorizados` (mismos UIDs que `COACH_UIDS`). |
| Alumno: cuenta de Auth + fila en `alumnos` encontrada **por email**. El único vínculo confiable cuenta↔alumno es `app_metadata.alumno_id` (lo escribe solo el servidor). | `App.jsx` login alumno; README de la función; `alumnos.auth_uid`, el email y `user_metadata` **los escribe el cliente**. | RLS usa solo `auth.jwt()->app_metadata->>alumno_id`. Nunca email ni `auth_uid`. |
| `alumnos.entrenador_id` (`uid` del entrenador o `'entrenador_principal'` legado) define a quién gestiona cada entrenador. | `getAlumnos`, Edge Function. | Entrenador autorizado + (`entrenador_id` = su uid o `entrenador_principal`). Un alumno no puede cambiarlo (trigger). |
| Cualquier usuario autenticado hacía `upsert` en `entrenadores` (alumnos incluidos). | `App.jsx` (efecto de Auth). | La base ahora lo rechaza; el cliente ya no lo intenta con cuentas de alumno (`lib/entrenadorUpsertGate.js`). |
| El alumno escribe: `progreso`, `sesiones`, `fotos`, `mensajes` (suyos), `alumnos.onesignal_id`, `rutinas.datos.semana_activa` (avance). Lee: lo suyo, `config`, la fila de su entrenador y su biblioteca. | Búsqueda de `from(...)`/`sbFetch(...)`. | Permisos mínimos + triggers de columnas (RLS no restringe columnas). |
| Las RPC `it_rutina_*` (reiniciar, avanzar semana, guardar contenido) **no están versionadas** en el repo; el cliente cae a escrituras directas si no existen. | `lib/rpcClient.js`. | Si existen en producción como `SECURITY DEFINER` sin validar al llamador, **eluden RLS**: el preflight R5 y la verificación V8 las señalan; revisarlas antes del GO. |

## 2. Matriz de permisos (rol del JWT `authenticated`; `anon`: nada)
| Tabla | Alumno vinculado | Entrenador autorizado (sus alumnos / sus filas) |
|---|---|---|
| `alumnos` | S y U (solo `onesignal_id`) de su fila | S/I/U/D donde `entrenador_id` es suyo; no puede entregar el alumno a otro entrenador |
| `entrenadores` | S solo la de su entrenador | S/I/U de la suya (o la legada) |
| `rutinas` | S las suyas; U solo avanzar `datos.semana_activa` (nunca retroceder ni tocar otra clave/columna) | S/I/U/D las suyas, plantillas y las de sus alumnos |
| `progreso`, `sesiones` | S e I los suyos (no hay U ni D) | S, I (validación manual) y D de sus alumnos |
| `mensajes` | S; I solo como alumno; U solo `leido` de lo que recibió | S; I solo como entrenador; U `leido` de lo que recibió; D |
| `notas` | S | S/I/U/D |
| `fotos` | S/I/D las suyas | S/I/D de sus alumnos |
| `config` | S | S/I/U |
| `video_overrides`, `ejercicio_overrides`, `ejercicios_custom` | S los de su entrenador y los `entrenador_principal` | S/I/U/D los suyos |
| `prescripcion_copias` (tabla nueva) | S e I las suyas, solo de una rutina propia | S las de sus alumnos |
| `coach_calendar_assignments`, `coach_notification_reads` | no tocadas: ya tienen políticas por dueño (`auth.uid() = entrenador_id`) | idem |

## 3. Qué dejaría de funcionar (y cómo evitarlo)
1. **Un alumno cuya cuenta no esté vinculada pierde TODO el acceso** (login incluido: la fila de `alumnos` ya no se ve). → Preflight R7; vincular de a uno con `scripts/admin/link-alumno.mjs` **antes** de migrar.
2. **El entrenador sin uid en el padrón pierde todo el acceso.** → Cargar el padrón antes (paso 0 del archivo); V5 lo comprueba. Se puede agregar/quitar sin migrar.
3. Alumnos con `entrenador_id` distinto de un uid autorizado o `entrenador_principal` quedan sin gestor. → Preflight R9.
4. Lecturas con la clave anon previas al login (si las hubiera) devuelven 401: el código solo lee tras `signInWithPassword`.
5. Cualquier RPC/función que dependiera de `acceso_total`. → R5/V8.
6. **Storage (bucket de fotos) no se auditó**: no está en el repo; sus políticas son un trabajo aparte.

## 4. Orden de despliegue y rollback de cada etapa
El orden se verificó con pruebas: **RLS e identidad remota conmutan** (mismo estado final en cualquier orden, `test-pgRlsV1`); las **copias dependen de RLS** (la migración de copias aborta sin ella). Se mantiene el orden más seguro: primero se cierra la brecha.

| # | Etapa (humano, primero en un branch/proyecto de Supabase de prueba) | Comprobación | Rollback |
|---|---|---|---|
| 1 | Preflight de seguridad: `rls-v1/0_preflight.sql` (R1–R11). Cargar `it_authz.entrenadores_autorizados` y **vincular cuentas** | R7 sin alumnos sin cuenta; R9 sin entrenador huérfano; R5 revisado | nada que revertir |
| 2 | Migración RLS: `rls-v1/1_migracion.sql` | `2_verificacion.sql` V1–V8 y **V9 manual con JWT reales** | `3_rollback.sql` (**restituye `acceso_total`**: solo emergencia; mejor corregir vínculo/padrón) |
| 3 | Verificación de permisos con cuentas de prueba (alumno A, B, entrenador, sin vínculo, anon) | V9 a–e | — |
| 4 | Identidad remota: `identidad-remota-v1/0_preflight → 1_migracion → 2_verificacion` | V1–V8 del runbook | `identidad-remota-v1/3_rollback.sql` |
| 5 | Copias: `prescripcion-copias-v1/1_tabla.sql` (exige el paso 2) | tabla, políticas, `has_table_privilege` | `prescripcion-copias-v1/3_rollback.sql` (borra las copias) |
| 6 | Verificación de persistencia: sesión de prueba → `progreso`/`sesiones` con identidad; copia en `prescripcion_copias`; un reintento no duplica | consultas del runbook | — |
| 7 | Activación en **Preview**: `VITE_IRONTRACK_IDENTIDAD_REMOTA=migracion-aplicada:identidad-remota-v1` y `VITE_IRONTRACK_COPIAS_PRESCRIPCION=migracion-aplicada:prescripcion-copias-v1` (variables de build; se activan **después** de 2–6) | `/qa` con `node scripts/qa/prescrito-ejecutado-visual.mjs` + prueba en iPhone real | quitar las variables y redeploy / *Instant Rollback* |
| 8 | QA funcional en Preview (alumno: entrenar offline/online, recargar; entrenador: ficha) | lista de `docs/identidad-remota-v1/RUNBOOK.md` | idem |
| 9 | Producción: repetir 1→7 en horario valle; **solo con autorización del dueño** | — | por etapa, arriba |

## 5. Límites y riesgos residuales
- El JWT de las pruebas locales es una simulación (`request.jwt.claims`); las políticas, triggers, privilegios y SQL son los de PostgreSQL real. Falta la prueba con Supabase Auth.
- `entrenador_principal` es un valor compartido: cualquier entrenador autorizado gestiona esos alumnos (igual que la Edge Function). Con un solo entrenador es irrelevante; con varios, migrar esos alumnos a un uid.
- `config` (datos de pago) la lee cualquier alumno vinculado; las fotos son URLs (el bucket no está cubierto).
- El contenido de `prescripcion_copias.snapshot` lo calcula el cliente: un alumno podría falsear la copia de **su propia** sesión (no la de otros). Cerrarlo exige capturar la copia del lado del servidor (RPC), fuera de esta etapa.
- Un `SECURITY DEFINER` público sin validar al llamador elude estas políticas (V8 lo señala).
