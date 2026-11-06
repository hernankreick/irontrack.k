// Demostración D76-04/05 (demo/ciclos-medianoche.html): series por ciclo de rutina (D76-04) y fecha estable del entrenamiento al cruzar
// medianoche y al recargar Safari (D76-05). Usa la lógica REAL (registro, write-ahead, envío idempotente, flush, rehidratación, fecha de la
// sesión, ancla, finalización) sobre un mundo en memoria con reloj simulado (ciclosMedianocheDemoData.js). Datos ficticios, sin Supabase,
// sin login, sin red y sin el almacenamiento real del navegador.
import React, { useCallback, useRef, useState } from 'react';
import { DEMO_ALUMNO_A, DEMO_ALUMNO_B, DEMO_TIMEOUT_MS, crearMundoCiclos, ejecutarEscenarios } from './ciclosMedianocheDemoData.js';

const CSS = `
.cmd { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --ok:#4ade80; --bad:#f87171; --warn:#fbbf24; --accent:#2563eb;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
@media (prefers-color-scheme: light) {
  html, body, #root { background-color:#f4f4f5 !important; }
  .cmd { --bg:#f4f4f5; --card:#ffffff; --text:#18181b; --muted:#52525b; --border:#d4d4d8; --btn:#e4e4e7; --ok:#15803d; --bad:#b91c1c; --warn:#92400e; --accent:#1d4ed8; color-scheme: light; }
}
.cmd-wrap { max-width:32rem; margin:0 auto; padding:calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); box-sizing:border-box; overflow-x:hidden; }
.cmd h1 { font-size:18px; margin:0 0 4px; }
.cmd h2 { font-size:16px; margin:0 0 8px; }
.cmd h3 { font-size:15px; margin:10px 0 4px; }
.cmd-aviso { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#f59e0b; margin:0 0 12px; }
@media (prefers-color-scheme: light) { .cmd-aviso { color:#92400e; background:#fef3c7; } }
.cmd-sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
.cmd-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; min-width:0; }
.cmd dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:0; }
.cmd dt { color:var(--muted); font-size:15px; }
.cmd dd { margin:0; font-weight:600; font-size:15px; overflow-wrap:anywhere; min-width:0; }
.cmd ul { list-style:none; margin:8px 0 0; padding:0; }
.cmd li { padding:6px 0; border-top:1px solid var(--border); font-size:14px; overflow-wrap:anywhere; }
.cmd li:first-child { border-top:0; }
.cmd-pasos { display:grid; grid-template-columns:1fr; gap:8px; }
.cmd-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
.cmd-btn { display:block; width:100%; min-width:44px; min-height:44px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
  background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:left; cursor:pointer; box-sizing:border-box; overflow-wrap:anywhere; }
.cmd-grid .cmd-btn { text-align:center; }
.cmd-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.cmd-btn:disabled { opacity:.55; cursor:default; }
.cmd-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.cmd-btn.prim { background:var(--accent); color:#fff; border-color:transparent; }
.cmd-pass { color:var(--ok); font-weight:800; }
.cmd-fail { color:var(--bad); font-weight:800; }
.cmd-pend { color:var(--warn); font-weight:700; }
.cmd-si { color:var(--ok); font-weight:800; }
.cmd-no { color:var(--bad); font-weight:800; }
.cmd-muted { color:var(--muted); font-size:14px; }
.cmd-vacio { color:var(--muted); font-size:14px; margin:6px 0 0; }
`;

const nombre = (id) => (id === DEMO_ALUMNO_A ? 'Alumna A (demo)' : id === DEMO_ALUMNO_B ? 'Alumno B (demo)' : 'sin sesión');

export default function CiclosMedianocheDemo() {
  const [, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [escenarios, setEscenarios] = useState(null);
  const [corriendo, setCorriendo] = useState(false);
  const mundoRef = useRef(null);
  if (!mundoRef.current) mundoRef.current = crearMundoCiclos({ timeoutMs: DEMO_TIMEOUT_MS });
  const m = mundoRef.current;
  const e = m.estado();

  const accion = (fn) => async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const textos = await fn();
      setNota((Array.isArray(textos) ? textos : [textos]).filter(Boolean).join(' '));
    } catch (err) {
      setNota('Error: ' + (err && err.message ? err.message : String(err)));
    } finally {
      setOcupado(false);
      tick();
    }
  };

  // 1. una serie en cada ejercicio del ciclo vigente (inicia el entrenamiento si no hay uno abierto).
  const paso1 = accion(async () => {
    const t = [];
    if (!m.sesion) t.push(await m.iniciarEntrenamiento());
    t.push(await m.registrarSerie(0));
    m.reloj.avanzar(1);
    t.push(await m.registrarSerie(1));
    return t;
  });
  const paso2 = accion(async () => {
    const t = [await m.reiniciarRutina(), await m.iniciarEntrenamiento()];
    const ej = m.estadoEjercicio(0);
    t.push('Ejercicio 1 en el ciclo nuevo: ' + ej.setsHoy + ' serie(s) de hoy, última serie ' + (ej.lastSet ? 'presente' : 'vacía') + ', precarga ' + (ej.precargaKg == null ? 'ninguna' : ej.precargaKg + ' kg') + '.');
    return t;
  });
  const paso3 = accion(async () => {
    if (!m.st.conectado) return m.conectar();
    const t = await m.desconectar();
    const pc = m.estado().pendientesPorCiclo;
    return t + ' Pendientes por ciclo: ' + (Object.keys(pc).map((c) => 'ciclo ' + c + ' × ' + pc[c]).join(', ') || 'ninguno') + '.';
  });
  const paso4 = accion(async () => [await m.conectar(), await m.sincronizarPendientes()]);
  const paso5 = accion(async () => {
    const t = [];
    if (m.sesion) t.push(await m.abandonarSesion());
    t.push(await m.fijarReloj(23, 55));
    t.push(await m.iniciarEntrenamiento());
    return t;
  });
  const paso6 = accion(async () => m.fijarReloj(0, 10));
  const paso7 = accion(async () => {
    const t = [];
    if (!m.sesion) return 'No hay entrenamiento abierto: usá 5 para iniciarlo.';
    for (let i = 0; i < 2; i++) {
      if (m.estadoEjercicio(i).setsHoy === 0) t.push(await m.registrarSerie(i));
    }
    t.push(await m.finalizar());
    return t;
  });
  const paso8 = accion(async () => m.recargarSafari());
  const masCinco = accion(async () => m.avanzarReloj(5));
  const alumno = accion(async () => m.cambiarAlumno());

  const reiniciarDemo = () => {
    mundoRef.current = crearMundoCiclos({ timeoutMs: DEMO_TIMEOUT_MS });
    setEscenarios(null);
    setNota('Demo reiniciada: alumna A, ciclo 1, Semana 1, conectado, reloj 5/11/2026 23:50, servidor vacío.');
    tick();
  };

  const pc = e.pendientesPorCiclo;
  const deshab = ocupado || corriendo;

  return (
    <div className="cmd">
      <style>{CSS}</style>
      <main className="cmd-wrap">
        <h1>Demo D76-04/05 · ciclos y medianoche</h1>
        <p className="cmd-aviso" role="note">Datos ficticios · sin Supabase · reloj simulado</p>
        <p className="cmd-sub">Series de distintos ciclos de rutina sin mezclarse y un entrenamiento que conserva su fecha al pasar la medianoche o al recargar Safari. La hora es la del reloj simulado, nunca la del teléfono.</p>

        <section className="cmd-card" aria-label="Estado del entrenamiento">
          <h2>Estado · {nombre(e.alumnoId)}</h2>
          <dl>
            <dt>Ciclo</dt><dd>{e.ciclo}</dd>
            <dt>Fecha de inicio</dt><dd>{e.fechaInicio ? e.fechaInicio + ' (' + e.horaInicio.split(' ')[1] + ')' : 'sin entrenamiento abierto'}</dd>
            <dt>Hora simulada</dt><dd>{e.horaSimulada}</dd>
            <dt>Día activo</dt><dd>{e.diaActivo || '—'}</dd>
            <dt>Semana</dt><dd>{e.semana}</dd>
            <dt>FINALIZAR visible</dt><dd>{e.finalizarVisible ? <span className="cmd-si">sí</span> : <span className="cmd-no">no</span>} <span className="cmd-muted">({e.progresoDia.done}/{e.progresoDia.total} ejercicios)</span></dd>
            <dt>Conexión</dt><dd>{e.conectado ? 'conectado' : 'sin conexión'}</dd>
            <dt>Pendientes</dt><dd>{e.pendientes}{e.pendientes ? ' · ' + Object.keys(pc).map((c) => 'ciclo ' + c + ' × ' + pc[c]).join(', ') : ''}</dd>
            <dt>Ancla local</dt><dd>{e.ancla ? e.ancla.fecha + ' · ciclo ' + e.ancla.ciclo + ' · inicio ' + e.ancla.inicio.split(' ')[1] : 'ninguna'}</dd>
          </dl>
          {nota ? <p className="cmd-muted" aria-live="polite">{nota}</p> : null}
        </section>

        <section className="cmd-card" aria-label="Pasos">
          <h2>Pasos</h2>
          <div className="cmd-pasos">
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso1}>1 · Registrar series ciclo {e.ciclo}</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso2}>2 · Reiniciar rutina e iniciar ciclo {e.ciclo + 1}</button>
            <button type="button" className="cmd-btn" disabled={deshab} aria-pressed={!e.conectado} onClick={paso3}>3 · Ver pendientes ciclo anterior / {e.conectado ? 'desconectar' : 'reconectar'}</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso4}>4 · Sincronizar pendientes</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso5}>5 · Iniciar a las 23:55</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso6}>6 · Avanzar reloj a 00:10</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso7}>7 · Registrar y finalizar</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={paso8}>8 · Simular recarga de Safari</button>
            <button type="button" className="cmd-btn prim" disabled={deshab} onClick={async () => {
              setCorriendo(true);
              try { setEscenarios(await ejecutarEscenarios({ timeoutMs: DEMO_TIMEOUT_MS })); } finally { setCorriendo(false); }
            }}>{corriendo ? 'Ejecutando…' : '9 · Ejecutar todas las pruebas automáticas'}</button>
          </div>
          <div className="cmd-grid">
            <button type="button" className="cmd-btn" disabled={deshab} onClick={masCinco}>Reloj +5 min</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={alumno}>Cambiar alumno</button>
            <button type="button" className="cmd-btn" disabled={deshab} onClick={reiniciarDemo}>Reiniciar demo</button>
          </div>
          <p className="cmd-muted">Para ver pendientes del ciclo anterior: 3 (desconectar) → 1 → 2 → 1 → 4. Medianoche: 5 → 1 → 6 → 7, o 5 → 1 → 6 → 8.</p>
        </section>

        <section className="cmd-card" aria-label="Series registradas">
          <h2>Series registradas ({e.series.length})</h2>
          {e.series.length ? (
            <ul>
              {e.series.map((s, i) => (
                <li key={s.id || i}>
                  {s.ejercicio} · ciclo {s.ciclo} · {s.fecha} · {s.kg} kg × {s.reps} ·{' '}
                  <span className={s.estado === 'pendiente' ? 'cmd-pend' : ''}>{s.estado}</span>
                </li>
              ))}
            </ul>
          ) : <p className="cmd-vacio">Sin series todavía.</p>}
        </section>

        <section className="cmd-card" aria-label="Sesiones confirmadas">
          <h2>Sesiones confirmadas en el servidor ({e.sesionesConfirmadas.length})</h2>
          {e.sesionesConfirmadas.length ? (
            <ul>
              {e.sesionesConfirmadas.map((s) => (
                <li key={s.id}>{s.dia} · fecha {s.fecha} · hora fin {s.hora} · semana {s.semana} · ciclo {s.ciclo}</li>
              ))}
            </ul>
          ) : <p className="cmd-vacio">Sin sesiones.</p>}
        </section>

        <section className="cmd-card" aria-label="Pruebas automáticas">
          <h2>Pruebas automáticas</h2>
          <p className="cmd-muted" style={{ marginTop: 0 }}>Cada escenario usa un mundo nuevo (almacenamiento, servidor y reloj en memoria).</p>
          {escenarios ? (
            <>
              <p style={{ fontWeight: 700 }} aria-live="polite" data-qa-resumen={escenarios.every((x) => x.pass) ? 'pass' : 'fail'}>{escenarios.filter((x) => x.pass).length} de {escenarios.length} PASS</p>
              <ul>
                {escenarios.map((x) => (
                  <li key={x.id}>
                    <span className={x.pass ? 'cmd-pass' : 'cmd-fail'}>{x.pass ? 'PASS' : 'FAIL'}</span> {x.id}. {x.nombre}
                    <div className="cmd-muted">{x.detalle}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="cmd-vacio">Tocá 9 para ejecutarlas.</p>}
        </section>
        <p className="cmd-muted">Alumnos ficticios: {DEMO_ALUMNO_A}, {DEMO_ALUMNO_B}.</p>
      </main>
    </div>
  );
}
