// Demo QA del PR #194 (demo/qa-pr194.html): datos y servidor FICTICIOS, puros y testeables en node (scripts/test-demoQaPr194.mjs).
//
// NO es una maqueta: la lógica es la REAL del PR. El "servidor" es un objeto en memoria que se comporta como el backend:
//  - createRutina: cleanRutinaWriteBody + withInitialSemanaActiva (lib/routineStore.js, lib/rutinaOperationalState.js), igual que App.jsx.
//  - updateRutina: cleanRutinaWriteBody + updateRutinaPreservingOperational (la misma función de producción) contra un cliente falso
//    que implementa la RPC it_rutina_guardar_contenido en memoria (preserva semana_activa y demás claves operativas).
// Contratos de respuesta (idénticos a producción): update -> array de filas | [] (0 filas, p. ej. RLS) | null (error); create -> array | []
// | null; una falla de red puede LANZAR. Modos: ok | red (lanza TypeError) | nulo (null) | vacio ([]).
// Sin Supabase, sin credenciales, sin red, sin almacenamiento del navegador.
import { cleanRutinaWriteBody } from '../../lib/routineStore.js';
import { RPC } from '../../lib/rpcClient.js';
import { mergeOperationalDatos, withInitialSemanaActiva, updateRutinaPreservingOperational } from '../../lib/rutinaOperationalState.js';

export const MODOS = { OK: 'ok', RED: 'red', NULO: 'nulo', VACIO: 'vacio' };
export const ENTRENADOR_DEMO = 'entrenador_principal';
export const ALUMNOS_DEMO = [
  { id: 'demo-a1', nombre: 'Alumno Demo Uno', email: 'uno@demo.invalid' },
  { id: 'demo-a2', nombre: 'Alumna Demo Dos', email: 'dos@demo.invalid' },
];
export const EJERCICIOS_DEMO = [
  { id: 'demo_sq', name: 'Sentadilla (demo)', nameEn: 'Squat (demo)' },
  { id: 'demo_bp', name: 'Press de banca (demo)', nameEn: 'Bench press (demo)' },
  { id: 'demo_row', name: 'Remo con barra (demo)', nameEn: 'Barbell row (demo)' },
  { id: 'demo_plank', name: 'Plancha (demo)', nameEn: 'Plank (demo)' },
];
export const HISTORIAL_DEMO = [
  { date: '10/11/2026', kg: 60, reps: 8, sets: 4, week: 1 },
  { date: '03/11/2026', kg: 57.5, reps: 8, sets: 4, week: 1 },
  { date: '27/10/2026', kg: 55, reps: 10, sets: 3, week: 1 },
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function diasDemo(sufijo) {
  return [
    { label: 'Día 1', warmup: [{ id: 'demo_plank', sets: '2', reps: '30s', kg: '', pause: 30 }], exercises: [
      { id: 'demo_sq', sets: '4', reps: '8', kg: '60', pause: 90 },
      { id: 'demo_bp', sets: '4', reps: '8', kg: '40', pause: 90 },
    ] },
    { label: 'Día 2', warmup: [], exercises: [{ id: 'demo_row', sets: '3', reps: '10', kg: '35', pause: 60 }] },
  ].map((d) => (sufijo ? Object.assign({}, d, { label: d.label + sufijo }) : d));
}

/** Rutina en el formato local de RutinaView (no guardada todavía). */
export function rutinaLocalNueva(n) {
  return { id: 'local-' + n, name: 'Rutina nueva ' + n + ' (sin guardar)', days: diasDemo(''), alumno_id: 'demo-a1', alumno: 'Alumno Demo Uno', note: '', saved: false, collapsed: false };
}

/** Fila del servidor -> rutina local (lo que vería RutinaView al recargar). */
export function filaARutinaLocal(fila) {
  return { id: fila.id, name: fila.nombre, days: clone((fila.datos && fila.datos.days) || []), alumno_id: fila.alumno_id, alumno: (fila.datos && fila.datos.alumno) || '', note: (fila.datos && fila.datos.note) || '', saved: true, collapsed: false, es_plantilla: !!fila.es_plantilla };
}

export function crearServidorRutinasDemo(opts) {
  const o = opts || {};
  const db = new Map();
  let seq = 0;
  const estado = {
    modo: o.modo || MODOS.OK,
    latenciaMs: o.latenciaMs || 0,
    updates: 0, updatesConfirmados: 0, creates: 0, createsConfirmados: 0, deletes: 0,
    bitacora: [],
  };
  const anotar = (op, resultado) => { estado.bitacora.unshift({ n: estado.bitacora.length + 1, op, modo: estado.modo, resultado }); if (estado.bitacora.length > 12) estado.bitacora.pop(); };

  // Fila inicial (guardada) con estado operativo del alumno: semana_activa = 2 (se debe preservar al guardar).
  const fila0 = { id: 'demo-r1', nombre: 'Rutina A (guardada)', alumno_id: 'demo-a1', entrenador_id: ENTRENADOR_DEMO, es_plantilla: false, datos: { days: diasDemo(''), alumno: 'Alumno Demo Uno', note: '', semana_activa: 2 } };
  db.set(fila0.id, fila0);

  // Cliente falso con la RPC atómica de producción (it_rutina_guardar_contenido) implementada en memoria.
  const cliente = {
    rpc: async (name, args) => {
      if (name !== RPC.GUARDAR_CONTENIDO) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      const row = db.get(String(args.p_rutina_id));
      if (!row) return { data: [], error: null };
      const f = args.p_fila || {};
      if (f.nombre != null) row.nombre = f.nombre;
      if (f.alumno_id !== undefined) row.alumno_id = f.alumno_id;
      if (f.es_plantilla !== undefined) row.es_plantilla = !!f.es_plantilla;
      row.datos = mergeOperationalDatos(row.datos, f.datos);
      return { data: [clone(row)], error: null };
    },
  };

  const sb = {
    updateRutina: async (id, data) => {
      estado.updates++;
      const body = cleanRutinaWriteBody(data);          // lanza si no hay alumno y no es plantilla (igual que producción)
      if (estado.latenciaMs) await sleep(estado.latenciaMs);
      if (estado.modo === MODOS.RED) { anotar('update ' + id, 'lanzó TypeError (sin red)'); throw new TypeError('Failed to fetch'); }
      if (estado.modo === MODOS.NULO) { anotar('update ' + id, 'null'); return null; }
      if (estado.modo === MODOS.VACIO) { anotar('update ' + id, '[] (0 filas)'); return []; }
      const res = await updateRutinaPreservingOperational(cliente, id, body);
      if (Array.isArray(res) && res.length > 0) estado.updatesConfirmados++;
      anotar('update ' + id, Array.isArray(res) ? res.length + ' fila(s)' : String(res));
      return res;
    },
    createRutina: async (data) => {
      estado.creates++;
      const body = withInitialSemanaActiva(cleanRutinaWriteBody(data));
      if (estado.latenciaMs) await sleep(estado.latenciaMs);
      if (estado.modo === MODOS.RED) { anotar('create', 'lanzó TypeError (sin red)'); throw new TypeError('Failed to fetch'); }
      if (estado.modo === MODOS.NULO) { anotar('create', 'null'); return null; }
      if (estado.modo === MODOS.VACIO) { anotar('create', '[] (0 filas)'); return []; }
      seq++;
      const fila = Object.assign({ id: 'demo-r' + (seq + 1) }, body);
      db.set(fila.id, clone(fila));
      estado.createsConfirmados++;
      anotar('create', '1 fila (' + fila.id + ')');
      return [clone(fila)];
    },
    deleteRutina: async (id) => { estado.deletes++; db.delete(String(id)); return [{ id }]; },
    getRutinasByEntrenador: async () => [...db.values()].map(clone),
  };

  return {
    sb,
    estado,
    filas: () => [...db.values()].map(clone),
    setModo: (m) => { estado.modo = m; },
    setLatencia: (ms) => { estado.latenciaMs = ms; },
    resumen: () => ({ filas: db.size, updates: estado.updates, updatesConfirmados: estado.updatesConfirmados, creates: estado.creates, createsConfirmados: estado.createsConfirmados }),
  };
}
