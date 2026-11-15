// Aislamiento de la demo QA del PR #194 (demo/qa-pr194.html). SE IMPORTA PRIMERO en qaPr194DemoMain.jsx.
// Objetivo: que esta página NO pueda leer ni escribir el almacenamiento de la app real (mismo origen en Vercel Preview) ni hablar con
// ningún servidor. Defensa en capas (la primera es el <meta> CSP `connect-src 'self'` de la página; esto es la segunda y la tercera):
//   1. Storage.prototype.* y window.localStorage/sessionStorage -> memoria (Map por instancia). Nada llega al almacenamiento real.
//   2. window.indexedDB -> inexistente (la app real no se toca).
//   3. fetch / XMLHttpRequest / sendBeacon / WebSocket / EventSource -> bloqueados y registrados (visibles en pantalla).
// Limitaciones: todo vive en memoria; recargar la página reinicia la demo. Es un aislamiento de ESTA página, no un sandbox del navegador.

export const estadoAislamiento = {
  storageEnMemoria: false,
  indexedDBBloqueado: false,
  redBloqueada: false,
  intentosRed: [],
  listeners: [],
};
function avisar() { estadoAislamiento.listeners.forEach((f) => { try { f(); } catch (e) {} }); }
export function suscribirAislamiento(f) { estadoAislamiento.listeners.push(f); return () => { estadoAislamiento.listeners = estadoAislamiento.listeners.filter((x) => x !== f); }; }

function registrar(tipo, destino) {
  estadoAislamiento.intentosRed.push({ tipo, destino: String(destino).slice(0, 80) });
  avisar();
}

export function instalarAislamiento(win) {
  var w = win || (typeof window !== 'undefined' ? window : null);
  if (!w) return estadoAislamiento;

  // 1) Almacenamiento en memoria (por instancia: localStorage y sessionStorage no se mezclan entre sí)
  try {
    var mem = new WeakMap();
    var mapa = function (s) { var m = mem.get(s); if (!m) { m = new Map(); mem.set(s, m); } return m; };
    var P = w.Storage && w.Storage.prototype;
    if (P) {
      P.getItem = function (k) { var m = mapa(this); return m.has(String(k)) ? m.get(String(k)) : null; };
      P.setItem = function (k, v) { mapa(this).set(String(k), String(v)); };
      P.removeItem = function (k) { mapa(this).delete(String(k)); };
      P.clear = function () { mapa(this).clear(); };
      P.key = function (i) { var ks = Array.from(mapa(this).keys()); return i < ks.length ? ks[i] : null; };
      try { Object.defineProperty(P, 'length', { configurable: true, get: function () { return mapa(this).size; } }); } catch (e) {}
    }
    var memStorage = function () { var o = Object.create(P || Object.prototype); return o; };
    ['localStorage', 'sessionStorage'].forEach(function (n) {
      try { Object.defineProperty(w, n, { configurable: true, value: memStorage() }); } catch (e) {}
    });
    estadoAislamiento.storageEnMemoria = true;
  } catch (e) { estadoAislamiento.storageEnMemoria = false; }

  // 2) IndexedDB inexistente
  try { Object.defineProperty(w, 'indexedDB', { configurable: true, value: undefined }); estadoAislamiento.indexedDBBloqueado = true; } catch (e) { estadoAislamiento.indexedDBBloqueado = false; }

  // 3) Red bloqueada y registrada
  try {
    w.fetch = function (input) { var u = (input && input.url) || input; registrar('fetch', u); return Promise.reject(new TypeError('Demo aislada: sin red (' + String(u).slice(0, 60) + ')')); };
    if (w.XMLHttpRequest) {
      w.XMLHttpRequest.prototype.open = function (m, u) { registrar('xhr', u); throw new Error('Demo aislada: sin red'); };
    }
    if (w.navigator) { try { w.navigator.sendBeacon = function (u) { registrar('beacon', u); return false; }; } catch (e) {} }
    w.WebSocket = function (u) { registrar('websocket', u); throw new Error('Demo aislada: sin red'); };
    w.EventSource = function (u) { registrar('eventsource', u); throw new Error('Demo aislada: sin red'); };
    estadoAislamiento.redBloqueada = true;
  } catch (e) { estadoAislamiento.redBloqueada = false; }
  return estadoAislamiento;
}

instalarAislamiento();
