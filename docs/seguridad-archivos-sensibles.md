# S-1 — Archivos sensibles versionados: estado y procedimiento

Estado verificado solo con metadatos de git (no se leyó el contenido de `.env` ni de `.chrome-headless/`).

## Qué había
Todo entró de una vez en `fef68a9` (#139, 2026-10-31) y sigue en el historial:

| Ruta | Archivos | Riesgo |
|---|---|---|
| `.chrome-headless/` | 198 (~11 MB): perfil completo de Chromium (`Cookies`, `Login Data`, `History`, `Web Data`, `Local Storage`, `Session Storage`, `Sync Data`) | Sesiones, contraseñas guardadas, historial y posibles tokens/PII de alumnos |
| `.env` | 1 (129 B, 2 líneas) | Solo se puede asumir que contiene las variables `VITE_*` (públicas por diseño). **No verificable sin leerlo** |
| `node_modules/` | 7424 (~98 MB, binarios de otra plataforma) | Higiene (no secreto). CI y Vercel usan `npm ci`, no dependen de esta copia |

## Qué hace este PR
- `git rm --cached` de `.chrome-headless/` (los archivos **siguen en disco**) y reglas `.chrome-headless/` y `.chrome-*/` en `.gitignore`.
- **Esto NO soluciona la exposición**: los archivos siguen accesibles en el historial (`fef68a9`), en clones y en forks.

## Qué NO se hizo (requiere al dueño)
1. **Rotar primero** (la rotación es la única garantía real):
   - Verificar localmente, sin pegar valores en ningún chat: `cut -d= -f1 .env` (solo nombres). Si algún nombre contiene `SERVICE_ROLE`, `SECRET` o `TOKEN`, o un valor con forma de JWT decodifica a `role: service_role`, o empieza por `sb_secret_`: **P0, rotar de inmediato** en Supabase.
   - `VITE_SUPABASE_ANON_KEY` es pública por diseño; rotarla solo si RLS es incompleta (ver S-2).
   - Cerrar las sesiones de cualquier servicio donde se haya iniciado sesión con ese Chrome (Supabase, Vercel, GitHub, Google) y cambiar las contraseñas guardadas en él.
   - Si el perfil tuvo sesiones de alumnos reales, evaluar si corresponde notificar por privacidad.
2. **Destrackear `.env`**: antes, definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el panel de Vercel (Production). Hoy `lib/envTargetGuard.js` usa el `.env` versionado como valor efectivo de Production: sin las variables en Vercel, el siguiente build de Production **fallará** (el despliegue anterior seguiría activo). Después: `git rm --cached .env`.
3. **Destrackear `node_modules/`** (`git rm -r --cached node_modules`): seguro para CI/Vercel (`npm ci`); genera un diff de 7424 borrados, por eso va en un PR aparte.
4. **Reescribir el historial** (solo con autorización explícita y después de rotar), sobre un clon espejo nuevo:
   `git filter-repo --invert-paths --path .env --path .chrome-headless --path node_modules`, luego push forzado a mano por el dueño (el flujo de agentes lo tiene denegado). Advertencias: cambia los hashes de los 50 commits y rompe PRs abiertos; los forks/clones conservan los blobs; GitHub mantiene `refs/pull/*` y cachés hasta que soporte los purgue; el repo pudo ser clonado desde el 2026-10-31.
5. Verificación posterior: `git ls-files | grep -cE '^(\.env$|\.chrome-headless|node_modules)'` = 0 y `git rev-list --all -- .env` vacío.
