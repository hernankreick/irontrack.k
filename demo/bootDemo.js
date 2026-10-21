// Arranque del modo DEMO (solo existe en builds de demo; ver lib/demoMode.js). Deja la app lista como "alumno ficticio" sin autenticacion
// y sin red: siembra localStorage con datos sinteticos, registra una API local que App.jsx usa en lugar de Supabase y bloquea fetch.
import { clearAllIronTrackPrefixedKeys } from "../lib/irontrackLocalStorage.js";
import { DEMO_ALUMNO_ID, DEMO_NAME, DEMO_RUTINA_ID, demoRutinaRow, demoSesiones, demoProgresoRows, demoPagoConfirmado } from "./demoData.js";

const MARKER = "IRONTRACK_DEMO_BUILD_MARKER";

function installNetworkBlock() {
  const real = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;
  globalThis.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    let sameOrigin = false;
    try { sameOrigin = new URL(url, location.href).origin === location.origin; } catch (e) { sameOrigin = false; }
    // Solo se permiten lecturas de archivos estaticos del mismo origen (JS, CSS, fuentes); nada de escrituras ni de otros servidores.
    if (!real || !sameOrigin || method !== "GET" || /\/(rest|auth|functions|storage|realtime)\/v1/.test(url)) {
      return Promise.reject(new TypeError("DEMO: red bloqueada (" + method + ")"));
    }
    return real(input, init);
  };
}

function seedStorage() {
  try { clearAllIronTrackPrefixedKeys(); } catch (e) {}
  const set = (k, v) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  const r = demoRutinaRow();
  set("it_session", { role: "alumno", name: DEMO_NAME, alumnoId: DEMO_ALUMNO_ID, entrenadorId: "demo-entrenador" });
  set("it_onboard_done", "1");
  set("it_week", "1");
  set("it_rt", [{ id: r.id, name: r.nombre, days: r.datos.days, datos: r.datos, alumno: DEMO_NAME, note: r.datos.note, alumno_id: DEMO_ALUMNO_ID, saved: true }]);
  set("it_demo", MARKER);
}

function banner() {
  const el = document.createElement("div");
  el.setAttribute("role", "note");
  el.textContent = "DEMO · datos ficticios";
  // Abajo y centrado, en una sola linea: no tapa el logo ni los controles de arriba (el Plan reserva espacio inferior).
  el.style.cssText = "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 2px);transform:translateX(-50%);z-index:2147483000;background:#B45309;color:#fff;font:700 10px/1 system-ui,sans-serif;letter-spacing:.06em;white-space:nowrap;padding:3px 10px;border-radius:8px;pointer-events:none";
  document.body.appendChild(el);
}

export function bootDemo() {
  installNetworkBlock();
  seedStorage();

  const rows = demoProgresoRows();
  const sesiones = demoSesiones();
  const rutina = demoRutinaRow();
  const now = () => new Date().toISOString();
  // Escrituras SIMULADAS: se confirman localmente y no salen del navegador.
  const sbOverrides = {
    getRutinas: async () => [rutina],
    getSesiones: async () => sesiones.slice(),
    getProgreso: async () => rows.slice(),
    getUltimaSesion: async () => sesiones.slice(0, 1),
    reconcileSemanaActivaAlumno: async () => ({ status: "noop" }),
    updateRutinaSemanaActiva: async () => ({ ok: true }),
    addProgresoIdempotente: async (data) => [Object.assign({ created_at: now() }, data)],
    addProgreso: async (data) => [Object.assign({ created_at: now() }, data)],
    addSesion: async (data) => [Object.assign({ id: "demo-ses-" + Date.now(), created_at: now() }, data)],
  };
  globalThis.__IRONTRACK_DEMO_API__ = {
    marker: MARKER,
    sb: sbOverrides,
    // Reemplaza a sbFetch: lecturas con datos ficticios; escrituras devuelven el cuerpo sin enviar nada.
    fetch: async (path, method, body) => {
      const m = String(method || "GET").toUpperCase();
      if (m !== "GET") return body == null ? null : Array.isArray(body) ? body : [body];
      if (/^alumnos\?/.test(path)) return [{ id: DEMO_ALUMNO_ID, ultimo_pago_confirmado: demoPagoConfirmado() }];
      if (/^progreso\?/.test(path)) return rows.slice();
      if (/^sesiones\?/.test(path)) return sesiones.slice();
      return [];
    },
  };
  if (document.body) banner(); else document.addEventListener("DOMContentLoaded", banner);
  return DEMO_RUTINA_ID;
}
