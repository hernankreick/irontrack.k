// Demo QA del PR #194 (demo/qa-pr194.html): componentes REALES del PR sobre un servidor ficticio en memoria. Sin login, sin Supabase,
// sin red y sin el almacenamiento del navegador (ver qaPr194Aislamiento.js). Controles visibles para simular éxito / fallo de red /
// respuesta nula / respuesta vacía y latencia. Solo existe en builds de Preview (vite.config.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkoutExercisePanel } from '../WorkoutExercisePanel.jsx';
import { RutinaView } from '../RutinaView.jsx';
import AlumnoSettingsModal from '../student/AlumnoSettingsModal.jsx';
import AlumnoProfileModal from '../student/AlumnoProfileModal.jsx';
import ExerciseHistoryModal from '../routines/ExerciseHistoryModal.jsx';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import ToastBanner from '../ui/ToastBanner.jsx';
import { getWorkoutExerciseStatus } from '../../lib/workoutSession.js';
import { estadoAislamiento, suscribirAislamiento } from './qaPr194Aislamiento.js';
import {
  DEMO_ALUMNO_ID, DEMO_RUTINA_ID, DEMO_CICLO, DEMO_SEMANA, DEMO_EJERCICIOS,
  crearStorageDemo, crearServidorDemo, crearLogSetDemo, fechaHoy,
} from './registroSeriesDemoData.js';
import {
  MODOS, ALUMNOS_DEMO, EJERCICIOS_DEMO, HISTORIAL_DEMO, crearServidorRutinasDemo, rutinaLocalNueva, filaARutinaLocal,
} from './qaPr194DemoData.js';

const CSS = `
.qa { color-scheme: dark; min-height:100vh; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size:16px; line-height:1.45; }
.qa--dark { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --accent:#3b82f6; --ok:#22c55e; --bad:#f87171; background:var(--bg); color:var(--text); }
.qa--light { color-scheme: light; --bg:#f4f4f5; --card:#ffffff; --text:#18181b; --muted:#52525b; --border:#d4d4d8; --btn:#e4e4e7; --accent:#1d4ed8; --ok:#15803d; --bad:#b91c1c; background:var(--bg); color:var(--text); }
.qa-wrap { max-width:34rem; margin:0 auto; padding:calc(12px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) calc(120px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left)); box-sizing:border-box; overflow-x:hidden; }
.qa h1 { font-size:19px; margin:0 0 6px; } .qa h2 { font-size:17px; margin:0 0 6px; } .qa h3 { font-size:14px; margin:10px 0 4px; color:var(--muted); }
.qa-badge { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#b45309; margin:0 6px 8px 0; }
.qa--dark .qa-badge { color:#fbbf24; }
.qa-card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px; margin:0 0 16px; min-width:0; }
.qa-muted { color:var(--muted); font-size:14px; margin:4px 0 8px; }
.qa-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.qa-btn { display:block; width:100%; min-height:44px; min-width:44px; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:center; cursor:pointer; box-sizing:border-box; }
.qa-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.qa-btn.prim { background:var(--accent); color:#fff; border-color:transparent; }
.qa-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.qa ol { list-style:decimal; margin:6px 0 10px; padding-left:22px; font-size:14px; } .qa ol li { margin:4px 0; display:list-item; }
.qa dl { display:grid; grid-template-columns:auto 1fr; gap:3px 12px; margin:0; } .qa dt { color:var(--muted); font-size:14px; } .qa dd { margin:0; font-weight:700; overflow-wrap:anywhere; }
.qa ul.log { list-style:none; margin:6px 0 0; padding:0; font-size:13px; } .qa ul.log li { padding:5px 0; border-top:1px solid var(--border); overflow-wrap:anywhere; }
.qa-mono { font-family:ui-monospace,Menlo,monospace; font-size:13px; }
.qa-ok { color:var(--ok); font-weight:800; } .qa-bad { color:var(--bad); font-weight:800; }
.qa-rv { border:1px dashed var(--border); border-radius:12px; padding:6px 0; margin-top:10px; display:flex; flex-direction:column; min-width:0; }
.qa-panel button { min-height:44px; min-width:44px; }
`;

const TEMAS = {
  dark: { bgCard: '#111a26', bgSub: '#0D1520', border: '#243040', textMain: '#f4f4f5', textMuted: '#94A3B8' },
  light: { bgCard: '#ffffff', bgSub: '#F0F4F8', border: '#E2E8F0', textMain: '#0F1923', textMuted: '#475569' },
};
const PATRON = { icon: 'R', color: '#22C55E', label: 'Rodilla', labelEn: 'Knee' };

function useAislamiento() {
  const [, setN] = useState(0);
  useEffect(() => suscribirAislamiento(() => setN((n) => n + 1)), []);
  return estadoAislamiento;
}

// ── Sección 1: registro de series con el panel real ─────────────────────────────────────────────
function SeccionRegistro({ darkMode, colores, toast2 }) {
  const [version, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);
  const mundo = useRef(null);
  if (!mundo.current) {
    const storage = crearStorageDemo(); const servidor = crearServidorDemo();
    mundo.current = { storage, servidor, logSet: crearLogSetDemo({ storage, servidor, alumnoId: DEMO_ALUMNO_ID, online: () => true, alCambiar: tick }) };
  }
  const [startTime] = useState(() => Date.now());
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [reinicios, setReinicios] = useState(0);
  const { logSet } = mundo.current;
  const series = logSet.series();
  const progress = logSet.progress();
  const ex = DEMO_EJERCICIOS[activeExIdx];
  const hoy = useMemo(() => fechaHoy(), []);
  const status = getWorkoutExerciseStatus({ exercise: ex, progress, date: hoy, currentWeek: DEMO_SEMANA, ciclo: DEMO_CICLO });
  const reiniciar = () => {
    const storage = crearStorageDemo(); const servidor = crearServidorDemo();
    mundo.current = { storage, servidor, logSet: crearLogSetDemo({ storage, servidor, alumnoId: DEMO_ALUMNO_ID, online: () => true, alCambiar: tick }) };
    setReinicios((n) => n + 1); setActiveExIdx(0); tick();
  };
  return (
    <section className="qa-card" aria-label="Registro de series" id="registro">
      <h2>1 · Registro de series</h2>
      <p className="qa-muted">Panel de entrenamiento REAL del PR (A-2, A-7, A-8).</p>
      <ol>
        <li>En PESO escribí <b>82,5</b> (con coma) y tocá REGISTRAR. Abajo debe figurar <b>82.5 kg</b> (no 825).</li>
        <li>El teclado debe ser numérico con coma/punto decimal.</li>
        <li>Arrastrá el dedo <b>verticalmente</b> sobre la tarjeta (scroll): NO debe registrarse ninguna serie.</li>
        <li>Un deslizamiento horizontal a la izquierda sí registra la serie.</li>
      </ol>
      <div className="qa-panel">
        <WorkoutExercisePanel
          key={reinicios + '-' + activeExIdx}
          activeExIdx={activeExIdx} setActiveExIdx={setActiveExIdx} exercises={DEMO_EJERCICIOS}
          ex={ex} info={{ id: ex.id, name: ex.name, pattern: ex.pattern }} pat={PATRON}
          setsHoy={status.setsToday} totalSets={status.totalSets} setsRestantes={status.remainingSets} setActualNum={status.currentSetNumber}
          ultimoSet={status.lastSet} pr={status.pr}
          es={true} darkMode={darkMode}
          bgCard={colores.bgCard} bgSub={colores.bgSub} border={colores.border} textMain={colores.textMain} textMuted={colores.textMuted}
          sessionPRList={[]} videoOverrides={{}} setVideoModal={() => {}} currentWeek={DEMO_SEMANA}
          logSet={logSet} startTimer={() => {}} setPrCelebration={() => {}} progress={progress}
          rutinaDatos={{ semana_activa: DEMO_SEMANA + 1, ciclo_actual: DEMO_CICLO }}
          logScope={[DEMO_ALUMNO_ID, DEMO_RUTINA_ID, 0, startTime].join('|')}
        />
      </div>
      <h3>Series registradas (valor guardado)</h3>
      {series.length ? (
        <ul className="log" aria-label="Series registradas">
          {series.map((s, i) => (<li key={s.opId} data-qa-serie>#{i + 1} · {(DEMO_EJERCICIOS.find((e) => e.id === s.exId) || {}).name} · <b data-qa-kg>{s.kg}</b> kg × {s.reps}</li>))}
        </ul>
      ) : <p className="qa-muted" data-qa-sin-series>Sin series todavía.</p>}
      <p className="qa-muted">Total: <b data-qa-total-series>{series.length}</b> serie(s).</p>
      <div className="qa-grid">
        <button type="button" className="qa-btn" onClick={() => setActiveExIdx((i) => (i + 1) % DEMO_EJERCICIOS.length)}>Cambiar ejercicio</button>
        <button type="button" className="qa-btn" onClick={reiniciar}>Reiniciar sección</button>
      </div>
      <span hidden>{version}{toast2 ? '' : ''}</span>
    </section>
  );
}

// ── Sección 2: Ajustes / Perfil / Historial ─────────────────────────────────────────────────────
function SeccionModales({ darkMode, colores, toast2 }) {
  const [abierto, setAbierto] = useState(null);
  const [profileEdit, setProfileEdit] = useState({ nombre: 'Alumno', apellido: 'Demo', email: 'alumno@demo.invalid', phone: '+54 11 0000-0000', avatarDataUrl: '' });
  const fileRef = useRef(null);
  const msg = (a, b) => a;
  const [lang, setLang] = useState('es');
  const cerrar = () => setAbierto(null);
  const btn = (bg) => ({ background: bg || (darkMode ? '#162234' : '#E2E8F0'), color: colores.textMain, border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 });
  const lbl = { fontSize: 11, fontWeight: 700, color: colores.textMuted, letterSpacing: 1 };
  const tag = (c) => ({ background: c + '22', color: c, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 });
  return (
    <section className="qa-card" aria-label="Ajustes, Perfil e Historial" id="modales">
      <h2>2 · Ajustes, Perfil e Historial</h2>
      <p className="qa-muted">Diálogos REALES del PR (V-1). Cada uno debe: abrir, llevar el foco adentro, cerrar con la X / tocando afuera y, con teclado, con Escape.</p>
      <div className="qa-grid">
        <button type="button" className="qa-btn prim" data-qa-abrir="ajustes" onClick={() => setAbierto('ajustes')}>Abrir Ajustes</button>
        <button type="button" className="qa-btn prim" data-qa-abrir="perfil" onClick={() => setAbierto('perfil')}>Abrir Perfil</button>
        <button type="button" className="qa-btn prim" data-qa-abrir="historial" onClick={() => setAbierto('historial')}>Abrir Historial del ejercicio</button>
      </div>
      <AlumnoSettingsModal
        open={abierto === 'ajustes'} darkMode={darkMode} lang={lang} msg={msg} es={true} toast2={toast2}
        onClose={cerrar} onToggleDarkMode={() => toast2('Modo oscuro: usá el selector de arriba de la demo')} onChangeLang={(c) => setLang(c)}
        onLogoutSettings={() => { cerrar(); toast2('Salir: no hay sesión en la demo'); }}
        RecordatoriosPanel={() => <div style={{ color: '#94a3b8', fontSize: 14, padding: '8px 0' }}>Recordatorios (no disponibles en la demo)</div>}
      />
      <AlumnoProfileModal
        open={abierto === 'perfil'} sessionData={{ name: 'Alumno Demo', alumnoId: 'demo-a1' }}
        profileEdit={profileEdit} setProfileEdit={setProfileEdit} profileFileRef={fileRef}
        bgSub={colores.bgSub} border={colores.border} textMain={colores.textMain} msg={msg}
        onClose={cerrar} onSave={() => { cerrar(); toast2('Perfil guardado ✓ (solo en memoria de la demo)'); }}
      />
      <ExerciseHistoryModal
        exercise={abierto === 'historial' ? { id: 'demo_sq', name: 'Sentadilla (demo)', nameEn: 'Squat (demo)', muscle: 'Cuádriceps', equip: 'Barra' } : null}
        history={HISTORIAL_DEMO} pattern={PATRON} canAddToRoutine={false} darkMode={darkMode} es={true} msg={msg}
        btn={btn} lbl={lbl} tag={tag} bgCard={colores.bgCard} textMain={colores.textMain} textMuted={colores.textMuted}
        onClose={cerrar} onLogSet={() => toast2('Serie de ejemplo (sin efecto)')} onAddToRoutine={() => {}}
      />
    </section>
  );
}

// ── Sección 3: editor de rutinas con RutinaView REAL y servidor ficticio ──────────────────────────
function SeccionRutinas({ darkMode, colores, toast2 }) {
  const srv = useRef(null);
  if (!srv.current) srv.current = crearServidorRutinasDemo({});
  const server = srv.current;
  const [, setV] = useState(0);
  const tick = () => setV((v) => v + 1);
  const [routines, setRoutines] = useState(() => server.filas().map(filaARutinaLocal));
  const [vista, setVista] = useState(0);
  const [contadorNuevas, setContadorNuevas] = useState(0);
  const [modo, setModoUI] = useState(MODOS.OK);
  const [lat, setLat] = useState(0);
  const noop = () => {};
  const setModo = (m) => { server.setModo(m); setModoUI(m); };
  const setLatencia = (ms) => { server.setLatencia(ms); setLat(ms); };
  const recargar = () => { setRoutines(server.filas().map(filaARutinaLocal)); setVista((n) => n + 1); toast2('Vista recargada desde el servidor ficticio'); };
  const agregarNueva = () => { const n = contadorNuevas + 1; setContadorNuevas(n); setRoutines((p) => p.concat([rutinaLocalNueva(n)])); };
  // El servidor cambia fuera de React: se refresca el panel tras cada operación.
  useEffect(() => { const id = setInterval(tick, 400); return () => clearInterval(id); }, []);
  const r = server.resumen();
  const filas = server.filas();
  const etiquetas = { ok: 'Éxito', red: 'Fallo de red (lanza)', nulo: 'Respuesta nula', vacio: 'Respuesta vacía []' };
  return (
    <section className="qa-card" aria-label="Editor de rutinas" id="rutinas">
      <h2>3 · Editor de rutinas y guardado</h2>
      <p className="qa-muted">RutinaView, RoutineCard y la barra de guardado REALES del PR (R-01, R-02, R-04, R-07). El servidor es ficticio y en memoria.</p>
      <ol>
        <li>Editá un ejercicio de «Rutina A» (menú ⋮ → Editar → cambiá el Kg → GUARDAR). Aparece la barra "Guardar cambios".</li>
        <li><b>Fallo:</b> elegí «Fallo de red», «Respuesta nula» o «Respuesta vacía» y tocá Guardar cambios. NO debe aparecer "Cambios guardados ✓", la barra debe seguir y el servidor no debe cambiar.</li>
        <li><b>Éxito:</b> elegí «Éxito», guardá y tocá «Recargar vista desde el servidor»: los cambios persisten.</li>
        <li><b>Doble toque:</b> poné latencia 1500 ms, tocá Guardar cambios dos veces seguidas con una rutina nueva sin guardar (botón «Agregar rutina nueva sin guardar», editala y guardá): «create confirmados» debe subir de a 1.</li>
        <li>Reordenar ejercicios arrastrando NO escribe solo: «updates» no cambia hasta que guardás.</li>
      </ol>
      <h3>Simulador de respuesta del servidor</h3>
      <div className="qa-grid" role="group" aria-label="Modo del servidor ficticio">
        {Object.keys(etiquetas).map((m) => (<button key={m} type="button" className="qa-btn" aria-pressed={modo === m} data-qa-modo={m} onClick={() => setModo(m)}>{etiquetas[m]}</button>))}
      </div>
      <div className="qa-grid" style={{ marginTop: 8 }}>
        <button type="button" className="qa-btn" aria-pressed={lat > 0} data-qa-latencia onClick={() => setLatencia(lat ? 0 : 1500)}>Latencia: {lat ? lat + ' ms' : '0 ms'}</button>
        <button type="button" className="qa-btn" data-qa-nueva onClick={agregarNueva}>Agregar rutina nueva sin guardar</button>
        <button type="button" className="qa-btn" data-qa-recargar onClick={recargar}>Recargar vista desde el servidor</button>
      </div>
      <div className="qa-rv">
        <RutinaView
          key={vista}
          setTab={noop} border={colores.border} textMuted={colores.textMuted} bgCard={colores.bgCard} textMain={colores.textMain}
          darkMode={darkMode} bgSub={colores.bgSub} es={true} lang="es" card={{}}
          setNewR={noop} routines={routines} setRoutines={setRoutines} allEx={EJERCICIOS_DEMO}
          toast2={toast2} setAddExModal={noop} setAddExSearch={noop} setAddExPat={noop} setAddExMuscle={noop} setAddExSelectedIds={noop}
          setDupDayModal={noop} alumnos={ALUMNOS_DEMO} sb={server.sb} setAssignRoutineId={noop}
          rutinasSBEntrenador={[]} setRutinasSBEntrenador={noop}
        />
      </div>
      <h3>Servidor ficticio</h3>
      <dl data-qa-estado-servidor>
        <dt>Modo</dt><dd data-qa-modo-actual>{etiquetas[modo]}</dd>
        <dt>Filas guardadas</dt><dd data-qa-filas>{r.filas}</dd>
        <dt>updates (llamadas / confirmados)</dt><dd><span data-qa-updates>{r.updates}</span> / <span data-qa-updates-ok>{r.updatesConfirmados}</span></dd>
        <dt>create (llamadas / confirmados)</dt><dd><span data-qa-creates>{r.creates}</span> / <span data-qa-creates-ok>{r.createsConfirmados}</span></dd>
      </dl>
      <h3>Contenido persistido</h3>
      <ul className="log" aria-label="Rutinas en el servidor ficticio">
        {filas.map((f) => (
          <li key={f.id} data-qa-fila>
            <b>{f.nombre}</b> · semana_activa {String(f.datos.semana_activa)} ·{' '}
            <span className="qa-mono" data-qa-resumen-fila>{(f.datos.days || []).map((d) => (d.warmup || []).map((e) => 'cal:' + e.id.replace('demo_', '') + ' ' + e.sets + 'x' + e.reps + '@' + (e.kg || '-')).concat((d.exercises || []).map((e) => e.id.replace('demo_', '') + ' ' + e.sets + 'x' + e.reps + '@' + (e.kg || '-'))).join(', ')).join(' | ')}</span>
          </li>
        ))}
      </ul>
      <h3>Últimas respuestas del servidor</h3>
      <ul className="log" aria-label="Bitácora">
        {server.estado.bitacora.length ? server.estado.bitacora.map((b) => (<li key={b.n}>#{b.n} {b.op} · modo {b.modo} → {b.resultado}</li>)) : <li>Sin llamadas todavía.</li>}
      </ul>
    </section>
  );
}

export default function QaPr194Demo() {
  const [darkMode, setDarkMode] = useState(() => !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches));
  const [toast, setToast] = useState('');
  const tRef = useRef(null);
  const toast2 = useCallback((t) => { setToast(t); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(''), 3500); }, []);
  const aisl = useAislamiento();
  const colores = darkMode ? TEMAS.dark : TEMAS.light;
  useEffect(() => { document.documentElement.style.background = darkMode ? '#0a0a0f' : '#f4f4f5'; document.body.style.background = darkMode ? '#0a0a0f' : '#f4f4f5'; }, [darkMode]);
  return (
    <div className={'qa ' + (darkMode ? 'qa--dark' : 'qa--light')}>
      <style>{CSS}</style>
      <AppGlobalStyles darkMode={darkMode} bgSub={colores.bgSub} textMain={colores.textMain} border={colores.border} />
      <main className="qa-wrap">
        <h1>Demo QA · PR #194</h1>
        <span className="qa-badge" role="note">Datos ficticios</span><span className="qa-badge">Sin login</span><span className="qa-badge">Sin Supabase</span>
        <section className="qa-card" aria-label="Aislamiento y tema" id="aislamiento">
          <h2>Aislamiento</h2>
          <dl data-qa-aislamiento>
            <dt>Almacenamiento</dt><dd data-qa-storage>{aisl.storageEnMemoria ? 'en memoria (no toca el de la app real)' : 'NO AISLADO'}</dd>
            <dt>IndexedDB</dt><dd>{aisl.indexedDBBloqueado ? 'bloqueado' : 'no bloqueado'}</dd>
            <dt>Red</dt><dd data-qa-red>{aisl.redBloqueada ? 'bloqueada' : 'NO BLOQUEADA'}</dd>
            <dt>Intentos de red</dt><dd className={aisl.intentosRed.length ? 'qa-bad' : 'qa-ok'} data-qa-intentos>{aisl.intentosRed.length}</dd>
          </dl>
          <p className="qa-muted">Todo vive en memoria: al recargar la página la demo vuelve al inicio.</p>
          <div className="qa-grid" role="group" aria-label="Tema">
            <button type="button" className="qa-btn" aria-pressed={darkMode} data-qa-tema="oscuro" onClick={() => setDarkMode(true)}>Tema oscuro</button>
            <button type="button" className="qa-btn" aria-pressed={!darkMode} data-qa-tema="claro" onClick={() => setDarkMode(false)}>Tema claro</button>
          </div>
        </section>
        <SeccionRegistro darkMode={darkMode} colores={colores} toast2={toast2} />
        <SeccionModales darkMode={darkMode} colores={colores} toast2={toast2} />
        <SeccionRutinas darkMode={darkMode} colores={colores} toast2={toast2} />
      </main>
      <ToastBanner toast={toast} darkMode={darkMode} border={colores.border} textMain={colores.textMain} />
    </div>
  );
}
