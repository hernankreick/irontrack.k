// Demostración R1 fase 1 (demo/guardado-rutinas.html): monta la pantalla REAL de Rutinas (RutinaView) contra un servidor FALSO en memoria.
// Datos ficticios, sin login, sin backend y sin red. Permite simular guardado correcto, error de red, error de permisos, cero filas,
// guardado parcial, doble toque y edición durante un guardado lento.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RutinaView } from '../RutinaView.jsx';
import { DEMO_ALUMNOS, MODOS, crearRutinasIniciales, crearServidor } from './guardadoRutinasDemoData.js';

const CSS = `
.grd { --bg:#0a0a0f; --card:#16161f; --text:#f4f4f5; --muted:#a1a1aa; --border:#2e2e3a; --btn:#27272f; --accent:#2563eb;
  color-scheme: dark; background:var(--bg); color:var(--text); min-height:100vh; font-family:'Geist Sans', system-ui, sans-serif; font-size:16px; line-height:1.45; }
.grd-wrap { max-width:36rem; margin:0 auto; padding:calc(12px + env(safe-area-inset-top)) 12px 0; box-sizing:border-box; overflow-x:hidden; }
.grd h1 { font-size:18px; margin:0 0 4px; }
.grd-aviso { display:inline-block; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; background:#f59e0b22; color:#f59e0b; margin:0 0 8px; }
.grd-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:12px; }
.grd-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.grd-btn { display:block; width:100%; min-height:44px; padding:8px 10px; border-radius:10px; border:1px solid var(--border); background:var(--btn);
  color:var(--text); font:inherit; font-size:14px; font-weight:600; cursor:pointer; box-sizing:border-box; }
.grd-btn[aria-pressed="true"] { border-color:var(--accent); box-shadow:inset 0 0 0 2px var(--accent); }
.grd-muted { color:var(--muted); font-size:13px; margin:6px 0 0; }
.grd-toast { position:fixed; top:calc(8px + env(safe-area-inset-top)); left:50%; transform:translateX(-50%); max-width:92vw; background:#18181b; color:#fff;
  border:1px solid var(--border); border-radius:10px; padding:10px 14px; font-size:14px; font-weight:600; z-index:20000; }
.grd-rutinas { display:flex; flex-direction:column; min-height:70vh; }
`;

export default function GuardadoRutinasDemo() {
  const [, setV] = useState(0);
  const repintar = useCallback(() => setV((v) => v + 1), []);
  const servidor = useMemo(() => crearServidor(repintar), [repintar]);
  const [routines, setRoutines] = useState(crearRutinasIniciales);
  const [toast, setToast] = useState('');
  const [clave, setClave] = useState(0);
  const toastTimer = useRef(null);
  const toast2 = useCallback((m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);
  // Para el QA automatico (scripts/qa/r1-guardado-rutinas.mjs): estado interno inspeccionable.
  useEffect(() => { window.__r1demo = { servidor, routines }; });
  const noop = () => {};
  const reiniciar = () => { servidor.reset(); servidor.modo = 'ok'; servidor.latenciaMs = 0; setRoutines(crearRutinasIniciales()); setClave((k) => k + 1); repintar(); };
  const filas = Object.values(servidor.filas);

  return (
    <div className="grd">
      <style>{CSS}</style>
      <div className="grd-wrap">
        <h1>Demo · guardado de rutinas</h1>
        <span className="grd-aviso">DATOS FICTICIOS · sin backend · sin login</span>
        <div className="grd-card" aria-label="Simulador del servidor">
          <div className="grd-grid">
            {MODOS.map(([m, label]) => (
              <button key={m} type="button" className="grd-btn" aria-pressed={servidor.modo === m} onClick={() => { servidor.modo = m; repintar(); }}>{label}</button>
            ))}
            <button type="button" className="grd-btn" aria-pressed={servidor.latenciaMs > 0} onClick={() => { servidor.latenciaMs = servidor.latenciaMs ? 0 : 3000; repintar(); }}>
              {servidor.latenciaMs ? 'Servidor lento: 3 s (activo)' : 'Servidor lento: 3 s'}
            </button>
            <button type="button" className="grd-btn" onClick={reiniciar}>Restablecer demo</button>
          </div>
          <p className="grd-muted" data-qa="contadores">Escrituras recibidas: {servidor.inserts} creaciones · {servidor.updates} actualizaciones</p>
          <p className="grd-muted" data-qa="servidor">En el servidor: {filas.map((f) => {
            const e = f.datos && f.datos.days && f.datos.days[0] && f.datos.days[0].exercises && f.datos.days[0].exercises[0];
            return f.nombre + (e ? ' (' + e.name + ' ' + e.kg + ' kg)' : '');
          }).join(' · ') || 'vacío'}</p>
          <p className="grd-muted">Probá: modo de error → editar un ejercicio → «Guardar cambios» (no debe decir «guardado»). «Servidor lento» → doble toque o editar mientras guarda.</p>
        </div>
        <div className="grd-rutinas" key={clave}>
          <RutinaView
            setTab={noop} border="#2e2e3a" textMuted="#a1a1aa" bgCard="#16161f" textMain="#f4f4f5" darkMode bgSub="#1c1c26" es lang="es"
            card={{}} setNewR={noop} routines={routines} setRoutines={setRoutines} allEx={[]} toast2={toast2}
            setAddExModal={noop} setAddExSearch={noop} setAddExPat={noop} setAddExMuscle={noop} setAddExSelectedIds={noop}
            setDupDayModal={noop} alumnos={DEMO_ALUMNOS} sb={servidor.sb} setAssignRoutineId={noop}
            rutinasSBEntrenador={[]} setRutinasSBEntrenador={noop} onRestartRoutine={async () => ({ ok: true })}
          />
        </div>
      </div>
      {toast ? <div className="grd-toast" role="status" aria-live="polite" data-qa="toast">{toast}</div> : null}
    </div>
  );
}
