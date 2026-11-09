// Ejecuta el arnés R1: transpila los componentes reales a ./out (ignorado por git) y corre los escenarios en Chromium.
// Requisitos (no son dependencias del proyecto): TypeScript y Playwright del entorno (TYPESCRIPT_MODULE / PLAYWRIGHT_MODULE).
import { spawnSync } from 'node:child_process'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const run = (f, args = []) => { const r = spawnSync(process.execPath, [path.join(HERE, f), ...args], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
run('build.mjs', ['components/RutinaView.jsx', 'lib/routineStore.js', 'lib/rutinaOperationalState.js', 'lib/exerciseResolve.js']);
run('scenarios.mjs'); run('scenarios-app.mjs'); run('label.mjs');
