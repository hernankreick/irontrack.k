// Demostración D76-08 (demo/sync-pendientes.html): sincronización automática de series pendientes al volver al primer plano.
// Usa el controlador REAL (lib/pendingSyncController.js) conectado con attachSyncTriggers REAL a un navegador simulado (flag de conexión +
// EventTarget falsos), el flush, el write-ahead y el POST idempotente reales, y el indicador REAL (PendingSyncIndicator). Datos ficticios,
// sin Supabase, sin login y sin red: almacenamiento, servidor y navegador son objetos en memoria (syncPendientesDemoData.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PendingSyncIndicator from '../workout/PendingSyncIndicator.jsx';
import {
  DEMO_ALUMNOS, DEMO_ALUMNO_A, DEMO_ALUMNO_B, DEMO_EJERCICIO, crearMundoSync, ejecutarEscenarios,
} from './syncPendientesDemoData.js';

const CSS = `
.spd { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --ok:#4ade80; --bad:#f87171; --accent:#2563eb;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
@media (prefers-color-scheme: light) {
  html, body, #root { background-color:#f4f4f5 !important; }
  .spd { --bg:#f4f4f5; --card:#ffffff; --text:#18181b; --muted:#52525b; --border:#d4d4d8; --btn:#e4e4e7; --ok:#15803d; --bad:#b91c1c; --accent:#1d4ed8; color-scheme: light; }
}
.spd-wrap { max-width:32rem; margin:0 auto; padding:calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); box-sizing:border-box; overflow-x:hidden; }
.spd h1 { font-size:18px; margin:0 0 4px; }
.spd h2 { font-size:16px; margin:0 0 8px; }
.spd h3 { font-size:15px; margin:10px 0 4px; }
.spd-aviso { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#f59e0b; margin:0 0 12px; }
@media (prefers-color-scheme: light) { .spd-aviso { color:#92400e; background:#fef3c7; } }
.spd-sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
.spd-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; min-width:0; }
.spd-phone { border:2px solid var(--border); border-radius:20px; padding:12px; min-height:96px; }
.spd dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:0; }
.spd dt { color:var(--muted); font-size:15px; }
.spd dd { margin:0; font-weight:600; font-size:15px; overflow-wrap:anywhere; min-width:0; }
.spd ul { list-style:none; margin:8px 0 0; padding:0; }
.spd li { padding:6px 0; border-top:1px solid var(--border); font-size:14px; overflow-wrap:anywhere; }
.spd li:first-child { border-top:0; }
.spd-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.spd-btn { display:block; width:100%; min-width:44px; min-height:44px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
  background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:center; cursor:pointer; box-sizing:border-box; overflow-wrap:anywhere; }
.spd-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.spd-btn:disabled { opacity:.55; cursor:default; }
.spd-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.spd-btn.prim { background:var(--accent); color:#fff; border-color:transparent; }
.spd-pass { color:var(--ok); font-weight:800; }
.spd-fail { color:var(--bad); font-weight:800; }
.spd-muted { color:var(--muted); font-size:14px; }
.spd-mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; }
.spd-vacio { color:var(--muted); font-size:14px; margin:6px 0 0; }
`;

const LATENCIA_ON = 2000;
const TIMEOUT_DEMO_MS = 1500;
const corto = (id) => (id ? id.slice(0, 8) + '…' + id.slice(-4) : '');
const nombreAlumno = (id) => (DEMO_ALUMNOS.find((a) => a.id === id) || {}).nombre || 'sin sesión';
const ESTADOS = { idle: 'inactivo', pending: 'pendiente', syncing: 'sincronizando', error: 'error', offline: 'sin conexión' };

export default function SyncPendientesDemo() {
  const [, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);
  const [ctlState, setCtlState] = useState(null);
  const [nota, setNota] = useState('');
  const [latencia, setLatencia] = useState(0);
  const [escenarios, setEscenarios] = useState(null);
  const [corriendo, setCorriendo] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const mundoRef = useRef(null);

  const crear = useCallback(() => crearMundoSync({
    timeoutMs: TIMEOUT_DEMO_MS,
    alCambiar: (st) => { setCtlState(st); tick(); },
    alResultado: (r) => {
      if (r.stale) setNota('Flush de otra identidad descartado: no se aplicó al alumno actual.');
      else if (r.ran === false) setNota('Otra pestaña está sincronizando: reintento programado.');
      else setNota('Flush (' + r.reason + '): ' + r.sent + ' confirmada(s), ' + r.failed + ' sin confirmar.');
      tick();
    },
  }), [tick]);

  if (!mundoRef.current) mundoRef.current = crear();

  useEffect(() => () => { if (mundoRef.current) mundoRef.current.dispose(); }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const upd = () => setDarkMode(!mq.matches);
    upd();
    if (mq.addEventListener) mq.addEventListener('change', upd);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', upd); };
  }, []);

  const m = mundoRef.current;
  const st = ctlState || m.ctl.getState();

  const accion = (fn, texto) => () => { fn(); if (texto) setNota(texto); tick(); };

  const reiniciar = () => {
    m.dispose();
    mundoRef.current = crear();
    setCtlState(null); setLatencia(0); setEscenarios(null);
    setNota('Demo reiniciada: alumna A con sesión, conectado, sin series, servidor vacío.');
    tick();
  };

  const toggleModo = (modo, on, off) => () => {
    const v = m.servidor.modo === modo ? 'normal' : modo;
    m.servidor.setModo(v);
    setNota(v === modo ? on : off);
    tick();
  };
  const toggleLatencia = () => {
    const v = latencia ? 0 : LATENCIA_ON;
    m.servidor.setLatencia(v); setLatencia(v);
    setNota(v ? 'El servidor falso tarda ' + v + ' ms en responder cada POST.' : 'Servidor sin latencia.');
  };

  const filasPorAlumno = DEMO_ALUMNOS.map((a) => ({ a, filas: m.servidor.filasDe(a.id) }));
  const pendientesIds = new Set(DEMO_ALUMNOS.flatMap((a) => m.pendientesDe(a.id).map((x) => x.opId)));

  return (
    <div className="spd">
      <style>{CSS}</style>
      <main className="spd-wrap">
        <h1>Demo D76-08 · sincronización de pendientes</h1>
        <p className="spd-aviso" role="note">Datos ficticios · sin Supabase · sin login</p>
        <p className="spd-sub">Controlador y disparadores REALES sobre un navegador simulado. Registrá series sin conexión y probá volver a Safari, el foco o recuperar la conexión: las series se sincronizan solas.</p>

        <section className="spd-card" aria-label="Pantalla del alumno">
          <h2>Pantalla del alumno · {nombreAlumno(st.alumnoId)}</h2>
          <div className="spd-phone">
            <PendingSyncIndicator variant="inline" state={st} es={true} darkMode={darkMode} onRetry={() => { m.ctl.retryNow(); tick(); }} />
            <p className="spd-muted" style={{ margin: 0 }}>{DEMO_EJERCICIO.name} · {DEMO_EJERCICIO.kg} kg × {DEMO_EJERCICIO.reps}</p>
          </div>
        </section>

        <section className="spd-card" aria-label="Controles">
          <h2>Controles</h2>
          <div className="spd-grid">
            <button type="button" className="spd-btn prim" disabled={!m.sesion.alumnoId} onClick={accion(() => m.registrarSinConexion(1), 'Sin conexión: 1 serie guardada en el dispositivo (sin POST).')}>Registrar serie sin conexión</button>
            <button type="button" className="spd-btn prim" disabled={!m.sesion.alumnoId} onClick={accion(() => m.registrarSinConexion(3), 'Sin conexión: 3 series guardadas en el dispositivo (sin POST).')}>Registrar 3 series sin conexión</button>
            <button type="button" className="spd-btn" onClick={accion(() => m.navegador.conectar(), 'Conexión recuperada (evento online).')}>Recuperar conexión</button>
            <button type="button" className="spd-btn" onClick={accion(() => { m.navegador.ocultar(); m.navegador.mostrar(); }, 'Regreso a Safari: visibilitychange (oculto → visible).')}>Simular regreso a Safari</button>
            <button type="button" className="spd-btn" onClick={accion(() => m.navegador.foco(), 'Evento focus de la ventana.')}>Simular foco</button>
            <button type="button" className="spd-btn" onClick={accion(() => m.navegador.simultaneos(), 'online + visibilitychange + focus + pageshow en el mismo tick.')}>Simular eventos simultáneos</button>
            <button type="button" className="spd-btn" aria-pressed={m.servidor.modo === 'http500'} onClick={toggleModo('http500', 'Los próximos POST responden HTTP 500.', 'Servidor normal.')}>Simular error HTTP (próximos POST)</button>
            <button type="button" className="spd-btn" aria-pressed={m.servidor.modo === 'timeout'} onClick={toggleModo('timeout', 'Los próximos POST responden después de ' + TIMEOUT_DEMO_MS + ' ms (timeout); el servidor inserta igual.', 'Servidor normal.')}>Simular timeout</button>
            <button type="button" className="spd-btn" aria-pressed={m.servidor.modo === 'perdida'} onClick={toggleModo('perdida', 'Los próximos POST insertan y la respuesta se pierde.', 'Servidor normal.')}>Simular respuesta perdida</button>
            <button type="button" className="spd-btn" aria-pressed={latencia > 0} onClick={toggleLatencia}>Latencia: {latencia ? latencia + ' ms' : '0 ms'}</button>
            <button type="button" className="spd-btn" onClick={accion(() => m.registrarSerie(), 'Serie registrada con la conexión actual.')} disabled={!m.sesion.alumnoId}>Registrar serie (conexión actual)</button>
            <button type="button" className="spd-btn" onClick={accion(() => m.cambiarAlumno(), 'Cambio de alumno ficticio: solo se ven y envían sus pendientes.')}>Cambiar de alumno ficticio</button>
            <button type="button" className="spd-btn" onClick={accion(() => m.cerrarSesion(), 'Sesión cerrada: sin identidad no se envía nada; los pendientes quedan en el dispositivo.')}>Cerrar sesión</button>
            <button type="button" className="spd-btn" onClick={reiniciar}>Reiniciar</button>
          </div>
          <p className="spd-muted">El reintento manual es el botón del propio indicador («Sincronizar ahora» / «Reintentar»).</p>
          {nota ? <p className="spd-muted" aria-live="polite">{nota}</p> : null}
        </section>

        <section className="spd-card" aria-label="Estado">
          <h2>Estado</h2>
          <dl>
            <dt>Alumno</dt><dd>{nombreAlumno(st.alumnoId)}{st.alumnoId ? ' (' + st.alumnoId + ')' : ''}</dd>
            <dt>Conexión</dt><dd>{m.navegador.online ? 'conectado' : 'sin conexión'}</dd>
            <dt>Controlador</dt><dd>{ESTADOS[st.status] || st.status}{st.lastReason ? ' · último motivo: ' + st.lastReason : ''}</dd>
            <dt>Pendientes</dt><dd>{st.pending} (del alumno actual)</dd>
            <dt>Fallos seguidos</dt><dd>{st.failures}{st.nextRetryAt ? ' · próximo reintento en ' + Math.max(0, Math.round((st.nextRetryAt - Date.now()) / 1000)) + ' s' : ''}</dd>
            <dt>POST enviados</dt><dd>{m.servidor.posts.length}</dd>
            <dt>Flush efectivos</dt><dd>{m.flushes}</dd>
            <dt>Servidor</dt><dd>{m.servidor.modo}{latencia ? ' · ' + latencia + ' ms' : ''}</dd>
          </dl>
        </section>

        <section className="spd-card" aria-label="Series locales">
          <h2>Series locales (dispositivo)</h2>
          {m.series.length ? (
            <ul>
              {m.series.map((s, i) => (
                <li key={s.opId}>
                  #{i + 1} · {nombreAlumno(s.alumnoId)} · {s.kg} kg × {s.reps} · <span className="spd-mono" title={s.opId}>{corto(s.opId)}</span>
                  {' · '}{m.servidor.filas.has(s.opId) ? 'en servidor' : pendientesIds.has(s.opId) ? 'pendiente' : 'sin pendiente'}
                </li>
              ))}
            </ul>
          ) : <p className="spd-vacio">Sin series todavía.</p>}
        </section>

        <section className="spd-card" aria-label="Filas del servidor">
          <h2>Filas confirmadas por el servidor</h2>
          {filasPorAlumno.map(({ a, filas }) => (
            <div key={a.id}>
              <h3>{a.nombre} · {filas.length}</h3>
              {filas.length ? (
                <ul>
                  {filas.map((f) => <li key={f.id}><span className="spd-mono" title={f.id}>{corto(f.id)}</span> · {f.kg} kg × {f.reps}</li>)}
                </ul>
              ) : <p className="spd-vacio">Sin filas.</p>}
            </div>
          ))}
        </section>

        <section className="spd-card" aria-label="Pruebas automáticas">
          <h2>Pruebas automáticas</h2>
          <p className="spd-muted" style={{ marginTop: 0 }}>Cada escenario usa almacenamiento, servidor y navegador nuevos (timeout de demo {TIMEOUT_DEMO_MS} ms).</p>
          <button type="button" className="spd-btn prim" disabled={corriendo} onClick={async () => {
            setCorriendo(true);
            try { setEscenarios(await ejecutarEscenarios({ timeoutMs: TIMEOUT_DEMO_MS })); } finally { setCorriendo(false); }
          }}>{corriendo ? 'Ejecutando…' : 'Ejecutar pruebas automáticas'}</button>
          {escenarios ? (
            <>
              <p style={{ fontWeight: 700 }} aria-live="polite" data-qa-resumen={escenarios.every((e) => e.pass) ? 'pass' : 'fail'}>{escenarios.filter((e) => e.pass).length} de {escenarios.length} PASS</p>
              <ul>
                {escenarios.map((e) => (
                  <li key={e.id}>
                    <span className={e.pass ? 'spd-pass' : 'spd-fail'}>{e.pass ? 'PASS' : 'FAIL'}</span> {e.id}. {e.nombre}
                    <div className="spd-muted">{e.detalle}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <p className="spd-muted">Alumnos ficticios: {DEMO_ALUMNO_A}, {DEMO_ALUMNO_B}.</p>
      </main>
    </div>
  );
}
