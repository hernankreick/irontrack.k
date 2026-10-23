# Agentes, orquestador y guards de IronTrack (carpeta `.claude/` versionada)

## Qué se versiona (lista blanca en `.gitignore`)
`.claude/agents/` (los cinco agentes y el orquestador), `.claude/hooks/` (guard de Bash y compuerta del fixer), `.claude/settings.json` (permisos y hook compartidos: **es el de `main`, del flujo de UI del PR #114; este cambio no lo modifica**), `.claude/ORQUESTADOR.md` y `.claude/authorization/fix.example.json` (plantilla sin efecto).
**Nunca se versiona**: `.claude/authorization/fix.json` (la autorización temporal la crea cada persona), `settings.local.json`, caches y sesiones, archivos de variables de entorno y cualquier archivo con nombre de credencial (`*secret*`, `*credential*`, `*.key`, `*.pem`, `*.token`, `*.local.*`).

## Coexistencia con el flujo de UI de `main` (PR #114)
`main` ya versiona otro sistema (`ui-coordinator`, `ui-implementer`, `ui-qa`, `pr-publisher`, su hook `guard.mjs` y un `settings.json` que permite commit y push a ramas que no sean `main`). Los agentes `irontrack-*` conviven sin pisarlo: nombres distintos y sus propios guards declarados en el frontmatter de cada agente (`bash-guard.mjs`, `fix-gate.mjs`). Por lo tanto el hook global y los permisos de sesión son los de `main`, no los del guard `irontrack`. Las denegaciones de `main` (merge, CLI de producción, credenciales, push forzado y push a `main`) se conservan y la prueba `test-orchestratorAgent.mjs` las verifica.

## Cómo autorizar una corrección al fixer
Copiar `.claude/authorization/fix.example.json` a `.claude/authorization/fix.json` (ignorado por git), poner `approved_by_user: true`, el id, la **rama exacta** y los archivos o carpetas permitidos. Borrarlo al terminar. Solo lo crea una persona: ningún agente puede escribir ese archivo ni editar `.claude/`.

## Falsos positivos del guard de Bash
El guard inspecciona **texto**: bloquea cualquier comando que *mencione* la CLI de producción, la clave de administración, SQL destructivo o un host del proyecto, aunque solo sea un mensaje de commit, un `echo` o una búsqueda con `grep`. Medido con `scripts/test-bashGuard.mjs`, el guard activo bloquea cinco usos inofensivos: mensajes de commit que nombran la herramienta, imprimir la URL del proyecto, buscar la clave en el código, buscar SQL en `sql/` y buscar texto SQL en el historial.

**Propuesta** (`.claude/hooks/bash-guard.next.mjs`, **no activada**): las cuatro reglas de «mención» y la de la clave de administración pasan a evaluarse sobre una vista donde se vacía el texto que solo se imprime o se busca (`echo`, `printf`, `grep`, `rg`, `git commit|log|show|diff|grep|tag`, y el cuerpo de un heredoc de `git commit` o `cat`). **No se relaja nunca**: lo que se ejecuta (cualquier otro programa, `bash -c`, `xargs`, `node -e`), comillas con `$` o comillas invertidas, `rg --pre`, `git -c`, ni las reglas de archivos de credenciales, volcado de entorno, git destructivo o `rm`. Además cierra dos huecos del guard activo: la CLI dentro de un alias de git con `!` y dentro de un grupo `{ …; }`.
`scripts/test-bashGuard.mjs` (14 comprobaciones) verifica que las protecciones sigan bloqueando en ambos guards y modos, que los falsos positivos se permitan solo en la propuesta, que la lista de avisos y el modo de solo lectura sean idénticos y que la compuerta del fixer siga bloqueando.
Para activarla: revisar el diff y reemplazar `bash-guard.mjs` por `bash-guard.next.mjs` (es una edición de `.claude/` y la hace una persona).

Cobertura: las 9 mutaciones de la propuesta que se probaron quedan detectadas (se agregaron los casos de `git push` con `--receive-pack` y de comilla simple sin cerrar).
Hueco detectado también en el guard **activo**: una opción con la CLI pegada a un `=` (por ejemplo `git push --exec=<CLI>`) no se reconoce como comando. La propuesta lo cierra; el guard activo no se modificó.

## Autorización antigua detectada (IT-019)
Existe `.claude/authorization/fix.json` local con `approved_by_user: true`, id `IT-019`, rama `test/it-009-pr-records` y los archivos `lib/workoutSession.js` y `scripts/test-prRecords.mjs`. Esa corrección ya está integrada en `main` (PR #97), por lo que la autorización quedó **vencida**. No se eliminó (requiere aprobación específica). Riesgo bajo: la compuerta exige que la rama actual coincida, pero si alguien volviera a usar esa rama el fixer podría editar esos dos archivos. Recomendación: borrarlo a mano. Con la lista blanca de `.gitignore` este archivo no puede subirse al repositorio.

## Orquestador
Ver `.claude/ORQUESTADOR.md`. Se invoca con `claude --agent irontrack-orchestrator`.
