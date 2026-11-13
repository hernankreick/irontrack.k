# Identidad remota de series y sesiones (PR-6)

Estado: **preparada y DESACTIVADA**. Sin la variable de activación, el frontend envía exactamente los mismos payloads de siempre.

## Contrato
`progreso`: `sesion_uid uuid`, `bloque text ('warmup'|'main')`, `pos smallint` (todos nullable).
`sesiones`: `sesion_uid uuid` (índice único parcial), `identidad_v smallint` (=1). Migración definitiva (preparada, no ejecutada) y runbook: `docs/identidad-remota-v1/` (la propuesta inicial queda superada) (no ejecutada, vive en docs/ porque `sql/` está bloqueado para agentes, sin backfill, sin FK, sin cambios de RLS).

## Activación (humana, en este orden)
1. Revisar y copiar la migración propuesta a `sql/` y correrla en un entorno de prueba; ejecutar los bloques de VERIFICACIÓN (RLS, grants, triggers, RPC).
2. Correrla en producción.
3. Recién entonces definir en Vercel `VITE_IRONTRACK_IDENTIDAD_REMOTA=migracion-aplicada:identidad-remota-v1` y redeployar. Cualquier otro valor = desactivada.
4. No se activa por detectar columnas: la bandera es la única fuente.

## Degradación segura
Con la bandera activa, si el servidor responde `PGRST204`/`42703` (columna inexistente) o `23514` (check de identidad), cada envío afectado se repite **una vez** sin los campos nuevos (los envíos en paralelo de un mismo flush pueden intentarlo una vez cada uno) y la app deja de enviarlos hasta recargar. Un error de columna implica que no se insertó nada: no duplica. Los pendientes (`it_pq`) conservan su identidad local y el opId, así que no se bloquean ni se pierden. Un `23505` nunca provoca reenvío: sobre `progreso_pkey` es la idempotencia por opId; sobre `sesiones_sesion_uid_uidx` significa que la sesión ya está guardada (la comprobación posterior de la finalización la encuentra; la deduplicación existente no cambia).

## Lectura e hidratación
Pasiva y validada (UUID v4, `bloque`/`pos` juntos y en rango). La identidad explícita del servidor gana si es consistente con la local; si se contradicen en la misma fila (mismo id) la serie queda `identidad_no_verificable` y no se usa. Filas históricas: sin identidad, nunca se infiere. Para comparar prescrito/ejecutado, `vincularSeriesConSesiones` deriva `sesion_id` solo por `sesion_uid` igual y único (uid duplicado en `sesiones` = ambiguo = sin vínculo).

## Rollback
Frontend: quitar la variable y redeployar. SQL: bloque ROLLBACK al final de la migración.

## Pendiente de verificar con acceso real al esquema
Tipos exactos actuales, vistas/triggers sobre `progreso`/`sesiones`, políticas RLS y GRANT por columna, RPC que inserten con lista fija de columnas. El repo no versiona estas tablas.
