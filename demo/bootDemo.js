// Arranque del modo DEMO (solo existe en builds de demo; ver lib/demoMode.js). Deja la app lista como "alumno ficticio" sin autenticacion
// y sin red: siembra localStorage con datos sinteticos, registra una API local que App.jsx usa en lugar de Supabase y bloquea fetch.
import { clearAllIronTrackPrefixedKeys } from "../lib/irontrackLocalStorage.js";
import { DEMO_ALUMNO_ID, DEMO_NAME, DEMO_RUTINA_ID, demoRutinaRow, demoSesiones, demoProgresoRows, demoPagoConfirmado } from "./demoData.js";
import { COACH_ALUMNOS, COACH_AUTH_ID, COACH_NAME, COACH_RUTINAS, COACH_STORE_ID, coachMensajes, coachProgreso, coachSesiones } from "./demoCoachData.js";
import { createDemoClient } from "./demoClient.js";

// Por defecto la demo abre como ENTRENADOR; `?rol=alumno` abre la interfaz del alumno (solo existe en builds de demo).
function demoRole() {
  try { return new URLSearchParams(location.search).get("rol") === "alumno" ? "alumno" : "entrenador"; } catch (e) { return "entrenador"; }
}

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

function seedStorage(role) {
  try { clearAllIronTrackPrefixedKeys(); } catch (e) {}
  const set = (k, v) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  if (role === "entrenador") {
    set("it_session", { role: "entrenador", name: COACH_NAME, entrenadorId: COACH_STORE_ID });
    set("it_onboard_done", "1");
    // La app guarda las plantillas en su lista local (it_rt) con es_plantilla; las filas del servidor no la conservan en esa lista.
    set("it_rt", COACH_RUTINAS.filter((r) => r.es_plantilla).map((r) => ({ id: r.id, name: r.nombre, days: r.datos.days, datos: r.datos, alumno: "", note: r.datos.note, alumno_id: null, es_plantilla: true, saved: true, collapsed: true })));
    set("it_demo", MARKER);
    return;
  }
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
  const role = demoRole();
  installNetworkBlock();
  seedStorage(role);
  const now = () => new Date().toISOString();
  let api;
  if (role === "entrenador") {
    const sesiones = coachSesiones();
    const progreso = coachProgreso();
    const mensajes = coachMensajes();
    const byAlumno = (rows, id) => rows.filter((r) => String(r.alumno_id) === String(id));
    // Todo lo del coach se lee de datos ficticios en memoria; las escrituras se confirman localmente y no salen del navegador.
    const sbOverrides = {
      getAlumnosStrict: async () => COACH_ALUMNOS.slice(),
      getAlumnos: async () => COACH_ALUMNOS.slice(),
      getRutinasByEntrenador: async () => COACH_RUTINAS.slice(),
      getRutinasByAlumnoIds: async (ids) => COACH_RUTINAS.filter((r) => (ids || []).map(String).includes(String(r.alumno_id))),
      getRutinas: async (id) => byAlumno(COACH_RUTINAS, id),
      getSesiones: async (id) => byAlumno(sesiones, id),
      getProgreso: async (id) => byAlumno(progreso, id),
      getUltimaSesion: async (id) => byAlumno(sesiones, id).slice(0, 1),
      // "Validar sesion no finalizada": lee las sesiones de esa semana y guarda la validada SOLO en memoria (no persiste ni sale del navegador).
      getSesionesByAlumnoRutinaSemana: async (alumnoId, rutinaId, _rutinaNombre, semana) =>
        byAlumno(sesiones, alumnoId).filter((s) => String(s.rutina_id) === String(rutinaId) && Number(s.semana) === Number(semana)),
      addSesion: async (data) => {
        const row = Object.assign({ id: "demo-ses-" + Date.now(), created_at: now() }, data);
        sesiones.unshift(row);
        return [row];
      },
      getMensajes: async (id) => byAlumno(mensajes, id).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
      getMensajesConversaciones: async (ids) => mensajes.filter((m) => (ids || []).map(String).includes(String(m.alumno_id))),
      getMensajesNoLeidosCount: async () => 0,
      addMensaje: async (data) => [Object.assign({ id: "demo-msg-" + Date.now(), created_at: now(), leido: false }, data)],
      getEntrenador: async () => [{ id: COACH_AUTH_ID, nombre: COACH_NAME, email: "entrenador@ejemplo.invalid" }],
      reconcileSemanaActivaAlumno: async () => ({ status: "noop" }),
      // Altas y cambios SIMULADOS: se confirman localmente (no persisten ni salen del navegador).
      createAlumno: async (data) => ({ data: [Object.assign({ id: "demo-alu-" + Date.now(), entrenador_id: COACH_STORE_ID }, data)], error: null }),
      createRutina: async (data) => [Object.assign({ id: "demo-rut-" + Date.now() }, data)],
      updateRutina: async (id, data) => [Object.assign({ id }, data)],
    };
    api = {
      marker: MARKER,
      role,
      sb: sbOverrides,
      client: createDemoClient({ coachUserId: COACH_AUTH_ID }),
      fetch: async (path, method, body) => {
        const m = String(method || "GET").toUpperCase();
        if (m !== "GET") return body == null ? null : Array.isArray(body) ? body : [body];
        if (/^alumnos\?/.test(path)) return COACH_ALUMNOS.slice();
        if (/^progreso\?/.test(path)) return progreso.slice();
        if (/^sesiones\?/.test(path)) return sesiones.slice();
        if (/^mensajes\?/.test(path)) return mensajes.filter((x) => !x.de_entrenador && !x.leido);
        if (/^entrenadores\?/.test(path)) return [{ id: COACH_AUTH_ID, nombre: COACH_NAME, email: "entrenador@ejemplo.invalid" }];
        return [];
      },
    };
  } else {
    const rows = demoProgresoRows();
    const sesiones = demoSesiones();
    const rutina = demoRutinaRow();
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
    api = {
      marker: MARKER,
      role,
      sb: sbOverrides,
      client: createDemoClient({}),
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
  }
  globalThis.__IRONTRACK_DEMO_API__ = api;
  if (document.body) banner(); else document.addEventListener("DOMContentLoaded", banner);
  return role === "entrenador" ? COACH_AUTH_ID : DEMO_RUTINA_ID;
}
