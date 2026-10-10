# OneSignal: mover el envío al servidor y rotar la clave privada

Estado: **preparado, NO desplegado**. Nada de esto se ejecutó contra Supabase ni OneSignal.

## Qué cambia
- `hooks/useAlumnos.js`: `notifyAlumno(alumnoId, mensaje)` ya no llama a OneSignal ni contiene la clave; invoca `supabase.functions.invoke('notify-alumno', { body: { alumnoId, mensaje } })` (el SDK adjunta el JWT de la sesión). Misma firma, mismo texto de push, sin cambios visuales.
- `supabase/functions/notify-alumno/` (`index.ts` + `core.js`): valida el JWT, exige cuenta de entrenador, lee el alumno de la base con service role y verifica pertenencia; el `onesignal_id` destino sale de la base, nunca del cliente.
- El App ID de OneSignal es público (ya va en el bundle web para el SDK) y se mantiene.
- Hallazgo: hoy `notifyAlumno` **no se invoca desde ninguna pantalla** (solo se desestructura en `App.jsx`). La clave estaba expuesta en el bundle igualmente, pero no hay un flujo de notificaciones activo que se interrumpa al rotarla.

## Autorización (orden de chequeos)
1. Sin `Authorization: Bearer` → 401. JWT inválido/expirado o clave anon → 401.
2. Cuenta de entrenador: existe en `entrenadores` (el login del coach hace upsert de su UUID de Auth), **no** es el email de ningún alumno y, si se define `COACH_USER_IDS`, está en esa lista → si no, 403.
3. Alumno leído por `alumnoId` desde la base; no existe o no es suyo → 403 (misma respuesta, no revela ids).
4. Pertenencia: `alumnos.entrenador_id` = UUID del caller **o** `'entrenador_principal'` (esquema legacy; mismo criterio que `update-alumno-password`).
5. Sin `onesignal_id` → 200 `sent:false` (igual que el cliente anterior).

## Dependencias y riesgos antes de desplegar
1. **Identidad canónica del entrenador (principal riesgo).** Conviven el UUID de Auth y el string `entrenador_principal`, que usan casi todos los alumnos. Con el legacy, *cualquier* cuenta de entrenador puede notificar a *cualquier* alumno legacy (test 4c). Es aceptable con un solo entrenador real; deja de serlo si se agrega otro. Solución definitiva (fuera de alcance): migrar `alumnos.entrenador_id` a UUID.
2. **Qué es "cuenta de entrenador".** La app no tiene un rol confiable: `user_metadata.role` lo puede editar el propio usuario y el login usa `signUp` con la clave anon. Por eso la función se apoya en la tabla `entrenadores`. **Verificar antes de desplegar** si las políticas RLS de `entrenadores` dejan que un alumno autenticado inserte su propia fila; la función ya lo frena si su email figura en `alumnos`, y definir `COACH_USER_IDS` con el UUID del coach lo cubre del todo. Endurecer RLS es tarea aparte (no se tocó).
3. **Tabla `alumnos`**: se asumen las columnas `id, entrenador_id, email, onesignal_id` (las que ya usa el cliente).
4. **JWT**: dejar activa la verificación de JWT de la plataforma (default); no desplegar con `--no-verify-jwt`. El código además valida con `auth.getUser`.
5. **CORS** `*`, igual que `update-alumno-password`; la autorización real es el JWT.
6. **Clientes con bundle viejo / PWA en caché** seguirán usando la clave vieja hasta rotarla; tras rotar, sus envíos fallan en silencio (están en `try/catch`). Hoy ninguna pantalla lo dispara.
7. **La clave sigue en el historial de git.** Quitarla del código no la invalida: la rotación es obligatoria. No hace falta reescribir historial si se rota.
8. **Verificación pendiente en CI/local**: `vite build` no pudo ejecutarse en el entorno de preparación (`node_modules` instalado para Windows: faltan binarios nativos de rollup/esbuild). Por lo mismo `test-trainingVolume` y `test-weekGateLabels` ya fallaban antes de este cambio. Correr build y suite completa antes de desplegar.

## Orden seguro de despliegue (requiere autorización explícita; cada paso lo ejecuta una persona)
1. En OneSignal: **crear una clave nueva**. **No borrar la vieja todavía.**
2. `supabase secrets set ONESIGNAL_REST_API_KEY=<clave nueva>` (opcional `COACH_USER_IDS=<uuid del coach>`). Ingresarla en terminal/panel, no en archivos.
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
`node scripts/test-notifyAlumnoFunction.mjs` — 19 casos en memoria, sin red ni envíos reales: entrenador legítimo (legacy y UUID), alumno que intenta enviar, anónimo, clave anon como Bearer, alumno ajeno/inexistente, token inválido, destino enviado por el cliente ignorado, validación, fallos de infraestructura, CORS, regla real de cuenta de entrenador, y ausencia de claves `os_v2_app_…` en el repo. No ejecutada: prueba end-to-end contra un Supabase de staging.
