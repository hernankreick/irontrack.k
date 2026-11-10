// Demo de la «Nota del entrenador» por semana, con las pantallas REALES del alumno (Inicio: StudentPlanExerciseRows; entrenamiento en
// curso: WorkoutExercisePanel) y alumnos ficticios. Solo lectura: no hay login, red ni almacenamiento.
import React, { useState } from 'react';
import StudentPlanExerciseRows from '../student-plan/StudentPlanExerciseRows.jsx';
import { WorkoutExercisePanel } from '../WorkoutExercisePanel.jsx';

const W = (kg, note) => ({ sets: '3', reps: '8', kg: String(kg), pausa: '90', note });
const ALUMNOS = {
  ana: {
    label: 'Ana (con notas)',
    day: {
      warmup: [{ id: 'wu', name: 'Movilidad de cadera', sets: '2', reps: '10', weeks: [W(0, 'Sin dolor, rango corto'), W(0, ''), W(0, ''), W(0, '')] }],
      exercises: [
        { id: 'hip', name: 'Hip thrust', sets: '3', reps: '8', kg: '60', pause: 90, weeks: [W(60, '5×60 kg\n3×100 kg\n1×125'), W(70, 'Subir 10 kg respecto de la semana 1'), W(80, ''), W(90, 'Descarga: dejar 2 repeticiones en reserva.\n\nSi el glúteo no responde, cortar la serie y avisar por el chat para ajustar la carga de la próxima sesión.')] },
        { id: 'sq', name: 'Sentadilla goblet', sets: '3', reps: '8', kg: '16', pause: 60, weeks: [W(16, ''), W(16, ''), W(18, ''), W(18, '')] },
        { id: 'pl', name: 'Plancha', sets: '3', reps: '30s', kg: '', pause: 45, weeks: [] },
      ],
    },
  },
  bruno: {
    label: 'Bruno (otras notas)',
    day: {
      warmup: [],
      exercises: [
        { id: 'hip', name: 'Hip thrust', sets: '3', reps: '8', kg: '80', pause: 90, weeks: [W(80, 'Nota de Bruno · semana 1'), W(85, ''), W(90, 'Nota de Bruno · semana 3'), W(95, '')] },
        { id: 'rm', name: 'Remo con barra', sets: '3', reps: '8', kg: '40', pause: 90, weeks: [W(40, ''), W(42, ''), W(44, ''), W(46, '')] },
      ],
    },
  },
  carla: {
    label: 'Carla (sin notas)',
    day: { warmup: [], exercises: [{ id: 'hip', name: 'Hip thrust', sets: '3', reps: '10', kg: '50', pause: 75, weeks: [W(50, ''), W(52, ''), W(54, ''), W(56, '')] }] },
  },
};

export default function NotaSemanalDemo() {
  const [alumno, setAlumno] = useState('ana');
  const [week, setWeek] = useState(0);
  const [vista, setVista] = useState('inicio');
  const day = ALUMNOS[alumno].day;
  const T = { bg: '#0F1923', card: '#162234', border: '#2D4057', muted: '#8B9AB2', accent: '#2563EB' };
  const seg = (act) => ({ minHeight: 44, minWidth: 44, padding: '0 14px', border: 0, background: act ? T.accent : 'transparent', color: act ? '#fff' : T.muted, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 });
  const grp = { display: 'inline-flex', border: '1px solid ' + T.border, borderRadius: 10, overflow: 'hidden' };
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: T.muted, marginBottom: 6 };
  const ex0 = day.exercises[0];
  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: '#fff', fontFamily: "'Geist Sans',system-ui,sans-serif", padding: '14px 12px 40px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Demo · Nota del entrenador por semana</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: '0 0 12px', lineHeight: 1.45 }}>
          Datos ficticios, sin login. Elegí alumno y semana activa: se muestra solo la nota de esa semana. Sin nota no aparece el apartado.
        </p>
        <div style={lbl}>ALUMNO</div>
        <div style={{ ...grp, marginBottom: 10, flexWrap: 'wrap' }} role="group" aria-label="Alumno">
          {Object.entries(ALUMNOS).map(([k, a]) => <button key={k} type="button" style={seg(alumno === k)} aria-pressed={alumno === k} onClick={() => setAlumno(k)}>{a.label}</button>)}
        </div>
        <div style={lbl}>SEMANA ACTIVA</div>
        <div style={{ ...grp, marginBottom: 10 }} role="group" aria-label="Semana activa">
          {[0, 1, 2, 3].map((w) => <button key={w} type="button" style={seg(week === w)} aria-pressed={week === w} onClick={() => setWeek(w)}>{'Sem ' + (w + 1)}</button>)}
        </div>
        <div style={lbl}>PANTALLA</div>
        <div style={{ ...grp, marginBottom: 14 }} role="group" aria-label="Pantalla">
          <button type="button" style={seg(vista === 'inicio')} aria-pressed={vista === 'inicio'} onClick={() => setVista('inicio')}>Inicio (plan)</button>
          <button type="button" style={seg(vista === 'entrenando')} aria-pressed={vista === 'entrenando'} onClick={() => setVista('entrenando')}>Entrenando</button>
        </div>

        {vista === 'inicio' ? (
          <div style={{ background: T.card, borderRadius: 16, padding: '4px 14px 10px' }} aria-label="Inicio del alumno">
            <StudentPlanExerciseRows day={day} routineId={'demo-' + alumno} dayIndex={0} allEx={[]} currentWeekForRoutine={week}
              border={T.border} textMain="#fff" msg={(a) => a} es={true} fmtP={(s) => s + 's'} renderExerciseVideoButton={() => null} />
          </div>
        ) : (
          <div aria-label="Entrenamiento en curso">
            <WorkoutExercisePanel
              key={alumno + week} activeExIdx={0} setActiveExIdx={() => {}} exercises={day.exercises} ex={ex0} info={null} pat={{ color: '#2563EB', icon: 'E' }}
              setsHoy={[]} totalSets={3} setsRestantes={3} setActualNum={1} ultimoSet={null} pr={0} es={true} darkMode={true}
              bgCard={T.card} bgSub={T.bg} border={T.border} textMain="#fff" textMuted={T.muted} sessionPRList={[]} videoOverrides={{}}
              setVideoModal={() => {}} currentWeek={week} logSet={() => {}} startTimer={() => {}} setPrCelebration={() => {}}
              rutinaDatos={{}} progress={{}} logScope={'demo|' + alumno} />
          </div>
        )}
      </div>
    </div>
  );
}
