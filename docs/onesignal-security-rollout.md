# OneSignal: mover el envío al servidor y rotar la clave privada

Estado: **preparado, NO desplegado**. Nada de esto se ejecutó contra Supabase ni OneSignal.

## Qué cambia
- `hooks/useAlumnos.js`: `notifyAlumno(alumnoId, mensaje)` ya no llama a OneSignal ni contiene la clave; invoca `supabase.functions.invoke('notify-alumno', { body: { alumnoId, mensaje } })` (el SDK adjunta el JWT de la sesión). Misma firma, mismo texto de push, sin cambios visuales.
- `supabase/functions/notify-alumno/` (`index.ts` + `core.js`): valida el JWT, exige cuenta de entrenador, lee el alumno de la base con service role y verifica pertenencia; el `onesignal_id` destino sale de la base, nunca del cliente.
- El App ID de OneSignal es público (ya va en el bundle web para el SDK) y se mantiene.
- Hallazgo: hoy `notifyAlumno` **no se invoca desde ninguna pantalla** (solo se desestructura en `App.jsx`). La clave estaba expuesta en el bundle igualmente, pero no hay un flujo de notificaciones activo que se interrumpa al rotarla.

## Autorización (orden de chequeos)
1. Sin `Authorization: Bearer` → 401. JWT inválido/expirado o clave anon → 401 (validado con `auth.getUser`).
2. **`COACH_USER_IDS` es obligatorio** (UIDs de Supabase Auth separados por comas). Ausente, vacío o con el UID del caller fuera de la lista → 403 para todos (falla cerrado). No se usa `user_metadata.role` ni la tabla `entrenadores`.
3. El alumno se lee de la base por `alumnoId`; no existe o no es suyo → 403 (misma respuesta, no revela ids).
4. Pertenencia: `alumnos.entrenador_id` = UID del caller. Para alumnos legacy (`entrenador_principal`), que no tienen dueño individual demostrable, solo el **UID principal**: `PRINCIPAL_COACH_UID` si está definido (debe estar en la lista), o el único UID de `COACH_USER_IDS` si la lista tiene uno solo. Con varios UIDs y sin `PRINCIPAL_COACH_UID`, el caso legacy se deniega.
5. El `onesignal_id` destino sale de la base. Sin `onesignal_id` → 200 `sent:false` (igual que el cliente anterior).

## Dependencias y riesgos antes de desplegar
1. **Secretos obligatorios antes del paso de despliegue del frontend**: `COACH_USER_IDS` (UID real del entrenador, obtenerlo en Supabase Auth → Users) y `ONESIGNAL_REST_API_KEY`. Sin `COACH_USER_IDS` la función rechaza todo.
2. **Identidad canónica**: conviven el UID de Auth y `entrenador_principal` (casi todos los alumnos). Está resuelto restringiendo el legacy a un único UID principal; si se suma un segundo entrenador, definir `PRINCIPAL_COACH_UID` y migrar `entrenador_id` a UID (fuera de alcance).
3. **Tabla `alumnos`**: se asumen las columnas `id, entrenador_id, onesignal_id` (las que ya usa el cliente).
4. **JWT**: dejar activa la verificación de JWT de la plataforma (default); no desplegar con `--no-verify-jwt`.
5. **CORS** `*`, igual que `update-alumno-password`; la autorización real es el JWT + lista.
6. **Alcance real**: `notifyAlumno` no se invoca desde ninguna pantalla ni flujo (solo se define en `hooks/useAlumnos.js` y se desestructura en `App.jsx`). Revocar la clave vieja no interrumpe ninguna funcionalidad activa conocida. El registro de suscripciones push (alta del `onesignal_id` al loguear el alumno y `OneSignal.init`) usa solo el App ID público y no depende de la clave REST.
7. **Clientes con bundle viejo / PWA en caché** conservan la clave en su bundle; tras revocarla, esos envíos (hoy inexistentes) fallarían en silencio.
8. **La clave sigue en el historial de git**: quitarla del código no la invalida; la rotación es obligatoria. No hace falta reescribir historial si se rota.
9. **Nota de repo**: `node_modules/` está versionado en git, con binarios de Windows; por eso `vite build` y 2 tests no corren en Linux sin reinstalar. La verificación se hizo en una copia con `npm ci` (build OK, bundle sin claves, 15/15 scripts). No se tocó `node_modules` del repo.

## Orden seguro de despliegue (requiere autorización explícita; cada paso lo ejecuta una persona)
1. En OneSignal: **crear una clave nueva**. **No borrar la vieja todavía.**
2. `supabase secrets set ONESIGNAL_REST_API_KEY=<clave nueva> COACH_USER_IDS=<uid del entrenador>` (opcional `PRINCIPAL_COACH_UID`). Ingresarlos en terminal/panel, no en archivos.
3. `supabase functions deploy notify-alumno`. Probar con una cuenta de entrenador real sobre un alumno de prueba propio (envía un push real, solo en el caso legítimo) y verificar 403/401/401 con alumno, anónimo y token inválido.
4. Desplegar el frontend (esta rama, tras revisión y merge). Desde acá el cliente no lleva clave.
5. Dar margen para que los clientes/PWA carguen el bundle nuevo.
6. En OneSignal: **eliminar la clave vieja** (la expuesta).
7. Verificar que un push legítimo llega y revisar logs de la función por 401/403 inesperados.

Interrupciones posibles: hacer el paso 6 antes de 3–4 corta los envíos hasta desplegar; tras el 6, un cliente con bundle viejo no envía pushes (silencioso). Por eso el orden.

## Reversión
- Falla de la función (403/500 con coach legítimo) antes del paso 6: la clave vieja sigue válida, se puede redeployar el frontend anterior; corregir la función y reintentar.
- Después del paso 6 no se restaura la clave vieja (está comprometida): se corrige la función o se crea otra clave y se actualiza el secreto (`supabase secrets set`), sin redeploy del frontend.
- La función es aditiva: `supabase functions delete notify-alumno` no afecta nada más.

## Pruebas
`node scripts/test-notifyAlumnoFunction.mjs` — 23 casos en memoria, sin red ni envíos reales: entrenador legítimo (legacy y UID propio), alumno que intenta enviar, anónimo, clave anon, alumno ajeno/inexistente, token inválido, `COACH_USER_IDS` ausente/vacío/incorrecto, UID no listado, `user_metadata.role` ignorado, reglas del UID principal legacy, destino del cliente ignorado, validación, fallos de infraestructura, CORS y ausencia de claves `os_v2_app_…` y de UIDs literales. Pendiente: prueba end-to-end contra un Supabase de staging (infraestructura externa no disponible) y ejecución de la función bajo Deno.
