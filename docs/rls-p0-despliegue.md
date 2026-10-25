# RLS P0 — procedimiento de despliegue y rollback

> Lo ejecuta el propietario, **de a un paso**, en este orden. Nada de esto se aplicó en Supabase remoto: las pruebas corrieron solo en un
> PostgreSQL local efímero con datos ficticios (`tests/rls/run.sh`). Reemplaza la documentación de despliegue del PR #89 (basada en
> `coach_principal`, `alumnos.auth_uid` y backfill de `entrenador_principal`), que **no** aplica al `main` actual.

## Modelo de autorización (único)
| Quién | Prueba de identidad | Quién la escribe |
|---|---|---|
| Entrenador | su UID está en `public.coach_accounts` (espejo de `COACH_UIDS`) | solo el propietario (SQL Editor / `service_role`) |
| Alumno | `app_metadata.alumno_id` del JWT = `alumnos.id` | solo el servidor: la Edge Function `update-alumno-password` o `scripts/admin/link-alumno.mjs` |
| Alcance del entrenador | `alumnos.entrenador_id` = su UID **o** `'entrenador_principal'` (legacy, sigue siendo el que usa el cliente de `main`) | — |

No otorgan nada: filas en `entrenadores`, `alumnos.auth_uid`, `alumnos.entrenador_id` por sí solo, `user_metadata`, ni el email. **No hay backfill**
de `entrenador_principal` (el cliente de `main` lo consulta tal cual) y la Edge Function no cambia.

## Archivos
| Archivo | Rol |
|---|---|
| `supabase/migrations/20261025100000_rls_p0_identity.sql` | Unidad A. Aditiva: `coach_accounts` + funciones `it_*` (SECURITY INVOKER). No cambia el comportamiento de la app. |
| `supabase/migrations/20261025110000_rls_p0_lockdown.sql` | Unidad B. Pre-vuelo que aborta, triggers de guarda, barrido de políticas, grants mínimos, políticas nuevas. |
| `supabase/rollback/20261025110000_rls_p0_snapshot_readonly.sql` | Solo lectura: genera el SQL que restaura el estado exacto previo. **Ejecutar y guardar antes de B.** |
| `supabase/rollback/20261025110000_rls_p0_rollback.sql` | Rollback de emergencia (vuelve al estado inseguro conocido). |
| `tests/rls/` | Batería local (ver `tests/rls/README.md`). |

## Hallazgos de la validación con el estado real de producción (preproducción)
Ver también `docs/rls-p0-vinculacion.md` (las 9 vinculaciones) y `tests/rls/prod-sim.mjs` (simulación del estado real con datos ficticios).
1. **Pre-vuelo de B incompleto (parche listo, pendiente de aplicar):** B no verificaba que los datos con dueño por UID (hoy: 75 `ejercicios_custom` y 1 `ejercicio_overrides`)
   pertenezcan a un UID de `coach_accounts`. Si se carga un UID distinto, B se aplicaba sin avisar y esos datos quedaban invisibles para todo entrenador.
   El parche está en `docs/rls-p0-parche-preflight-B.patch` (`git apply docs/rls-p0-parche-preflight-B.patch` sobre `supabase/migrations/20261025110000_rls_p0_lockdown.sql`).
   Mientras no se aplique, la sección 07 del diagnóstico (con `coach_uids` pegado) hace esa comprobación: **no aplicar B si hay un `BLOQUEA` en 07**.
2. **Frontend (corregido en `App.jsx`):** el efecto que carga `config` (alias de pagos), `video_overrides` y `ejercicio_overrides` corría una sola vez al montar, antes del login
   (clave anónima). Con RLS, un primer login en un dispositivo sin sesión guardada no los cargaba hasta reiniciar la app. Ahora depende del usuario autenticado.
3. **Enlaces `?r=` (modo solo lectura, sin sesión):** leen `rutinas` y `sesiones` por `alumnoId` con la clave anónima, que es exactamente el acceso que cierra el bloqueo.
   Tras B el enlace cae a la copia de la rutina embebida en el propio enlace (si la tiene) y deja de mostrar sesiones realizadas. Es un cambio de comportamiento deliberado;
   si se usan enlaces `?r=` con alumnos reales, hace falta una decisión de producto (p. ej. exigir inicio de sesión).
4. **Ruido esperado:** el cliente hace `upsert` en `entrenadores` en cada login, también de alumnos; tras B falla en silencio para ellos (solo `console.error`).
5. **Sin cambios necesarios en:** `coach_notification_reads` (no existe; B lo omite), `entrenador_principal` (alcance legacy), la Edge Function y el cambio de contraseña.

## Antes de empezar (sin tocar nada)
1. Backup de la base (Supabase → Database → Backups / PITR) y confirmar que se puede restaurar.
2. Ejecutar `rls_p0_snapshot_readonly.sql` en el SQL Editor y guardar la salida **fuera del repositorio**.
3. Ejecutar `docs/rls-p0-diagnostico-readonly.sql` pegando antes en `coach_uids` los UIDs de `COACH_UIDS`. Solo lectura, para saber qué hay realmente (esto el código no lo confirma): tipos de `alumnos.id` / `*.alumno_id` / `entrenador_id`; políticas y grants
   vigentes (`pg_policies`); si existen `notas`, `coach_notification_reads`; otras tablas de `public` (la migración avisa de las no gestionadas); registro público de Auth.
4. Elegir una **ventana de bajo uso**. Probar primero en un proyecto de Supabase de prueba si se dispone de uno.

## Pasos
1. **Vincular las cuentas de alumnos existentes**, de a una y tras verificar la titularidad, con `scripts/admin/link-alumno.mjs` (dry-run por defecto; ver el README de la función).
   Solo escribe `app_metadata`; no afecta a la versión desplegada. Los alumnos que se creen desde ahora con la función ya quedan vinculados.
2. Aplicar la **migración A** (`...100000_rls_p0_identity.sql`). Es inocua.
3. Cargar los entrenadores, con los **mismos UIDs que el secreto `COACH_UIDS`**:
   ```sql
   INSERT INTO public.coach_accounts(uid) VALUES ('<UID del entrenador>') ON CONFLICT DO NOTHING;   -- uno por entrenador
   ```
4. Aplicar la **migración B** (`...110000_rls_p0_lockdown.sql`). Aborta (sin cambios, es transaccional) si:
   falta A o `coach_accounts` está vacía · hay alumnos con cuenta de Auth (mismo email) **sin vincular** · una cuenta de entrenador figura vinculada como alumno ·
   algún `alumnos.entrenador_id` no es un entrenador de `coach_accounts` ni `entrenador_principal`.
   El email se usa **solo para detectar**, nunca para vincular. Continuar a sabiendas: `SET it.rls_p0_force = 'on';` en la misma sesión (esos alumnos no podrán ingresar).
5. Los tokens de alumno ya emitidos no tienen el vínculo hasta renovarse (≤ 1 h): pedir cerrar sesión y volver a entrar, o esperar.
6. **Humo** (con un alumno y un entrenador de prueba, no reales): el entrenador ve sus alumnos, rutinas, progreso, chat y calendario y asigna una contraseña
   (función → 200); el alumno inicia sesión, ve su rutina, registra una serie, avanza de semana y chatea; un alumno de prueba **no** ve a otro; un usuario autenticado cualquiera no ve nada.
7. Revisar los logs 24 h (403/42501 inesperados).

## Rollback
- **Preferido:** restaurar con el SQL generado por el snapshot (estado exacto previo) en una transacción.
- **Emergencia:** `supabase/rollback/20261025110000_rls_p0_rollback.sql`. Vuelve al estado **inseguro** previo (`acceso_total`); usar solo si la app queda inutilizable y no se
  puede corregir hacia adelante, y re-aplicar B cuanto antes. No toca datos; conserva A (inocua sin las políticas).
- La Edge Function no se modifica en este cambio: no requiere rollback. No volver a desplegar versiones anteriores a la actual (ver su README).

## Riesgos y límites conocidos
- **Pool legacy compartido:** `entrenador_principal` es de *todos* los entrenadores de `coach_accounts`. Con un solo entrenador (hoy) no hay problema; con varios, cada uno ve y puede
  reasignar los alumnos legacy. Aislarlos exige migrar `entrenador_id` a UIDs **y** cambiar el cliente (fuera de este alcance).
- El alumno no puede borrar su progreso ni sus sesiones, ni editar la rutina salvo `datos.semana_activa` (monótona 1..4). Las acciones de reinicio/borrado son del entrenador.
  Si alguna pantalla de alumno las usa, fallarán: confirmar en el humo.
- Un token de alumno sigue siendo válido hasta expirar aunque se retire el vínculo (≤ 1 h).
- `coach_accounts` debe mantenerse sincronizada con `COACH_UIDS` (alta/baja de entrenadores en ambos lugares).
- Tablas futuras: los privilegios por defecto de Supabase conceden acceso a `anon`/`authenticated` a tablas nuevas; revisar RLS y grants de cada tabla nueva.
- Las columnas reales de producción no están versionadas; las pruebas usan un esquema reconstruido.
