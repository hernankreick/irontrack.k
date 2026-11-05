// Demostración D76-03 (demo/registro-series.html): datos y lógica de la demo, puros y testeables en node.
//
// Datos ficticios, sin Supabase, sin red y sin el almacenamiento real del navegador: el "storage" y el "servidor" son objetos en memoria.
// La lógica de registro es la REAL: guarda (lib/setLogGuard.js), write-ahead (lib/setWriteAhead.js), payload/pendiente
// (lib/workoutSession.js), POST idempotente (lib/progressInsert.js) y flush (lib/pendingSyncQueue.js). crearLogSetDemo replica el
// logSet de App.jsx paso a paso (mismo orden: opId del intento -> write-ahead -> serie local -> envío asíncrono).
//
//   node scripts/test-demoRegistroSeries.mjs   (corre ejecutarEscenarios, lo mismo que el botón "Ejecutar pruebas automáticas")
import { createSetLogGuard } from '../../lib/setLogGuard.js';
import {
  buildExerciseSetRecord,
  buildPendingProgressItem,
  buildProgressPayload,
  isUuid,
  updateExerciseProgressRecord,
} from '../../lib/workoutSession.js';
import { generateOpId, flushPendingForAlumno, visiblePendingItems } from '../../lib/pendingSyncQueue.js';
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight } from '../../lib/setWriteAhead.js';
import { postProgressIdempotent } from '../../lib/progressInsert.js';

export const DEMO_ALUMNO_ID = 'demo-alumno';
export const DEMO_RUTINA_ID = 'demo-rutina';
export const DEMO_CICLO = 1;
export const DEMO_SEMANA = 0;
export const DEMO_EJERCICIOS = [
  { id: 'sentadilla-demo', name: 'Sentadilla (demo)', sets: 4, reps: 8, kg: 60, pause: 90, pattern: 'rodilla' },
  { id: 'press-banca-demo', name: 'Press de banca (demo)', sets: 4, reps: 8, kg: 40, pause: 90, pattern: 'empuje' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function fechaHoy() {
  return new Date().toLocaleDateString('es-AR');
}

/** Almacenamiento en memoria con la interfaz de localStorage. falla=true: setItem lanza QuotaExceededError (cuota agotada). */
export function crearStorageDemo(opts) {
  const m = new Map();
  let falla = !!(opts && opts.falla);
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (falla) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        e.code = 22;
        throw e;
      }
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); },
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    setFalla: (v) => { falla = !!v; },
    get falla() { return falla; },
    _m: m,
  };
}

/** Servidor falso de `progreso`: inserción por id (409/23505 sobre progreso_pkey si ya existe) y lectura por id, con latencia configurable. */
export function crearServidorDemo(opts) {
  const o = opts || {};
  const filas = new Map();
  const posts = [];
  let latenciaMs = o.latenciaMs || 0;
  let perderRespuestas = 0;
  return {
    filas, posts,
    setLatencia: (ms) => { latenciaMs = Math.max(0, Number(ms) || 0); },
    get latenciaMs() { return latenciaMs; },
    // Las próximas n respuestas se pierden DESPUÉS de insertar (como un corte de red tras el commit).
    perderProximasRespuestas: (n) => { perderRespuestas = n; },
    io: {
      post: async (payload) => {
        posts.push(payload);
        if (latenciaMs > 0) await sleep(latenciaMs);
        if (filas.has(payload.id)) {
          return { ok: false, status: 409, data: { code: '23505', details: 'Key (id)=(' + payload.id + ') already exists.', message: 'duplicate key value violates unique constraint "progreso_pkey"' } };
        }
        const fila = Object.assign({}, payload);
        filas.set(payload.id, fila);
        if (perderRespuestas > 0) { perderRespuestas--; throw new Error('respuesta perdida'); }
        return { ok: true, status: 201, data: [fila] };
      },
      getById: async (id) => ({ ok: true, status: 200, data: filas.has(id) ? [filas.get(id)] : [] }),
    },
  };
}

/**
 * Réplica del logSet de App.jsx con las funciones reales. Devuelve la función logSet(exId, kg, reps, note, rpe, week, opIdIntento) => boolean
 * y, como propiedades: series() (registradas localmente, con su opId), progress() (mismo formato que progress de App), esperarEnvios(),
 * ultimoError().
 */
export function crearLogSetDemo(opts) {
  const o = opts || {};
  const storage = o.storage;
  const servidor = o.servidor;
  const alumnoId = o.alumnoId || DEMO_ALUMNO_ID;
  const ciclo = o.ciclo != null ? o.ciclo : DEMO_CICLO;
  const online = typeof o.online === 'function' ? o.online : () => true;
  const alCambiar = typeof o.alCambiar === 'function' ? o.alCambiar : () => {};
  const fecha = o.fecha || fechaHoy();
  const series = [];
  let progress = {};
  const envios = [];
  let ultimoError = null;

  const logSet = (exId, kg, reps, note, rpe, week, opIdIntento) => {
    const d = fecha;
    const weekForSet = Number.isFinite(Number(week)) ? Number(week) : DEMO_SEMANA;
    const newSet = buildExerciseSetRecord(kg, reps, d, weekForSet, note, rpe, ciclo);
    // D76-03: igual que App.jsx, el opId del intento (guarda) se reutiliza; si no es un UUID se genera uno.
    const opId = isUuid(opIdIntento) ? opIdIntento : generateOpId();
    // D76-01: write-ahead ANTES de mostrar y de enviar. Si no se puede persistir, no se registra.
    const pendingItem = buildPendingProgressItem(exId, kg, reps, note, d, weekForSet, ciclo, alumnoId, opId);
    const wa = writeAheadPendingSet(storage, pendingItem, Date.now());
    if (!wa.ok) {
      ultimoError = wa.reason;
      alCambiar();
      return false;
    }
    ultimoError = null;
    progress = Object.assign({}, progress, { [exId]: updateExerciseProgressRecord(progress[exId], newSet) });
    series.push({ exId, kg: newSet.kg, reps: newSet.reps, opId, fecha: d, semana: weekForSet });
    if (online()) {
      const envio = sendWriteAheadSet({
        storage,
        opId,
        timeoutMs: o.timeoutMs,
        send: () => postProgressIdempotent(servidor.io, buildProgressPayload(alumnoId, exId, kg, reps, note, d, weekForSet, ciclo, opId)),
      }).then((res) => { alCambiar(); return res; });
      envios.push(envio);
    }
    alCambiar();
    return true;
  };
  logSet.series = () => series.slice();
  logSet.progress = () => progress;
  logSet.esperarEnvios = () => Promise.all(envios.slice());
  logSet.ultimoError = () => ultimoError;
  return logSet;
}

/** Sincroniza los pendientes del alumno con flushPendingForAlumno real (mismo payload que el flush de App.jsx). */
export function flushDemo(opts) {
  const o = opts || {};
  const alumnoId = o.alumnoId || DEMO_ALUMNO_ID;
  return flushPendingForAlumno({
    storage: o.storage,
    alumnoId,
    timeoutMs: o.timeoutMs,
    isInFlight: isSetSendInFlight,
    send: (item) => postProgressIdempotent(o.servidor.io, buildProgressPayload(alumnoId, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId)),
  });
}

export function pendientesDemo(storage, alumnoId) {
  try { return visiblePendingItems(storage, alumnoId || DEMO_ALUMNO_ID).length; } catch (e) { return 0; }
}

/** PASS si cada opId local es único y las filas del servidor son un subconjunto de las series locales, sin duplicados. */
export function verificarConsistencia(series, servidor) {
  const ids = series.map((s) => s.opId);
  const unicos = new Set(ids);
  if (unicos.size !== ids.length) return { pass: false, detalle: 'hay opIds locales repetidos' };
  const filas = [...servidor.filas.keys()];
  if (new Set(filas).size !== filas.length) return { pass: false, detalle: 'filas duplicadas en el servidor' };
  const fuera = filas.filter((id) => !unicos.has(id));
  if (fuera.length) return { pass: false, detalle: fuera.length + ' fila(s) del servidor sin serie local' };
  return { pass: true, detalle: ids.length + ' serie(s) local(es) · ' + filas.length + ' fila(s) en servidor · sin duplicados' };
}

// Un "toque" de REGISTRAR: lo mismo que hace handleLogSet del panel con la guarda.
function tocar(guard, scope, logSet, ex) {
  const e = ex || DEMO_EJERCICIOS[0];
  return guard.attempt(scope, (opId) => logSet(e.id, e.kg, e.reps, '', null, DEMO_SEMANA, opId));
}

function entorno(opts) {
  const o = opts || {};
  const storage = crearStorageDemo({ falla: o.falla });
  const servidor = crearServidorDemo({ latenciaMs: o.latenciaMs });
  let enLinea = o.online !== false;
  const logSet = crearLogSetDemo({ storage, servidor, alumnoId: DEMO_ALUMNO_ID, online: () => enLinea, timeoutMs: o.timeoutMs });
  const guard = createSetLogGuard({ generateId: generateOpId });
  const scope = 'demo-alumno|' + DEMO_RUTINA_ID + '|0|1|0|' + DEMO_EJERCICIOS[0].id;
  return { storage, servidor, logSet, guard, scope, setOnline: (v) => { enLinea = !!v; } };
}

/** Escenarios automáticos con la guarda REAL + crearLogSetDemo. Devuelve [{ id, nombre, pass, detalle }]. */
export async function ejecutarEscenarios(opts) {
  const o = opts || {};
  const latenciaMs = o.latenciaMs != null ? o.latenciaMs : 1500;
  const timeoutMs = o.timeoutMs != null ? o.timeoutMs : Math.max(3000, latenciaMs * 3);
  const escenarios = [
    ['Doble toque inmediato → 1 serie', async () => {
      const e = entorno({ timeoutMs });
      const r1 = tocar(e.guard, e.scope, e.logSet); const r2 = tocar(e.guard, e.scope, e.logSet);
      await e.logSet.esperarEnvios();
      const ok = r1.status === 'logged' && r2.status === 'busy' && e.logSet.series().length === 1 && e.servidor.filas.size === 1;
      return [ok, '1º ' + r1.status + ', 2º ' + r2.status + ' · ' + e.logSet.series().length + ' serie(s), ' + e.servidor.filas.size + ' fila(s)'];
    }],
    ['5 toques rápidos → 1 serie', async () => {
      const e = entorno({ timeoutMs });
      const st = [1, 2, 3, 4, 5].map(() => tocar(e.guard, e.scope, e.logSet).status);
      await e.logSet.esperarEnvios();
      const ok = st.filter((s) => s === 'logged').length === 1 && e.logSet.series().length === 1 && e.servidor.filas.size === 1 && e.servidor.posts.length === 1;
      return [ok, st.join(', ') + ' · ' + e.logSet.series().length + ' serie(s), ' + e.servidor.posts.length + ' POST'];
    }],
    ['Dos eventos antes del siguiente render (reentrante) → 1 serie', async () => {
      const e = entorno({ timeoutMs });
      let interno = null;
      const r = e.guard.attempt(e.scope, (opId) => {
        interno = tocar(e.guard, e.scope, e.logSet);
        return e.logSet(DEMO_EJERCICIOS[0].id, 60, 8, '', null, DEMO_SEMANA, opId);
      });
      await e.logSet.esperarEnvios();
      const ok = r.status === 'logged' && interno && interno.status === 'busy' && e.logSet.series().length === 1;
      return [ok, 'externo ' + r.status + ', interno ' + (interno && interno.status) + ' · ' + e.logSet.series().length + ' serie(s)'];
    }],
    ['Latencia ' + latenciaMs + ' ms: POST pendiente + toque extra → 1 serie, 1 fila', async () => {
      const e = entorno({ latenciaMs, timeoutMs });
      const r1 = tocar(e.guard, e.scope, e.logSet);
      await sleep(Math.min(50, latenciaMs));
      const filasDurante = e.servidor.filas.size;
      const r2 = tocar(e.guard, e.scope, e.logSet);
      const fl = await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs });
      await e.logSet.esperarEnvios();
      const ok = r1.status === 'logged' && r2.status === 'busy' && filasDurante === 0 && fl.sent === 0 && e.logSet.series().length === 1 && e.servidor.filas.size === 1 && e.servidor.posts.length === 1 && pendientesDemo(e.storage) === 0;
      return [ok, 'durante el POST: ' + filasDurante + ' fila(s), toque extra ' + r2.status + ', flush envió ' + fl.sent + ' · al final ' + e.logSet.series().length + ' serie(s), ' + e.servidor.filas.size + ' fila(s), ' + e.servidor.posts.length + ' POST'];
    }],
    ['Fallo de guardado anticipado (cuota) → 0 series; reintento con el mismo opId → 1 serie', async () => {
      const e = entorno({ falla: true, timeoutMs });
      const r1 = tocar(e.guard, e.scope, e.logSet);
      const tras1 = { series: e.logSet.series().length, posts: e.servidor.posts.length, busy: e.guard.snapshot().busy, err: e.logSet.ultimoError() };
      e.storage.setFalla(false);
      const r2 = tocar(e.guard, e.scope, e.logSet);
      await e.logSet.esperarEnvios();
      const ok = r1.status === 'failed' && tras1.series === 0 && tras1.posts === 0 && !tras1.busy && tras1.err === 'quota'
        && r2.status === 'logged' && r2.opId === r1.opId && e.logSet.series().length === 1 && e.servidor.filas.size === 1 && e.servidor.filas.has(r1.opId);
      return [ok, '1º ' + r1.status + ' (' + tras1.err + '), 0 series y 0 POST, guarda libre (status failed: el panel no limpia kg/reps) · reintento ' + r2.status + (r2.opId === r1.opId ? ' con el mismo opId' : ' con OTRO opId') + ' · ' + e.logSet.series().length + ' serie(s), ' + e.servidor.filas.size + ' fila(s)'];
    }],
    ['Dos registros legítimos idénticos tras la confirmación → 2 series, 2 opIds', async () => {
      const e = entorno({ timeoutMs });
      const r1 = tocar(e.guard, e.scope, e.logSet);
      const libero = e.guard.finishConfirmation(r1.token);
      const r2 = tocar(e.guard, e.scope, e.logSet);
      await e.logSet.esperarEnvios();
      const s = e.logSet.series();
      const ok = libero && r1.status === 'logged' && r2.status === 'logged' && s.length === 2 && s[0].opId !== s[1].opId && s[0].kg === s[1].kg && s[0].reps === s[1].reps && e.servidor.filas.size === 2;
      return [ok, s.length + ' serie(s) de ' + DEMO_EJERCICIOS[0].kg + ' kg × ' + DEMO_EJERCICIOS[0].reps + ' · opIds distintos: ' + (s.length === 2 && s[0].opId !== s[1].opId ? 'sí' : 'no') + ' · ' + e.servidor.filas.size + ' fila(s)'];
    }],
    ['Cambio de ejercicio durante «LISTO» → la confirmación sigue; su token la libera una sola vez', async () => {
      const e = entorno({ timeoutMs });
      const rA = tocar(e.guard, e.scope, e.logSet, DEMO_EJERCICIOS[0]);
      const scopeB = 'demo-alumno|' + DEMO_RUTINA_ID + '|0|1|1|' + DEMO_EJERCICIOS[1].id;
      e.guard.reset(scopeB);   // lo que hace el efecto del panel al cambiar de ejercicio
      const extra = tocar(e.guard, scopeB, e.logSet, DEMO_EJERCICIOS[1]);
      const libera = e.guard.finishConfirmation(rA.token);
      const repetido = e.guard.finishConfirmation(rA.token);
      const rB = tocar(e.guard, scopeB, e.logSet, DEMO_EJERCICIOS[1]);
      const viejoTrasB = e.guard.finishConfirmation(rA.token);
      const nuevo = e.guard.finishConfirmation(rB.token);
      await e.logSet.esperarEnvios();
      const ok = rA.status === 'logged' && extra.status === 'busy' && libera && !repetido && rB.status === 'logged' && !viejoTrasB && nuevo && e.logSet.series().length === 2;
      return [ok, 'toque extra en B durante «LISTO»: ' + extra.status + ' · token A libera: ' + (libera ? 'sí' : 'no') + ', repetido: ' + (repetido ? 'sí' : 'no') + ', tras B: ' + (viejoTrasB ? 'sí' : 'no') + ' · ' + e.logSet.series().length + ' serie(s) (1 por ejercicio)'];
    }],
    ['Auto-avance tras la última serie: toque a los 350 ms → 0 series en el ejercicio siguiente', async () => {
      const e = entorno({ timeoutMs });
      const A = DEMO_EJERCICIOS[0], B = DEMO_EJERCICIOS[1];
      for (let i = 0; i < A.sets - 1; i++) { const r = tocar(e.guard, e.scope, e.logSet, A); e.guard.finishConfirmation(r.token); }
      const ultima = tocar(e.guard, e.scope, e.logSet, A);
      const scopeB = 'demo-alumno|' + DEMO_RUTINA_ID + '|0|1|1|' + B.id;
      await sleep(300); e.guard.reset(scopeB);   // setTimeout(()=>setActiveExIdx(siguiente), 300) del panel
      await sleep(50);
      const extra = tocar(e.guard, scopeB, e.logSet, B);
      const enB = e.logSet.series().filter((x) => x.exId === B.id).length;
      e.guard.finishConfirmation(ultima.token);   // fin de «LISTO» (800 ms)
      const rB = tocar(e.guard, scopeB, e.logSet, B);
      await e.logSet.esperarEnvios();
      const ok = ultima.status === 'logged' && extra.status === 'busy' && enB === 0 && rB.status === 'logged' && e.logSet.series().length === A.sets + 1;
      return [ok, 'toque a 350 ms: ' + extra.status + ', ' + enB + ' serie(s) nuevas en B · tras «LISTO» B registra: ' + rB.status + ' · ' + e.logSet.series().length + ' serie(s)'];
    }],
    ['Sin conexión: pendiente sincronizado → 1 fila en servidor, 1 serie local', async () => {
      const e = entorno({ online: false, timeoutMs });
      const r = tocar(e.guard, e.scope, e.logSet);
      const pend = pendientesDemo(e.storage);
      const postsOffline = e.servidor.posts.length;
      e.setOnline(true);
      const f1 = await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs });
      const f2 = await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs });
      const ok = r.status === 'logged' && pend === 1 && postsOffline === 0 && f1.sent === 1 && f2.sent === 0 && e.servidor.filas.size === 1 && e.servidor.filas.has(r.opId) && e.logSet.series().length === 1 && pendientesDemo(e.storage) === 0;
      return [ok, 'offline: ' + pend + ' pendiente, ' + postsOffline + ' POST · flush envió ' + f1.sent + ', 2º flush ' + f2.sent + ' · ' + e.servidor.filas.size + ' fila(s), ' + e.logSet.series().length + ' serie(s)'];
    }],
    ['Respuesta perdida: el flush reenvía el mismo opId (409 verificado) → 1 fila', async () => {
      const e = entorno({ timeoutMs });
      e.servidor.perderProximasRespuestas(1);
      const r = tocar(e.guard, e.scope, e.logSet);
      const [res] = await e.logSet.esperarEnvios();
      const pend = pendientesDemo(e.storage);
      const f = await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs });
      const ok = r.status === 'logged' && res.confirmed === false && pend === 1 && f.sent === 1 && e.servidor.posts.length === 2 && e.servidor.posts[1].id === r.opId && e.servidor.filas.size === 1 && e.logSet.series().length === 1 && pendientesDemo(e.storage) === 0;
      return [ok, 'envío ' + (res.confirmed ? 'confirmado' : 'no confirmado') + ', ' + pend + ' pendiente · flush confirmó ' + f.sent + ' · ' + e.servidor.posts.length + ' POST, ' + e.servidor.filas.size + ' fila(s), ' + e.logSet.series().length + ' serie(s)'];
    }],
  ];
  const out = [];
  for (let i = 0; i < escenarios.length; i++) {
    const [nombre, fn] = escenarios[i];
    try {
      const [pass, detalle] = await fn();
      out.push({ id: i + 1, nombre, pass: !!pass, detalle });
    } catch (err) {
      out.push({ id: i + 1, nombre, pass: false, detalle: 'error: ' + (err && err.message ? err.message : String(err)) });
    }
  }
  return out;
}
