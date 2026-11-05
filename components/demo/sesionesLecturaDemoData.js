// Datos FICTICIOS y servidor FALSO en memoria de la demostración D76-02 (demo/sesiones-lectura.html, solo Preview o IRONTRACK_DEMO=1).
// Sin red, sin Supabase y sin almacenamiento: todo vive en memoria y se pierde al recargar.
// Usa el controlador REAL (lib/sesionesLectura.js) y la posición REAL (lib/studentWeeklyProgress.js); acá no se reimplementa lógica.
import {
  crearControladorSesiones,
  estadoPlanAlumno,
  puedeIniciarEntrenamientoAlumno,
  manejarSesionGuardada,
} from "../../lib/sesionesLectura.js";
import { getActiveStudentRoutinePosition } from "../../lib/studentWeeklyProgress.js";

export const DEMO_ALUMNO = { id: "demo-alumno-1", nombre: "Alumno Demo" };
export const DEMO_RUTINA_ID = "demo-rutina-1";
export const MODOS = ["ok", "http500", "red", "timeout", "vacia"];
export const DEMO_TIMEOUT_MS = 3000;

export function demoRutina() {
  return {
    id: DEMO_RUTINA_ID,
    nombre: "Rutina Demo",
    alumno_id: DEMO_ALUMNO.id,
    datos: {
      semana_activa: 1,
      ciclo_actual: 1,
      days: [
        { label: "Día 1", exercises: [{ id: "demo-ej-sq", name: "Sentadilla" }, { id: "demo-ej-bp", name: "Press banca" }, { id: "demo-ej-row", name: "Remo con barra" }] },
        { label: "Día 2", exercises: [{ id: "demo-ej-dl", name: "Peso muerto" }, { id: "demo-ej-ohp", name: "Press militar" }] },
        { label: "Día 3", exercises: [{ id: "demo-ej-lunge", name: "Zancada" }, { id: "demo-ej-pu", name: "Dominadas" }, { id: "demo-ej-plank", name: "Plancha" }] },
        { label: "Día 4", exercises: [{ id: "demo-ej-hip", name: "Hip thrust" }, { id: "demo-ej-rdl", name: "Peso muerto rumano" }] },
      ],
    },
  };
}

function fechaHoy(diasAtras) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - (diasAtras || 0));
  return d;
}

/** Fecha de hoy en formato es-AR (d/m/yyyy), como las filas reales. */
export function fechaEsAR(d) {
  const x = d || new Date();
  return x.getDate() + "/" + (x.getMonth() + 1) + "/" + x.getFullYear();
}

function filaSesion(id, diaIdx, diasAtras) {
  const d = fechaHoy(diasAtras);
  return {
    id: id,
    alumno_id: DEMO_ALUMNO.id,
    rutina_id: DEMO_RUTINA_ID,
    dia_idx: diaIdx,
    semana: 1,
    ciclo: 1,
    fecha: fechaEsAR(d),
    created_at: d.toISOString(),
  };
}

export function sesionesIniciales() {
  return [filaSesion("demo-ses-1", 0, 2), filaSesion("demo-ses-2", 1, 1)];
}

/**
 * Servidor falso. leer(alumnoId) => Promise<{ ok, status, data }> (mismo contrato que sb.getSesionesDetallado) según el modo:
 *   ok: filas actuales · http500: { ok:false, status:500 } · red: rechaza TypeError("Failed to fetch") · timeout: no resuelve · vacia: [].
 * encolarRespuesta({ demoraMs, filas }) fuerza la PRÓXIMA lectura (para simular una respuesta vieja que llega tarde).
 */
export function crearServidorDemo(opciones) {
  const o = opciones || {};
  let modo = o.modo || "ok";
  let filas = (o.filas || sesionesIniciales()).map((f) => Object.assign({}, f));
  const cola = [];
  let lecturas = 0;
  let nextId = 100;
  return {
    leer(alumnoId) {
      lecturas++;
      const propias = () => filas.filter((f) => String(f.alumno_id) === String(alumnoId)).map((f) => Object.assign({}, f));
      if (cola.length) {
        const r = cola.shift();
        const data = r.filas.map((f) => Object.assign({}, f));
        return new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, data: data }), r.demoraMs || 0));
      }
      if (modo === "http500") return Promise.resolve({ ok: false, status: 500, data: { message: "Error interno simulado" } });
      if (modo === "red") return Promise.reject(new TypeError("Failed to fetch"));
      if (modo === "timeout") return new Promise(() => {});
      if (modo === "vacia") return Promise.resolve({ ok: true, status: 200, data: [] });
      return Promise.resolve({ ok: true, status: 200, data: propias() });
    },
    setModo(m) { if (MODOS.includes(m)) modo = m; },
    modo() { return modo; },
    filas() { return filas.map((f) => Object.assign({}, f)); },
    lecturas() { return lecturas; },
    encolarRespuesta(r) { cola.push({ demoraMs: r.demoraMs, filas: r.filas || [] }); },
    /** Inserta una sesión (como el insert confirmado de la finalización) y devuelve la fila guardada. */
    insertarSesion(fila) {
      const guardada = Object.assign({ id: "demo-ses-" + nextId++ }, fila);
      filas = filas.concat([guardada]);
      return Object.assign({}, guardada);
    },
  };
}

/** Posición REAL del alumno (misma llamada que App) con las sesiones visibles del controlador. */
export function calcularPosicion(estado) {
  return getActiveStudentRoutinePosition({
    alumno: DEMO_ALUMNO,
    rutina: demoRutina(),
    sesiones: (estado && estado.rows) || [],
    completedDays: [],
    currentWeek: 0,
  });
}

/** Vista derivada (todo con funciones reales). */
export function resumen(estado) {
  const params = { esAlumno: true, readOnly: false, lectura: estado, weekGateActivo: false };
  const plan = estadoPlanAlumno(params);
  const pos = calcularPosicion(estado);
  return {
    plan: plan,
    puedeIniciar: puedeIniciarEntrenamientoAlumno(params),
    status: estado ? estado.status : "sin_datos",
    confiable: !!(estado && estado.confiable),
    reason: estado ? estado.reason : null,
    visibles: estado && estado.rows ? estado.rows.length : 0,
    semana: pos.weekNumber,
    diaActual: pos.currentDayIndex == null ? null : pos.currentDayIndex + 1,
    completados: pos.completedDaysInWeek,
    completedDayIndexes: pos.completedDayIndexes,
  };
}

export function crearEntorno(opciones) {
  const o = opciones || {};
  const servidor = crearServidorDemo({ modo: o.modo });
  const ctl = crearControladorSesiones({ leer: (aid) => servidor.leer(aid), timeoutMs: o.timeoutMs || DEMO_TIMEOUT_MS, alCambiar: o.alCambiar });
  return { servidor, ctl };
}

/**
 * Finalizar el día que toca + fallo de relectura: inserta en el servidor falso la sesión del día siguiente según la posición REAL,
 * pone el servidor en http500 y llama a manejarSesionGuardada (real) con la fila confirmada.
 */
export async function finalizarDiaConFalloRelectura(servidor, ctl) {
  const pos = calcularPosicion(ctl.estado());
  if (pos.currentDayIndex == null) return { ok: false, motivo: "la semana no tiene un día pendiente" };
  const ahora = new Date();
  const fila = servidor.insertarSesion({
    alumno_id: DEMO_ALUMNO.id,
    rutina_id: DEMO_RUTINA_ID,
    dia_idx: pos.currentDayIndex,
    semana: 1,
    ciclo: 1,
    fecha: fechaEsAR(ahora),
    created_at: ahora.toISOString(),
  });
  servidor.setModo("http500");
  await manejarSesionGuardada(ctl, DEMO_ALUMNO.id, fila);
  return { ok: true, fila: fila };
}

/** Respuesta vieja después de una nueva: la 1.ª lectura tarda demoraMs y trae 1 sesión; la 2.ª responde enseguida con las actuales. */
export async function respuestaViejaDespuesDeNueva(servidor, ctl, demoraMs) {
  const vieja = servidor.filas().slice(0, 1);
  servidor.encolarRespuesta({ demoraMs: demoraMs, filas: vieja });
  const primera = ctl.cargar(DEMO_ALUMNO.id);
  const segunda = ctl.cargar(DEMO_ALUMNO.id);
  await Promise.all([primera, segunda]);
  return ctl.estado();
}

const dia3Ok = (r) => r.plan === "plan" && r.diaActual === 3 && r.completados === 2 && r.puedeIniciar;

function linea(r) {
  if (r.plan !== "plan") return "plan " + r.plan + " · status " + r.status + " · sin día actual · inicio " + (r.puedeIniciar ? "permitido" : "bloqueado");
  return "plan " + r.plan + " · status " + r.status + " · Día actual " + (r.diaActual == null ? "—" : r.diaActual) +
    " · " + r.completados + " completados · inicio " + (r.puedeIniciar ? "permitido" : "bloqueado");
}

async function errorTrasOk(modo, timeoutMs) {
  const { servidor, ctl } = crearEntorno({ timeoutMs });
  await ctl.cargar(DEMO_ALUMNO.id);
  servidor.setModo(modo);
  await ctl.cargar(DEMO_ALUMNO.id);
  const r = resumen(ctl.estado());
  return { pass: dia3Ok(r) && r.status === "desactualizado", detalle: linea(r) + " · motivo " + r.reason };
}

/** Escenarios automáticos: cada uno con controlador y servidor falso NUEVOS. Devuelve [{ id, nombre, pass, detalle }]. */
export async function ejecutarEscenarios(opciones) {
  const timeoutMs = (opciones && opciones.timeoutMs) || 200;
  const escenarios = [
    ["Lectura exitosa", async () => {
      const { ctl } = crearEntorno({ timeoutMs });
      await ctl.cargar(DEMO_ALUMNO.id);
      const r = resumen(ctl.estado());
      return { pass: dia3Ok(r) && r.status === "ok", detalle: linea(r) };
    }],
    ["Error HTTP 500 tras una lectura ok", () => errorTrasOk("http500", timeoutMs)],
    ["Error de red tras una lectura ok", () => errorTrasOk("red", timeoutMs)],
    ["Timeout tras una lectura ok", () => errorTrasOk("timeout", timeoutMs)],
    ["Primer fallo sin estado previo (recarga + 500)", async () => {
      const { ctl } = crearEntorno({ timeoutMs, modo: "http500" });
      await ctl.cargar(DEMO_ALUMNO.id);
      const r = resumen(ctl.estado());
      return { pass: r.plan === "error" && !r.puedeIniciar && r.visibles === 0, detalle: linea(r) + " · no se asume Día 1" };
    }],
    ["Reintentar y recuperar", async () => {
      const { servidor, ctl } = crearEntorno({ timeoutMs, modo: "http500" });
      await ctl.cargar(DEMO_ALUMNO.id);
      const antes = resumen(ctl.estado());
      servidor.setModo("ok");
      await ctl.cargar(DEMO_ALUMNO.id);
      const r = resumen(ctl.estado());
      return { pass: antes.plan === "error" && dia3Ok(r) && r.status === "ok", detalle: "antes: " + antes.plan + " → después: " + linea(r) };
    }],
    ["Finalizar Día 3 + fallo de relectura", async () => {
      const { servidor, ctl } = crearEntorno({ timeoutMs });
      await ctl.cargar(DEMO_ALUMNO.id);
      const fin = await finalizarDiaConFalloRelectura(servidor, ctl);
      const r = resumen(ctl.estado());
      const visible = !!fin.fila && ctl.estado().rows.some((s) => s.id === fin.fila.id && s.dia_idx === 2);
      return {
        pass: r.plan === "plan" && r.completados === 3 && r.diaActual === 4 && visible && r.status === "desactualizado" && r.puedeIniciar,
        detalle: linea(r) + " · sesión del Día 3 " + (visible ? "visible" : "NO visible"),
      };
    }],
    ["Respuesta vacía válida", async () => {
      const { ctl } = crearEntorno({ timeoutMs, modo: "vacia" });
      await ctl.cargar(DEMO_ALUMNO.id);
      const r = resumen(ctl.estado());
      return { pass: r.plan === "plan" && r.confiable && r.completados === 0 && r.diaActual === 1 && r.puedeIniciar, detalle: linea(r) + " · el servidor confirmó 0 sesiones" };
    }],
    ["Respuesta vieja después de una nueva", async () => {
      const { servidor, ctl } = crearEntorno({ timeoutMs });
      const e = await respuestaViejaDespuesDeNueva(servidor, ctl, Math.min(timeoutMs / 2, 100));
      const r = resumen(e);
      return { pass: dia3Ok(r) && r.visibles === 2, detalle: linea(r) + " · " + r.visibles + " sesiones visibles (la vieja traía 1)" };
    }],
    ["Sesiones confirmadas visibles después de un error", async () => {
      const { servidor, ctl } = crearEntorno({ timeoutMs });
      await ctl.cargar(DEMO_ALUMNO.id);
      servidor.setModo("http500");
      await ctl.cargar(DEMO_ALUMNO.id);
      const ids = ctl.estado().rows.map((s) => s.id);
      const pass = ["demo-ses-1", "demo-ses-2"].every((id) => ids.includes(id)) && ctl.estado().status === "desactualizado";
      return { pass, detalle: "ids visibles: " + (ids.join(", ") || "ninguno") };
    }],
  ];
  const out = [];
  for (let i = 0; i < escenarios.length; i++) {
    const [nombre, fn] = escenarios[i];
    try {
      const r = await fn();
      out.push({ id: i + 1, nombre, pass: !!r.pass, detalle: r.detalle });
    } catch (e) {
      out.push({ id: i + 1, nombre, pass: false, detalle: "excepción: " + (e && e.message) });
    }
  }
  return out;
}
