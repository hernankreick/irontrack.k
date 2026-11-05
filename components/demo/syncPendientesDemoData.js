// Demostración D76-08 (demo/sync-pendientes.html): sincronización automática de series pendientes. Datos y lógica de la demo, puros y
// testeables en node.
//
// Datos ficticios, sin Supabase, sin red y sin el almacenamiento real del navegador: el "storage", el "servidor" y el "navegador" (flag de
// conexión + EventTarget falsos para window/document) son objetos en memoria. La lógica es la REAL: controlador y disparadores
// (lib/pendingSyncController.js), flush (lib/pendingSyncQueue.js), write-ahead (lib/setWriteAhead.js), payload/pendiente
// (lib/workoutSession.js) y POST idempotente (lib/progressInsert.js). registrarSerie replica el logSet de App.jsx (write-ahead -> envío si hay
// conexión -> si no confirma, reintento a los pocos segundos). locks: null para no usar navigator.locks real.
//
//   node scripts/test-demoSyncPendientes.mjs   (corre ejecutarEscenarios, lo mismo que el botón "Ejecutar pruebas automáticas")
import { crearStorageDemo } from './registroSeriesDemoData.js';
import { createPendingSyncController, attachSyncTriggers } from '../../lib/pendingSyncController.js';
import { generateOpId, visiblePendingItems } from '../../lib/pendingSyncQueue.js';
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight } from '../../lib/setWriteAhead.js';
import { postProgressIdempotent } from '../../lib/progressInsert.js';
import { buildPendingProgressItem, buildProgressPayload } from '../../lib/workoutSession.js';

export const DEMO_ALUMNO_A = 'demo-alumno-a';
export const DEMO_ALUMNO_B = 'demo-alumno-b';
export const DEMO_ALUMNOS = [
  { id: DEMO_ALUMNO_A, nombre: 'Alumna A (demo)' },
  { id: DEMO_ALUMNO_B, nombre: 'Alumno B (demo)' },
];
export const DEMO_EJERCICIO = { id: 'sentadilla-demo', name: 'Sentadilla (demo)', kg: 60, reps: 8 };
export const DEMO_SEMANA = 0;
export const DEMO_CICLO = 1;
export const MODOS_SERVIDOR = ['normal', 'http500', 'timeout', 'perdida'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fechaHoy() {
  return new Date().toLocaleDateString('es-AR');
}

/**
 * Servidor falso de `progreso` con io { post, getById } para postProgressIdempotent. Modos (para los próximos POST):
 *  - normal: inserta por id (409/23505 sobre progreso_pkey si ya existe);
 *  - http500: responde 500 sin insertar;
 *  - timeout: la respuesta llega DESPUÉS de timeoutMs (el cliente ya se rindió); la fila se inserta igual al final;
 *  - perdida: inserta y la respuesta se pierde (corte de red tras el commit).
 * latenciaMs se suma a cada POST.
 */
export function crearServidorSync(opts) {
  const o = opts || {};
  const filas = new Map();
  const posts = [];
  let modo = 'normal';
  let latenciaMs = o.latenciaMs || 0;
  const timeoutMs = o.timeoutMs || 1500;
  const insertar = (payload) => {
    if (filas.has(payload.id)) {
      return { ok: false, status: 409, data: { code: '23505', details: 'Key (id)=(' + payload.id + ') already exists.', message: 'duplicate key value violates unique constraint "progreso_pkey"' } };
    }
    const fila = Object.assign({}, payload);
    filas.set(payload.id, fila);
    return { ok: true, status: 201, data: [fila] };
  };
  return {
    filas, posts,
    get modo() { return modo; },
    setModo: (m) => { modo = MODOS_SERVIDOR.indexOf(m) >= 0 ? m : 'normal'; },
    get latenciaMs() { return latenciaMs; },
    setLatencia: (ms) => { latenciaMs = Math.max(0, Number(ms) || 0); },
    filasDe: (alumnoId) => [...filas.values()].filter((f) => f.alumno_id === alumnoId),
    io: {
      post: async (payload) => {
        const m = modo;
        posts.push(payload);
        if (latenciaMs > 0) await sleep(latenciaMs);
        if (m === 'http500') return { ok: false, status: 500, data: { message: 'error interno (ficticio)' } };
        if (m === 'timeout') { await sleep(timeoutMs + 300); return insertar(payload); }
        const r = insertar(payload);
        if (m === 'perdida' && r.ok) throw new Error('respuesta perdida (ficticia)');
        return r;
      },
      getById: async (id) => ({ ok: true, status: 200, data: filas.has(id) ? [filas.get(id)] : [] }),
    },
  };
}

/** Navegador simulado: flag de conexión + EventTarget falsos para window y document (visibilityState). */
export function crearNavegadorDemo() {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  const nav = { online: true };
  const fire = (target, type) => target.dispatchEvent(new Event(type));
  return {
    win, doc, nav,
    get online() { return nav.online; },
    desconectar: () => { nav.online = false; fire(win, 'offline'); },
    conectar: () => { nav.online = true; fire(win, 'online'); },
    ocultar: () => { doc.visibilityState = 'hidden'; fire(doc, 'visibilitychange'); },
    mostrar: () => { doc.visibilityState = 'visible'; fire(doc, 'visibilitychange'); },
    foco: () => fire(win, 'focus'),
    pageshow: () => fire(win, 'pageshow'),
    // online + visibilitychange (visible) + focus + pageshow en el MISMO tick (lo que hace iOS al volver a la PWA).
    simultaneos: () => {
      nav.online = true;
      doc.visibilityState = 'visible';
      fire(win, 'online'); fire(doc, 'visibilitychange'); fire(win, 'focus'); fire(win, 'pageshow');
    },
  };
}

/**
 * Mundo ficticio: storage + servidor + navegador + sesión (alumno A, B o ninguno) + controlador REAL conectado con attachSyncTriggers REAL.
 * opts: { latenciaMs, timeoutMs, retryDelaysMs, eventMinGapMs, reintentoLogSetMs, alCambiar(state), alResultado(r) }.
 */
export function crearMundoSync(opts) {
  const o = opts || {};
  const timeoutMs = o.timeoutMs || 1500;
  const storage = crearStorageDemo();
  const servidor = crearServidorSync({ latenciaMs: o.latenciaMs, timeoutMs });
  const navegador = crearNavegadorDemo();
  const sesion = { alumnoId: DEMO_ALUMNO_A };
  const series = [];
  const envios = [];
  const resultados = [];
  const timers = new Set();
  const alCambiar = typeof o.alCambiar === 'function' ? o.alCambiar : () => {};
  const alResultado = typeof o.alResultado === 'function' ? o.alResultado : () => {};
  let flushes = 0;

  const ctl = createPendingSyncController({
    storage,
    getAlumnoId: () => sesion.alumnoId,
    isOnline: () => navegador.nav.online,
    isInFlight: isSetSendInFlight,
    sendItem: (item, alumnoId) => postProgressIdempotent(servidor.io, buildProgressPayload(alumnoId, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId)),
    timeoutMs,
    locks: null,
    retryDelaysMs: o.retryDelaysMs,
    eventMinGapMs: o.eventMinGapMs,
    onChange: (st) => alCambiar(st),
    onResult: (r) => { flushes++; resultados.push(r); alResultado(r); },
  });
  const detach = attachSyncTriggers(ctl, { win: navegador.win, doc: navegador.doc });

  // Réplica del logSet de App.jsx: write-ahead -> serie local -> envío si hay conexión; si no confirma, un reintento a los pocos segundos.
  function registrarSerie(over) {
    const alumnoId = sesion.alumnoId;
    if (!alumnoId) return { ok: false, reason: 'sin-sesion' };
    const e = Object.assign({}, DEMO_EJERCICIO, over || {});
    const opId = generateOpId();
    const d = fechaHoy();
    const item = buildPendingProgressItem(e.id, e.kg, e.reps, '', d, DEMO_SEMANA, DEMO_CICLO, alumnoId, opId);
    const wa = writeAheadPendingSet(storage, item, Date.now());
    if (!wa.ok) return { ok: false, reason: wa.reason };
    series.push({ opId, alumnoId, exId: e.id, kg: item.kg, reps: item.reps });
    ctl.refresh();
    if (navegador.nav.online) {
      const envio = sendWriteAheadSet({
        storage, opId, timeoutMs,
        send: () => postProgressIdempotent(servidor.io, buildProgressPayload(alumnoId, e.id, e.kg, e.reps, '', d, DEMO_SEMANA, DEMO_CICLO, opId)),
      }).then((res) => {
        ctl.refresh();
        if (!res.confirmed && o.reintentoLogSetMs !== null) {
          const h = setTimeout(() => { timers.delete(h); ctl.trigger('retry'); }, o.reintentoLogSetMs || 4000);
          timers.add(h);
        }
        return res;
      });
      envios.push(envio);
    }
    return { ok: true, opId };
  }

  async function esperar() {
    for (let i = 0; i < 400; i++) {
      await Promise.all(envios.slice());
      if (!ctl.isFlushing()) break;
      await sleep(10);
    }
    await sleep(0);
  }

  return {
    storage, servidor, navegador, sesion, series, resultados, ctl,
    get flushes() { return flushes; },
    pendientes: (alumnoId) => { try { return visiblePendingItems(storage, alumnoId === undefined ? sesion.alumnoId : alumnoId).length; } catch (e) { return 0; } },
    pendientesDe: (alumnoId) => { try { return visiblePendingItems(storage, alumnoId); } catch (e) { return []; } },
    registrarSerie,
    registrarSinConexion: (n) => {
      if (navegador.nav.online) navegador.desconectar();
      const out = [];
      for (let i = 0; i < (n || 1); i++) out.push(registrarSerie());
      return out;
    },
    cambiarAlumno: () => {
      sesion.alumnoId = sesion.alumnoId === DEMO_ALUMNO_A ? DEMO_ALUMNO_B : DEMO_ALUMNO_A;
      return ctl.trigger('session');
    },
    cerrarSesion: () => {
      sesion.alumnoId = null;
      return ctl.trigger('session');
    },
    esperar,
    dispose: () => {
      ctl.dispose();
      detach();
      timers.forEach((h) => clearTimeout(h));
      timers.clear();
    },
  };
}

/** Escenarios automáticos con el controlador y los disparadores REALES. Devuelve [{ id, nombre, pass, detalle }]. */
export async function ejecutarEscenarios(opts) {
  const o = opts || {};
  const latenciaMs = o.latenciaMs != null ? o.latenciaMs : 600;
  const timeoutMs = o.timeoutMs != null ? o.timeoutMs : 1500;
  const nuevo = (extra) => crearMundoSync(Object.assign({ timeoutMs, reintentoLogSetMs: null }, extra || {}));
  const escenarios = [
    ['Serie sin conexión → queda pendiente, 0 POST, estado «sin conexión»', async (m) => {
      m.registrarSinConexion(1);
      const st = m.ctl.getState();
      const ok = m.pendientes() === 1 && m.servidor.posts.length === 0 && st.status === 'offline' && st.pending === 1;
      return [ok, m.pendientes() + ' pendiente, ' + m.servidor.posts.length + ' POST, estado ' + st.status];
    }],
    ['Recuperar conexión (evento online) → sincronización automática', async (m) => {
      m.registrarSinConexion(1);
      m.navegador.conectar();
      await m.esperar();
      const ok = m.servidor.filas.size === 1 && m.pendientes() === 0 && m.flushes === 1 && m.ctl.getState().status === 'idle';
      return [ok, m.servidor.filas.size + ' fila(s), ' + m.pendientes() + ' pendiente(s), ' + m.flushes + ' flush, estado ' + m.ctl.getState().status];
    }],
    ['Volver a Safari (visibilitychange visible) → sincroniza; oculto no dispara', async (m) => {
      m.registrarSinConexion(1);
      m.navegador.nav.online = true;   // la conexión volvió con la app en segundo plano (sin evento online)
      m.navegador.ocultar();
      await m.esperar();
      const postsOculto = m.servidor.posts.length;
      m.navegador.mostrar();
      await m.esperar();
      const ok = postsOculto === 0 && m.servidor.filas.size === 1 && m.pendientes() === 0 && m.ctl.getState().lastReason === 'visible';
      return [ok, 'oculto: ' + postsOculto + ' POST · visible: ' + m.servidor.filas.size + ' fila(s), ' + m.pendientes() + ' pendiente(s)'];
    }],
    ['Foco de la ventana → sincroniza', async (m) => {
      m.registrarSinConexion(1);
      m.navegador.nav.online = true;
      m.navegador.foco();
      await m.esperar();
      const ok = m.servidor.filas.size === 1 && m.pendientes() === 0 && m.ctl.getState().lastReason === 'focus';
      return [ok, m.servidor.filas.size + ' fila(s), ' + m.pendientes() + ' pendiente(s)'];
    }],
    ['online + visibilitychange + focus + pageshow simultáneos (3 series) → 1 flush, 1 POST por serie', async (m) => {
      m.registrarSinConexion(3);
      m.navegador.simultaneos();
      await m.esperar();
      const ids = m.servidor.posts.map((p) => p.id);
      const ok = m.flushes === 1 && m.servidor.posts.length === 3 && new Set(ids).size === 3 && m.servidor.filas.size === 3 && m.pendientes() === 0;
      return [ok, m.flushes + ' flush efectivo, ' + m.servidor.posts.length + ' POST, ' + m.servidor.filas.size + ' fila(s)'];
    }],
    ['POST lento de la serie (latencia ' + latenciaMs + ' ms) + evento online → sin duplicados', async (m) => {
      m.servidor.setLatencia(latenciaMs);
      const r = m.registrarSerie();
      await sleep(Math.min(30, latenciaMs));
      m.navegador.conectar();
      m.navegador.foco();
      await m.esperar();
      const ok = r.ok && m.servidor.posts.length === 1 && m.servidor.filas.size === 1 && m.pendientes() === 0;
      return [ok, m.servidor.posts.length + ' POST, ' + m.servidor.filas.size + ' fila(s), ' + m.pendientes() + ' pendiente(s)'];
    }],
    ['Timeout → pendiente conservado con el mismo opId; reintento manual → 1 fila', async (m) => {
      m.registrarSinConexion(1);
      const op = m.series[0].opId;
      m.servidor.setModo('timeout');
      m.navegador.conectar();
      await m.esperar();
      const st = m.ctl.getState();
      const conservado = m.pendientesDe(m.sesion.alumnoId).map((x) => x.opId);
      m.servidor.setModo('normal');
      await sleep(400);   // la respuesta tardía del servidor ya insertó la fila
      await m.ctl.retryNow();
      const ok = st.status === 'error' && conservado.length === 1 && conservado[0] === op && m.servidor.posts.every((p) => p.id === op) && m.servidor.filas.size === 1 && m.pendientes() === 0;
      return [ok, 'tras timeout: estado ' + st.status + ', pendiente ' + (conservado[0] === op ? 'con el mismo opId' : 'DISTINTO') + ' · reintento: ' + m.servidor.posts.length + ' POST (mismo id), ' + m.servidor.filas.size + ' fila'];
    }],
    ['Error HTTP 500 → pendiente conservado, «Reintentar»; reintento manual → sincroniza', async (m) => {
      m.registrarSinConexion(2);
      m.servidor.setModo('http500');
      m.navegador.conectar();
      await m.esperar();
      const st = m.ctl.getState();
      m.servidor.setModo('normal');
      await m.ctl.retryNow();
      const ok = st.status === 'error' && st.pending === 2 && st.failures === 1 && st.nextRetryAt != null && m.servidor.filas.size === 2 && m.pendientes() === 0 && m.ctl.getState().status === 'idle';
      return [ok, 'tras 500: ' + st.status + ' con ' + st.pending + ' pendientes y reintento programado · manual: ' + m.servidor.filas.size + ' fila(s)'];
    }],
    ['Respuesta perdida tras insertar → reintento con el MISMO opId (409 verificado) → 1 fila', async (m) => {
      m.registrarSinConexion(1);
      m.servidor.setModo('perdida');
      m.navegador.conectar();
      await m.esperar();
      const pend = m.pendientes();
      m.servidor.setModo('normal');
      await m.ctl.retryNow();
      const ok = pend === 1 && m.servidor.posts.length === 2 && m.servidor.posts[0].id === m.servidor.posts[1].id && m.servidor.filas.size === 1 && m.pendientes() === 0;
      return [ok, 'tras la pérdida: ' + pend + ' pendiente · ' + m.servidor.posts.length + ' POST con el mismo id, ' + m.servidor.filas.size + ' fila'];
    }],
    ['Tras un fallo, foco/visible dentro de 2 s no reintentan (sin bucle); online sí', async (m) => {
      m.registrarSinConexion(1);
      m.servidor.setModo('http500');
      m.navegador.conectar();
      await m.esperar();
      const p1 = m.servidor.posts.length;
      m.navegador.foco(); m.navegador.mostrar(); m.navegador.pageshow();
      await m.esperar();
      const p2 = m.servidor.posts.length;
      m.navegador.conectar();
      await m.esperar();
      const ok = p1 === 1 && p2 === 1 && m.servidor.posts.length === 2 && m.pendientes() === 1;
      return [ok, 'POST: ' + p1 + ' → eventos frenados ' + p2 + ' → online ' + m.servidor.posts.length + ' · pendiente conservado'];
    }],
    ['Cambio de alumno A → B: B no envía los pendientes de A; el contador es solo de B', async (m) => {
      m.registrarSinConexion(2);
      await m.cambiarAlumno();
      m.registrarSerie();
      const contB = m.ctl.getState().pending;
      m.navegador.conectar();
      await m.esperar();
      const ok = contB === 1 && m.servidor.filasDe(DEMO_ALUMNO_B).length === 1 && m.servidor.filasDe(DEMO_ALUMNO_A).length === 0 && m.pendientes(DEMO_ALUMNO_A) === 2;
      return [ok, 'contador con B: ' + contB + ' · filas B ' + m.servidor.filasDe(DEMO_ALUMNO_B).length + ', A ' + m.servidor.filasDe(DEMO_ALUMNO_A).length + ' · pendientes de A en el dispositivo: ' + m.pendientes(DEMO_ALUMNO_A)];
    }],
    ['Cerrar sesión → ningún POST aunque lleguen eventos; pendientes conservados', async (m) => {
      m.registrarSinConexion(2);
      await m.cerrarSesion();
      m.navegador.simultaneos();
      await m.ctl.retryNow();
      await m.esperar();
      const st = m.ctl.getState();
      const ok = m.servidor.posts.length === 0 && m.pendientes(DEMO_ALUMNO_A) === 2 && st.alumnoId === null && st.pending === 0 && st.status === 'idle';
      return [ok, m.servidor.posts.length + ' POST · ' + m.pendientes(DEMO_ALUMNO_A) + ' pendientes conservados · indicador oculto'];
    }],
    ['Recarga: controlador nuevo con pendientes en el dispositivo → los sincroniza al iniciar sesión', async (m) => {
      m.registrarSinConexion(2);
      m.dispose();
      const otro = crearMundoSync({ timeoutMs, reintentoLogSetMs: null });
      try {
        // Mismo dispositivo: se reutiliza el storage del mundo anterior.
        m.storage._m.forEach((v, k) => otro.storage.setItem(k, v));
        await otro.ctl.trigger('session');
        const ok = otro.servidor.filas.size === 2 && otro.pendientes() === 0;
        return [ok, otro.servidor.filas.size + ' fila(s) tras la recarga, ' + otro.pendientes() + ' pendiente(s)'];
      } finally { otro.dispose(); }
    }],
    ['Dos series idénticas legítimas (opIds distintos) → 2 filas', async (m) => {
      m.registrarSinConexion(2);
      m.navegador.conectar();
      await m.esperar();
      const f = [...m.servidor.filas.values()];
      const ok = f.length === 2 && f[0].id !== f[1].id && f[0].kg === f[1].kg && f[0].reps === f[1].reps;
      return [ok, f.length + ' fila(s) de ' + DEMO_EJERCICIO.kg + ' kg × ' + DEMO_EJERCICIO.reps + ', ids distintos'];
    }],
    ['Sin pendientes → estado inactivo (el indicador no se muestra)', async (m) => {
      await m.ctl.trigger('session');
      const st = m.ctl.getState();
      const ok = st.status === 'idle' && st.pending === 0 && m.servidor.posts.length === 0;
      return [ok, 'estado ' + st.status + ', ' + st.pending + ' pendientes, ' + m.servidor.posts.length + ' POST'];
    }],
  ];
  const out = [];
  for (let i = 0; i < escenarios.length; i++) {
    const [nombre, fn] = escenarios[i];
    const m = nuevo();
    try {
      const [pass, detalle] = await fn(m);
      out.push({ id: i + 1, nombre, pass: !!pass, detalle });
    } catch (err) {
      out.push({ id: i + 1, nombre, pass: false, detalle: 'error: ' + (err && err.message ? err.message : String(err)) });
    } finally {
      m.dispose();
    }
  }
  return out;
}
