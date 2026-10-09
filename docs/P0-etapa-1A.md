# P0 Etapa 1A: preparación para la cola persistente de series

Alcance: proteger las series pendientes, dejar los enlaces compartidos en solo lectura y endurecer la coordinación del
módulo `lib/pendingSets.js`. **No** integra la cola con `logSet` ni con `flushPendingSync`, no envía nada nuevo a
Supabase, no toca Auth, RLS ni Edge Functions y no agrega llamadas a `supabase.auth.signOut()`.

## 1. Claves protegidas

Toda clave que reconoce `isPendingSetsKey` (prefijo `it_pending_sync`) sobrevive a login, logout, cambio de alumno y
reinicio de historial, y queda fuera de "Exportar datos":

| Clave | Contenido |
|---|---|
| `it_pending_sync:item:<uuid>` | registro inmutable de una serie |
| `it_pending_sync:meta:<uuid>` | estado (intentos, error, status) |
| `it_pending_sync_legacy:<uuid>` | cuarentena (un registro antiguo por clave) |
| `it_pending_sync:migration` | diario de migración |
| `it_pending_sync:lease:*` | lease consultivo |
| `it_pending_sync_raw:<ts>` | copia literal de la cola antigua si la migración no pudo completarse |
| `it_pending_sync` | cola ANTIGUA (array) |

**La cola antigua no se deja como array.** Si siguiera ahí, el vaciado antiguo de `App.jsx` (que envía bajo el alumno de la
sesión actual) podría sincronizar series de un alumno como si fueran de otro. En login y logout
(`lib/irontrackLocalStorage.js`, `preserveLegacyPendingQueue`) se traslada, sin modificarla, a la cuarentena. Se conserva,
pero nunca se envía sola (D7). Si ni la migración ni la copia literal son posibles, el array queda intacto.

## 2. Puntos de logout (donde habrá que integrar el cierre seguro de Auth junto con S0.6)

En esta etapa estos puntos solo **conservan** las claves de series pendientes. No se agregó `signOut()`.

| Archivo y línea | Flujo | `signOut` hoy |
|---|---|---|
| `App.jsx:2917` | confirmación `logout` / `logoutSettings` del entrenador | no |
| `App.jsx:3274` | `handleCoachLogout` | no |
| `App.jsx:3532` | `onLogout` del alumno | no |
| `App.jsx:3564` | `onCoachLogout` | no |
| `components/settings/SettingsPage.jsx:378` (`doLogout`) | logout desde Ajustes | **sí** (ya existía) |
| `App.jsx:3142` | rechazo del login de alumno sin ficha | sí (ya existía) |

Login (limpieza de sesión): `App.jsx:3053` (entrenador) y `App.jsx:3122` (alumno), ambos con
`clearIronTrackStorageForNewLogin()`.

A integrar después (no en esta etapa): un cierre de sesión central que (1) intente un último vaciado de la cola del alumno,
(2) llame a `supabase.auth.signOut()`, (3) limpie con `clearAllIronTrackPrefixedKeys()`. Debe coordinarse con S0.6, que no
modifica ninguno de estos puntos de logout pero sí reconstruye la sesión del alumno por `auth_uid`
(`lib/studentIdentity.js`). Con S0.6, un fallo de red en la restauración borra `it_session` y manda al login: las series
pendientes sobreviven gracias a la protección de claves.

## 3. Enlaces compartidos (`?r=`): solo lectura

Un visitante con un enlace `?r=` no está autenticado. Puede **consultar** lo que el enlace ya mostraba (rutina, sesiones, progreso,
fotos, chat) pero **no escribir nada**, aunque en el navegador haya una sesión de Supabase Auth de otra persona.

Escrituras alcanzables desde ese modo (auditadas en el código) y su defensa:

| Escritura | Dónde | Defensa |
|---|---|---|
| Iniciar entrenamiento | `startStudentWorkout` (`App.jsx`) | rechaza con aviso |
| Registrar series | `logSet` (`App.jsx`) | rechaza con aviso; el `alumnoId` del enlace ya no se usa |
| Finalizar sesión / crear `sesiones` | `finalizarSesion` (`WorkoutScreen.jsx`) | rechaza; se eliminó la escritura desde el enlace |
| Enviar mensajes (chat) | `Chat.jsx` → `sb.addMensaje` | caja de texto reemplazada por aviso; `enviar` sale sin escribir |
| Marcar mensajes como leídos | `ChatFlotante.jsx`, `Chat.jsx` → `sb.marcarMensajesLeidos` | no se llama en modo compartido |
| Subir fotos | `ProgressPhotosPanel.jsx` → `sb.addFoto` | sin input ni botones; `subirFoto` sale |
| `upsert` en `entrenadores` con la sesión de Auth persistida | efecto de Auth de `App.jsx` | el efecto no corre en modo compartido |
| Cualquier otra escritura de `sb` | `guardSharedWrites(sb)` | lista explícita (ver `lib/sharedMode.js`); un test verifica que toda función `add*/create*/update*/delete*/set*/save*/marcar*/reconcile*` esté en la lista |
| Cualquier escritura por `sbFetch` | `sbFetch` (`App.jsx`) | rechaza todo método distinto de GET/HEAD/OPTIONS |
| Cualquier escritura por el cliente supabase-js | `lib/supabaseClient.js` (`global.fetch`) | responde 403 sin tocar la red para escrituras a `/rest/v1`, `/functions/v1` y `/storage/v1`; **`/auth/v1` no se toca** (login y refresco de token) |

El chat sigue siendo **legible** desde el enlace (como antes). Si eso es deseable es una decisión de producto aparte.
Es una barrera del **cliente**: no sustituye a la RLS, que no se modificó.

## 4. Web Locks (`lib/pendingSets.js`)

- Web Locks disponible → exclusión mutua real.
- Web Locks disponible pero falla antes de empezar → no se envía nada (`stopped: "lock_error"`), las series quedan intactas.
  No hay degradación silenciosa.
- Sin Web Locks → `flush` no envía (`stopped: "no_web_locks"`, `coordination: "unavailable"`) salvo `advisoryFallback: true`,
  que solo debe habilitarse tras validar la idempotencia en un entorno aislado (D6).
- `flush` y `migrate` informan siempre el modo de coordinación usado.
- `migrateSync()` es la variante síncrona sin lock para limpiezas de almacenamiento.

## 5. Pruebas

```
node scripts/test-pendingSets.mjs
node scripts/test-pendingStoragePreservation.mjs
node scripts/test-sharedReadOnly.mjs
```
