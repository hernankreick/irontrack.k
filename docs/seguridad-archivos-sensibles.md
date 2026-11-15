# S-1 — Archivos sensibles versionados: diagnóstico, corrección y controles

Auditoría hecha con el historial **completo** (clon no superficial: 1136 commits, 147 ramas remotas, 0 tags) y con
`scripts/security/secret-scan.mjs --history --profile-details`. Ningún valor se imprimió ni se copió: solo nombres de
variables, tipos, conteos y dominios. Ningún secreto se envió a servicios externos.

> Corrección respecto de la versión anterior de este documento: aquella se basó en un clon superficial y atribuía todo a
> `fef68a9` (31/10). Las fechas reales están abajo.

## ⚠️ Urgente: dos credenciales REALES expuestas (repositorio PÚBLICO)

| # | Credencial | Dónde | Desde | Estado | Riesgo |
|---|---|---|---|---|---|
| 1 | **Clave REST API de OneSignal** (`os_v2_app_…`, 113 caracteres) | `hooks/useAlumnos.js:7` en **`main` hoy**, 146/147 ramas, 9 versiones del archivo y 21 bundles `dist/` del historial; casi seguro también en el JavaScript de producción (se envía como `Authorization: Basic` desde el navegador) | `0747946` · 2026-03-21 | **ACTIVA** (no hay evidencia de rotación) | **CRÍTICO**: cualquiera puede enviar notificaciones push a todos los suscriptores de la app y usar la API de esa app de OneSignal |
| 2 | **Contraseña por defecto de la cuenta del entrenador** (13 caracteres, junto a su email; además se mostraba en la pantalla de login) | `App.jsx` (quitada de `main` en `caae90d`, 2026-10-20, IT-001) · sigue en 58/147 ramas y 29 commits; también en `scripts/e2e-phase1.mjs`, `tests/rls/README.md` y `docs/despliegue-rls-p0.md` de ramas RLS | `0747946` · 2026-03-21 | **Vigencia desconocida**: el `signUp` automático creaba la cuenta de Auth con esa contraseña; no hay registro de que se haya cambiado (no se verificó usándola: prohibido) | **CRÍTICO si sigue vigente**: acceso completo como entrenador a los datos de todos los alumnos |

No hay evidencia de uso indebido de ninguna de las dos. El control nuevo detecta ambas formas (`onesignal-rest-key`,
`code-password`); la clave de OneSignal figura en `scripts/security/known-findings.json` como **conocida pendiente**
(se informa en cada corrida y no bloquea el CI; cualquier otro secreto sí).

## Diagnóstico de los archivos del hallazgo S-1 original

| Ruta | Entró | Salió del índice | Contenido verificado | Riesgo |
|---|---|---|---|---|
| `.env` (1 versión, blob `6a7bdfd27e`) | `1c140b7` · 2026-03-24 | este PR (S-1) | `VITE_SUPABASE_URL` (URL del proyecto, no secreta) y `VITE_SUPABASE_ANON_KEY` = clave `sb_publishable_` (**pública por diseño**: va igual en el JavaScript de producción) | **BAJO** (sin secretos privados). Operativo: Production podía depender de este archivo |
| `.chrome-headless/` (perfil de Chromium) | `fa38440` · 2026-04-18 | `2373b44` · 2026-11-14 (#194) | `Cookies`: 0 filas · `Login Data`: 0 filas · `History`: 4 URLs `file://` locales · ningún JWT ni token de proveedor en ningún archivo (incluidos `Local Storage`, `Session Storage` y volcados de Crashpad) | **BAJO** (higiene; no hay sesiones ni contraseñas) |
| `.chrome-scroll-test/` (5 archivos: volcado `.dmp` de Crashpad, metadatos, `Variations`) | `2788c56` · 2026-04-28 | este PR (S-1) | ningún JWT ni token en los blobs | **BAJO** |
| `qa/stack.sh` (solo en una rama sin fusionar) | `899f847` · 2026-10-10 | — | `GOTRUE_JWT_SECRET` = referencia a variable de shell (`"$VAR"`), no un literal | **Falso positivo** |
| `node_modules/` (7424 archivos) | — | pendiente (PR aparte) | dependencias de terceros, sin hallazgos de ruta | Higiene, no secretos |

No se encontró (escáner + verificación independiente de los 10396 blobs, binarios incluidos): clave `service_role`,
`sb_secret_`, token personal `sbp_`, tokens de GitHub/Stripe/AWS, llaves privadas, cadenas Postgres con contraseña ni
JWT de sesión (`authenticated`). Tokens de Vercel: sin coincidencias por nombre de variable ni por prefijo conocido (no
tienen un formato fijo verificable: hipótesis razonable, no certeza). Sesiones activas: ninguna.

Información **pública para siempre** (por diseño o por el historial), riesgo BAJO/MEDIO, no secreta:
- La URL del proyecto de Supabase de producción, la clave `sb_publishable_` y el JWT `anon` legacy aparecen en `.env`,
  `env.example`/`.env.example` antiguos y bundles `dist/` históricos. `config/env-targets.json` guarda solo hashes, pero el
  host ya es público por el historial (MEDIO: no da acceso).
- UUIDs de usuarios y el email del entrenador en documentación/SQL (identificadores, no credenciales).
- Lo que protege los datos con la clave pública es **RLS** (hallazgo S-2, RLS v1 preparada en #193): rotar la clave
  pública no aporta seguridad mientras esté, por diseño, en el bundle.

## Antes de hacer `git pull` de S-1
Al traer este cambio, Git **borra el `.env` local** de cada clon (deja de estar versionado). Antes del pull: copialo a
`.env.local` (ignorado), que Vite lee igual.

## Qué cambió en S-1
- `git rm --cached .env` y `git rm -r --cached .chrome-scroll-test` (los archivos **siguen en disco** local).
- `.gitignore`: perfiles (`.chrome-*/`, `.chromium-*/`, `.playwright-*/`), volcados (`*.dmp`, `Crashpad/`), llaves
  (`*.pem`, `*.key`, `*.p12`, `id_rsa*`, ...), `.npmrc`, `.supabase/`, `supabase/.temp/`, `*.env` (salvo plantillas).
- `.env.example`: aclara que en `VITE_*` solo va la clave pública; nunca `service_role` ni `sb_secret_`.
- **Control permanente** `scripts/security/secret-scan.mjs` (sin dependencias ni red; nunca imprime valores):
  - CI: paso «Secret scan (archivos versionados)» en `test-and-build` + suite `scripts/test-secretScan.mjs`.
  - `scripts/test-envTracking.mjs` ya no tolera `.env` («deuda conocida» eliminada) y falla con cualquier perfil de navegador.
  - Local (opcional, una vez por clon): `git config core.hooksPath .githooks` → bloquea commits con secretos (`--staged`).
  - Auditoría: `node scripts/security/secret-scan.mjs --history [--profile-details] [--json]`.
  - CI de cada PR: además del árbol final, `--range base..head` revisa los blobs de **todos** los commits del PR.
  - Excepción para datos **ficticios**: comentario `secret-scan: allow` en la misma línea, solo en `scripts/test-*.mjs` o
    `fixtures/`, y **nunca** para hallazgos CRÍTICOS.
  - Secretos reales ya expuestos y pendientes del dueño: `scripts/security/known-findings.json` (ruta + regla + huella;
    sin valores). Se informan en cada corrida; el CI avisa cuando una entrada ya no aplica para quitarla.
  - Si git falla o la salida se trunca, sale con código 2 (nunca un «0 hallazgos» falso).
  - Límite conocido: una contraseña escondida tras una variable (`x = guardado || "literal"`) no siempre se detecta; la
    regla `code-password` cubre `password: "…"`, `pass === "…"` y similares en el código de la app.

## Antes de fusionar S-1 (dueño)
`lib/envTargetGuard.js` tomaba el `.env` versionado como valor efectivo de **Production** si el panel de Vercel no
definía las variables. Confirmá en Vercel → Project → Settings → Environment Variables (ámbito **Production**) que existen
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Si faltan, el build de Production **falla** (reglas P1/P3) y Vercel
mantiene el despliegue anterior: no hay caída, pero tampoco se publica. Las Preview ya usan variables del panel
(la regla R1 bloquea Preview con `.env` y las Preview pasan).

## Historial
Todos los archivos de la tabla siguen accesibles en commits anteriores (y en clones/forks hechos desde 2026-03-24).
Para los archivos del S-1 original (`.env`, perfiles) **no** es necesario por seguridad: no contienen secretos privados ni
sesiones. Para la clave de OneSignal y la contraseña del entrenador la reescritura **tampoco alcanza**: el repo es público
desde 2026-03-21 y pudo clonarse; la única protección real es **rotar**. Tras rotar, el valor del historial queda inválido. Si se
quisiera por higiene/tamaño (~11 MB de perfil + `node_modules`), procedimiento (solo el dueño, con autorización expresa):
1. Avisar que se cerrarán/rehacen los PR abiertos; congelar merges.
2. Clon espejo nuevo: `git clone --mirror <url> it.git && cd it.git`.
3. `git filter-repo --invert-paths --path .env --path .chrome-headless --path .chrome-scroll-test` (y `--path node_modules` si se decide);
   para los valores, `--replace-text` con un archivo local de reemplazos (nunca versionado), recién DESPUÉS de rotar.
4. Verificar: `node scripts/security/secret-scan.mjs --history` (desde un clon del resultado) sin hallazgos de ruta.
5. Push forzado manual por el dueño (el flujo de agentes lo tiene denegado). Impacto: cambian todos los hashes desde
   2026-03-24, se rompen ramas/PR abiertos y clones; los forks y `refs/pull/*` de GitHub conservan los blobs hasta que
   soporte de GitHub los purgue.

## Rotación (orden)
1. **OneSignal (hoy):** OneSignal → la app → Settings → Keys & IDs → generar una REST API key nueva y revocar la anterior.
   Consecuencia: el envío de push desde el navegador **deja de funcionar** hasta mover el envío al servidor. La rama
   `claude/onesignal-security-fix-t3ij3x` (sin fusionar, 2026-10-10) ya lo hace con la Edge Function `notify-alumno`
   (la clave nueva vive en los secretos de la función, nunca en el bundle). Orden recomendado: desplegar la función con la
   clave nueva → fusionar el cambio del cliente → revocar la clave vieja (o revocar ya y aceptar push caídas un tiempo).
2. **Contraseña del entrenador (hoy):** iniciar sesión y cambiarla (o desde Supabase → Authentication → Users → la cuenta
   → reset), cerrar las demás sesiones y revisar `last_sign_in_at` en busca de accesos no reconocidos. Consecuencia:
   ninguna para la app (la contraseña ya no está en el código desde IT-001).
3. Nada más requiere rotación: la clave `sb_publishable_`/anon es pública por diseño; no se halló ninguna clave privilegiada.

Si en el futuro el escáner reporta un CRÍTICO: rotar primero, después retirar el archivo y recién entonces evaluar el historial.

## Fuera de alcance de esta auditoría
Los repositorios públicos `hernankreick/irontrack`, `irontrack_2.0` e `irontrack_3.0` (anteriores) no se auditaron.
