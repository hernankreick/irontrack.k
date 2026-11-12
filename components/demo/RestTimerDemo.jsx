// Demostración del temporizador de descanso (demo/temporizador-descanso.html, PR #183).
// Monta el panel REAL de entrenamiento (WorkoutExercisePanel) y el temporizador REAL (workout/RestTimer) sobre dos alumnos ficticios.
// La pausa se interpreta con lib/restPause.js (la del PR #183): no existe un parser paralelo. Datos ficticios, sin base de datos remota, sin login,
// sin red y sin almacenamiento del navegador: todo vive en memoria y "Reiniciar demo" lo borra.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkoutExercisePanel } from '../WorkoutExercisePanel.jsx';
import RestTimer from '../workout/RestTimer.jsx';
import { resolveExerciseForWeek, getWorkoutExerciseStatus, buildExerciseSetRecord, updateExerciseProgressRecord } from '../../lib/workoutSession.js';
import { DEMO_ALUMNOS, DEMO_CICLO, DEMO_SEMANA, interpretarPausa, mostrarValor } from './restTimerDemoData.js';

const CSS = `
.rtd { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --ok:#16a34a; --bad:#dc2626; --accent:#2563eb;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
.rtd-wrap { max-width:32rem; margin:0 auto; padding:calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); box-sizing:border-box; overflow-x:hidden; }
.rtd h1 { font-size:18px; margin:0 0 4px; }
.rtd h2 { font-size:16px; margin:0 0 8px; }
.rtd-aviso { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#f59e0b; margin:0 0 12px; }
.rtd-sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
.rtd-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; min-width:0; }
.rtd-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.rtd-btn { display:block; width:100%; min-width:44px; min-height:44px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
  background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:center; cursor:pointer; box-sizing:border-box; }
.rtd-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.rtd-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.rtd-btn.prim { background:var(--accent); color:#fff; border-color:transparent; }
.rtd-list { list-style:none; margin:0; padding:0; }
.rtd-list li { margin:0 0 8px; }
.rtd-ex { text-align:left; }
.rtd-ex small { display:block; color:var(--muted); font-weight:500; font-size:13px; overflow-wrap:anywhere; }
.rtd-ok { color:#22c55e; font-weight:800; }
.rtd-no { color:#f59e0b; font-weight:800; }
.rtd-mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; overflow-wrap:anywhere; }
.rtd-log li { padding:8px 0; border-top:1px solid var(--border); font-size:14px; overflow-wrap:anywhere; }
.rtd-log li:first-child { border-top:0; }
.rtd-muted { color:var(--muted); font-size:14px; }
.rtd-panel { min-width:0; }
.rtd-panel button { min-height:44px !important; min-width:44px !important; }
.rtd-overlay { position:fixed; inset:0; z-index:1000; }
`;

const COLORES = { bgCard: '#111a26', bgSub: '#0D1520', border: '#243040', textMain: '#f4f4f5', textMuted: '#94A3B8' };
const fechaHoy = () => new Date().toLocaleDateString('es-AR');

export default function RestTimerDemo() {
  const [alumnoIdx, setAlumnoIdx] = useState(0);
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [progress, setProgress] = useState({});
  const [registros, setRegistros] = useState([]);
  const [timer, setTimer] = useState(null);
  const [, setTick] = useState(0);
  const [reinicios, setReinicios] = useState(0);
  const registrosRef = useRef([]);
  const alumnoRef = useRef(DEMO_ALUMNOS[0]);

  const alumno = DEMO_ALUMNOS[alumnoIdx];
  alumnoRef.current = alumno;
  const ejercicios = alumno.ejercicios;
  const hoy = useMemo(() => fechaHoy(), []);

  // Cuenta regresiva del temporizador (mismo criterio que WorkoutScreen: endAt - ahora).
  useEffect(() => {
    if (!timer || !timer.endAt) return undefined;
    const id = setInterval(() => {
      if (Date.now() >= timer.endAt) setTimer(null);
      else setTick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [timer]);
  const restante = timer && timer.endAt ? Math.max(0, Math.round((timer.endAt - Date.now()) / 1000)) : 0;

  // Réplica de startTimer de App.jsx: segundos <= 0 -> sin temporizador; si no, arranca con endAt.
  const startTimer = useCallback((secs, color) => {
    if (!(secs > 0)) { setTimer(null); return; }
    const ult = registrosRef.current[registrosRef.current.length - 1];
    if (ult && ult.timer == null) ult.timer = secs;   // el panel llama a logSet y DESPUÉS a startTimer, en el mismo toque
    setRegistros(registrosRef.current.slice());
    setTimer({ total: secs, color, endAt: Date.now() + secs * 1000 });
  }, []);

  // logSet en memoria: usa los constructores reales de la serie (lib/workoutSession.js) pero no persiste nada.
  const logSet = useCallback((exId, kg, reps, note, rpe, week) => {
    const semana = Number.isFinite(Number(week)) ? Number(week) : DEMO_SEMANA;
    const nueva = buildExerciseSetRecord(kg, reps, hoy, semana, note, rpe, DEMO_CICLO);
    setProgress((p) => Object.assign({}, p, { [exId]: updateExerciseProgressRecord(p[exId], nueva) }));
    const bruto = alumnoRef.current.ejercicios.find((e) => e.id === exId);
    const it = bruto ? interpretarPausa(bruto, DEMO_SEMANA) : null;
    registrosRef.current = registrosRef.current.concat([{
      n: registrosRef.current.length + 1, nombre: bruto ? bruto.name : exId, kg: nueva.kg, reps: nueva.reps, it, timer: null,
    }]);
    setRegistros(registrosRef.current.slice());
    return true;
  }, [hoy]);

  const reiniciar = useCallback(() => {
    registrosRef.current = [];
    setRegistros([]); setProgress({}); setTimer(null); setActiveExIdx(0); setReinicios((n) => n + 1);
  }, []);

  const elegirAlumno = (i) => {
    registrosRef.current = [];
    setRegistros([]); setProgress({}); setTimer(null); setActiveExIdx(0); setAlumnoIdx(i); setReinicios((n) => n + 1);
  };

  const bruto = ejercicios[Math.min(activeExIdx, ejercicios.length - 1)];
  const ex = resolveExerciseForWeek(bruto, DEMO_SEMANA);   // misma resolución semanal que WorkoutScreen.jsx
  const info = { id: ex.id, name: ex.name, pattern: ex.pattern };
  const status = getWorkoutExerciseStatus({ exercise: ex, progress, date: hoy, currentWeek: DEMO_SEMANA, ciclo: DEMO_CICLO });
  const sig = ejercicios[activeExIdx + 1];
  const logScope = ['demo', alumno.id, reinicios].join('|');

  return (
    <div className="rtd">
      <style>{CSS}</style>
      {timer ? (
        <div className="rtd-overlay">
          <RestTimer
            active
            remainingSeconds={restante}
            totalSeconds={timer.total}
            nextLabel={sig ? sig.name : ''}
            es
            green="#22C55E"
            border2="#243040"
            textMain="#f4f4f5"
            textMuted="#94A3B8"
            onSkip={() => startTimer(0)}
          />
        </div>
      ) : null}
      <main className="rtd-wrap">
        <h1>Demo · temporizador de descanso (PR #183)</h1>
        <p className="rtd-aviso" role="note">Datos ficticios · sin cuentas ni conexión a datos · nada se guarda</p>
        <p className="rtd-sub">Panel de entrenamiento y temporizador REALES. Elegí un alumno y un ejercicio, tocá REGISTRAR SET y mirá si aparece el descanso.</p>

        <section className="rtd-card" aria-label="Alumno">
          <h2>Alumno ficticio</h2>
          <div className="rtd-grid">
            {DEMO_ALUMNOS.map((a, i) => (
              <button key={a.id} type="button" className="rtd-btn" aria-pressed={i === alumnoIdx} onClick={() => elegirAlumno(i)}>
                {a.nombre}
                <small style={{ display: 'block', fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}>{a.detalle}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="rtd-card" aria-label="Ejercicios">
          <h2>Ejercicios y pausa interpretada</h2>
          <ul className="rtd-list">
            {ejercicios.map((e, i) => {
              const it = interpretarPausa(e, DEMO_SEMANA);
              return (
                <li key={e.id}>
                  <button type="button" className="rtd-btn rtd-ex" aria-pressed={i === activeExIdx} onClick={() => setActiveExIdx(i)}>
                    {e.name}
                    <small>Pausa original: <span className="rtd-mono">{mostrarValor(it.original)}</span></small>
                    {it.semana != null ? <small>Semana 1 define: <span className="rtd-mono">{mostrarValor(it.semana)}</span></small> : null}
                    <small>
                      Segundos interpretados: <strong>{it.segundos} s</strong> →{' '}
                      <span className={it.inicia ? 'rtd-ok' : 'rtd-no'}>{it.inicia ? 'inicia temporizador' : 'sin temporizador'}</span>
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rtd-card rtd-panel" aria-label="Panel de registro">
          <WorkoutExercisePanel
            key={alumno.id + '|' + reinicios}
            activeExIdx={activeExIdx}
            setActiveExIdx={setActiveExIdx}
            exercises={ejercicios}
            ex={ex} info={info} pat={{ icon: 'R', color: '#22C55E' }}
            setsHoy={status.setsToday} totalSets={status.totalSets}
            setsRestantes={status.remainingSets} setActualNum={status.currentSetNumber}
            ultimoSet={status.lastSet} pr={status.pr}
            es darkMode
            bgCard={COLORES.bgCard} bgSub={COLORES.bgSub} border={COLORES.border}
            textMain={COLORES.textMain} textMuted={COLORES.textMuted}
            sessionPRList={[]}
            videoOverrides={{}} setVideoModal={() => {}}
            currentWeek={DEMO_SEMANA}
            logSet={logSet} startTimer={startTimer}
            setPrCelebration={() => {}} progress={progress}
            rutinaDatos={{ semana_activa: DEMO_SEMANA + 1, ciclo_actual: DEMO_CICLO }}
            logScope={logScope}
          />
        </section>

        <section className="rtd-card" aria-label="Registro de la demo">
          <h2>Series registradas (solo en memoria)</h2>
          {registros.length ? (
            <ol className="rtd-log" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {registros.map((r) => (
                <li key={r.n}>
                  #{r.n} · {r.nombre} · {r.kg} kg × {r.reps}
                  <div className="rtd-muted">
                    Pausa <span className="rtd-mono">{mostrarValor(r.it && r.it.original)}</span>{r.it && r.it.semana != null ? <> (semana: <span className="rtd-mono">{mostrarValor(r.it.semana)}</span>)</> : null}
                    {' '}→ <strong>{r.it ? r.it.segundos : '?'} s</strong>
                  </div>
                  <div>
                    Temporizador:{' '}
                    {r.timer != null
                      ? <span className="rtd-ok">iniciado ({r.timer} s)</span>
                      : <span className="rtd-no">NO iniciado</span>}
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="rtd-muted">Sin series todavía.</p>}
          <button type="button" className="rtd-btn prim" style={{ marginTop: 12 }} onClick={reiniciar}>Reiniciar demo</button>
        </section>
      </main>
    </div>
  );
}
