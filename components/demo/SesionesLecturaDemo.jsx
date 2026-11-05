// Demostración D76-02 (demo/sesiones-lectura.html): lectura de sesiones del alumno con un servidor FALSO en memoria.
// Datos ficticios, sin Supabase, sin red y sin almacenamiento. Controlador y posición REALES (ver sesionesLecturaDemoData.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { crearControladorSesiones } from '../../lib/sesionesLectura.js';
import {
  DEMO_ALUMNO, DEMO_TIMEOUT_MS, demoRutina, crearServidorDemo, resumen,
  finalizarDiaConFalloRelectura, respuestaViejaDespuesDeNueva, ejecutarEscenarios,
} from './sesionesLecturaDemoData.js';

const CSS = `
.sld { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --ok:#16a34a; --bad:#dc2626; --warn:#d97706; --accent:#f59e0b;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
@media (prefers-color-scheme: light) {
  html, body, #root { background-color:#f4f4f5 !important; }
  .sld { --bg:#f4f4f5; --card:#ffffff; --text:#18181b; --muted:#52525b; --border:#d4d4d8; --btn:#e4e4e7; --ok:#15803d; --bad:#b91c1c; --warn:#b45309; --accent:#b45309; color-scheme: light; }
}
.sld-wrap { max-width:32rem; margin:0 auto; padding:16px 16px calc(32px + env(safe-area-inset-bottom)); box-sizing:border-box; }
.sld h1 { font-size:18px; margin:0 0 4px; }
.sld h2 { font-size:16px; margin:0 0 8px; }
.sld p, .sld li, .sld dd, .sld dt { font-size:15px; }
.sld-sub { color:var(--muted); font-size:14px; margin:0 0 16px; }
.sld-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; }
.sld dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:0; }
.sld dt { color:var(--muted); }
.sld dd { margin:0; font-weight:600; overflow-wrap:anywhere; }
.sld ul { list-style:none; margin:8px 0 0; padding:0; }
.sld li { padding:6px 0; border-top:1px solid var(--border); }
.sld li:first-child { border-top:0; }
.sld-btn { display:block; width:100%; min-height:44px; padding:10px 12px; margin:0 0 8px; border-radius:10px; border:1px solid var(--border);
  background:var(--btn); color:var(--text); font:inherit; font-size:15px; font-weight:600; text-align:left; cursor:pointer; }
.sld-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.sld-btn.prim { background:var(--accent); color:#111; border-color:transparent; text-align:center; }
.sld-gate { border-radius:12px; padding:16px; margin-bottom:14px; font-size:20px; font-weight:800; text-align:center; color:#fff; }
.sld-pass { color:var(--ok); font-weight:800; }
.sld-fail { color:var(--bad); font-weight:800; }
.sld-muted { color:var(--muted); font-size:14px; }
`;

const MODO_TXT = { ok: 'OK', http500: 'HTTP 500', red: 'sin red', timeout: 'no responde (timeout 3 s)', vacia: 'respuesta vacía válida' };

export default function SesionesLecturaDemo() {
  const rutina = useRef(demoRutina()).current;
  const gen = useRef(0);
  const servidorRef = useRef(null);
  const ctlRef = useRef(null);
  const [estado, setEstado] = useState(null);
  const [modo, setModo] = useState('ok');
  const [enCurso, setEnCurso] = useState(0);
  const [nota, setNota] = useState('');
  const [escenarios, setEscenarios] = useState(null);
  const [corriendo, setCorriendo] = useState(false);

  // Controlador REAL nuevo (vacío). Solo el de la generación vigente actualiza la pantalla.
  const nuevoControlador = useCallback(() => {
    const g = ++gen.current;
    const servidor = servidorRef.current;
    const ctl = crearControladorSesiones({
      leer: (aid) => servidor.leer(aid),
      timeoutMs: DEMO_TIMEOUT_MS,
      alCambiar: (e) => { if (gen.current === g) setEstado(e); },
    });
    ctlRef.current = ctl;
    setEstado(ctl.estado());
    return ctl;
  }, []);

  const correr = useCallback(async (texto, fn) => {
    setNota(texto);
    setEnCurso((n) => n + 1);
    try { await fn(); } finally { setEnCurso((n) => n - 1); }
  }, []);

  const cargarCon = useCallback((m, texto) => {
    servidorRef.current.setModo(m);
    setModo(m);
    return correr(texto, () => ctlRef.current.cargar(DEMO_ALUMNO.id));
  }, [correr]);

  const restablecer = useCallback(() => {
    servidorRef.current = crearServidorDemo();
    setModo('ok');
    setEscenarios(null);
    const ctl = nuevoControlador();
    correr('Demo restablecida: servidor con 2 sesiones (Día 1 y Día 2) y lectura exitosa.', () => ctl.cargar(DEMO_ALUMNO.id));
  }, [nuevoControlador, correr]);

  useEffect(() => { restablecer(); }, [restablecer]);

  if (!estado) return null;
  const r = resumen(estado);
  const completados = new Set(r.completedDayIndexes);

  return (
    <div className="sld">
      <style>{CSS}</style>
      <main className="sld-wrap">
        <h1>Demo D76-02 · datos ficticios · sin Supabase</h1>
        <p className="sld-sub">{DEMO_ALUMNO.nombre} · {rutina.nombre} (4 días) · servidor falso en memoria: {MODO_TXT[modo]}</p>

        <section className="sld-card" aria-label="Estado del controlador">
          <h2>Estado del controlador</h2>
          <dl>
            <dt>Estado</dt><dd>{r.status === 'sin_datos' ? 'sin datos' : r.status}{enCurso > 0 ? ' (lectura en curso)' : ''}</dd>
            <dt>Confiable</dt><dd>{r.confiable ? 'sí' : 'no'}</dd>
            <dt>Último error</dt><dd>{r.reason || 'ninguno'}</dd>
            <dt>Sesiones visibles</dt><dd>{r.visibles}</dd>
          </dl>
          {nota ? <p className="sld-muted" aria-live="polite">{nota}</p> : null}
        </section>

        <section className="sld-card" aria-label="Plan del alumno">
          <h2>Plan</h2>
          {r.plan === 'plan' ? (
            <>
              <p style={{ margin: 0, fontWeight: 700 }}>Semana {r.semana} · Día actual: {r.diaActual == null ? 'semana completa' : 'Día ' + r.diaActual}</p>
              <ul>
                {rutina.datos.days.map((d, i) => (
                  <li key={i}>{completados.has(i) ? '✓ ' : '○ '}{d.label}{completados.has(i) ? ' · completado' : ''}<span className="sld-muted"> · {d.exercises.map((e) => e.name).join(', ')}</span></li>
                ))}
              </ul>
            </>
          ) : r.plan === 'cargando' ? (
            <p style={{ margin: 0 }}>Cargando tus entrenamientos…</p>
          ) : (
            <>
              <p style={{ margin: '0 0 10px', fontWeight: 700 }}>No pudimos cargar tus entrenamientos</p>
              <button type="button" className="sld-btn prim" onClick={() => cargarCon(modo, 'Reintento con el modo actual del servidor: ' + MODO_TXT[modo] + '.')}>Reintentar</button>
            </>
          )}
        </section>

        <div className="sld-gate" role="status" style={{ background: r.puedeIniciar ? 'var(--ok)' : 'var(--bad)' }}>
          Iniciar entrenamiento: {r.puedeIniciar ? 'PERMITIDO' : 'BLOQUEADO'}
        </div>

        <section className="sld-card" aria-label="Controles manuales">
          <h2>Controles manuales</h2>
          <button type="button" className="sld-btn" onClick={() => cargarCon('ok', 'Lectura exitosa.')}>Lectura exitosa</button>
          <button type="button" className="sld-btn" onClick={() => cargarCon('http500', 'El servidor responde HTTP 500.')}>Error HTTP 500</button>
          <button type="button" className="sld-btn" onClick={() => cargarCon('red', 'La lectura falla por red (Failed to fetch).')}>Error de red</button>
          <button type="button" className="sld-btn" onClick={() => cargarCon('timeout', 'El servidor no responde: el controlador corta a los 3 s.')}>Timeout (3 s)</button>
          <button type="button" className="sld-btn" onClick={() => cargarCon('vacia', 'El servidor confirma 0 sesiones (respuesta vacía válida).')}>Respuesta vacía válida</button>
          <button type="button" className="sld-btn" onClick={() => cargarCon('ok', 'Reintento con el servidor OK.')}>Reintentar (servidor OK)</button>
          <button type="button" className="sld-btn" onClick={() => {
            setModo('http500');
            correr('Se guardó la sesión del día que tocaba y la relectura falló (HTTP 500).', async () => {
              const res = await finalizarDiaConFalloRelectura(servidorRef.current, ctlRef.current);
              if (!res.ok) setNota('No hay día pendiente en la semana: ' + res.motivo + '.');
            });
          }}>Finalizar Día {r.plan === 'plan' && r.diaActual != null ? r.diaActual : 3} + fallo de relectura</button>
          <button type="button" className="sld-btn" onClick={() => {
            servidorRef.current.setModo('ok');
            setModo('ok');
            correr('Dos lecturas: la primera tarda 1,5 s y trae una foto vieja (1 sesión); la segunda responde enseguida. Queda la nueva.',
              () => respuestaViejaDespuesDeNueva(servidorRef.current, ctlRef.current, 1500));
          }}>Respuesta vieja después de una nueva</button>
          <button type="button" className="sld-btn" onClick={() => {
            const ctl = nuevoControlador();
            correr('Recarga: controlador nuevo y vacío, lectura con el modo actual (' + MODO_TXT[modo] + ').', () => ctl.cargar(DEMO_ALUMNO.id));
          }}>Recargar (Safari)</button>
          <button type="button" className="sld-btn" onClick={restablecer}>Restablecer demo</button>
        </section>

        <section className="sld-card" aria-label="Escenarios automáticos">
          <h2>Escenarios automáticos</h2>
          <p className="sld-muted" style={{ marginTop: 0 }}>Cada escenario usa un controlador y un servidor falso nuevos (timeout corto: 200 ms).</p>
          <button type="button" className="sld-btn prim" disabled={corriendo} onClick={async () => {
            setCorriendo(true);
            try { setEscenarios(await ejecutarEscenarios({ timeoutMs: 200 })); } finally { setCorriendo(false); }
          }}>{corriendo ? 'Ejecutando…' : 'Ejecutar todos'}</button>
          {escenarios ? (
            <>
              <p style={{ fontWeight: 700 }} aria-live="polite">{escenarios.filter((e) => e.pass).length} de {escenarios.length} PASS</p>
              <ul>
                {escenarios.map((e) => (
                  <li key={e.id}>
                    <span className={e.pass ? 'sld-pass' : 'sld-fail'}>{e.pass ? 'PASS' : 'FAIL'}</span> {e.id}. {e.nombre}
                    <div className="sld-muted">{e.detalle}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
