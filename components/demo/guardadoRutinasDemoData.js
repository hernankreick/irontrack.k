// Datos FICTICIOS y servidor FALSO en memoria para la demo del guardado de rutinas (demo/guardado-rutinas.html, solo Preview).
// No importa ningun SDK de backend ni el cliente de la app: el "cliente" es un objeto en memoria con la forma minima (rpc / insertRutinas) que consumen
// las funciones REALES de lib/ (updateRutinaPreservingOperational, cleanRutinaWriteBody, withInitialSemanaActiva), igual que sb de App.jsx.
import { cleanRutinaWriteBody } from '../../lib/routineStore.js';
import { updateRutinaPreservingOperational, withInitialSemanaActiva } from '../../lib/rutinaOperationalState.js';

export const DEMO_ALUMNOS = [
  { id: 'al-1', nombre: 'Ana Ficticia' },
  { id: 'al-2', nombre: 'Beto Ficticio' },
  { id: 'al-3', nombre: 'Caro Ficticia' },
];

const ex = (id, name, kg) => ({ id, name, sets: '3', reps: '8', kg: String(kg), pause: 90, note: '', weeks: [] });

export function crearRutinasIniciales() {
  return [
    { id: 'rr-ana', name: 'Rutina Ana', alumno_id: 'al-1', alumno: 'Ana Ficticia', note: '', saved: true, collapsed: false,
      days: [{ label: 'Día 1', warmup: [], exercises: [ex('sq', 'Sentadilla', 60), ex('bp', 'Press banca', 40)] }] },
    { id: 'rr-beto', name: 'Rutina Beto', alumno_id: 'al-2', alumno: 'Beto Ficticio', note: '', saved: true, collapsed: true,
      days: [{ label: 'Día 1', warmup: [], exercises: [ex('dl', 'Peso muerto', 80)] }] },
    { id: 'tmp-caro', name: 'Rutina nueva Caro', alumno_id: 'al-3', alumno: 'Caro Ficticia', note: '', saved: false, collapsed: true,
      days: [{ label: 'Día 1', warmup: [], exercises: [ex('rw', 'Remo', 30)] }] },
  ];
}

export const MODOS = [
  ['ok', 'Guardado correcto'],
  ['red', 'Error de red'],
  ['permisos', 'Error de permisos'],
  ['cero', 'Cero filas actualizadas'],
  ['parcial', 'Falla solo Rutina Beto'],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

// Servidor falso. `modo` y `latenciaMs` se cambian desde la pantalla; `onChange` avisa para repintar.
export function crearServidor(onChange) {
  const s = {
    modo: 'ok', latenciaMs: 0, filas: {}, log: [], seq: 0,
    inserts: 0, updates: 0,
    notify() { if (onChange) onChange(); },
    reset() {
      s.filas = {
        'rr-ana': { id: 'rr-ana', nombre: 'Rutina Ana', alumno_id: 'al-1', datos: { days: crearRutinasIniciales()[0].days } },
        'rr-beto': { id: 'rr-beto', nombre: 'Rutina Beto', alumno_id: 'al-2', datos: { days: crearRutinasIniciales()[1].days } },
      };
      s.log = []; s.inserts = 0; s.updates = 0; s.notify();
    },
  };
  // Decide el resultado de una escritura segun el modo. nombre: para el modo "parcial".
  function resultado(nombre) {
    if (s.modo === 'red') return 'red';
    if (s.modo === 'permisos') return 'permisos';
    if (s.modo === 'cero') return 'cero';
    if (s.modo === 'parcial' && nombre === 'Rutina Beto') return 'permisos';
    return 'ok';
  }
  const cliente = {
    async rpc(_name, args) {
      const fila = args.p_fila || {};
      const res = resultado(fila.nombre);
      s.log.push({ op: 'update', id: args.p_rutina_id, nombre: fila.nombre, res }); s.updates++; s.notify();
      if (s.latenciaMs) await wait(s.latenciaMs);
      if (res === 'red') throw new TypeError('Failed to fetch');
      if (res === 'permisos') return { data: null, error: { code: '42501', message: 'permission denied for table rutinas' } };
      if (res === 'cero') return { data: [], error: null };
      const prev = s.filas[args.p_rutina_id] || { id: args.p_rutina_id };
      s.filas[args.p_rutina_id] = Object.assign({}, prev, clone(fila));
      s.notify();
      return { data: [clone(s.filas[args.p_rutina_id])], error: null };
    },
    insertRutinas(rows) {
      return {
        async select() {
          const fila = rows[0];
          const res = resultado(fila.nombre);
          s.log.push({ op: 'insert', nombre: fila.nombre, res }); s.inserts++; s.notify();
          if (s.latenciaMs) await wait(s.latenciaMs);
          if (res === 'red') throw new TypeError('Failed to fetch');
          if (res === 'permisos') return { data: null, error: { code: '42501', message: 'permission denied' } };
          if (res === 'cero') return { data: [], error: null };
          const id = 'srv-' + (++s.seq);
          s.filas[id] = Object.assign({ id }, clone(fila));
          s.notify();
          return { data: [clone(s.filas[id])], error: null };
        },
      };
    },
  };
  // Mismo contrato que sb.createRutina / sb.updateRutina de App.jsx: null ante error, [] si no hubo fila.
  const sb = {
    createRutina: async (data) => {
      const body = withInitialSemanaActiva(cleanRutinaWriteBody(data));
      const { data: creada, error } = await cliente.insertRutinas([body]).select();
      if (error) return null;
      return creada || [];
    },
    updateRutina: async (id, data) => updateRutinaPreservingOperational(cliente, id, cleanRutinaWriteBody(data)),
  };
  s.sb = sb;
  s.reset();
  return s;
}
