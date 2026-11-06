// Demostración D7.6 (demo/cargas-historial.html): validación de cargas + historial completo de sesiones.
// Datos ficticios, sin Supabase, sin login y sin red: el "servidor" es un arreglo en memoria. Usa la lógica REAL:
//   - lib/cargaSerie.js (serieRegistrable, igual que logSet de App.jsx) y lib/workoutSession.js (canLogWorkoutSet, PR, payload);
//   - lib/sesionesHistorial.js (lectura paginada completa) y lib/sesionesLectura.js (controlador D76-02);
//   - components/student-progress/progressMetrics.js (racha) con los mismos datos que ve el alumno.
import { serieRegistrable, validarKgEntrada } from '../../lib/cargaSerie.js';
import {
  buildExerciseSetRecord, buildProgressPayload, calculateNewWeightPR, canLogWorkoutSet, updateExerciseProgressRecord,
} from '../../lib/workoutSession.js';
import { leerSesionesAlumnoCompletas } from '../../lib/sesionesHistorial.js';
import { crearControladorSesiones } from '../../lib/sesionesLectura.js';
import { computeDayStreak } from '../student-progress/progressMetrics.js';

export const DEMO_ALUMNO_ID = '00000000-0000-4000-8000-0000000000d7';
export const DEMO_OTRO_ALUMNO_ID = '00000000-0000-4000-8000-0000000000e8';
export const DEMO_CICLO = 1;
export const DEMO_SEMANA = 0;
export const DEMO_EJERCICIOS = [
  { id: 'sentadilla-demo', name: 'Sentadilla (demo)', sets: 3, reps: 5, kg: 100, pause: 90, pattern: 'rodilla' },
  { id: 'dominadas-demo', name: 'Dominadas (demo, peso corporal / lastre)', sets: 3, reps: 8, pause: 90, pattern: 'traccion' },
  { id: 'plancha-demo', name: 'Plancha (demo, por tiempo)', sets: 2, reps: '45s', pause: 60, pattern: 'core' },
];
/** Récord previo ficticio de la sentadilla: 100 kg (un PR exige superarlo). */
export const DEMO_RECORD_PREVIO = 100;

export function fechaHoy() {
  return new Date().toLocaleDateString('es-AR');
}

/**
 * logSet de demo con la MISMA defensa que App.jsx: serieRegistrable antes de registrar/encolar/enviar. Guarda los intentos (aceptados y
 * rechazados), el progreso visible, los PR detectados y el payload que se enviaría a Supabase (buildProgressPayload real).
 */
export function crearLogSetDemo(opts) {
  const o = opts || {};
  const alCambiar = typeof o.alCambiar === 'function' ? o.alCambiar : () => {};
  const fecha = o.fecha || fechaHoy();
  let progress = { 'sentadilla-demo': { sets: [], max: DEMO_RECORD_PREVIO } };
  const intentos = [];
  const enviados = [];
  const prs = [];
  const logSet = (exId, kg, reps, note, rpe, week) => {
    const weekForSet = Number.isFinite(Number(week)) ? Number(week) : DEMO_SEMANA;
    if (!serieRegistrable(kg, reps)) {
      intentos.push({ exId, kg, reps, ok: false });
      alCambiar();
      return false;
    }
    const pr = calculateNewWeightPR(progress[exId] || { sets: [], max: 0 }, kg);
    if (pr) prs.push(Object.assign({ exId }, pr));
    progress = Object.assign({}, progress, { [exId]: updateExerciseProgressRecord(progress[exId], buildExerciseSetRecord(kg, reps, fecha, weekForSet, note, rpe, DEMO_CICLO)) });
    enviados.push(buildProgressPayload(DEMO_ALUMNO_ID, exId, kg, reps, note, fecha, weekForSet + 1, DEMO_CICLO));
    intentos.push({ exId, kg, reps, ok: true });
    alCambiar();
    return true;
  };
  logSet.progress = () => progress;
  logSet.intentos = () => intentos.slice();
  logSet.enviados = () => enviados.slice();
  logSet.prs = () => prs.slice();
  return logSet;
}

// ── Sesiones ficticias ─────────────────────────────────────────────────────────
const dmy = (d) => d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();

/** n sesiones del alumno demo, una por dia hacia atras desde hoy (racha real = n), 3 por semana del programa, + 3 de otro alumno. */
export function crearSesionesDemo(n) {
  const total = n || 26;
  const rows = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() - i);
    const orden = total - 1 - i; // 0 = la mas antigua
    rows.push({
      id: 'demo-ses-' + String(orden + 1).padStart(3, '0'), alumno_id: DEMO_ALUMNO_ID, rutina_id: 'demo-rutina', rutina_nombre: 'Rutina demo',
      semana: Math.floor(orden / 3) + 1, dia_idx: orden % 3, dia_label: 'Día ' + ((orden % 3) + 1), ciclo: DEMO_CICLO,
      fecha: dmy(d), hora: '10:00', created_at: d.toISOString(), completada: true,
    });
  }
  for (let j = 0; j < 3; j++) {
    const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() - j);
    rows.push({ id: 'otro-' + j, alumno_id: DEMO_OTRO_ALUMNO_ID, rutina_id: 'otra', semana: 9, dia_idx: 0, dia_label: 'OTRO ALUMNO', fecha: dmy(d), created_at: d.toISOString(), completada: true });
  }
  return rows;
}

const ordenar = (rows) => rows.slice().sort((a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : b.id > a.id ? 1 : b.id < a.id ? -1 : 0));

/** Servidor PostgREST falso para `sesiones` (interpreta alumno_id, limit, offset). opts.fallarPagina(): numero de pagina que responde 503. */
export function crearServidorSesiones(rows, opts) {
  const o = opts || {};
  const llamadas = [];
  const requestStatus = async (path) => {
    llamadas.push(path);
    const m = /alumno_id=eq\.([^&]+).*?limit=(\d+)(?:&offset=(\d+))?/.exec(path);
    if (!m) return { ok: false, status: 400, data: null };
    const aid = decodeURIComponent(m[1]); const lim = Number(m[2]); const off = Number(m[3] || 0);
    const fallar = typeof o.fallarPagina === 'function' ? o.fallarPagina() : null;
    if (fallar != null && off / lim === fallar) return { ok: false, status: 503, data: { message: 'falla simulada' } };
    return { ok: true, status: 200, data: ordenar(rows.filter((r) => r.alumno_id === aid)).slice(off, off + lim) };
  };
  requestStatus.llamadas = llamadas;
  return requestStatus;
}

/** Lo que devolvia la consulta anterior: `sesiones?alumno_id=eq.X&order=created_at.desc&limit=10`. */
export function leerAntes(rows, alumnoId) {
  return ordenar(rows.filter((r) => r.alumno_id === (alumnoId || DEMO_ALUMNO_ID))).slice(0, 10);
}

/** Metricas que ve el alumno en Progreso con un arreglo de sesiones (mismas reglas que StudentProgressSection). */
export function metricasAlumno(sesiones) {
  const list = Array.isArray(sesiones) ? sesiones : [];
  const semanas = {};
  list.forEach((s) => { semanas[s.semana] = (semanas[s.semana] || 0) + 1; });
  return { total: list.length, racha: computeDayStreak(list, {}), logro20: list.length >= 20, semanas };
}

/** Controlador D76-02 real leyendo con la lectura completa (paginas de `pageSize` para mostrar varias paginas en la demo). */
export function crearControladorDemo(requestStatus, pageSize) {
  return crearControladorSesiones({ leer: (aid) => leerSesionesAlumnoCompletas(requestStatus, aid, { pageSize: pageSize || 10 }) });
}

/** Escenarios automaticos (mismos que la prueba scripts/test-demoCargasHistorial.mjs). */
export async function ejecutarEscenarios() {
  const out = [];
  const ok = (nombre, pass, detalle) => out.push({ nombre, pass: !!pass, detalle: detalle || '' });
  const [SENT, DOM, PLAN] = DEMO_EJERCICIOS;

  const ls = crearLogSetDemo();
  const invalidos = [[DOM, '-10'], [SENT, '-5'], [SENT, '1e5'], [SENT, 'Infinity'], [SENT, '80abc'], [SENT, '800000']];
  const habilitados = invalidos.filter(([ex, kg]) => canLogWorkoutSet(ex, kg, String(ex.reps)));
  ok('REGISTRAR deshabilitado con kg negativo, 1e5, Infinity, texto o fuera del techo técnico', habilitados.length === 0, invalidos.map((x) => x[1]).join(' · '));
  const aceptadosInvalidos = invalidos.filter(([ex, kg]) => ls(ex.id, Number(String(kg).replace(',', '.')), 5) !== false);
  ok('logSet (defensa final) rechaza esas cargas aunque llegaran como número', aceptadosInvalidos.length === 0 && ls.enviados().length === 0, ls.enviados().length + ' enviadas');
  ok('ningún PR por cargas inválidas', ls.prs().length === 0);
  const validos = [[SENT, '102,5', 5], [DOM, '', 8], [DOM, '12,5', 8], [PLAN, '', 45], [SENT, '1500', 1]];
  const habil = validos.filter(([ex, kg]) => canLogWorkoutSet(ex, kg, String(ex.reps)));
  ok('coma decimal, peso corporal, lastre, tiempo y cargas altas legítimas siguen habilitados', habil.length === validos.length, validos.map((x) => x[1] || '(vacío)').join(' · '));
  validos.forEach(([ex, kg, reps]) => ls(ex.id, validarKgEntrada(kg).kg, reps));
  ok('se registran y envían las 5 válidas (102,5 → 102.5)', ls.enviados().length === 5 && ls.enviados()[0].kg === 102.5, ls.enviados().map((p) => p.kg).join(', '));
  ok('PR: 102,5 > 100 es PR; 1500 también (sin tope fisiológico)', ls.prs().map((p) => p.kg).join(',') === '102.5,1500');

  const rows = crearSesionesDemo(26);
  const srv = crearServidorSesiones(rows);
  const completo = await leerSesionesAlumnoCompletas(srv, DEMO_ALUMNO_ID, { pageSize: 10 });
  const antes = metricasAlumno(leerAntes(rows));
  const ahora = metricasAlumno(completo.data);
  ok('historial: 26 sesiones (antes 10)', completo.ok && ahora.total === 26 && antes.total === 10, 'antes ' + antes.total + ' · ahora ' + ahora.total + ' en ' + completo.pages + ' páginas');
  ok('racha 26 días (antes 10) y logro «20 sesiones» alcanzable', ahora.racha === 26 && antes.racha === 10 && ahora.logro20 && !antes.logro20);
  ok('sin filas de otro alumno', completo.data.every((r) => r.alumno_id === DEMO_ALUMNO_ID));
  let falla = null;
  const srv2 = crearServidorSesiones(rows, { fallarPagina: () => falla });
  const ctl = crearControladorDemo(srv2, 10);
  await ctl.cargar(DEMO_ALUMNO_ID);
  falla = 1;
  const e = await ctl.cargar(DEMO_ALUMNO_ID);
  ok('falla la página 2: se conservan las 26 (desactualizado), nunca 10 ni 0', e.status === 'desactualizado' && e.rows.length === 26, e.status + ' · ' + e.rows.length);
  return out;
}
