// Demostración D76-03 (demo/registro-series.html): un toque de REGISTRAR = una serie.
// Monta el panel REAL de entrenamiento (WorkoutExercisePanel, con su guarda lib/setLogGuard.js) sobre un logSet de demo que replica el de
// App.jsx con las funciones reales (write-ahead, POST idempotente, flush). Datos ficticios, sin Supabase, sin login y sin red: el
// almacenamiento y el servidor son objetos en memoria (registroSeriesDemoData.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkoutExercisePanel } from '../WorkoutExercisePanel.jsx';
import { getWorkoutExerciseStatus } from '../../lib/workoutSession.js';
import {
  DEMO_ALUMNO_ID, DEMO_RUTINA_ID, DEMO_CICLO, DEMO_SEMANA, DEMO_EJERCICIOS,
  crearStorageDemo, crearServidorDemo, crearLogSetDemo, flushDemo, pendientesDemo, verificarConsistencia, ejecutarEscenarios, fechaHoy,
} from './registroSeriesDemoData.js';

const CSS = `
.rsd { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --ok:#16a34a; --bad:#dc2626; --accent:#2563eb;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
@media (prefers-color-scheme: light) {
  html, body, #root { background-color:#f4f4f5 !important; }
  .rsd { --bg:#f4f4f5; --card:#ffffff; --text:#18181b; --muted:#52525b; --border:#d4d4d8; --btn:#e4e4e7; --ok:#15803d; --bad:#b91c1c; --accent:#1d4ed8; color-scheme: light; }
}
.rsd-wrap { max-width:32rem; margin:0 auto; padding:calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); box-sizing:border-box; overflow-x:hidden; }
.rsd h1 { font-size:18px; margin:0 0 4px; }
.rsd h2 { font-size:16px; margin:0 0 8px; }
.rsd-aviso { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#f59e0b; margin:0 0 12px; }
.rsd-sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
.rsd-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; min-width:0; }
.rsd dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:0; }
.rsd dt { color:var(--muted); font-size:15px; }
.rsd dd { margin:0; font-weight:600; font-size:15px; overflow-wrap:anywhere; }
.rsd ul { list-style:none; margin:8px 0 0; padding:0; }
.rsd li { padding:6px 0; border-top:1px solid var(--border); font-size:14px; overflow-wrap:anywhere; }
.rsd li:first-child { border-top:0; }
.rsd-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.rsd-btn { display:block; width:100%; min-width:44px; min-height:44px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
  background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:center; cursor:pointer; box-sizing:border-box; }
.rsd-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.rsd-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.rsd-btn.prim { background:var(--accent); color:#fff; border-color:transparent; }
.rsd-gate { border-radius:12px; padding:12px; margin-bottom:14px; font-size:17px; font-weight:800; text-align:center; color:#fff; }
.rsd-pass { color:var(--ok); font-weight:800; }
.rsd-fail { color:var(--bad); font-weight:800; }
.rsd-muted { color:var(--muted); font-size:14px; }
.rsd-mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; }
.rsd-panel { min-width:0; }
.rsd-panel button { min-height:44px !important; min-width:44px !important; }
`;

const LATENCIA_ON = 2000;
const corto = (id) => (id ? id.slice(0, 8) + '…' + id.slice(-4) : '');

function crearMundo() {
  return { storage: crearStorageDemo(), servidor: crearServidorDemo() };
}

export default function RegistroSeriesDemo() {
  const [version, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);
  const onlineRef = useRef(true);
  const mundoRef = useRef(null);
  const logSetRef = useRef(null);
  const panelRef = useRef(null);
  const [reinicios, setReinicios] = useState(0);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [latencia, setLatencia] = useState(0);
  const [fallaStorage, setFallaStorage] = useState(false);
  const [online, setOnline] = useState(true);
  const [nota, setNota] = useState('');
  const [dobleToque, setDobleToque] = useState(null);
  const [escenarios, setEscenarios] = useState(null);
  const [corriendo, setCorriendo] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  if (!mundoRef.current) {
    mundoRef.current = crearMundo();
    logSetRef.current = crearLogSetDemo({ storage: mundoRef.current.storage, servidor: mundoRef.current.servidor, alumnoId: DEMO_ALUMNO_ID, online: () => onlineRef.current, alCambiar: tick });
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const upd = () => setDarkMode(!mq.matches);
    upd();
    if (mq.addEventListener) mq.addEventListener('change', upd);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', upd); };
  }, []);

  const reiniciar = useCallback(() => {
    onlineRef.current = true;
    mundoRef.current = crearMundo();
    logSetRef.current = crearLogSetDemo({ storage: mundoRef.current.storage, servidor: mundoRef.current.servidor, alumnoId: DEMO_ALUMNO_ID, online: () => onlineRef.current, alCambiar: tick });
    setLatencia(0); setFallaStorage(false); setOnline(true); setActiveExIdx(0); setDobleToque(null); setEscenarios(null);
    setStartTime(Date.now()); setReinicios((n) => n + 1);
    setNota('Demo reiniciada: sesión nueva, sin series, servidor vacío.');
  }, [tick]);

  const { storage, servidor } = mundoRef.current;
  const logSet = logSetRef.current;
  const series = logSet.series();
  const progress = logSet.progress();
  const hoy = useMemo(() => fechaHoy(), []);
  const ex = DEMO_EJERCICIOS[activeExIdx];
  const status = getWorkoutExerciseStatus({ exercise: ex, progress, date: hoy, currentWeek: DEMO_SEMANA, ciclo: DEMO_CICLO });
  const consistencia = verificarConsistencia(series, servidor);
  const pendientes = pendientesDemo(storage);
  const logScope = [DEMO_ALUMNO_ID, DEMO_RUTINA_ID, 0, startTime].join('|');
  const colores = darkMode
    ? { bgCard: '#111a26', bgSub: '#0D1520', border: '#243040', textMain: '#f4f4f5', textMuted: '#94A3B8' }
    : { bgCard: '#ffffff', bgSub: '#F0F4F8', border: '#E2E8F0', textMain: '#0F1923', textMuted: '#475569' };

  // Busca el botón REGISTRAR real del panel en el DOM.
  const botonRegistrar = () => {
    const root = panelRef.current;
    if (!root) return null;
    return [...root.querySelectorAll('button')].find((b) => /REGISTRAR SET|LOG SET/.test(b.textContent || '')) || null;
  };

  const simularToques = (n) => {
    const btn = botonRegistrar();
    if (!btn) { setNota('No hay botón REGISTRAR visible (¿ejercicio completo o confirmación "LISTO" en curso?).'); return; }
    if (btn.disabled) { setNota('El botón REGISTRAR está deshabilitado ahora (confirmación "LISTO" en curso o datos incompletos). Esperá y probá de nuevo.'); return; }
    const antes = logSet.series().length;
    for (let i = 0; i < n; i++) btn.click();   // n clics SINCRÓNICOS en el mismo handler: no hay render entre ellos
    const despues = logSet.series().length;
    const delta = despues - antes;
    const esperado = logSet.ultimoError() ? 0 : 1;
    setDobleToque({ n, delta, pass: delta === esperado, error: logSet.ultimoError() });
    setNota(n + ' clics sincrónicos sobre REGISTRAR → +' + delta + ' serie(s)' + (logSet.ultimoError() ? ' (guardado anticipado falló: ' + logSet.ultimoError() + ')' : '') + '.');
  };

  const toggleLatencia = () => {
    const v = latencia ? 0 : LATENCIA_ON;
    servidor.setLatencia(v); setLatencia(v);
    setNota(v ? 'El servidor falso tarda ' + v + ' ms en responder cada POST.' : 'Servidor sin latencia.');
  };
  const toggleFalla = () => {
    const v = !fallaStorage;
    storage.setFalla(v); setFallaStorage(v);
    setNota(v ? 'El guardado anticipado falla (QuotaExceededError): REGISTRAR no guarda y los datos quedan en pantalla.' : 'Guardado anticipado normal: el próximo toque reintenta con el mismo opId.');
  };
  const toggleOnline = () => {
    const v = !online;
    onlineRef.current = v; setOnline(v);
    setNota(v ? 'Conexión restablecida: usá "Sincronizar pendientes".' : 'Sin conexión: las series quedan pendientes en el dispositivo (sin POST).');
  };
  const sincronizar = async () => {
    const r = await flushDemo({ storage, servidor, timeoutMs: Math.max(3000, latencia * 3) });
    setNota('Sincronización: ' + (r.skipped ? 'omitida (' + r.skipped + ')' : r.sent + ' confirmada(s), ' + r.failed + ' sin confirmar') + '.');
    tick();
  };

  const info = { id: ex.id, name: ex.name, pattern: ex.pattern };

  return (
    <div className="rsd">
      <style>{CSS}</style>
      <main className="rsd-wrap">
        <h1>Demo D76-03 · series duplicadas</h1>
        <p className="rsd-aviso" role="note">Datos ficticios · sin Supabase · sin login</p>
        <p className="rsd-sub">Panel de entrenamiento REAL con la guarda de registro. Para 2 series legítimas iguales: tocá REGISTRAR, esperá que vuelva de «LISTO» y tocá de nuevo.</p>

        <div className="rsd-gate" role="status" style={{ background: consistencia.pass ? 'var(--ok)' : 'var(--bad)' }}>
          {consistencia.pass ? 'PASS' : 'FAIL'} · {consistencia.detalle}
        </div>
        {dobleToque ? (
          <p role="status" style={{ marginTop: 0 }}>
            <span className={dobleToque.pass ? 'rsd-pass' : 'rsd-fail'}>{dobleToque.pass ? 'PASS' : 'FAIL'}</span>{' '}
            {dobleToque.n === 2 ? 'doble toque' : dobleToque.n + ' toques'} → +{dobleToque.delta} serie{dobleToque.delta === 1 ? '' : 's'}{dobleToque.error ? ' (fallo de guardado: se esperaba +0)' : ''}
          </p>
        ) : null}

        <section className="rsd-card rsd-panel" aria-label="Panel de registro" ref={panelRef}>
          <WorkoutExercisePanel
            key={reinicios}
            activeExIdx={activeExIdx}
            setActiveExIdx={setActiveExIdx}
            exercises={DEMO_EJERCICIOS}
            ex={ex} info={info} pat={{ icon: 'R', color: '#22C55E' }}
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
            logScope={logScope}
          />
        </section>

        <section className="rsd-card" aria-label="Controles">
          <h2>Controles</h2>
          <div className="rsd-grid">
            <button type="button" className="rsd-btn prim" onClick={() => simularToques(2)}>Simular doble toque</button>
            <button type="button" className="rsd-btn prim" onClick={() => simularToques(5)}>Simular 5 toques rápidos</button>
            <button type="button" className="rsd-btn" aria-pressed={latencia > 0} onClick={toggleLatencia}>Latencia de red: {latencia ? latencia + ' ms' : '0 ms'}</button>
            <button type="button" className="rsd-btn" aria-pressed={fallaStorage} onClick={toggleFalla}>Fallo de guardado anticipado: {fallaStorage ? 'sí' : 'no'}</button>
            <button type="button" className="rsd-btn" aria-pressed={!online} onClick={toggleOnline}>{online ? 'Conectado' : 'Sin conexión'}</button>
            <button type="button" className="rsd-btn" onClick={sincronizar}>Sincronizar pendientes</button>
            <button type="button" className="rsd-btn" onClick={() => setActiveExIdx((i) => (i + 1) % DEMO_EJERCICIOS.length)}>Cambiar ejercicio</button>
            <button type="button" className="rsd-btn" onClick={reiniciar}>Reiniciar demo</button>
          </div>
          {nota ? <p className="rsd-muted" aria-live="polite">{nota}</p> : null}
        </section>

        <section className="rsd-card" aria-label="Estado">
          <h2>Estado</h2>
          <dl>
            <dt>Series locales</dt><dd>{series.length}</dd>
            <dt>Filas en servidor</dt><dd>{servidor.filas.size}</dd>
            <dt>POST enviados</dt><dd>{servidor.posts.length}</dd>
            <dt>Pendientes</dt><dd>{pendientes} en el almacenamiento (falso) del dispositivo</dd>
            <dt>Ejercicio</dt><dd>{ex.name} · {ex.sets}×{ex.reps} · {ex.kg} kg</dd>
          </dl>
          {series.length ? (
            <ul aria-label="Series registradas">
              {series.map((s, i) => (
                <li key={s.opId}>
                  #{i + 1} · {DEMO_EJERCICIOS.find((e) => e.id === s.exId)?.name || s.exId} · {s.kg} kg × {s.reps} ·{' '}
                  <span className="rsd-mono" title={s.opId}>{corto(s.opId)}</span>{' '}
                  · {servidor.filas.has(s.opId) ? 'en servidor' : 'pendiente'}
                </li>
              ))}
            </ul>
          ) : <p className="rsd-muted">Sin series todavía.</p>}
        </section>

        <section className="rsd-card" aria-label="Pruebas automáticas">
          <h2>Pruebas automáticas</h2>
          <p className="rsd-muted" style={{ marginTop: 0 }}>Guarda real + logSet de demo; cada escenario usa almacenamiento y servidor nuevos (el de latencia tarda 1,5 s).</p>
          <button type="button" className="rsd-btn prim" disabled={corriendo} onClick={async () => {
            setCorriendo(true);
            try { setEscenarios(await ejecutarEscenarios()); } finally { setCorriendo(false); }
          }}>{corriendo ? 'Ejecutando…' : 'Ejecutar pruebas automáticas'}</button>
          {escenarios ? (
            <>
              <p style={{ fontWeight: 700 }} aria-live="polite">{escenarios.filter((e) => e.pass).length} de {escenarios.length} PASS</p>
              <ul>
                {escenarios.map((e) => (
                  <li key={e.id}>
                    <span className={e.pass ? 'rsd-pass' : 'rsd-fail'}>{e.pass ? 'PASS' : 'FAIL'}</span> {e.id}. {e.nombre}
                    <div className="rsd-muted">{e.detalle}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <span hidden>{version}</span>
      </main>
    </div>
  );
}
