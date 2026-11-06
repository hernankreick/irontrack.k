// Demostración D76-09 (demo/historial-cuarentena.html): series pendientes después de que el entrenador borra el historial.
// Datos ficticios, sin Supabase, sin red y sin el almacenamiento real del navegador: "storage" y "servidor" son objetos en memoria.
// La lógica es la REAL: sello del historial (lib/historialSello.js), write-ahead (lib/setWriteAhead.js), flush y cuarentena
// (lib/pendingSyncQueue.js + lib/historialCuarentena.js), controlador (lib/pendingSyncController.js), payload/pendiente
// (lib/workoutSession.js) y POST idempotente (lib/progressInsert.js). El servidor falso aplica la MISMA regla que el trigger de la
// migración D76-09 (docs/d76-09/01_migracion_d76_09.sql) y responde como PostgREST (400 + code IT409).
//
//   node scripts/test-demoHistorialCuarentena.mjs   (corre ejecutarEscenarios, lo mismo que el botón "Ejecutar pruebas automáticas")
import { crearStorageDemo } from './registroSeriesDemoData.js';
import { createPendingSyncController } from '../../lib/pendingSyncController.js';
import { generateOpId, visiblePendingItems } from '../../lib/pendingSyncQueue.js';
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight } from '../../lib/setWriteAhead.js';
import { postProgressIdempotent } from '../../lib/progressInsert.js';
import { buildPendingProgressItem, buildProgressPayload } from '../../lib/workoutSession.js';
import { obtenerSello, selloParaRegistrar, leerSelloCache, RPC_HISTORIAL } from '../../lib/historialSello.js';
import { leerCuarentena, prepararConfirmacionReingreso, ejecutarReingreso } from '../../lib/historialCuarentena.js';

export const DEMO_ALUMNO = 'demo-alumno-d7609';
export const DEMO_EJERCICIO = { id: 'sentadilla-demo', name: 'Sentadilla (demo)' };

let tokSeq = 0;
function nuevoSello() {
  tokSeq++;
  var h = (Date.now().toString(16) + tokSeq.toString(16) + Math.random().toString(16).slice(2)).replace(/[^0-9a-f]/g, '').padEnd(32, '0').slice(0, 32);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32);
}

/**
 * Servidor falso: tabla progreso (PK id) + estado del historial por alumno { epoch, token, reset_at } y las RPC de D76-09
 * (sello, limpiar, reingresar). Regla de inserción = it_private.historial_guard_insert en modo 'activo'.
 */
export function crearServidorHistorial() {
  var progreso = new Map();
  var estado = {};
  var est = function (a) { return estado[a] || { epoch: 0, token: null, reset_at: null }; };
  var guard = function (row) {
    var e = est(row.alumno_id);
    if (!e.reset_at) return null;
    if (row.historial_token && row.historial_token === e.token) return null;
    return row.historial_token ? 'sello_anterior' : 'sin_sello';
  };
  var rpc = async function (name, args) {
    var a = args.p_alumno_id;
    var e = est(a);
    if (name === RPC_HISTORIAL.SELLO) return { data: [{ epoch: e.epoch, sello: e.token, reset_at: e.reset_at, modo: 'activo', vinculado: true }], error: null, missing: false };
    if (name === RPC_HISTORIAL.LIMPIAR) {
      if (args.p_epoch_esperado !== e.epoch) return { data: [{ ok: false, reason: 'conflicto_epoch', epoch: e.epoch }], error: null, missing: false };
      var borradas = 0;
      progreso.forEach(function (r, k) { if (r.alumno_id === a) { progreso.delete(k); borradas++; } });
      estado[a] = { epoch: e.epoch + 1, token: nuevoSello(), reset_at: new Date().toISOString() };
      return { data: [{ ok: true, epoch: e.epoch + 1, progreso: borradas, sesiones: 0 }], error: null, missing: false };
    }
    if (name === RPC_HISTORIAL.REINGRESAR) {
      if (!e.reset_at) return { data: [{ ok: false, reason: 'sin_borrado' }], error: null, missing: false };
      if (args.p_epoch_confirmado !== e.epoch) return { data: [{ ok: false, reason: 'conflicto_epoch', epoch: e.epoch }], error: null, missing: false };
      var res = [];
      (args.p_series || []).forEach(function (s) {
        if (!(typeof s.kg === 'number' && s.kg >= 0 && Number.isInteger(s.reps) && s.reps >= 1)) { res.push({ tipo: 'serie', id: s.id, resultado: 'invalida' }); return; }
        if (progreso.has(s.id)) { res.push({ tipo: 'serie', id: s.id, resultado: 'ya_existia' }); return; }
        progreso.set(s.id, { id: s.id, alumno_id: a, ejercicio_id: s.ejercicio_id, kg: s.kg, reps: s.reps, fecha: s.fecha, historial_epoch: e.epoch, reingreso_de_epoch: s.epoch_original, reingreso_at: new Date().toISOString() });
        res.push({ tipo: 'serie', id: s.id, resultado: 'insertada' });
      });
      return { data: [{ ok: true, epoch: e.epoch, resultados: res }], error: null, missing: false };
    }
    return { data: null, error: { code: 'PGRST202' }, missing: true };
  };
  var io = {
    post: async function (p) {
      var g = guard(p);
      if (g) return { ok: false, status: 400, data: { code: 'IT409', message: 'it_historial_reiniciado', details: g, hint: 'epoch_vigente=' + est(p.alumno_id).epoch } };
      if (progreso.has(p.id)) return { ok: false, status: 409, data: { code: '23505', details: 'Key (id)=(' + p.id + ') already exists.' } };
      var row = Object.assign({}, p, { historial_epoch: est(p.alumno_id).epoch });
      delete row.historial_token;
      progreso.set(p.id, row);
      return { ok: true, status: 201, data: [row] };
    },
    getById: async function (id) { return { ok: true, status: 200, data: progreso.has(id) ? [progreso.get(id)] : [] }; },
  };
  return {
    rpc: rpc, io: io,
    filas: function (a) { var out = []; progreso.forEach(function (r) { if (r.alumno_id === a) out.push(r); }); return out.sort(function (x, y) { return x.kg - y.kg; }); },
    estado: function (a) { return est(a); },
  };
}

/** Mundo de la demo: teléfono del alumno (storage + controlador reales), conexión simulada y servidor falso. */
export function crearMundoHistorial(opts) {
  var o = opts || {};
  var storage = crearStorageDemo();
  var servidor = crearServidorHistorial();
  var online = true;
  var kg = 60;
  var A = DEMO_ALUMNO;
  // Sin conexión no hay red: ni RPC ni POST.
  var rpcAlumno = function (n, a) { return online ? servidor.rpc(n, a) : Promise.resolve({ data: null, error: { message: 'sin conexión (demo)' }, missing: false }); };
  var send = function (item) {
    if (!online) return Promise.reject(new Error('sin conexión (demo)'));
    return postProgressIdempotent(servidor.io, buildProgressPayload(A, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId, item.historial_token));
  };
  var refrescarSello = function () { return online ? obtenerSello({ rpc: rpcAlumno, storage: storage, alumnoId: A }) : Promise.resolve(null); };
  var ctl = createPendingSyncController({
    storage: storage, getAlumnoId: function () { return A; }, isOnline: function () { return online; }, isInFlight: isSetSendInFlight,
    sendItem: function (item) { return send(item); }, onChange: o.onChange, onResult: o.onResult,
    onTrigger: function () { return refrescarSello(); }, retryDelaysMs: [3000], timeoutMs: o.timeoutMs || 3000, locks: null,
  });
  return {
    storage: storage, servidor: servidor, ctl: ctl, alumnoId: A, rpcAlumno: rpcAlumno,
    online: function () { return online; },
    setOnline: function (v) { online = !!v; if (online) return ctl.trigger('online'); ctl.refresh(); return Promise.resolve(null); },
    refrescarSello: refrescarSello,
    /** Igual que logSet de App.jsx: sello vigente AL REGISTRAR, write-ahead y envío inmediato si hay conexión. */
    registrarSerie: async function () {
      kg += 2.5;
      var opId = generateOpId();
      var c = leerSelloCache(storage, A);
      var it = buildPendingProgressItem(DEMO_EJERCICIO.id, kg, 5, '', new Date().toLocaleDateString('es-AR'), 1, 1, A, opId, selloParaRegistrar(storage, A), c && c.capacidad ? c.epoch : null);
      if (!writeAheadPendingSet(storage, it, Date.now()).ok) return { kg: kg, estado: 'no_guardada' };
      ctl.refresh();
      if (!online) return { kg: kg, estado: 'pendiente' };
      var r = await sendWriteAheadSet({ storage: storage, opId: opId, send: function () { return send(it); }, timeoutMs: o.timeoutMs || 3000 });
      ctl.refresh();
      if (r.reason === 'historial_reiniciado') await refrescarSello();
      return { kg: kg, estado: r.confirmed ? 'guardada' : r.reason === 'historial_reiniciado' ? 'revision' : 'pendiente' };
    },
    /** El entrenador limpia el historial (RPC atómica con la época que ve). */
    limpiarHistorial: async function () {
      var st = await servidor.rpc(RPC_HISTORIAL.SELLO, { p_alumno_id: A });
      var r = await servidor.rpc(RPC_HISTORIAL.LIMPIAR, { p_alumno_id: A, p_epoch_esperado: st.data[0].epoch });
      return r.data[0];
    },
    pendientes: function () { return visiblePendingItems(storage, A).length; },
    cuarentena: function () { var q = leerCuarentena(storage, A); return q.series.length + q.sesiones.length; },
    filas: function () { return servidor.filas(A); },
  };
}

/** Escenarios automáticos (los mismos que corre scripts/test-demoHistorialCuarentena.mjs). Devuelve [{ nombre, ok, detalle }]. */
export async function ejecutarEscenarios() {
  var out = [];
  var paso = function (nombre, ok, detalle) { out.push({ nombre: nombre, ok: !!ok, detalle: detalle || '' }); };
  try {
    var m = crearMundoHistorial();
    await m.ctl.trigger('session');
    await m.registrarSerie();
    paso('Serie con conexión → guardada en el servidor', m.filas().length === 1);
    await m.setOnline(false);
    await m.registrarSerie(); await m.registrarSerie();
    paso('Dos series sin conexión → quedan en el teléfono', m.pendientes() === 2);
    var lim = await m.limpiarHistorial();
    paso('El entrenador limpia el historial (época 1)', lim.ok && lim.epoch === 1 && m.filas().length === 0);
    await m.setOnline(true);
    paso('Al volver la conexión las series viejas NO reaparecen: van a revisión', m.filas().length === 0 && m.cuarentena() === 2 && m.pendientes() === 0, 'servidor ' + m.filas().length + ' · revisión ' + m.cuarentena());
    await m.refrescarSello();
    var nueva = await m.registrarSerie();
    paso('Serie nueva después del borrado (sello vigente) → aceptada', nueva.estado === 'guardada' && m.filas().length === 1);
    var conf = await prepararConfirmacionReingreso({ rpc: m.rpcAlumno, storage: m.storage, alumnoId: m.alumnoId });
    var sub = await ejecutarReingreso({ rpc: m.rpcAlumno, storage: m.storage, alumnoId: m.alumnoId, epochConfirmado: conf.epoch });
    paso('«Subir igual» con confirmación → suben con auditoría', sub.ok && m.filas().length === 3 && m.cuarentena() === 0 && m.filas().filter(function (f) { return f.reingreso_at; }).length === 2);
    await m.setOnline(false); await m.registrarSerie();
    await m.limpiarHistorial(); await m.setOnline(true);
    var conf2 = await prepararConfirmacionReingreso({ rpc: m.rpcAlumno, storage: m.storage, alumnoId: m.alumnoId });
    await m.limpiarHistorial();
    var sub2 = await ejecutarReingreso({ rpc: m.rpcAlumno, storage: m.storage, alumnoId: m.alumnoId, epochConfirmado: conf2.epoch });
    paso('Otro borrado durante la confirmación → conflicto, no se sube nada', !sub2.ok && sub2.reason === 'conflicto_epoch' && m.cuarentena() === 1 && m.filas().length === 0);
    m.ctl.dispose();
  } catch (e) {
    paso('Error inesperado', false, e && e.message);
  }
  return out;
}
