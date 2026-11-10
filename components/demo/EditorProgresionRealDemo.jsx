// Demo del editor de progresion REAL (EditExModal y EditExerciseModal) con ejercicios ficticios en memoria.
// "Guardar" actualiza la lista local (para poder reabrir y comprobar la deteccion de semanas); sin red ni almacenamiento.
import React, { useState } from 'react';
import EditExModal from '../routines/EditExModal.jsx';
import { EditExerciseModal } from '../EditExerciseModal.jsx';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';

const mkWeeks = (n) => Array.from({ length: n }, (_, i) => ({
  sets: '3', reps: String(8 + (i % 3)), kg: String(16 + 2 * Math.floor(i / 3)), pausa: '60', note: i === 1 ? 'Nota de ejemplo' : '',
}));
const mkEx = (id, name, n, progresion) => ({ id, name, sets: '3', reps: '8', kg: '16', pause: 60, progresion, weeks: mkWeeks(n) });
const inicial = () => [
  mkEx('d4', 'Sentadilla goblet (4 sem)', 4, 'carga'),
  mkEx('d5', 'Press mancuernas (5 sem)', 5, 'reps'),
  mkEx('d6', 'Remo con barra (6 sem)', 6, 'carga'),
  mkEx('d7', 'Peso muerto rumano (7 sem)', 7, 'series'),
  mkEx('d8', 'Hip thrust (8 sem)', 8, 'pausa'),
  mkEx('d10', 'Dominadas (10 sem, fuera de 4-8)', 10, 'manual'),
  { id: 'd0', name: 'Plancha (sin semanas guardadas)', sets: '3', reps: '30s', kg: '', pause: 60, progresion: 'manual', weeks: [] },
];

export default function EditorProgresionRealDemo() {
  const [exs, setExs] = useState(inicial);
  const [open, setOpen] = useState(null); // { id, editor: 'ficha' | 'rutinas' }
  const [msg2, setMsg2] = useState('');
  const darkMode = true;
  const T = getAppThemeTokens(darkMode);
  const cur = open && exs.find((e) => e.id === open.id);
  const save = (v) => {
    setExs((p) => p.map((e) => (e.id === open.id ? { ...e, ...v } : e)));
    setMsg2('Guardado en memoria: ' + cur.name + ' → ' + (v.weeks || []).length + ' semanas (no se escribió nada fuera de esta página)');
    setOpen(null);
  };
  const box = { background: '#162234', border: '1px solid #2D4057', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 };
  const b = { minHeight: 44, padding: '0 14px', borderRadius: 10, border: '1px solid #2D4057', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div style={{ minHeight: '100dvh', background: '#0F1923', color: '#fff', fontFamily: "'Geist Sans',system-ui,sans-serif", padding: '16px 14px 40px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Demo · Editor de progresión semanal (real)</h1>
        <p style={{ fontSize: 12, color: '#8B9AB2', margin: '0 0 14px' }}>
          Datos ficticios, sin login ni conexión a datos reales. Cada ejercicio abre con su cantidad de semanas ya seleccionada. “Rutinas” = editor del lápiz de Rutinas; “Ficha alumno” = editor de la ficha del alumno. Cambiá el ancho de la ventana o girá el iPhone para ver planilla ↔ tabla.
        </p>
        {msg2 ? <div role="status" style={{ ...box, borderColor: '#22C55E', fontSize: 12 }}>{msg2}</div> : null}
        {exs.map((e) => (
          <div key={e.id} style={box}>
            <div style={{ flex: '1 1 200px', fontWeight: 700, fontSize: 14 }}>{e.name}<div style={{ fontSize: 11, color: '#8B9AB2', fontWeight: 500 }}>guardadas: {e.weeks.length} · método: {e.progresion}</div></div>
            <button type="button" style={b} onClick={() => { setMsg2(''); setOpen({ id: e.id, editor: 'rutinas' }); }}>Rutinas ✎</button>
            <button type="button" style={b} onClick={() => { setMsg2(''); setOpen({ id: e.id, editor: 'ficha' }); }}>Ficha alumno ✎</button>
          </div>
        ))}
        <button type="button" style={{ ...b, marginTop: 8 }} onClick={() => { setExs(inicial()); setMsg2(''); }}>Restablecer datos</button>
      </div>
      {cur && open.editor === 'rutinas' ? (
        <EditExerciseModal key={'r' + cur.id + cur.weeks.length} exercise={cur} darkMode={darkMode} onSave={save} onClose={() => setOpen(null)} />
      ) : null}
      {cur && open.editor === 'ficha' ? (
        <EditExModal key={'f' + cur.id + cur.weeks.length} editEx={{ ex: cur, rId: 'demo', dIdx: 0, eIdx: 0 }} btn={T.btn} inp={T.inp} es={true}
          PATS={{}} darkMode={darkMode} allEx={[]} msg={(a) => a} onSave={save} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}
