// Host de prueba: reproduce el contrato de App.jsx alrededor de RutinaView (datos FICTICIOS, sin red).
import React, { useState, useEffect, createElement as h } from 'react';
import { RutinaView } from './out/components/RutinaView.js';
import { cleanRutinaWriteBody } from './out/lib/routineStore.js';
import { updateRutinaPreservingOperational, withInitialSemanaActiva } from './out/lib/rutinaOperationalState.js';
import { sanitizeRoutineDaysForWrite } from './out/lib/exerciseResolve.js';

const W = window; W.__writes = []; W.__toasts = []; W.__mode = W.__mode || 'ok'; W.__db = W.__db || {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Cliente Supabase FALSO. Modos: ok | vacio (0 filas, p.ej. RLS) | error (HTTP/PostgREST) | red (excepcion) ; __delay ms
const fakeClient = {
  async rpc(name, args) {
    const mode = W.__mode; W.__writes.push({ op: 'rpc:' + name, id: args.p_rutina_id, days: args.p_fila && args.p_fila.datos && args.p_fila.datos.days, mode, t: Date.now() });
    if (W.__delay) await wait(W.__delay);
    if (mode === 'red') throw new TypeError('Failed to fetch');
    if (mode === 'error') return { data: null, error: { code: '42501', message: 'permission denied for table rutinas' } };
    if (mode === 'vacio') return { data: [], error: null };
    W.__db[args.p_rutina_id] = JSON.parse(JSON.stringify(args.p_fila));
    return { data: [{ id: args.p_rutina_id, ...args.p_fila }], error: null };
  },
  from() {
    return { insert(rows) { return { async select() {
      const mode = W.__mode; W.__writes.push({ op: 'insert', days: rows[0].datos.days, mode, t: Date.now() });
      if (W.__delay) await wait(W.__delay);
      if (mode === 'red') throw new TypeError('Failed to fetch');
      if (mode === 'error') return { data: null, error: { code: '42501', message: 'denied' } };
      if (mode === 'vacio') return { data: [], error: null };
      const id = 'srv-' + (W.__writes.length); W.__db[id] = rows[0]; return { data: [{ id, ...rows[0] }], error: null };
    } }; } };
  },
};
// Mismo contrato que sb.createRutina / sb.updateRutina de App.jsx (lineas 381-393)
const sb = {
  createRutina: async (data) => { const body = withInitialSemanaActiva(cleanRutinaWriteBody(data)); const { data: c, error } = await fakeClient.from('rutinas').insert([body]).select(); if (error) return null; return c || []; },
  updateRutina: async (id, data) => updateRutinaPreservingOperational(fakeClient, id, cleanRutinaWriteBody(data)),
  getRutinasByEntrenador: async () => [],
};

function Host() {
  const [tab, setTab] = useState('routines');
  const [routines, setRoutines] = useState(() => { try { return JSON.parse(localStorage.getItem('it_rt') || '[]'); } catch (e) { return []; } });
  // Igual que App.jsx:1641-1647
  useEffect(() => { try { localStorage.setItem('it_rt', JSON.stringify(routines.map((r) => ({ ...r, days: sanitizeRoutineDaysForWrite(r.days) })))); } catch (e) {} }, [routines]);
  W.__routines = routines; W.__setRoutines = setRoutines; W.__tab = tab;
  const noop = () => {};
  return h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: '100vh' } },
    h('nav', { style: { display: 'flex', gap: 8, padding: 8 } },
      h('button', { id: 'nav-alumnos', onClick: () => setTab('alumnos') }, 'Alumnos'),
      h('button', { id: 'nav-rutinas', onClick: () => setTab('routines') }, 'Rutinas')),
    tab === 'routines'
      ? h(RutinaView, { setTab, border: '#333', textMuted: '#999', bgCard: '#111', textMain: '#fff', darkMode: true, bgSub: '#222', es: true, lang: 'es',
          card: {}, setNewR: noop, routines, setRoutines, allEx: [], toast2: (m) => W.__toasts.push(m),
          setAddExModal: (v) => { W.__addEx = v; }, setAddExSearch: noop, setAddExPat: noop, setAddExMuscle: noop, setAddExSelectedIds: noop,
          setDupDayModal: (v) => { W.__dup = v; }, alumnos: [{ id: 'al-1', nombre: 'Ana Ficticia' }, { id: 'al-2', nombre: 'Beto Ficticio' }], sb, setAssignRoutineId: noop,
          rutinasSBEntrenador: W.__serverRows || [], setRutinasSBEntrenador: noop, onRestartRoutine: async () => ({ ok: true }) })
      : h('div', { id: 'alumnos-view' }, 'Vista Alumnos (RutinaView desmontada)'));
}
W.ReactDOM.createRoot(document.getElementById('root')).render(h(Host));
