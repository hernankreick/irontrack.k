// Demostración D7.6 (demo/cargas-historial.html): validación de cargas + historial completo de sesiones.
// Monta el panel REAL de entrenamiento (WorkoutExercisePanel) sobre un logSet de demo con la misma defensa que App.jsx, y el panel REAL
// del historial de sesiones (ProgressSessionsPanel) leyendo con la lectura paginada real. Datos ficticios, sin Supabase, sin login y
// sin red (cargasHistorialDemoData.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkoutExercisePanel } from '../WorkoutExercisePanel.jsx';
import { ProgressSessionsPanel } from '../student-progress/ProgressSessionsPanel.jsx';
import { getWorkoutExerciseStatus } from '../../lib/workoutSession.js';
import {
  DEMO_ALUMNO_ID, DEMO_CICLO, DEMO_SEMANA, DEMO_EJERCICIOS, crearLogSetDemo, crearSesionesDemo, crearServidorSesiones, leerAntes,
  metricasAlumno, crearControladorDemo, ejecutarEscenarios, fechaHoy,
} from './cargasHistorialDemoData.js';

const CSS = `
.chd { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --ok:#16a34a; --bad:#dc2626; --accent:#2563eb;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
@media (prefers-color-scheme: light) {
  html, body, #root { background-color:#f4f4f5 !important; }
  .chd { --bg:#f4f4f5; --card:#ffffff; --text:#18181b; --muted:#52525b; --border:#d4d4d8; --btn:#e4e4e7; --ok:#15803d; --bad:#b91c1c; --accent:#1d4ed8; color-scheme: light; }
}
.chd-wrap { max-width:32rem; margin:0 auto; padding:calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); box-sizing:border-box; overflow-x:hidden; }
.chd h1 { font-size:18px; margin:0 0 4px; }
.chd h2 { font-size:16px; margin:0 0 8px; }
.chd-aviso { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#f59e0b; margin:0 0 12px; }
.chd-sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
.chd-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; min-width:0; }
.chd ul { list-style:none; margin:8px 0 0; padding:0; }
.chd li { padding:6px 0; border-top:1px solid var(--border); font-size:14px; overflow-wrap:anywhere; }
.chd li:first-child { border-top:0; }
.chd-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.chd-btn { display:block; width:100%; min-width:44px; min-height:44px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
  background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:center; cursor:pointer; box-sizing:border-box; }
.chd-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.chd-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.chd-btn.prim { background:var(--accent); color:#fff; border-color:transparent; }
.chd-pass { color:var(--ok); font-weight:800; }
.chd-fail { color:var(--bad); font-weight:800; }
.chd-muted { color:var(--muted); font-size:14px; }
.chd table { width:100%; border-collapse:collapse; font-size:14px; }
.chd th, .chd td { text-align:left; padding:6px 4px; border-top:1px solid var(--border); }
.chd th { color:var(--muted); font-weight:600; }
.chd-panel { min-width:0; }
.chd-panel button { min-height:44px !important; min-width:44px !important; }
`;

export default function CargasHistorialDemo() {
  const [, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);
  const logSetRef = useRef(null);
  const [reinicios, setReinicios] = useState(0);
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [escenarios, setEscenarios] = useState(null);
  const [corriendo, setCorriendo] = useState(false);
  if (!logSetRef.current) logSetRef.current = crearLogSetDemo({ alCambiar: tick });

  // ── sesiones ──
  const rows = useMemo(() => crearSesionesDemo(26), []);
  const fallaRef = useRef(null);
  const srv = useMemo(() => crearServidorSesiones(rows, { fallarPagina: () => fallaRef.current }), [rows]);
  const ctlRef = useRef(null);
  if (!ctlRef.current) ctlRef.current = crearControladorDemo(srv, 10);
  const [estadoSes, setEstadoSes] = useState(() => ctlRef.current.estado());
  const [fallaPag2, setFallaPag2] = useState(false);
  const recargar = useCallback(async () => { setEstadoSes(await ctlRef.current.cargar(DEMO_ALUMNO_ID)); }, []);
  useEffect(() => { recargar(); }, [recargar]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const upd = () => setDarkMode(!mq.matches);
    upd();
    if (mq.addEventListener) mq.addEventListener('change', upd);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', upd); };
  }, []);

  const logSet = logSetRef.current;
  const progress = logSet.progress();
  const hoy = useMemo(() => fechaHoy(), []);
  const ex = DEMO_EJERCICIOS[activeExIdx];
  const status = getWorkoutExerciseStatus({ exercise: ex, progress, date: hoy, currentWeek: DEMO_SEMANA, ciclo: DEMO_CICLO });
  const colores = darkMode
    ? { bgCard: '#111a26', bgSub: '#0D1520', border: '#243040', textMain: '#f4f4f5', textMuted: '#94A3B8' }
    : { bgCard: '#ffffff', bgSub: '#F0F4F8', border: '#E2E8F0', textMain: '#0F1923', textMuted: '#475569' };
  const antes = metricasAlumno(leerAntes(rows));
  const ahora = metricasAlumno(estadoSes.rows);
  const intentos = logSet.intentos().slice(-6).reverse();
  const prs = logSet.prs();

  const reiniciar = () => {
    logSetRef.current = crearLogSetDemo({ alCambiar: tick });
    setActiveExIdx(0); setEscenarios(null); setReinicios((n) => n + 1);
  };
  const toggleFalla = async () => {
    const v = !fallaPag2;
    fallaRef.current = v ? 1 : null;
    setFallaPag2(v);
    setEstadoSes(await ctlRef.current.cargar(DEMO_ALUMNO_ID));
  };
  const correr = async () => {
    setCorriendo(true);
    try { setEscenarios(await ejecutarEscenarios()); } finally { setCorriendo(false); }
  };
  const nombreEj = (id) => (DEMO_EJERCICIOS.find((e) => e.id === id) || {}).name || id;

  return (
    <div className="chd">
      <style>{CSS}</style>
      <main className="chd-wrap">
        <h1>Demo D7.6 · cargas y historial</h1>
        <p className="chd-aviso" role="note">Datos ficticios · sin Supabase · sin login</p>

        <h2>1 · Validación de cargas</h2>
        <p className="chd-sub">Panel de entrenamiento REAL. Probá escribir en kg: <b>-10</b>, <b>80abc</b>, <b>1e5</b> o <b>800000</b> (REGISTRAR queda deshabilitado y aparece el aviso), y <b>102,5</b> (válido; supera el récord ficticio de 100 kg → PR). En Dominadas el kg puede quedar vacío (peso corporal) o llevar lastre.</p>
        <div className="chd-grid" style={{ marginBottom: 10 }}>
          {DEMO_EJERCICIOS.map((e, i) => (
            <button key={e.id} type="button" className="chd-btn" aria-pressed={i === activeExIdx} onClick={() => setActiveExIdx(i)}>{e.name.split(' (')[0]}</button>
          ))}
          <button type="button" className="chd-btn" onClick={reiniciar}>Reiniciar</button>
        </div>
        <section className="chd-card chd-panel" aria-label="Panel de registro">
          <WorkoutExercisePanel
            key={reinicios + '-' + activeExIdx}
            activeExIdx={activeExIdx}
            setActiveExIdx={setActiveExIdx}
            exercises={DEMO_EJERCICIOS}
            ex={ex} info={{ id: ex.id, name: ex.name, pattern: ex.pattern }} pat={{ icon: 'R', color: '#22C55E' }}
            setsHoy={status.setsToday} totalSets={status.totalSets}
            setsRestantes={status.remainingSets} setActualNum={status.currentSetNumber}
            ultimoSet={status.lastSet} pr={status.pr}
            es={true} darkMode={darkMode}
            bgCard={colores.bgCard} bgSub={colores.bgSub} border={colores.border}
            textMain={colores.textMain} textMuted={colores.textMuted}
            sessionPRList={[]}
            videoOverrides={{}} setVideoModal={() => {}}
            currentWeek={DEMO_SEMANA}
            logSet={logSet} startTimer={() => {}}
            setPrCelebration={() => {}} progress={progress}
            rutinaDatos={{ semana_activa: DEMO_SEMANA + 1, ciclo_actual: DEMO_CICLO }}
            logScope={'demo-d76|' + reinicios}
          />
        </section>
        <section className="chd-card" aria-label="Registro de intentos">
          <h2>Lo que llega al servidor</h2>
          <p className="chd-muted" style={{ margin: 0 }}>Series enviadas: {logSet.enviados().length} · PR detectados: {prs.length ? prs.map((p) => p.kg + ' kg').join(', ') : 'ninguno'}</p>
          {intentos.length ? (
            <ul>
              {intentos.map((x, i) => (
                <li key={i}><span className={x.ok ? 'chd-pass' : 'chd-fail'}>{x.ok ? 'GUARDADA' : 'RECHAZADA'}</span> · {nombreEj(x.exId)} · {String(x.kg)} kg × {String(x.reps)}</li>
              ))}
            </ul>
          ) : <p className="chd-muted">Todavía no registraste series.</p>}
        </section>

        <h2>2 · Historial de sesiones</h2>
        <p className="chd-sub">26 sesiones ficticias (una por día) y 3 de otro alumno en el mismo servidor. Antes la app pedía solo las 10 más recientes.</p>
        <section className="chd-card" aria-label="Comparación">
          <table>
            <thead><tr><th scope="col">Métrica del alumno</th><th scope="col">Antes (limit=10)</th><th scope="col">Ahora</th></tr></thead>
            <tbody>
              <tr><td>Sesiones completadas</td><td>{antes.total}</td><td><b>{ahora.total}</b></td></tr>
              <tr><td>Racha (días)</td><td>{antes.racha}</td><td><b>{ahora.racha}</b></td></tr>
              <tr><td>Logro «20 sesiones»</td><td>{antes.logro20 ? 'sí' : 'no'}</td><td><b>{ahora.logro20 ? 'sí' : 'no'}</b></td></tr>
              <tr><td>Semanas en el historial</td><td>{Object.keys(antes.semanas).length}</td><td><b>{Object.keys(ahora.semanas).length}</b></td></tr>
            </tbody>
          </table>
          <p className="chd-muted" role="status" style={{ marginBottom: 0 }}>Estado de la lectura: <b>{estadoSes.status}</b>{estadoSes.status === 'desactualizado' ? ' (falló una página: se conservan los datos anteriores completos)' : ''} · consultas al servidor: {srv.llamadas.length}</p>
          <div className="chd-grid" style={{ marginTop: 10 }}>
            <button type="button" className="chd-btn" aria-pressed={fallaPag2} onClick={toggleFalla}>Falla página 2: {fallaPag2 ? 'sí' : 'no'}</button>
            <button type="button" className="chd-btn" onClick={recargar}>Volver a leer</button>
          </div>
        </section>
        <section className="chd-card" aria-label="Historial por semanas">
          <ProgressSessionsPanel sharedParam="" sb={{ getSesiones: async () => [] }} EX={[]} es={true} sesiones={estadoSes.rows} expectedDaysPerWeek={3} />
        </section>

        <section className="chd-card" aria-label="Escenarios automáticos">
          <h2>Escenarios automáticos</h2>
          <button type="button" className="chd-btn prim" onClick={correr} disabled={corriendo}>{corriendo ? 'Corriendo…' : 'Correr escenarios'}</button>
          {escenarios ? (
            <ul>
              {escenarios.map((s, i) => (
                <li key={i}><span className={s.pass ? 'chd-pass' : 'chd-fail'}>{s.pass ? 'PASS' : 'FAIL'}</span> · {s.nombre}{s.detalle ? <span className="chd-muted"> — {s.detalle}</span> : null}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </div>
  );
}
