// Demo: prescripcion de la SEMANA ACTIVA durante el entrenamiento. Usa el panel REAL (WorkoutExercisePanel), el estado real del ejercicio
// (getWorkoutExerciseStatus) y la regla real resolveExerciseForWeek. El modo «Antes» alimenta el panel con el ejercicio base (como hacia
// WorkoutScreen); «Ahora» con la prescripcion de la semana. Lo registrado se arma con buildExerciseSetRecord. Todo en memoria.
import React, { useMemo, useState } from 'react';
import { WorkoutExercisePanel } from '../WorkoutExercisePanel.jsx';
import {
  resolveExerciseForWeek, getWorkoutExerciseStatus, buildExerciseSetRecord, updateExerciseProgressRecord,
} from '../../lib/workoutSession.js';

const T = { bg: '#0F1923', card: '#162234', border: '#2D4057', muted: '#8B9AB2', accent: '#2563EB' };
const hoy = () => { const d = new Date(); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); };
const Wk = (sets, reps, kg, pausa) => ({ sets, reps, kg, pausa, note: '' });

const EJERCICIOS = {
  hip: { label: 'Hip thrust (S1 base · S2 +reps · S3 +series · S4 +carga)', ex: { id: 'hip', name: 'Hip thrust', sets: '3', reps: '8', kg: '60', pause: 90, weeks: [Wk('3', '8', '60', '90'), Wk('3', '10', '60', '90'), Wk('4', '10', '60', '75'), Wk('4', '10', '70', '60')] } },
  parcial: { label: 'Remo con barra (valores parciales)', ex: { id: 'rm', name: 'Remo con barra', sets: '3', reps: '8-10', kg: '40', pause: 60, weeks: [Wk('', '', '', ''), Wk('', '12', '', ''), Wk('', '', '45', '120'), Wk('4', '', '', '')] } },
  plancha: { label: 'Plancha (sin progresión semanal)', ex: { id: 'pl', name: 'Plancha', sets: '3', reps: '30s', kg: '', pause: 45, weeks: [] } },
};

export default function PrescripcionSemanaDemo() {
  const [key, setKey] = useState('hip');
  const [week, setWeek] = useState(0);
  const [modo, setModo] = useState('ahora'); // 'antes' = ejercicio base · 'ahora' = prescripcion de la semana
  const [registros, setRegistros] = useState({}); // por ejercicio: { sets, max }
  const [timer, setTimer] = useState(null);
  const base = EJERCICIOS[key].ex;
  const semana = useMemo(() => resolveExerciseForWeek(base, week), [base, week]);
  const exPanel = modo === 'ahora' ? semana : base;
  const fecha = hoy();
  const progress = registros;
  const st = getWorkoutExerciseStatus({ exercise: exPanel, progress, date: fecha, currentWeek: week });
  const grp = { display: 'inline-flex', border: '1px solid ' + T.border, borderRadius: 10, overflow: 'hidden', flexWrap: 'wrap' };
  const seg = (a) => ({ minHeight: 44, minWidth: 44, padding: '0 12px', border: 0, background: a ? T.accent : 'transparent', color: a ? '#fff' : T.muted, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 });
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: T.muted, margin: '12px 0 6px' };
  const fmt = (e) => (e.sets || '-') + '×' + (e.reps || '-') + (e.kg ? ' · ' + e.kg + ' kg' : '') + (e.pause ? ' · ⏱ ' + e.pause + 's' : '');
  const logSet = (exId, kg, reps, note, rpe, weekOverride) => {
    const nuevo = Object.assign(buildExerciseSetRecord(kg, reps, fecha, weekOverride, note, rpe, 1), { id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
    setRegistros((p) => Object.assign({}, p, { [exId]: updateExerciseProgressRecord(p[exId], nuevo) }));
    return true;
  };
  const sets = (registros[base.id] && registros[base.id].sets) || [];
  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: '#fff', fontFamily: "'Geist Sans',system-ui,sans-serif", padding: '14px 12px 48px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Demo · Prescripción de la semana en el entrenamiento</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: '0 0 8px', lineHeight: 1.45 }}>Datos ficticios, sin login. «Antes» = el panel usaba el ejercicio base; «Ahora» = la prescripción de la semana activa (misma regla que Inicio). Registrá series y mirá abajo qué se guarda.</p>
        <div style={lbl}>EJERCICIO</div>
        <div style={grp} role="group" aria-label="Ejercicio">
          {Object.entries(EJERCICIOS).map(([k, e]) => <button key={k} type="button" style={seg(key === k)} aria-pressed={key === k} onClick={() => setKey(k)}>{k === 'hip' ? 'Hip thrust' : k === 'parcial' ? 'Remo (parcial)' : 'Plancha (sin semanas)'}</button>)}
        </div>
        <div style={lbl}>SEMANA ACTIVA</div>
        <div style={grp} role="group" aria-label="Semana activa">
          {[0, 1, 2, 3].map((w) => <button key={w} type="button" style={seg(week === w)} aria-pressed={week === w} onClick={() => setWeek(w)}>{'Sem ' + (w + 1)}</button>)}
        </div>
        <div style={lbl}>PANEL DE ENTRENAMIENTO</div>
        <div style={grp} role="group" aria-label="Modo">
          <button type="button" style={seg(modo === 'antes')} aria-pressed={modo === 'antes'} onClick={() => setModo('antes')}>Antes (base)</button>
          <button type="button" style={seg(modo === 'ahora')} aria-pressed={modo === 'ahora'} onClick={() => setModo('ahora')}>Ahora (semana)</button>
        </div>

        <section aria-label="Prescripción cargada" style={{ background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: 12, marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: T.muted, marginBottom: 6 }}>PRESCRIPCIÓN DEL ENTRENADOR</div>
          <div data-testid="base" style={{ fontSize: 13, marginBottom: 4 }}><b>Base:</b> {fmt(base)}</div>
          <div data-testid="semana" style={{ fontSize: 13 }}><b>Semana {week + 1}:</b> {fmt(semana)}</div>
        </section>

        <div style={{ marginTop: 14 }} aria-label="Entrenamiento en curso">
          <WorkoutExercisePanel
            activeExIdx={0} setActiveExIdx={() => {}} exercises={[exPanel]} ex={exPanel} info={null} pat={{ color: '#2563EB', icon: 'E' }}
            setsHoy={st.setsToday} totalSets={st.totalSets} setsRestantes={st.remainingSets} setActualNum={st.currentSetNumber}
            ultimoSet={st.lastSet} pr={st.pr} es={true} darkMode={true}
            bgCard={T.card} bgSub={T.bg} border={T.border} textMain="#fff" textMuted={T.muted} sessionPRList={[]} videoOverrides={{}}
            setVideoModal={() => {}} currentWeek={week} logSet={logSet} startTimer={(s) => setTimer(s)} setPrCelebration={() => {}}
            rutinaDatos={{}} progress={progress} logScope={'demo|' + key} key={key + '|' + modo + '|' + week} />
        </div>
        {timer ? <div role="status" style={{ marginTop: 8, fontSize: 12, color: T.muted }}>Descanso iniciado: <b data-testid="timer" style={{ color: '#fff' }}>{timer}s</b></div> : null}

        <section aria-label="Valores registrados" style={{ background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: 12, marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: T.muted, marginBottom: 6 }}>REGISTRADO ({sets.length} series · lo que se guardaría)</div>
          {sets.length === 0 ? <div style={{ fontSize: 12, color: T.muted }}>Todavía no registraste series.</div> : null}
          {sets.slice().reverse().map((s, i) => (
            <div key={s.id} data-testid="registro" style={{ fontSize: 13, padding: '4px 0', borderTop: i ? '1px solid ' + T.border : 'none' }}>
              Serie {i + 1}: <b>{s.kg} kg × {s.reps}</b> · semana {Number(s.week) + 1}
            </div>
          ))}
          {sets.length ? <button type="button" onClick={() => setRegistros({})} style={{ marginTop: 8, minHeight: 44, padding: '0 14px', borderRadius: 10, border: '1px solid ' + T.border, background: 'transparent', color: '#fff', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Borrar registros de la demo</button> : null}
        </section>
      </div>
    </div>
  );
}
