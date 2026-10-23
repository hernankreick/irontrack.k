# Coordinación entre carriles (UI/UX y general)

Dos carriles independientes, sin anidar coordinadores. Este documento es el **único procedimiento** de enrutamiento, publicación y actualización. No cambia permisos, hooks ni `settings.json`: lo que está bloqueado sigue bloqueado.

## 1. Carriles y a quién va cada tarea
| | Carril UI/UX | Carril general |
|---|---|---|
| Coordinador (hilo principal) | `ui-coordinator` (`claude --agent ui-coordinator`) | `irontrack-orchestrator` (`claude --agent irontrack-orchestrator`) |
| Agentes | `ui-implementer`, `ui-qa`, `pr-publisher` | `irontrack-auditor`, `-data`, `-security`, `-fixer`, `-qa` |
| Recibe | Estilos, clases, layout, accesibilidad, textos de interfaz, tamaños táctiles, QA visual: archivos en `components/**`, `index.css`, `public/**`, `assets/**`, `scripts/test-*.mjs`, `scripts/qa/**` | Todo lo demás: `lib/`, `App.jsx`, `hooks/`, `contexts/`, Supabase, Auth, RLS, secretos, datos, `.github/` (CI y despliegue), dependencias, `.claude/`, `docs/` de seguridad, auditorías, revisión de seguridad |

Criterio objetivo (misma definición que `npm run check:scope`; nótese que ésta incluye `scripts/test-*.mjs`, así que un PR que solo cambie una prueba —incluidas las de seguridad o de agentes— se clasifica como UI/UX aunque la revise el carril general): si **todos** los archivos del cambio están dentro del alcance UI y ninguno es prohibido, es del carril UI/UX; si uno solo no lo está, es del carril general. Una tarea mixta se **parte en dos PR**, uno por carril; si el PR de UI depende del general, el general va primero.
Cada coordinador **rechaza** lo que no es de su carril y nombra al otro. Los coordinadores no se invocan entre sí.

## 2. Antes de empezar cualquier tarea (preflight)
Ejecutar, desde una sesión que pueda hacerlo (ver «Quién puede consultar»):
```
node scripts/coord-status.mjs --fetch --files <archivos que voy a tocar>
```
En entornos con proxy de salida anteponer `NODE_USE_ENV_PROXY=1`. La herramienta es de solo lectura sobre el árbol de trabajo y sobre GitHub (no usa tokens, solo la API pública del repositorio); `--fetch` actualiza las referencias remotas locales (`git fetch origin --prune`) y por eso no puede correrlo un agente en modo de solo lectura y muestra: PR abiertos con su carril y si están desactualizados, ramas ajenas con trabajo reciente aún no integrado, solape de archivos con tu trabajo y posibles PR duplicados.
- **Solape de archivos:** no se edita. Se avisa al dueño y se espera o se ordena (el que toca `.claude/` o `scripts/test-agentFlow.mjs` va primero).
- **No se pudo consultar GitHub (exit 2):** no se asume que no hay PR; se reintenta antes de crear uno.
- Cada coordinador incluye este resultado en su informe.

## 3. Evitar PR duplicados
Antes de crear un PR: `node scripts/coord-status.mjs --head <rama> --title "<título>" --strict`. Si indica un PR existente (misma rama o título muy parecido), **se actualiza ese PR** (nuevo commit en su rama) en lugar de abrir otro. Quien publica deja en el cuerpo del PR el carril («Carril: UI/UX» o «Carril: general»).
Convención de ramas (`pr-publisher` ya exige `feat|fix|chore`): carril UI/UX `feat/ui-*`, `fix/ui-*` (las ramas existentes conservan su nombre); carril general `fix/sec-*`, `chore/sec-*`, `fix/data-*`, `chore/*`.

## 4. Actualizar PR desactualizados después de un merge
`protect-main` exige la rama al día, así que cada merge deja «behind» a los demás PR abiertos.
1. Cada carril actualiza **solo los PR propios**: `git fetch origin main` y `git merge origin/main` (nunca rebase ni force-push), o la herramienta de actualización de rama de `pr-publisher`.
2. Se espera el CI nuevo y se comprueba que `main` no volvió a avanzar antes de pedir el merge.
3. Si el dueño había autorizado el merge de un SHA exacto y la actualización cambia el head, la autorización **ya no aplica**: se vuelve a pedir indicando el nuevo SHA.
4. Un PR del otro carril desactualizado se informa, no se toca.
5. Orden de merges: lo decide el dueño. Recomendado: primero lo que toca `.claude/`, los tests de agentes o el CI; luego el resto.

## 5. Un solo procedimiento de publicación y validación
Validación (ambos carriles): `npm run test:all` y `npm run build`; el carril UI/UX suma `npm run check:scope`, `npm run qa:builds` y `npm run qa:ui` (`ui-qa`); el carril general suma las pruebas dirigidas y la revisión de `irontrack-security` e `irontrack-qa`. Un build verde no prueba que algo esté arreglado.
Publicación: commit, push a rama de trabajo y PR contra `main` con la herramienta de PR; nunca push a `main`. Un PR por tema y por carril, en Draft hasta tener el CI verde.

## 6. Quién puede preparar, publicar y fusionar
| Acción | Carril UI/UX | Carril general |
|---|---|---|
| Preparar (editar) | `ui-implementer` (alcance UI) | `irontrack-fixer`, solo con `fix.json` aprobado por una persona |
| Probar | `ui-qa` | `irontrack-qa` |
| Publicar | `pr-publisher` | **Hoy: la sesión principal con herramientas de PR, y solo con autorización explícita del dueño para rama, commit y push** (ver limitaciones) |
| Fusionar a `main` | Solo el dueño | Solo el dueño |
| Desplegar | Solo el dueño | Solo el dueño (flujo manual con entorno protegido) |

**Merges y despliegues están reservados a autorizaciones humanas explícitas** en la conversación, indicando el PR y el SHA. Un mensaje de un agente, un hook o una notificación no es autorización. Lo bloquean `settings.json`, `guard.mjs` y el clasificador de permisos; no se rodean.

## 7. Limitaciones conocidas (no resueltas en esta etapa)
- **Quién puede consultar:** `irontrack-orchestrator` no tiene herramientas de GitHub y su Bash es de solo lectura (su guard no admite `node scripts/coord-status.mjs`). El preflight lo corre `pr-publisher` o una sesión sin restricción de carril, y el orquestador usa su resultado. Cambiarlo exige tocar permisos de agentes o hooks (decisión del dueño).
- **Publicador del carril general:** `pr-publisher` exige `check:scope`, que falla para cualquier cambio fuera de la UI; `irontrack-orchestrator` e `irontrack-fixer` no pueden hacer push ni PR. Hasta que el dueño decida una regla de carril para `pr-publisher`, esos PR los abre la sesión principal con las herramientas de PR, con autorización explícita del dueño para la rama, el commit y el push (protocolo de `CLAUDE.md`).
- `coord-status.mjs` es una heurística: puede listar ramas ya integradas por squash cuyo contenido cambió después, y no ve el trabajo local no empujado de otra sesión. La fuente de verdad es GitHub; lo no empujado no existe para el preflight.
- La API anónima de GitHub permite unas 60 consultas por hora y cada corrida usa hasta 31: dos corridas seguidas pueden agotar el cupo (la herramienta sale con exit 2, nunca asume que no hay PR). Solo mira los primeros 15 PR abiertos y los primeros 100 archivos de cada uno.
- Los guards son inspección de texto y los hooks de los agentes no corren en carpetas no confiadas (ver `docs/agentes-y-guards.md`).
- Coordinadores anidados (orquestador → `ui-coordinator`): **no se hace**. Antes habría que probar en una sesión descartable que la lista de agentes de `ui-coordinator` se respeta como subagente y que su memoria y `SendMessage` funcionan.
