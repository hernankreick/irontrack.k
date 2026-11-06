// D76-08 — Sincronizacion automatica y confiable de series pendientes (it_pq:* / it_pending_sync) + estado para el indicador del alumno.
//
// Problema: el flush solo corria al montar y con el evento 'online'. En iPhone (PWA / Safari) la app vuelve del segundo plano sin evento
// 'online' (visibilitychange, focus, pageshow de bfcache), asi que las series pendientes podian quedar sin enviar hasta recargar.
//
// Reglas:
//  - Solo sincroniza con una identidad VALIDADA (getAlumnoId(): alumno con sesion propia; nunca coach, enlace compartido ni lectura).
//    Sin identidad no hay flush ni POST: el estado vuelve a { alumnoId:null, pending:0, status:'idle' } y se cancela el reintento.
//  - El flush es SIEMPRE flushPendingForAlumno (lib/pendingSyncQueue.js) bajo withFlushLock: quita por opId solo con confirmacion del
//    servidor; ante error, timeout o respuesta ambigua el pendiente queda con el MISMO opId (el servidor deduplica por progreso.id).
//  - Coalescencia: si hay un flush en curso, trigger() devuelve LA MISMA promesa (online + focus + visibilitychange + pageshow juntos =
//    un unico flush efectivo). Lo que logSet ya esta enviando en esta pestaña (isInFlight) no se reenvia.
//  - Sin conexion: no se intenta enviar (estado 'offline', pendientes conservados).
//  - Backoff acotado: tras un flush con fallos se programa UN reintento con retryDelaysMs[fallos-1]; agotada la lista no hay mas timers
//    (espera un evento o el reintento manual). Eventos automaticos (focus/visible/pageshow/session) dentro de eventMinGapMs desde un flush
//    fallido se descartan ('throttled') para no entrar en un bucle rapido; 'online', 'manual' y 'retry' no se frenan.
//  - Si la identidad cambia mientras corre un flush, ese resultado NO se aplica al estado del alumno nuevo: se recalcula para el actual
//    (y, si el nuevo alumno tiene pendientes, se dispara su propio flush). Cada envio verifica la identidad antes de salir.
//  - Si otra pestaña tiene el cerrojo (ran:false) el estado queda 'pending' y se reintenta con los mismos plazos acotados.
//  - Sin setInterval ni sondeo: solo eventos del navegador (attachSyncTriggers), el timer de backoff y llamadas explicitas.
//  - No persiste nada propio: solo lee/escribe lo que ya leen/escriben flushPendingForAlumno y visiblePendingItems.
//  - D7.6: las series pendientes con datos invalidos (pendienteEnviable false) NO cuentan como pendientes (no disparan flush, reintentos
//    ni estado 'pending'/'error'): se exponen aparte en state.invalid / state.invalidItems para el aviso, y quedan en el dispositivo.
//
// Todo es inyectable (storage, reloj, timers, locks, envio) para probarlo en node: scripts/test-d7-6SyncForeground.mjs.
//  - D76-09: lo rechazado por un borrado de historial pasa a cuarentena (lib/historialCuarentena.js): no cuenta como pendiente ni como
//    error, no se reintenta; se expone en state.quarantined / state.quarantinedItems. onTrigger(alumnoId, reason) (opcional, sin esperar)
//    permite refrescar el sello del historial en cada evento del navegador.
import { flushPendingForAlumno, visiblePendingItems, withFlushLock, pendienteEnviable } from "./pendingSyncQueue.js";
import { leerCuarentena } from "./historialCuarentena.js";

export var DEFAULT_RETRY_DELAYS_MS = [5000, 15000, 45000, 120000];
export var DEFAULT_EVENT_MIN_GAP_MS = 2000;

// Eventos automaticos que se frenan durante eventMinGapMs tras un flush fallido.
var THROTTLED_REASONS = { focus: true, visible: true, pageshow: true, session: true };

function idOrNull(v) {
  return v == null || v === "" ? null : String(v);
}

export function createPendingSyncController(opts) {
  var o = opts || {};
  var storage = o.storage;
  var getAlumnoId = typeof o.getAlumnoId === "function" ? o.getAlumnoId : function () { return null; };
  var isOnline = typeof o.isOnline === "function" ? o.isOnline : function () { return true; };
  var sendItem = o.sendItem;
  var isInFlight = typeof o.isInFlight === "function" ? o.isInFlight : function () { return false; };
  var timeoutMs = o.timeoutMs;
  var locks = o.locks;
  var now = typeof o.now === "function" ? o.now : function () { return Date.now(); };
  var setTimer = typeof o.setTimer === "function" ? o.setTimer : function (fn, ms) { return setTimeout(fn, ms); };
  var clearTimer = typeof o.clearTimer === "function" ? o.clearTimer : function (h) { clearTimeout(h); };
  var retryDelaysMs = Array.isArray(o.retryDelaysMs) ? o.retryDelaysMs.slice() : DEFAULT_RETRY_DELAYS_MS.slice();
  var eventMinGapMs = o.eventMinGapMs != null ? Number(o.eventMinGapMs) : DEFAULT_EVENT_MIN_GAP_MS;
  var onChange = typeof o.onChange === "function" ? o.onChange : null;
  var onResult = typeof o.onResult === "function" ? o.onResult : null;
  var onTrigger = typeof o.onTrigger === "function" ? o.onTrigger : null;

  var state = { alumnoId: null, pending: 0, inFlight: 0, status: "idle", lastReason: null, failures: 0, nextRetryAt: null, invalid: 0, invalidItems: [], quarantined: 0, quarantinedItems: [] };
  var current = null;        // promesa del flush en curso (coalescencia)
  var timer = null;
  var lastFailAt = null;     // momento del ultimo flush con fallos (para el freno de eventos)
  var lockMisses = 0;        // flush que no corrio porque otra pestaña tenia el cerrojo
  var disposed = false;

  function readId() {
    try { return idOrNull(getAlumnoId()); } catch (e) { return null; }
  }
  function online() {
    try { return isOnline() !== false; } catch (e) { return true; }
  }
  function readQuarantine(aid) {
    var q = { series: [], sesiones: [] };
    try { q = leerCuarentena(storage, aid); } catch (e) { q = { series: [], sesiones: [] }; }
    var items = q.series.map(function (r) {
      var it = r.item || {};
      return { tipo: "serie", id: r.id, exId: it.exId != null ? String(it.exId) : "", kg: it.kg, reps: it.reps, date: it.date != null ? String(it.date) : "", rechazadoAt: r.rechazadoAt || null };
    }).concat(q.sesiones.map(function (r) {
      var s = r.payload || {};
      return { tipo: "sesion", id: r.id, diaLabel: s.dia_label || "", date: s.fecha != null ? String(s.fecha) : "", rechazadoAt: r.rechazadoAt || null };
    }));
    return { quarantined: items.length, quarantinedItems: items };
  }
  function readPending(aid) {
    if (!aid) return { count: 0, inFlight: 0, invalid: 0, invalidItems: [], quarantined: 0, quarantinedItems: [] };
    var all = [];
    try { all = visiblePendingItems(storage, aid); } catch (e) { all = []; }
    var items = all.filter(pendienteEnviable);
    // D7.6: resumen (sin modificar nada) de las series que no se enviaran, para que el aviso permita identificarlas.
    var invalidItems = all.filter(function (it) { return !pendienteEnviable(it); }).map(function (it) {
      return { opId: it && it.opId != null ? String(it.opId) : null, exId: it && it.exId != null ? String(it.exId) : "", kg: it ? it.kg : null, reps: it ? it.reps : null, date: it && it.date != null ? String(it.date) : "" };
    });
    var fl = 0;
    items.forEach(function (it) {
      try { if (it && typeof it.opId === "string" && it.opId && isInFlight(it.opId)) fl++; } catch (e) {}
    });
    var qr = readQuarantine(aid);
    return { count: items.length, inFlight: fl, invalid: invalidItems.length, invalidItems: invalidItems, quarantined: qr.quarantined, quarantinedItems: qr.quarantinedItems };
  }
  // Campos de cuarentena/invalidos para setState (se repiten en cada rama).
  function extra(p) {
    return { invalid: p.invalid, invalidItems: p.invalidItems, quarantined: p.quarantined, quarantinedItems: p.quarantinedItems };
  }

  function emit() {
    if (onChange) { try { onChange(getState()); } catch (e) {} }
  }
  function setState(patch) {
    var next = Object.assign({}, state, patch);
    var changed = Object.keys(next).some(function (k) {
      if (k === "invalidItems" || k === "quarantinedItems") return JSON.stringify(next[k]) !== JSON.stringify(state[k]);
      return next[k] !== state[k];
    });
    state = next;
    if (changed) emit();
  }
  function cancelTimer() {
    if (timer != null) { try { clearTimer(timer); } catch (e) {} }
    timer = null;
    if (state.nextRetryAt != null) state = Object.assign({}, state, { nextRetryAt: null });
  }
  function schedule(delay) {
    cancelTimer();
    if (delay == null || !Number.isFinite(Number(delay)) || disposed) return null;
    var at = now() + Number(delay);
    timer = setTimer(function () {
      timer = null;
      state = Object.assign({}, state, { nextRetryAt: null });
      trigger("retry");
    }, Number(delay));
    return at;
  }
  function resetNoIdentity() {
    cancelTimer();
    failures0();
    setState({ alumnoId: null, pending: 0, inFlight: 0, status: "idle", failures: 0, nextRetryAt: null, invalid: 0, invalidItems: [], quarantined: 0, quarantinedItems: [] });
  }
  function failures0() {
    lastFailAt = null;
    lockMisses = 0;
  }

  // Estado "en reposo" (sin flush en curso) para el alumno aid.
  function restingStatus(aid, p) {
    if (!online()) return "offline";
    if (p.count === 0) return "idle";
    if (state.alumnoId === aid && state.status === "error" && state.failures > 0) return "error";
    // Todo lo pendiente lo esta enviando logSet en esta pestaña: se informa como sincronizando.
    if (p.inFlight === p.count) return "syncing";
    return "pending";
  }

  function refresh() {
    if (disposed) return getState();
    var aid = readId();
    if (!aid) { resetNoIdentity(); return getState(); }
    if (state.alumnoId !== aid) {
      cancelTimer();
      failures0();
      state = Object.assign({}, state, { alumnoId: aid, failures: 0, status: "idle", lastReason: null });
    }
    var p = readPending(aid);
    if (current) {
      setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight }, extra(p)));
      return getState();
    }
    var status = restingStatus(aid, p);
    if (status === "idle") {
      cancelTimer();
      failures0();
      setState(Object.assign({ alumnoId: aid, pending: 0, inFlight: 0, status: "idle", failures: 0, nextRetryAt: null }, extra(p)));
      return getState();
    }
    setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight, status: status }, extra(p)));
    return getState();
  }

  async function run(aid, reason) {
    var r;
    try {
      r = await withFlushLock(function () {
        return flushPendingForAlumno({
          storage: storage,
          alumnoId: aid,
          isInFlight: isInFlight,
          timeoutMs: timeoutMs,
          // Cada envio verifica que la identidad siga siendo la misma (logout o cambio de alumno a mitad del flush => no se envia).
          send: function (item) { return readId() === aid ? sendItem(item, aid) : Promise.resolve(null); },
        });
      }, { locks: locks });
    } catch (e) {
      r = { ran: true, value: { sent: 0, failed: 1, error: true } };
    }
    var v = (r && r.ran && r.value) || {};
    var result = { reason: reason, alumnoId: aid, ran: !!(r && r.ran), sent: v.sent || 0, failed: v.failed || 0, quarantined: v.quarantined || 0, skipped: v.skipped || null, stale: false };
    current = null;
    if (disposed) return result;

    var nowId = readId();
    if (nowId !== aid) {
      // Identidad cambiada mientras corria: no se aplica nada al estado del alumno nuevo; se recalcula para el actual.
      result.stale = true;
      cancelTimer();
      failures0();
      state = Object.assign({}, state, { failures: 0, status: "idle", alumnoId: nowId === null ? null : state.alumnoId });
      refresh();
      if (nowId && state.pending > 0) trigger("session");
      return result;
    }

    var p = readPending(aid);
    if (!result.ran) {
      lockMisses++;
      var at0 = schedule(retryDelaysMs[lockMisses - 1]);
      setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight, status: p.count ? (online() ? "pending" : "offline") : "idle", lastReason: reason, nextRetryAt: at0 }, extra(p)));
    } else if (result.failed > 0 || result.skipped === "corrupt") {
      lockMisses = 0;
      lastFailAt = now();
      var failures = state.failures + 1;
      // Lista corrupta: reintentar no ayuda, no se programa timer.
      var at1 = result.skipped === "corrupt" ? (cancelTimer(), null) : schedule(retryDelaysMs[failures - 1]);
      setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight, status: online() ? "error" : "offline", lastReason: reason, failures: failures, nextRetryAt: at1 }, extra(p)));
    } else {
      cancelTimer();
      failures0();
      state = Object.assign({}, state, { failures: 0, status: "idle" });
      setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight, status: p.count ? restingStatus(aid, p) : "idle", lastReason: reason, failures: 0, nextRetryAt: null }, extra(p)));
    }
    if (onResult) { try { onResult(result); } catch (e) {} }
    return result;
  }

  /** Pide una sincronizacion. reason: 'online' | 'visible' | 'focus' | 'pageshow' | 'session' | 'retry' | 'manual'. */
  function trigger(reason) {
    if (disposed) return Promise.resolve({ reason: reason, skipped: "disposed" });
    var aid = readId();
    if (!aid) { resetNoIdentity(); return Promise.resolve({ reason: reason, skipped: "no-alumno" }); }
    if (onTrigger) { try { Promise.resolve(onTrigger(aid, reason)).catch(function () {}); } catch (e) {} }
    if (current) return current;
    if (state.alumnoId !== aid) {
      cancelTimer();
      failures0();
      state = Object.assign({}, state, { alumnoId: aid, failures: 0, status: "idle" });
    }
    var p = readPending(aid);
    if (!online()) {
      cancelTimer();
      setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight, status: "offline", lastReason: reason }, extra(p)));
      return Promise.resolve({ reason: reason, skipped: "offline" });
    }
    if (p.count === 0) {
      cancelTimer();
      failures0();
      setState(Object.assign({ alumnoId: aid, pending: 0, inFlight: 0, status: "idle", lastReason: reason, failures: 0, nextRetryAt: null }, extra(p)));
      return Promise.resolve({ reason: reason, skipped: "empty" });
    }
    if (THROTTLED_REASONS[reason] && lastFailAt != null && now() - lastFailAt < eventMinGapMs) {
      return Promise.resolve({ reason: reason, skipped: "throttled" });
    }
    cancelTimer();
    setState(Object.assign({ alumnoId: aid, pending: p.count, inFlight: p.inFlight, status: "syncing", lastReason: reason, nextRetryAt: null }, extra(p)));
    current = run(aid, reason);
    return current;
  }

  function getState() {
    return Object.assign({}, state, { invalidItems: (state.invalidItems || []).slice(), quarantinedItems: (state.quarantinedItems || []).slice() });
  }

  function dispose() {
    disposed = true;
    cancelTimer();
  }

  return {
    trigger: trigger,
    retryNow: function () { return trigger("manual"); },
    refresh: refresh,
    getState: getState,
    dispose: dispose,
    isFlushing: function () { return current != null; },
  };
}

/**
 * Conecta los eventos del navegador al controlador. Devuelve detach().
 *  - window 'online'  -> trigger('online');  window 'offline' -> refresh()
 *  - document 'visibilitychange' solo con visibilityState === 'visible' -> trigger('visible')  (volver a Safari / a la PWA)
 *  - window 'focus' -> trigger('focus');  window 'pageshow' -> trigger('pageshow')  (reanudacion desde bfcache en iOS)
 */
export function attachSyncTriggers(controller, env) {
  var e = env || {};
  var win = e.win || null;
  var doc = e.doc || null;
  var onOnline = function () { controller.trigger("online"); };
  var onOffline = function () { controller.refresh(); };
  var onVisibility = function () { if (doc && doc.visibilityState === "visible") controller.trigger("visible"); };
  var onFocus = function () { controller.trigger("focus"); };
  var onPageShow = function () { controller.trigger("pageshow"); };
  if (win && typeof win.addEventListener === "function") {
    win.addEventListener("online", onOnline);
    win.addEventListener("offline", onOffline);
    win.addEventListener("focus", onFocus);
    win.addEventListener("pageshow", onPageShow);
  }
  if (doc && typeof doc.addEventListener === "function") doc.addEventListener("visibilitychange", onVisibility);
  return function detach() {
    if (win && typeof win.removeEventListener === "function") {
      win.removeEventListener("online", onOnline);
      win.removeEventListener("offline", onOffline);
      win.removeEventListener("focus", onFocus);
      win.removeEventListener("pageshow", onPageShow);
    }
    if (doc && typeof doc.removeEventListener === "function") doc.removeEventListener("visibilitychange", onVisibility);
  };
}
