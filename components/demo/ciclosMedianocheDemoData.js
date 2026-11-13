// Demostración D76-04/05 (demo/ciclos-medianoche.html): series por ciclo de rutina y fecha estable del entrenamiento al cruzar medianoche.
// Datos y lógica de la demo, puros y testeables en node.
//
// Datos ficticios, sin Supabase, sin red y sin el almacenamiento real del navegador: el "storage", el "servidor" (progreso + sesiones +
// rutinas) y el RELOJ son objetos en memoria. El reloj arranca el 5/11/2026 a las 23:50 (hora local) y solo avanza con las acciones: la
// demo nunca depende de la hora del dispositivo. La lógica es la REAL:
//   - lib/workoutSession.js (serie local, payloads, hidratación + reconciliación por id/ciclo, progreso del día, sesión),
//   - lib/workoutSessionDate.js (fecha de la sesión, ancla para la recarga, cierre),
//   - lib/rutinaCiclo.js (ciclo vigente, reinicio, precarga), lib/setWriteAhead.js + lib/pendingSyncQueue.js + lib/progressInsert.js
//     (write-ahead, envío idempotente, flush) y lib/finalizeWorkoutSession.js (finalización confirmada + avance de semana).
// registrarSerie replica el logSet de App.jsx; finalizar replica la finalización de WorkoutScreen.jsx; sincronizarPendientes replica el
// flush + la rehidratación del login de App.jsx.
//
//   node scripts/test-demoCiclosMedianoche.mjs   (corre ejecutarEscenarios, lo mismo que el botón 9 de la pantalla)
import { crearStorageDemo } from './registroSeriesDemoData.js';
import {
  buildExerciseSetRecord,
  buildPendingProgressItem,
  buildProgressPayload,
  buildSessionPayload,
  calculateDayProgress,
  getWorkoutExerciseStatus,
  hydrateProgressFromRows,
  mergeProgressEntries,
  removeUndefinedPayloadFields,
  updateExerciseProgressRecord,
} from '../../lib/workoutSession.js';
import {
  cerrarSesionActiva,
  claveDiaDeSesion,
  fechaDeSesion,
  fechaLocalDe,
  leerSesionActiva,
  prepararInicioEntrenamiento,
} from '../../lib/workoutSessionDate.js';
import { buildReinicioDatos, CICLO_CARGAS, readCicloActual, rowCiclo, setsForLoadPrefill } from '../../lib/rutinaCiclo.js';
import { isSetSendInFlight, sendWriteAheadSet, writeAheadPendingSet } from '../../lib/setWriteAhead.js';
import { flushPendingForAlumno, generateOpId, visiblePendingItems } from '../../lib/pendingSyncQueue.js';
import { postProgressIdempotent } from '../../lib/progressInsert.js';
import { finalizeStudentSession } from '../../lib/finalizeWorkoutSession.js';

export const DEMO_ALUMNO_A = 'demo-alumno-a';
export const DEMO_ALUMNO_B = 'demo-alumno-b';
export const DEMO_ALUMNOS = [
  { id: DEMO_ALUMNO_A, nombre: 'Alumna A (demo)' },
  { id: DEMO_ALUMNO_B, nombre: 'Alumno B (demo)' },
];
// Mismos valores en todos los ciclos (a propósito): la reconciliación no debe mezclar series de ciclos distintos con iguales kg/reps/fecha.
export const DEMO_EJERCICIOS = [
  { id: 'sentadilla-demo', name: 'Sentadilla (demo)', sets: 2, reps: 8, kg: 60 },
  { id: 'remo-demo', name: 'Remo (demo)', sets: 2, reps: 10, kg: 40 },
];
// Reloj simulado: 5/11/2026 23:50 hora LOCAL (mismo instante "de pared" en cualquier zona horaria).
export const DEMO_RELOJ_INICIO = new Date(2026, 10, 5, 23, 50).getTime();
export const DEMO_TIMEOUT_MS = 1500;
const LAST_ADVANCE_KEY = 'it_last_week_advance_date';

const dos = (n) => (n < 10 ? '0' : '') + n;

/** "d/m/aaaa HH:MM" de un instante (hora local), sin depender del formato del navegador. */
export function formatoHora(ms) {
  const d = new Date(ms);
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
}

/**
 * Reloj simulado. now() devuelve el instante simulado; avanzar(min) lo mueve hacia adelante; fijar(h, m) lo lleva a esa hora de la
 * "noche del 5 al 6 de noviembre": h >= 12 => 5/11, h < 12 => 6/11 (00:10 = 6/11 00:10).
 */
export function crearReloj(inicioMs) {
  let t = Number.isFinite(inicioMs) ? inicioMs : DEMO_RELOJ_INICIO;
  return {
    now: () => t,
    avanzar: (min) => { t += Math.round(Number(min) || 0) * 60000; return t; },
    fijar: (h, m) => { t = new Date(2026, 10, h >= 12 ? 5 : 6, h, m || 0).getTime(); return t; },
  };
}

function crearRutina(alumnoId) {
  return {
    id: 'demo-rutina-' + alumnoId.slice(-1),
    name: 'Rutina ficticia ' + alumnoId.slice(-1).toUpperCase(),
    alumno_id: alumnoId,
    days: [{ label: 'Día 1', exercises: DEMO_EJERCICIOS.map((e) => ({ id: e.id, sets: String(e.sets), reps: String(e.reps), kg: String(e.kg) })) }],
    datos: { semana_activa: 1, ciclo_actual: 1 },
  };
}

/**
 * Servidor falso: progreso (por id; 409/23505 sobre progreso_pkey si se repite; columna ciclo con DEFAULT 1 como en sql/ciclo_rutina.sql),
 * sesiones (getSesiones / addSesion / getSesionesByAlumnoRutinaSemana) y rutinas (updateRutinaSemanaActiva: solo en el ciclo esperado,
 * monótono). created_at sale del reloj simulado.
 *  - perderRespuestaSesion(): el próximo addSesion inserta y la respuesta se pierde, y la lectura de comprobación siguiente también falla
 *    (la finalización queda sin confirmar y el alumno reintenta).
 *  - fallarLecturasSesiones(n): las próximas n lecturas de sesiones devuelven null (lectura fallida).
 */
export function crearServidorCiclos(reloj, rutinas) {
  const filas = new Map();
  const posts = [];
  const sesiones = [];
  const sesionPosts = [];
  const avances = [];
  let seq = 0;
  let perderSesion = false;
  let lecturasFallidas = 0;
  const marca = () => new Date(reloj.now() + (seq++)).toISOString();
  const rutinaPorId = (id) => Object.values(rutinas).find((r) => r.id === id) || null;
  const leerSesiones = () => {
    if (lecturasFallidas > 0) { lecturasFallidas--; return null; }
    return true;
  };
  return {
    filas, posts, sesiones, sesionPosts, avances,
    filasDe: (alumnoId) => [...filas.values()].filter((f) => f.alumno_id === alumnoId),
    sesionesDe: (alumnoId) => sesiones.filter((s) => s.alumno_id === alumnoId),
    perderRespuestaSesion: () => { perderSesion = true; },
    fallarLecturasSesiones: (n) => { lecturasFallidas = Math.max(0, Number(n) || 0); },
    io: {
      post: async (payload) => {
        posts.push(payload);
        if (filas.has(payload.id)) {
          return { ok: false, status: 409, data: { code: '23505', details: 'Key (id)=(' + payload.id + ') already exists.', message: 'duplicate key value violates unique constraint "progreso_pkey"' } };
        }
        const fila = Object.assign({ ciclo: 1 }, payload, { created_at: marca() });
        filas.set(payload.id, fila);
        return { ok: true, status: 201, data: [Object.assign({}, fila)] };
      },
      getById: async (id) => ({ ok: true, status: 200, data: filas.has(id) ? [Object.assign({}, filas.get(id))] : [] }),
    },
    sb: {
      getSesiones: async (alumnoId) => (leerSesiones() ? sesiones.filter((s) => s.alumno_id === alumnoId).map((s) => Object.assign({}, s)) : null),
      addSesion: async (payload) => {
        sesionPosts.push(payload);
        const fila = Object.assign({ ciclo: 1 }, payload, { id: 'demo-sesion-' + (sesiones.length + 1), created_at: marca() });
        sesiones.push(fila);
        if (perderSesion) { perderSesion = false; lecturasFallidas = 1; throw new Error('respuesta perdida (ficticia)'); }
        return [Object.assign({}, fila)];
      },
      getSesionesByAlumnoRutinaSemana: async (alumnoId, rutinaId, _nombre, semana) => {
        if (!leerSesiones()) throw new Error('lectura fallida (ficticia)');
        return sesiones.filter((s) => s.alumno_id === alumnoId && s.rutina_id === rutinaId && Number(s.semana) === Number(semana)).map((s) => Object.assign({}, s));
      },
      updateRutinaSemanaActiva: async (rutinaId, nextWeek, expectedCiclo) => {
        const r = rutinaPorId(rutinaId);
        if (!r) return [];
        if (Number.isInteger(expectedCiclo) && readCicloActual(r.datos) !== expectedCiclo) return { status: 'ciclo_cambiado', datos: Object.assign({}, r.datos) };
        if (Number(r.datos.semana_activa) >= nextWeek) return [{ id: r.id, datos: Object.assign({}, r.datos) }];
        r.datos = Object.assign({}, r.datos, { semana_activa: nextWeek });
        avances.push({ rutinaId, semana: nextWeek });
        return [{ id: r.id, datos: Object.assign({}, r.datos) }];
      },
    },
  };
}

/**
 * Mundo ficticio: reloj + storage + servidor + alumnos A y B (cada uno con su rutina de 1 día y 2 ejercicios de 2 series) + progreso local
 * por alumno (como it_pg) + sesión activa en memoria + conexión. Cada acción es async y devuelve un texto para mostrar.
 * opts: { inicio (ms), timeoutMs }.
 */
export function crearMundoCiclos(opts) {
  const o = opts || {};
  const timeoutMs = o.timeoutMs || DEMO_TIMEOUT_MS;
  const reloj = crearReloj(o.inicio);
  const storage = crearStorageDemo();
  const rutinas = { [DEMO_ALUMNO_A]: crearRutina(DEMO_ALUMNO_A), [DEMO_ALUMNO_B]: crearRutina(DEMO_ALUMNO_B) };
  const servidor = crearServidorCiclos(reloj, rutinas);
  const progreso = { [DEMO_ALUMNO_A]: {}, [DEMO_ALUMNO_B]: {} };
  const st = { alumnoId: DEMO_ALUMNO_A, sesion: null, conectado: true, ultimoInicio: null, ultimoFinal: null };

  const rutina = () => rutinas[st.alumnoId];
  const ejercicios = () => rutina().days[0].exercises;
  const ciclo = () => readCicloActual(rutina().datos);
  // Igual que logSet / WorkoutScreen: semana persistida (1..4) => base 0.
  const semanaBase0 = () => {
    const n = Number(rutina().datos.semana_activa);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n - 1 : 0;
  };
  const fechaSesion = () => fechaDeSesion(st.sesion, reloj.now());
  const nombreEj = (exId) => (DEMO_EJERCICIOS.find((e) => e.id === exId) || {}).name || exId;
  const sendItem = (alumnoId) => (item) => postProgressIdempotent(servidor.io, buildProgressPayload(alumnoId, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId));

  // Réplica de logSet (App.jsx): fecha de la sesión -> ciclo vigente -> opId -> write-ahead -> serie local (con id) -> envío si hay conexión.
  async function registrarSerie(ejIdx) {
    const alumnoId = st.alumnoId;
    if (!st.sesion) return 'Primero iniciá el entrenamiento.';
    const ex = ejercicios()[ejIdx || 0];
    const base = DEMO_EJERCICIOS.find((e) => e.id === ex.id);
    const d = fechaSesion();
    const week = semanaBase0();
    const c = ciclo();
    const opId = generateOpId();
    const newSet = Object.assign(buildExerciseSetRecord(base.kg, base.reps, d, week, '', null, c), { id: opId });
    const item = buildPendingProgressItem(ex.id, base.kg, base.reps, '', d, week, c, alumnoId, opId);
    const wa = writeAheadPendingSet(storage, item, reloj.now());
    if (!wa.ok) return 'No se pudo guardar la serie en el dispositivo (' + wa.reason + '); no se registra.';
    progreso[alumnoId] = Object.assign({}, progreso[alumnoId], { [ex.id]: updateExerciseProgressRecord(progreso[alumnoId][ex.id], newSet) });
    let estado = 'pendiente (sin conexión)';
    if (st.conectado) {
      const res = await sendWriteAheadSet({
        storage, opId, timeoutMs, now: reloj.now,
        send: () => postProgressIdempotent(servidor.io, buildProgressPayload(alumnoId, ex.id, base.kg, base.reps, '', d, week, c, opId)),
      });
      estado = res.confirmed ? 'sincronizada' : 'pendiente (' + res.reason + ')';
    }
    return nombreEj(ex.id) + ' ' + base.kg + ' kg × ' + base.reps + ' · ciclo ' + c + ' · fecha ' + d + ' · ' + estado + '.';
  }

  // Reinicio de rutina (lo hace el entrenador desde SU dispositivo): ciclo + 1, Semana 1, cargas en cero. La sesión en memoria del alumno
  // se cierra; el ancla de su dispositivo NO se borra (no la ve el entrenador): un inicio posterior la descarta por "otro_ciclo".
  async function reiniciarRutina() {
    const r = rutina();
    const antes = readCicloActual(r.datos);
    r.datos = buildReinicioDatos(r.datos, { tipo: 'rutina', cargas: CICLO_CARGAS.CERO, nowIso: new Date(reloj.now()).toISOString() });
    st.sesion = null;
    return 'Rutina reiniciada: ciclo ' + antes + ' → ' + readCicloActual(r.datos) + ', Semana ' + r.datos.semana_activa + '. La sesión abierta se cerró.';
  }

  // Inicio del entrenamiento del alumno (startStudentWorkout de App.jsx): prepararInicioEntrenamiento con el storage y el reloj simulados.
  async function iniciarEntrenamiento() {
    const r = rutina();
    const res = prepararInicioEntrenamiento({
      storage,
      session: { rId: r.id, dIdx: 0, exIdx: 0, startTime: reloj.now() },
      alumnoId: st.alumnoId,
      ciclo: readCicloActual(r.datos),
      semana: semanaBase0(),
      now: reloj.now(),
    });
    st.sesion = res.session;
    st.ultimoInicio = { recuperada: res.recuperada, motivo: res.motivo };
    return res.recuperada
      ? 'Entrenamiento recuperado (mismo alumno, rutina, día, ciclo y semana): fecha ' + res.session.fecha + ', inicio ' + formatoHora(res.session.startTime) + '.'
      : 'Entrenamiento nuevo (' + res.motivo + '): fecha ' + res.session.fecha + ', ciclo ' + res.session.ciclo + '.';
  }

  // Rehidratación como en el login de App.jsx: filas del servidor -> hydrateProgressFromRows -> mergeProgressEntries con el progreso local.
  function rehidratar() {
    const alumnoId = st.alumnoId;
    const hydrated = hydrateProgressFromRows(servidor.filasDe(alumnoId));
    const prev = progreso[alumnoId];
    if (!prev || Object.keys(prev).length === 0) { progreso[alumnoId] = hydrated; return; }
    const merged = Object.assign({}, prev);
    Object.keys(hydrated).forEach((exId) => { merged[exId] = mergeProgressEntries(prev[exId], hydrated[exId]); });
    progreso[alumnoId] = merged;
  }

  async function sincronizarPendientes() {
    if (!st.conectado) return 'Sin conexión: los pendientes siguen en el dispositivo.';
    const alumnoId = st.alumnoId;
    const r = await flushPendingForAlumno({ storage, alumnoId, isInFlight: isSetSendInFlight, timeoutMs, send: sendItem(alumnoId) });
    rehidratar();
    return 'Sincronización: ' + (r.sent || 0) + ' confirmada(s), ' + (r.failed || 0) + ' sin confirmar. Progreso rehidratado desde el servidor.';
  }

  // Recarga de Safari: se pierde la sesión en memoria; storage y progreso local quedan. El alumno vuelve a iniciar el mismo día.
  async function recargarSafari() {
    st.sesion = null;
    const t = await iniciarEntrenamiento();
    return 'Recarga a las ' + formatoHora(reloj.now()).split(' ')[1] + ' · ' + t;
  }

  // Réplica de la finalización del alumno (WorkoutScreen.jsx).
  async function finalizar() {
    const s = st.sesion;
    if (!s) return 'No hay entrenamiento abierto.';
    const alumnoId = st.alumnoId;
    const r = rutina();
    const persisted = Number(r.datos && r.datos.semana_activa);
    const effectiveWeek = Number.isFinite(persisted) && persisted >= 1 && persisted <= 4 ? persisted - 1 : 0;
    const semanaParaGuardar = effectiveWeek + 1;
    const cicloActual = readCicloActual(r.datos);
    const now = reloj.now();
    const hoyFin = fechaDeSesion(s, now);
    const todayStr = claveDiaDeSesion(s, now);
    const horaFin = formatoHora(now).split(' ')[1];
    let lastAdvanceDate = null;
    try { lastAdvanceDate = storage.getItem(LAST_ADVANCE_KEY); } catch (e) { lastAdvanceDate = null; }
    const activeDay = r.days[s.dIdx] || r.days[0];
    const payload = removeUndefinedPayloadFields(buildSessionPayload({
      alumnoId, session: s, activeDay, activeRoutine: r, exercises: activeDay.exercises, weekToSave: semanaParaGuardar,
      date: hoyFin, time: horaFin, includeRoutineId: true, ciclo: cicloActual,
    }));
    const outcome = await finalizeStudentSession({
      sb: servidor.sb, alumnoId, payload, date: hoyFin, dayIndex: s.dIdx, weekToSave: semanaParaGuardar, ciclo: cicloActual,
      isOnline: st.conectado, effectiveWeek, totalDays: r.days.length, lastAdvanceDate, todayStr, rutinaId: r.id, rutinaNombre: r.name,
      timeoutMs,
      updateRutinaWeek: () => servidor.sb.updateRutinaSemanaActiva(r.id, effectiveWeek + 2, cicloActual),
    });
    st.ultimoFinal = outcome;
    if (outcome.status !== 'saved') {
      return 'No se confirmó la finalización (' + outcome.reason + '): el entrenamiento sigue abierto; reintentá.';
    }
    cerrarSesionActiva(storage, { alumnoId, session: s });
    if (outcome.week.advance === 'ok') { try { storage.setItem(LAST_ADVANCE_KEY, todayStr); } catch (e) { /* demo */ } }
    st.sesion = null;
    return 'Sesión confirmada (' + outcome.source + ') con fecha ' + hoyFin + ' · avance de semana: ' + outcome.week.advance + '.';
  }

  async function cambiarAlumno() {
    st.alumnoId = st.alumnoId === DEMO_ALUMNO_A ? DEMO_ALUMNO_B : DEMO_ALUMNO_A;
    st.sesion = null;
    return 'Ahora: ' + nombreAlumno(st.alumnoId) + '. Sus pendientes y su ancla son solo suyos.';
  }

  async function avanzarReloj(min) { reloj.avanzar(min); return 'Reloj simulado: ' + formatoHora(reloj.now()) + '.'; }
  async function fijarReloj(h, m) { reloj.fijar(h, m); return 'Reloj simulado: ' + formatoHora(reloj.now()) + '.'; }
  // Deja el entrenamiento abierto sin finalizar (para empezar otro): borra SOLO su ancla (cerrarSesionActiva) y la sesión en memoria.
  async function abandonarSesion() {
    if (!st.sesion) return 'No había entrenamiento abierto.';
    cerrarSesionActiva(storage, { alumnoId: st.alumnoId, session: st.sesion });
    st.sesion = null;
    return 'Entrenamiento abierto descartado (sus series quedan registradas).';
  }
  async function desconectar() { st.conectado = false; return 'Sin conexión: las series quedan pendientes en el dispositivo.'; }
  async function conectar() { st.conectado = true; return 'Conexión recuperada.'; }

  const pendientes = (alumnoId) => {
    try { return visiblePendingItems(storage, alumnoId === undefined ? st.alumnoId : alumnoId); } catch (e) { return []; }
  };

  // Estado para la pantalla (del alumno actual).
  function estado() {
    const alumnoId = st.alumnoId;
    const r = rutina();
    const c = ciclo();
    const prog = progreso[alumnoId];
    const pend = pendientes(alumnoId);
    const pendIds = new Set(pend.map((p) => p.opId));
    const pendientesPorCiclo = {};
    pend.forEach((p) => { const k = rowCiclo(p); pendientesPorCiclo[k] = (pendientesPorCiclo[k] || 0) + 1; });
    const series = [];
    Object.keys(prog).forEach((exId) => {
      (prog[exId].sets || []).forEach((s) => {
        series.push({
          id: s.id || null, exId, ejercicio: nombreEj(exId), ciclo: rowCiclo(s), fecha: s.date, kg: s.kg, reps: s.reps, created_at: s.created_at || null,
          estado: s.id && pendIds.has(s.id) ? 'pendiente' : (s.id && servidor.filas.has(s.id) ? 'sincronizada' : 'local'),
        });
      });
    });
    const fecha = st.sesion ? fechaSesion() : null;
    const dia = st.sesion ? calculateDayProgress(ejercicios(), prog, fecha, semanaBase0(), { checkWeek: false, ciclo: c }) : { done: 0, total: ejercicios().length, pct: 0 };
    const ancla = leerSesionActiva(storage, alumnoId);
    return {
      alumnoId, alumno: nombreAlumno(alumnoId), ciclo: c, semana: Number(r.datos.semana_activa) || 1,
      sesionAbierta: !!st.sesion, fechaInicio: st.sesion ? st.sesion.fecha : null, horaInicio: st.sesion ? formatoHora(st.sesion.startTime) : null,
      horaSimulada: formatoHora(reloj.now()), fechaReloj: fechaLocalDe(reloj.now()),
      diaActivo: st.sesion ? ((r.days[st.sesion.dIdx] || {}).label || 'Día ' + (st.sesion.dIdx + 1)) : null,
      progresoDia: dia, finalizarVisible: !!st.sesion && dia.total > 0 && dia.done >= dia.total,
      conectado: st.conectado, series, pendientes: pend.length, pendientesPorCiclo,
      sesionesConfirmadas: servidor.sesionesDe(alumnoId).map((x) => ({ id: x.id, fecha: x.fecha, dia: x.dia_label, semana: x.semana, ciclo: rowCiclo(x), hora: x.hora })),
      ancla: ancla && String(ancla.alumnoId) === String(alumnoId) ? { fecha: ancla.fecha, ciclo: ancla.ciclo, inicio: formatoHora(ancla.startTime) } : null,
      ultimoInicio: st.ultimoInicio,
    };
  }

  // Lo que mostraría el panel del ejercicio: series de HOY (fecha de la sesión) del ciclo vigente, última serie y peso precargado.
  function estadoEjercicio(ejIdx) {
    const ex = ejercicios()[ejIdx || 0];
    const prog = progreso[st.alumnoId];
    const status = getWorkoutExerciseStatus({ exercise: ex, progress: prog, date: fechaSesion(), currentWeek: semanaBase0(), ciclo: ciclo() });
    const sugeridas = setsForLoadPrefill(prog[ex.id] && prog[ex.id].sets, rutina().datos);
    return { setsHoy: status.setsToday.length, lastSet: status.lastSet, precargaKg: (status.setsToday[0] && status.setsToday[0].kg) || (sugeridas[0] && sugeridas[0].kg) || null };
  }

  return {
    reloj, storage, servidor, rutinas, progreso, st,
    get alumnoId() { return st.alumnoId; },
    get sesion() { return st.sesion; },
    rutina, ciclo, fechaSesion, pendientes, estado, estadoEjercicio, rehidratar,
    registrarSerie, reiniciarRutina, iniciarEntrenamiento, avanzarReloj, fijarReloj, desconectar, conectar,
    sincronizarPendientes, recargarSafari, finalizar, cambiarAlumno, abandonarSesion,
  };
}

function nombreAlumno(id) {
  return (DEMO_ALUMNOS.find((a) => a.id === id) || {}).nombre || id;
}

const F5 = '5/11/2026';
const F6 = '6/11/2026';
const setsDe = (m, exId) => ((m.progreso[m.alumnoId][exId] || {}).sets || []);

/** Escenarios automáticos con la lógica REAL; cada uno con un mundo nuevo. Devuelve [{ id, nombre, pass, detalle }]. */
export async function ejecutarEscenarios(opts) {
  const o = opts || {};
  const nuevo = () => crearMundoCiclos({ timeoutMs: o.timeoutMs || DEMO_TIMEOUT_MS });
  const [EX0, EX1] = DEMO_EJERCICIOS.map((e) => e.id);
  const escenarios = [
    ['Series del ciclo 1 (registro y envío)', async (m) => {
      await m.iniciarEntrenamiento();
      for (const i of [0, 0, 1, 1]) { m.reloj.avanzar(1); await m.registrarSerie(i); }
      const e = m.estado();
      const filas = m.servidor.filasDe(DEMO_ALUMNO_A);
      const ok = e.series.length === 4 && e.series.every((s) => s.ciclo === 1 && s.fecha === F5 && s.estado === 'sincronizada') &&
        filas.length === 4 && filas.every((f) => rowCiclo(f) === 1) && m.servidor.posts.every((p) => !('ciclo' in p)) && e.pendientes === 0 && e.finalizarVisible;
      return [ok, e.series.length + ' serie(s) ciclo 1 del ' + F5 + ', ' + filas.length + ' fila(s) en el servidor, ' + e.pendientes + ' pendiente(s), FINALIZAR ' + (e.finalizarVisible ? 'visible' : 'oculto')];
    }],
    ['Reiniciar rutina e iniciar ciclo 2 sin precarga del ciclo 1', async (m) => {
      await m.iniciarEntrenamiento();
      for (const i of [0, 1]) { m.reloj.avanzar(1); await m.registrarSerie(i); }
      await m.reiniciarRutina();
      m.reloj.avanzar(1);
      await m.iniciarEntrenamiento();
      const e = m.estado();
      const ej = m.estadoEjercicio(0);
      const ok = e.ciclo === 2 && m.sesion.ciclo === 2 && e.semana === 1 && m.st.ultimoInicio.motivo === 'otro_ciclo' && ej.setsHoy === 0 && ej.lastSet === undefined &&
        ej.precargaKg === null && !e.finalizarVisible && setsDe(m, EX0).length === 1;
      return [ok, 'ciclo ' + e.ciclo + ', inicio ' + m.st.ultimoInicio.motivo + ', series de hoy ' + ej.setsHoy + ', última serie ' + (ej.lastSet ? 'PRESENTE' : 'vacía') + ', precarga ' + (ej.precargaKg == null ? 'ninguna' : ej.precargaKg + ' kg')];
    }],
    ['Pendientes del ciclo anterior visibles con su ciclo', async (m) => {
      await m.iniciarEntrenamiento();
      await m.desconectar();
      await m.registrarSerie(0); await m.registrarSerie(1);
      await m.reiniciarRutina();
      await m.iniciarEntrenamiento();
      await m.registrarSerie(0);
      const e = m.estado();
      const ciclos = m.pendientes().map((p) => rowCiclo(p)).sort();
      const ej = m.estadoEjercicio(0);
      const ok = e.pendientes === 3 && ciclos.join(',') === '1,1,2' && e.pendientesPorCiclo[1] === 2 && e.pendientesPorCiclo[2] === 1 && ej.setsHoy === 1 && rowCiclo(ej.lastSet) === 2;
      return [ok, e.pendientes + ' pendiente(s): ciclo 1 × ' + (e.pendientesPorCiclo[1] || 0) + ', ciclo 2 × ' + (e.pendientesPorCiclo[2] || 0) + ' · el ciclo 2 ve solo su serie (' + ej.setsHoy + ')'];
    }],
    ['Sincronizar sin mezclar ciclos (payload y rehidratación)', async (m) => {
      await m.iniciarEntrenamiento();
      await m.desconectar();
      await m.registrarSerie(0); await m.registrarSerie(0);
      await m.reiniciarRutina();
      await m.iniciarEntrenamiento();
      await m.registrarSerie(0);
      await m.conectar();
      await m.sincronizarPendientes();
      const p1 = m.servidor.posts.filter((p) => !('ciclo' in p));
      const p2 = m.servidor.posts.filter((p) => p.ciclo === 2);
      const filas = m.servidor.filasDe(DEMO_ALUMNO_A);
      const sets = setsDe(m, EX0);
      const c1 = sets.filter((s) => rowCiclo(s) === 1).length;
      const c2 = sets.filter((s) => rowCiclo(s) === 2).length;
      await m.sincronizarPendientes();
      const ok = p1.length === 2 && p2.length === 1 && m.servidor.posts.length === 3 && filas.length === 3 && filas.filter((f) => rowCiclo(f) === 1).length === 2 &&
        sets.length === 3 && new Set(sets.map((s) => s.id)).size === 3 && c1 === 2 && c2 === 1 && m.estadoEjercicio(0).setsHoy === 1 && m.pendientes().length === 0 &&
        setsDe(m, EX0).length === 3;
      return [ok, 'POST ciclo 1 sin campo ciclo: ' + p1.length + ', POST con ciclo 2: ' + p2.length + ' · tras rehidratar: ' + c1 + ' serie(s) ciclo 1 + ' + c2 + ' ciclo 2, sin duplicados'];
    }],
    ['Iniciar a las 23:55 → fecha 5/11 y ancla', async (m) => {
      m.reloj.fijar(23, 55);
      await m.iniciarEntrenamiento();
      const a = leerSesionActiva(m.storage, m.alumnoId);
      const ok = m.sesion.fecha === F5 && !m.st.ultimoInicio.recuperada && !!a && a.fecha === F5 && a.ciclo === 1 && a.startTime === m.reloj.now();
      return [ok, 'fecha de la sesión ' + m.sesion.fecha + ', ancla ' + (a ? a.fecha + ' ciclo ' + a.ciclo : 'ausente')];
    }],
    ['Reloj a las 00:10 → FINALIZAR sigue visible', async (m) => {
      m.reloj.fijar(23, 55);
      await m.iniciarEntrenamiento();
      m.reloj.fijar(23, 56); await m.registrarSerie(0);
      m.reloj.fijar(23, 58); await m.registrarSerie(1);
      m.reloj.fijar(0, 10);
      const e = m.estado();
      const conRelojReal = calculateDayProgress(m.rutina().days[0].exercises, m.progreso[DEMO_ALUMNO_A], fechaLocalDe(m.reloj.now()), 0, { checkWeek: false, ciclo: 1 });
      const ok = e.fechaReloj === F6 && e.fechaInicio === F5 && e.finalizarVisible && e.progresoDia.pct === 100 && conRelojReal.pct === 0;
      return [ok, 'hora ' + e.horaSimulada + ', fecha de la sesión ' + e.fechaInicio + ', progreso ' + e.progresoDia.pct + '% (con la fecha del reloj sería ' + conRelojReal.pct + '%)'];
    }],
    ['Registrar y finalizar después de medianoche (reintento sin duplicar)', async (m) => {
      m.reloj.fijar(23, 55);
      await m.iniciarEntrenamiento();
      m.reloj.fijar(23, 57); await m.registrarSerie(0);
      m.reloj.fijar(0, 8); await m.registrarSerie(1);
      m.reloj.fijar(0, 10);
      m.servidor.perderRespuestaSesion();
      const t1 = await m.finalizar();
      const fallo1 = m.st.ultimoFinal.status === 'failed' && !!m.sesion;
      m.reloj.fijar(0, 12);
      await m.finalizar();
      const ses = m.servidor.sesionesDe(DEMO_ALUMNO_A);
      const filas = m.servidor.filasDe(DEMO_ALUMNO_A);
      const ok = fallo1 && m.st.ultimoFinal.status === 'saved' && m.st.ultimoFinal.source === 'existing' && ses.length === 1 && ses[0].fecha === F5 &&
        m.servidor.sesionPosts.length === 1 && filas.length === 2 && filas.every((f) => f.fecha === F5) && m.sesion === null && leerSesionActiva(m.storage, m.alumnoId) === null &&
        m.st.ultimoFinal.week.advance === 'ok' && m.servidor.avances.length === 1;
      return [ok, '1.º intento: ' + (fallo1 ? 'sin confirmar' : t1) + ' · reintento 00:12: ' + m.st.ultimoFinal.source + ' · ' + ses.length + ' sesión con fecha ' + (ses[0] && ses[0].fecha) + ', ' + filas.length + ' series del ' + F5 + ', semana avanzada ' + m.servidor.avances.length + ' vez'];
    }],
    ['Recarga de Safari a las 00:05 → recupera la fecha', async (m) => {
      m.reloj.fijar(23, 55);
      await m.iniciarEntrenamiento();
      const inicio = m.sesion.startTime;
      m.reloj.fijar(23, 58); await m.registrarSerie(0);
      m.reloj.fijar(0, 5);
      await m.recargarSafari();
      const rec = m.st.ultimoInicio;
      await m.registrarSerie(1);
      const e = m.estado();
      const ok = rec.recuperada && rec.motivo === 'ancla' && m.sesion.fecha === F5 && m.sesion.startTime === inicio && e.series.length === 2 && e.series.every((s) => s.fecha === F5) && e.finalizarVisible;
      return [ok, (rec.recuperada ? 'recuperada' : 'NO recuperada (' + rec.motivo + ')') + ', fecha ' + m.sesion.fecha + ', inicio ' + formatoHora(m.sesion.startTime) + ', ' + e.series.length + ' series del ' + F5];
    }],
    ['Cambio de alumno: B no recupera el ancla ni ve los pendientes de A', async (m) => {
      m.reloj.fijar(23, 55);
      await m.iniciarEntrenamiento();
      await m.desconectar();
      await m.registrarSerie(0);
      await m.cambiarAlumno();
      m.reloj.fijar(0, 5);
      await m.iniciarEntrenamiento();
      const rec = m.st.ultimoInicio;
      await m.conectar();
      await m.sincronizarPendientes();
      const ok = m.alumnoId === DEMO_ALUMNO_B && !rec.recuperada && rec.motivo === 'sin_ancla' && m.sesion.fecha === F6 && m.pendientes(DEMO_ALUMNO_B).length === 0 &&
        m.pendientes(DEMO_ALUMNO_A).length === 1 && m.servidor.posts.length === 0;
      return [ok, 'inicio de B: ' + rec.motivo + ', fecha ' + m.sesion.fecha + ' · pendientes A ' + m.pendientes(DEMO_ALUMNO_A).length + ', B ' + m.pendientes(DEMO_ALUMNO_B).length + ', POST ' + m.servidor.posts.length];
    }],
    ['Ciclo nuevo + medianoche a la vez: no recupera la sesión vieja', async (m) => {
      m.reloj.fijar(23, 55);
      await m.iniciarEntrenamiento();
      m.reloj.fijar(23, 56); await m.registrarSerie(0);
      m.reloj.fijar(23, 58); await m.reiniciarRutina();
      m.reloj.fijar(0, 5);
      await m.iniciarEntrenamiento();
      const rec = m.st.ultimoInicio;
      const vieja = setsDe(m, EX0)[0];
      const ok = !rec.recuperada && rec.motivo === 'otro_ciclo' && m.sesion.ciclo === 2 && m.sesion.fecha === F6 && vieja.date === F5 && rowCiclo(vieja) === 1 &&
        m.estadoEjercicio(0).setsHoy === 0 && setsDe(m, EX1).length === 0;
      return [ok, 'inicio: ' + rec.motivo + ', ciclo ' + m.sesion.ciclo + ', fecha ' + m.sesion.fecha + ' · la serie del ciclo 1 conserva ' + vieja.date];
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
    }
  }
  return out;
}
