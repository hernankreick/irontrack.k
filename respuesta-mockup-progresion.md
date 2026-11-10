# IronTrack — Mockup comparativo del editor de progresión semanal

## Estado
La demo está lista y subida a la rama `claude/irontrack-progression-mockup-es6cpw` (commit `86cf714`).

**Preview de Vercel: pendiente.** No pude leer la URL del deploy y no hay PR abierto. El hook de seguridad bloqueó mi consulta con `gh api` a deploys y estados; respeté el bloqueo y no busqué rodeos. Tampoco puedo confirmar que Vercel haya publicado la Preview ni si exige login.

## Qué se hizo
- **Página nueva:** `demo/progresion-editor.html`, con `components/demo/ProgresionEditorDemo.jsx`, `progresionEditorDemoData.js` y `progresionEditorDemoMain.jsx`, siguiendo las otras demos.
- **Test nuevo:** `scripts/test-demoProgresionEditor.mjs` (6 pruebas, pasan).
- **Único cambio fuera de la demo:** una línea en `vite.config.js` que registra la página solo en builds de Preview (en Production no se compila). `check:scope` lo marca como fuera de alcance, igual que las demos anteriores, así que necesita tu OK.
- **Aislamiento:** no se tocaron componentes productivos, métodos de progresión, Supabase, SQL ni lógica de guardado. Solo datos ficticios; GUARDAR no guarda nada.

## Funciones de la demo
- Alternar entre Diseño A, Diseño B y Ambos, con los mismos datos en los dos.
- Elegir 4, 6 u 8 semanas; editar series, reps, kg y pausa.
- Abrir y cerrar las notas semanales.
- Probar los 5 métodos (+Carga, +Reps, +Series, −Pausa, Manual): resaltan lo que progresa, muestran el delta (por ejemplo +2) y "Autocompletar" usa las mismas fórmulas que el editor real.
- Copiar una semana a la siguiente, repetir una fila y moverse entre celdas con flechas y Enter.
- Estilo: paleta oscura del modal actual de IronTrack.

## Pruebas
- `test:all` en copia Linux (el `node_modules` es de Windows): 103 de 104 suites pasan. Falla `test-demoProgreso`; tras reubicar mi entrada en `vite.config.js` su chequeo de `vite.config` ya pasa, pero no pude re-correr la suite entera.
- Build con `IRONTRACK_DEMO=1`: incluye la demo.
- No corrí `npm run qa:ui` ni `qa:builds`.
- Medido en Chromium a 1440, 1366 y 390 px: sin errores de consola ni desborde horizontal de la página.

## Comparación (6 semanas)
| | Diseño A (tabla) | Diseño B (planilla) |
|---|---|---|
| Alto en escritorio | 575 px (8 sem: 663 px) | 640 px (8 sem: 640 px) |
| Scroll vertical en 1440 y 1366 | No | No |
| Scroll horizontal en escritorio | No | No (también con 8 semanas) |
| iPhone 390 px | Todo visible sin scroll horizontal, campos de 44 px | Scroll horizontal obligatorio, ~3 semanas a la vez |
| Notas | Columna con texto visible | Fila de botones; las notas abiertas aparecen abajo |
| Copiar entre semanas | Botón ⧉ por fila (copia la anterior) | "copiar →" por semana y ⇥ para repetir una fila |

## Recomendación
Recomiendo el **Diseño A** como base.
- **Móvil:** es el único que se usa bien en el iPhone; el B obliga a deslizar de lado para ver las semanas.
- **Legibilidad:** conserva la nota a la vista y se lee como una fila por semana.
- **Velocidad:** con 4 a 6 semanas es igual de rápido que B, y la navegación con flechas existe en ambos.
- **Dónde gana B:** con 8 semanas el alto no crece y es más cómodo para comparar una variable entre semanas, pero solo en escritorio.
- **Opción híbrida (no probada):** B solo en pantallas anchas y A en móvil.

## Cómo ver la demo
- **Preview de Vercel:** autorizame a abrir un PR contra `main` (sin merge) para que Vercel publique la Preview. Si pide login de Vercel, lo informo y buscamos otra alternativa sin tocar Production.
- **Local:** `IRONTRACK_DEMO=1 npm run dev` y abrir `/demo/progresion-editor.html` (desde una copia Linux si tu `node_modules` es de Windows).
- **Capturas:** 1440 y 1366 px (A y B) y iPhone 390 px (A y B), enviadas en el chat.
