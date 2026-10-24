# Orquestador de IronTrack (`irontrack-orchestrator`)

Coordina a los cinco agentes del proyecto (`irontrack-auditor`, `-data`, `-security`, `-fixer`, `-qa`): recibe un objetivo en lenguaje natural, lo divide en tareas, delega (en paralelo lo independiente), verifica y entrega **un solo informe**. No edita código, no ejecuta pruebas y no toca producción: eso lo hacen los agentes especializados bajo sus propios límites técnicos.

## Cómo se invoca
- **Como hilo principal (recomendado):** `claude --agent irontrack-orchestrator` (sesión interactiva, carpeta confiada). Opcional, para que sea el predeterminado del proyecto: `"agent": "irontrack-orchestrator"` en `.claude/settings.json` (no está activado; es una decisión del propietario).
- **Como subagente** desde una sesión normal: «Usá irontrack-orchestrator para …». Funciona, pero la lista blanca `Agent(...)` de su frontmatter solo se aplica en el modo de hilo principal; como subagente, la contención depende del texto de sus instrucciones y de los hooks y reglas `deny` de `settings.json`, que sí se aplican siempre.
- Ejemplo: `claude --agent irontrack-orchestrator` y pedir *«Revisá el estado de IT-002 y prepará el despliegue seguro»*.

## Qué agentes coordina realmente
Los cinco, y ninguno más: su frontmatter declara `tools: Agent(irontrack-auditor, irontrack-data, irontrack-security, irontrack-fixer, irontrack-qa), Read, Grep, Glob, Bash`. Verificado ejecutándolo (ver «Pruebas»): reconoce exactamente esos cinco, lanza las delegaciones en paralelo, y consolida sus resultados.

## Qué puede hacer solo
Auditar, revisar, ejecutar pruebas y el build (vía QA), pruebas de mutación en copias, preparar scripts/consultas/parches/documentación **sin aplicarlos**, y pedir al fixer un cambio **dentro de una autorización aprobada** (`.claude/authorization/fix.json`).

## Qué NO puede hacer sin una autorización específica
Desplegar, usar la CLI de Supabase/Vercel, tocar Auth/RLS/secretos/datos reales, cambiar contraseñas, vincular cuentas, commit/push/PR/merge, borrar información, tocar `CLAUDE.md`, `.claude/` o `fix.json`. No tiene `Edit`/`Write`; solo el fixer edita, y solo con `fix.json` aprobado, en la rama y los archivos listados (`fix-gate.mjs`). Cada autorización cubre únicamente lo que dice.

## Cómo se pide una autorización
Una sola solicitud por vez: **Acción · Alcance · Riesgos · Qué no incluye · Qué hace después**.

## Límites de la plataforma (documentados)
- Los subagentes **pueden** lanzar subagentes (hasta tres niveles); la lista blanca `Agent(nombre, …)` solo restringe cuando el agente corre con `--agent`. Fuente: documentación oficial de subagentes de Claude Code.
- Los hooks y las reglas `deny` de `settings.json` aplican a subagentes. Los hooks del frontmatter solo viven mientras ese agente está activo y se saltan si la carpeta no está confiada.
- En `claude -p` sobre una carpeta no confiada se ignoran las reglas `permissions.allow` (los agentes quedan sin permiso de Bash): no usarlo para operar.
- Una llamada de Bash no comparte estado con la siguiente; `node_modules/` versionado hace fallar el build local (validar con el CI o con un árbol limpio).
- El guard (`bash-guard.mjs`) puede dar falsos positivos por texto. Se informa; no se esquiva.

## Carriles y coordinación con la sesión de UI/UX
Este orquestador coordina **solo el carril general** (auditoría, datos, seguridad, correcciones autorizadas, QA). Lo que es de UI/UX (estilos, layout, accesibilidad, tamaños táctiles, QA visual: `components/**`, `index.css`, `public/**`, `assets/**`, `scripts/test-*.mjs`, `scripts/qa/**`) es del carril UI/UX: lo recibe `ui-coordinator` (`claude --agent ui-coordinator`); acá se rechaza indicándolo. No se anidan coordinadores. Procedimiento completo (enrutamiento, preflight de PR y ramas ajenas, PR duplicados, PR desactualizados, publicación, quién fusiona): `docs/coordinacion-carriles.md`.
Limitación actual: este orquestador no puede consultar GitHub ni publicar PR con sus herramientas; usa el resultado de `node scripts/coord-status.mjs` que corre otra sesión o agente habilitado.

## Pruebas
- `node scripts/test-orchestratorAgent.mjs` — 19 comprobaciones estáticas de la definición (lista blanca exacta, sin `Edit`/`Write`, hook de solo lectura, prompt con las reglas de autorización y honestidad, `settings.json` sin debilitar). Detecta degradaciones deliberadas (agente fuera de lista, `Write` agregado, hook en modo global, regla anti-simulación eliminada).
- Delegación real: se ejecutó con `claude --agent irontrack-orchestrator -p …` (solo lectura) y los cinco agentes fueron lanzados; ver el informe de entrega.
