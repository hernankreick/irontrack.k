// Demostración D76-09 (demo/historial-cuarentena.html): series del teléfono del alumno después de que el entrenador borra el historial.
// Usa el indicador REAL (PendingSyncIndicator) y la revisión REAL (HistorialCuarentenaModal) sobre la lógica real de lib/, con almacenamiento
// y servidor FALSOS en memoria (historialCuarentenaDemoData.js). Datos ficticios, sin Supabase, sin login y sin red.
import React, { useEffect, useRef, useState } from 'react';
import PendingSyncIndicator from '../workout/PendingSyncIndicator.jsx';
import HistorialCuarentenaModal from '../workout/HistorialCuarentenaModal.jsx';
import { leerSelloCache } from '../../lib/historialSello.js';
import { DEMO_EJERCICIO, crearMundoHistorial, ejecutarEscenarios } from './historialCuarentenaDemoData.js';

const CSS = `
.hcd{--bg:#0a0a0f;--card:#16161f;--text:#f4f4f5;--muted:#a1a1aa;--border:#2e2e3a;--btn:#27272f;--accent:#2563eb;--ok:#4ade80;--bad:#f87171;
 color-scheme:dark;background:var(--bg);color:var(--text);min-height:100vh;font-family:'Geist Sans',system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.45}
@media (prefers-color-scheme: light){html,body,#root{background-color:#f4f4f5 !important}
 .hcd{--bg:#f4f4f5;--card:#fff;--text:#18181b;--muted:#52525b;--border:#d4d4d8;--btn:#e4e4e7;--accent:#1d4ed8;--ok:#15803d;--bad:#b91c1c;color-scheme:light}}
.hcd-w{max-width:34rem;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) calc(28px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left));box-sizing:border-box;overflow-x:hidden}
.hcd h1{font-size:18px;margin:0 0 4px}.hcd h2{font-size:16px;margin:0 0 8px}
.hcd-tag{display:inline-block;font-size:13px;font-weight:700;padding:3px 8px;border-radius:8px;background:#f59e0b22;color:#f59e0b;margin:0 0 10px}
@media (prefers-color-scheme: light){.hcd-tag{color:#92400e;background:#fef3c7}}
.hcd-sub{color:var(--muted);font-size:14px;margin:0 0 12px}
.hcd-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;min-width:0}
.hcd-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hcd-b{display:block;width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--btn);color:var(--text);font:inherit;font-size:15px;font-weight:600;cursor:pointer;box-sizing:border-box;overflow-wrap:anywhere}
.hcd-b:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.hcd-b:disabled{opacity:.55;cursor:default}
.hcd-b.p{background:var(--accent);color:#fff;border-color:transparent}
.hcd-b[aria-pressed="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 2px var(--accent)}
.hcd ol{margin:0;padding-left:20px;font-size:14px}.hcd li{margin:4px 0}
.hcd-rows{list-style:none;margin:8px 0 0;padding:0;font-size:14px}.hcd-rows li{padding:6px 0;border-top:1px solid var(--border);overflow-wrap:anywhere}
.hcd-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}.hcd-msg{font-weight:600;margin:8px 0 0;overflow-wrap:anywhere}
.hcd-pass{color:var(--ok);font-weight:800}.hcd-fail{color:var(--bad);font-weight:800}
`;

const oscuro = () => !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);

export default function HistorialCuarentenaDemo() {
  const [, setV] = useState(0);
  const tick = () => setV((v) => v + 1);
  const [st, setSt] = useState(null);
  const [modal, setModal] = useState(false);
  const [msgA, setMsgA] = useState('');
  const [msgC, setMsgC] = useState('');
  const [escenarios, setEscenarios] = useState(null);
  const [corriendo, setCorriendo] = useState(false);
  const mundoRef = useRef(null);

  const crear = () => {
    if (mundoRef.current) mundoRef.current.ctl.dispose();
    mundoRef.current = crearMundoHistorial({
      onChange: setSt,
      onResult: (r) => { if (r.quarantined) setMsgA(r.quarantined + (r.quarantined > 1 ? ' series pasaron' : ' serie pasó') + ' a revisión: no se subieron.'); tick(); },
    });
    mundoRef.current.ctl.trigger('session').then(tick);
  };
  useEffect(() => { crear(); return () => { if (mundoRef.current) mundoRef.current.ctl.dispose(); }; }, []);
  const m = mundoRef.current;
  if (!m) return null;
  const sello = leerSelloCache(m.storage, m.alumnoId);
  const filas = m.filas();

  return (
    <div className="hcd"><style>{CSS}</style><div className="hcd-w">
      <h1>IronTrack · D76-09</h1>
      <span className="hcd-tag">DEMO · datos ficticios · sin Supabase</span>
      <p className="hcd-sub">Series que quedaron en el teléfono del alumno cuando el entrenador limpia el historial. Lógica y pantallas reales de la app; el servidor es una simulación en memoria con la misma regla que la migración.</p>

      <section className="hcd-card" aria-labelledby="hcd-pasos">
        <h2 id="hcd-pasos">Probalo así</h2>
        <ol>
          <li>Tocá <b>Sin conexión</b> y registrá 2 o 3 series.</li>
          <li>Como entrenador, tocá <b>Limpiar historial</b>.</li>
          <li>Tocá <b>Con conexión</b>: las series viejas NO se suben; quedan <b>en revisión</b>.</li>
          <li>Tocá <b>Revisar</b> → <b>Subir igual</b> → confirmá: recién ahí se suben (con auditoría).</li>
          <li>Repetí y, con la confirmación abierta, limpiá otra vez desde «Pruebas automáticas»: el servidor rechaza la subida.</li>
        </ol>
      </section>

      <section className="hcd-card" aria-labelledby="hcd-tel">
        <h2 id="hcd-tel">📱 Teléfono del alumno (ficticio)</h2>
        <PendingSyncIndicator state={st} es darkMode={oscuro()} onRetry={() => m.ctl.retryNow()} onReviewQuarantine={() => setModal(true)} />
        <div className="hcd-g" role="group" aria-label="Conexión del teléfono">
          <button type="button" className="hcd-b" aria-pressed={m.online()} onClick={async () => { setMsgA('Conexión recuperada: sincronizando…'); await m.setOnline(true); tick(); }}>Con conexión</button>
          <button type="button" className="hcd-b" aria-pressed={!m.online()} onClick={async () => { await m.setOnline(false); setMsgA('Teléfono sin conexión (simulado).'); tick(); }}>Sin conexión</button>
        </div>
        <div style={{ height: 8 }} />
        <button type="button" className="hcd-b p" onClick={async () => {
          const r = await m.registrarSerie();
          setMsgA(r.estado === 'guardada' ? 'Serie de ' + r.kg + ' kg guardada en el servidor ✓'
            : r.estado === 'revision' ? 'Serie de ' + r.kg + ' kg rechazada por el servidor (historial reiniciado) → en revisión.'
            : 'Serie de ' + r.kg + ' kg guardada en el teléfono, pendiente de sincronizar.');
          tick();
        }}>Registrar serie ({DEMO_EJERCICIO.name} × 5)</button>
        <p className="hcd-sub" style={{ margin: '8px 0 0' }}>Sello conocido por el teléfono: <span className="hcd-mono" data-qa="sello">{sello && sello.sello ? '…' + sello.sello.slice(-6) + ' (época ' + sello.epoch + ')' : 'ninguno (sin borrados)'}</span></p>
        {msgA ? <p className="hcd-msg" role="status">{msgA}</p> : null}
      </section>

      <section className="hcd-card" aria-labelledby="hcd-coach">
        <h2 id="hcd-coach">🧑‍🏫 Entrenador</h2>
        <button type="button" className="hcd-b" onClick={async () => {
          const r = await m.limpiarHistorial();
          setMsgC(r.ok ? 'Historial limpiado (época ' + r.epoch + '): ' + r.progreso + ' series borradas en el servidor.' : 'No se limpió: ' + r.reason);
          tick();
        }}>Limpiar historial del alumno</button>
        {msgC ? <p className="hcd-msg" role="status" data-qa="msg-coach">{msgC}</p> : null}
      </section>

      <section className="hcd-card" aria-labelledby="hcd-srv">
        <h2 id="hcd-srv">🗄️ Servidor (simulado): series del alumno <span data-qa="filas">({filas.length})</span></h2>
        {filas.length === 0 ? <p className="hcd-sub" style={{ margin: 0 }}>Sin series.</p> : (
          <ul className="hcd-rows">{filas.map((f) => (
            <li key={f.id}>{f.kg} kg × {f.reps} · {f.fecha} · época {f.historial_epoch}{f.reingreso_at ? ' · subida igual (registrada en época ' + (f.reingreso_de_epoch ?? '¿?') + ')' : ''}</li>
          ))}</ul>
        )}
      </section>

      <section className="hcd-card" aria-labelledby="hcd-auto">
        <h2 id="hcd-auto">Pruebas automáticas</h2>
        <button type="button" className="hcd-b" disabled={corriendo} onClick={async () => { setCorriendo(true); setEscenarios(await ejecutarEscenarios()); setCorriendo(false); }}>
          {corriendo ? 'Ejecutando…' : 'Ejecutar pruebas automáticas'}
        </button>
        {escenarios ? (
          <ul className="hcd-rows" data-qa="escenarios">{escenarios.map((e, i) => (
            <li key={i}><span className={e.ok ? 'hcd-pass' : 'hcd-fail'}>{e.ok ? 'PASA' : 'FALLA'}</span> · {e.nombre}{e.detalle ? ' (' + e.detalle + ')' : ''}</li>
          ))}</ul>
        ) : null}
      </section>

      <button type="button" className="hcd-b" onClick={() => { setMsgA(''); setMsgC(''); setEscenarios(null); crear(); tick(); }}>Reiniciar demo</button>

      {modal ? (
        <HistorialCuarentenaModal alumnoId={m.alumnoId} storage={m.storage} rpc={m.rpcAlumno} es darkMode={oscuro()}
          nombreEjercicio={() => DEMO_EJERCICIO.name} onCambio={() => { m.ctl.refresh(); tick(); }} onClose={() => { setModal(false); tick(); }} />
      ) : null}
    </div></div>
  );
}
