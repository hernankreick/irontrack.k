# Separar Preview y Production (Vercel + Supabase)

Estado de partida (verificado en el repo y confirmado por el propietario):
- `.env` estaba versionado y apuntaba a producción; `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` están en Vercel como **All Environments** ⇒ todo Preview usa la base de producción.
- Este cambio (local, sin desplegar) agrega: `.env` fuera del índice y en `.gitignore`, `.env.example` sin valores reales, conexión **sin valores de respaldo**
  (`lib/supabaseEnv.js`), aviso en pantalla y cero peticiones cuando faltan las variables, y controles de build (`scripts/buildEnvGuard.mjs`):
  | Entorno de build | Sin variables | Con variables de producción | Con variables de QA/locales |
  |---|---|---|---|
  | Production (`VERCEL_ENV=production`) | **falla** (mensaje claro) | OK | OK |
  | Preview (`VERCEL_ENV=preview`) | OK, app **inerte** (sin base) | **falla** (salvo `VITE_ALLOW_PROD_IN_PREVIEW=1`) | OK |
  | Local (`npm run dev/build`) | OK, inerte | OK | OK |

## Qué puede afectar a lo ya desplegado
- Cambiar variables en Vercel **no altera despliegues ya construidos**: `VITE_*` se incrustan al compilar. Los Production y Previews existentes siguen igual hasta el próximo build.
- El riesgo está en el **próximo build**: si Production perdiera las variables, el nuevo guard hace fallar ese build (falla segura: el despliegue vigente sigue sirviendo). Por eso: **no borrar ni renombrar** las variables; solo recortar sus entornos.
- **Variables compartidas del equipo**: si estas variables están vinculadas desde *Team → Settings → Environment Variables* (en vez de ser del proyecto), editarlas afecta a **todos los proyectos vinculados** (p. ej. otros proyectos del equipo). En ese caso no editar la compartida: crear una variable del proyecto con el mismo nombre solo en Preview (la del proyecto prevalece) o desvincularla de este proyecto.
- **Promote / Instant Rollback**: un Preview construido sin variables es inerte; **nunca promoverlo a Production**. Instant Rollback reasigna un despliegue anterior sin recompilar (no se ve afectado por las variables).
- `VERCEL_ENV` debe estar disponible en el build (*Settings → Environment Variables → "Automatically expose System Environment Variables"*, activo por defecto). Si se desactiva, los guards degradan a avisos.
- Quien tenga el repo clonado y haga `git pull` del commit que quita `.env` **perderá su `.env` local**: antes de actualizar, `cp .env .env.local` (Vite lo carga y ya está ignorado).
- La historia de git no se reescribe: el `.env` y el `env.example` anteriores quedan en commits viejos. La clave anon/publishable es pública por diseño (va en el bundle); la protección real es RLS. Rotarla es opcional.

## Procedimiento (aplicar DESPUÉS de revisar y subir el código; cada paso lo ejecuta una persona)
**0. Solo lectura / respaldo**
1. Vercel → proyecto → *Deployments*: anotar el despliegue de Production vigente (objetivo de Instant Rollback).
2. *Settings → Environment Variables*: captura de pantalla de las variables `VITE_SUPABASE_*` y de dónde están definidas (proyecto o equipo). CLI opcional de solo lectura: `vercel env ls` (lista nombres y entornos, **no** valores). No usar `vercel env pull` (trae credenciales a la máquina).
3. En local: `cp .env .env.local` si trabajás con producción en desarrollo (mejor: apuntar el desarrollo al stack local, ver `qa/README.md`).

**1. Recortar entornos (sin tocar Production)**
4. En cada variable `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (del proyecto): *Edit* → dejar marcado **solo Production**; desmarcar **Preview** y **Development**. No cambiar el valor. Guardar.
   (*Development* se desmarca para que `vercel env pull`/`vercel dev` no entreguen credenciales de producción.)
5. Confirmar con `vercel env ls` (o la UI) que ambas quedan solo en Production.

**2. Preview sin acceso funcional (opción por defecto, sin base QA)**
6. No definir nada en Preview. Con el código nuevo, un Preview compila en modo inerte: muestra "Entorno sin base de datos configurada" y no emite peticiones a Supabase.
7. (Opcional, cuando exista un proyecto QA) definir en Preview, o solo para la rama `qa`, `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` del proyecto QA. El guard rechaza cualquier Preview que apunte al ref de producción.

**3. Subir el código y verificar**
8. Subir este cambio. Production se compila con sus variables (el guard exige que existan). Si el build de Production falla con "Build de PRODUCCION sin conexion…", revisar el paso 4 (Production debe seguir marcado) y reintentar; el despliegue anterior sigue activo.
9. Abrir un Preview nuevo (rama cualquiera): debe verse el aviso rojo en el login y, en DevTools → Network, **ninguna** petición a `*.supabase.co`. (Previews anteriores a este cambio no se reconstruyen solos; si siguen apuntando a producción, eliminarlos o redesplegarlos.)
10. Production: smoke test de lectura por el propietario (login y dashboard). No hace falta redeploy adicional.

**Reversión**
- Si algo falla con Production: Instant Rollback al despliegue anotado en el paso 1. Si faltó una variable, volver a marcar *Production* en esa variable.
- Si se necesita temporalmente que un Preview use producción (no recomendado): marcar *Preview* de nuevo **y** definir `VITE_ALLOW_PROD_IN_PREVIEW=1` solo en Preview.

## Relación con el despliegue de RLS P0
- Esta separación es independiente y **conviene hacerla antes** del backfill/migraciones de RLS: evita que un Preview (con credenciales reales de alumnos/entrenador) opere sobre producción mientras se despliega.
- No modifica la secuencia de `tests/rls/README.md`.
