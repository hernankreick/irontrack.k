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

- Interfaz: `startStudentWorkout` y `logSet` (App.jsx) y `finalizarSesion` (WorkoutScreen.jsx) rechazan con aviso.
- El `alumnoId` del enlace ya no se usa para escribir. Se eliminó la escritura de `sesiones` desde el enlace.
- Capa de datos: `guardSharedWrites(sb)` bloquea `addProgreso`, `addSesion`, `addFoto`, `deleteFoto`,
  `updateRutinaSemanaActiva` y los `deleteProgreso*` / `deleteSesiones*` (`lib/sharedMode.js`).
- Las lecturas (rutina, sesiones, progreso, fotos) no cambian.
- Es una barrera del cliente. No sustituye a la RLS (que sigue sin modificarse).
- **No se bloquea el chat** (`Chat.jsx` → `sb.addMensaje`): no es entrenamiento. Queda como riesgo pendiente.

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
