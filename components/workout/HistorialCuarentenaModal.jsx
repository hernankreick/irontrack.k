// D76-09 — Revision de lo que quedo en cuarentena por un borrado de historial (series y sesiones guardadas en ESTE telefono).
// Acciones, todas explicitas:
//   · Conservar (cerrar): no cambia nada.
//   · Descartar un registro: con confirmacion.
//   · «Subir igual»: 1) relee el estado VIGENTE del servidor y muestra la fecha del borrado; 2) el alumno confirma marcando la casilla;
//     3) RPC it_historial_reingresar con la epoca mostrada. Si el entrenador volvio a borrar entretanto -> conflicto: no se sube nada.
// La logica vive en lib/historialCuarentena.js (probada en node); este componente solo presenta.
import React, { useEffect, useRef, useState } from 'react';
import {
  leerCuarentena, descartarDeCuarentena, prepararConfirmacionReingreso, ejecutarReingreso,
} from '../../lib/historialCuarentena.js';

function fechaHora(iso, es) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(es ? 'es-AR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return String(iso); }
}

export function textoRegistro(r, es, nombreEjercicio) {
  if (r.tipo === 'sesion') {
    var s = r.payload || {};
    return (es ? 'Entrenamiento · ' : 'Workout · ') + (s.dia_label || (es ? 'Día' : 'Day')) + (s.fecha ? ' · ' + s.fecha : '');
  }
  var it = r.item || {};
  var nombre = '';
  try { nombre = typeof nombreEjercicio === 'function' ? (nombreEjercicio(it.exId) || '') : ''; } catch (e) { nombre = ''; }
  return (nombre || it.exId || (es ? 'Ejercicio' : 'Exercise')) + ' · ' + String(it.kg) + ' kg × ' + String(it.reps) + (it.date ? ' · ' + it.date : '');
}

/** Texto del resultado de «Subir igual». Puro (se prueba en node). */
export function textoResultadoReingreso(res, es) {
  if (!res) return '';
  if (res.ok) {
    var r = res.resumen || {};
    var subidos = (r.subidos || 0) + (r.yaExistian || 0) + (r.liberadas || 0);
    var base = es ? subidos + ' ' + (subidos === 1 ? 'registro subido' : 'registros subidos') + '.' : subidos + ' ' + (subidos === 1 ? 'record uploaded' : 'records uploaded') + '.';
    var resto = (r.invalidos || 0) + (r.conflictos || 0);
    return resto ? base + (es ? ' ' + resto + ' no se pudieron subir y siguen en revisión.' : ' ' + resto + ' could not be uploaded and stay for review.') : base;
  }
  if (res.reason === 'conflicto_epoch') {
    return es
      ? 'Tu entrenador volvió a reiniciar tu historial mientras confirmabas. No se subió nada: revisá y volvé a intentar.'
      : 'Your coach reset your history again while you were confirming. Nothing was uploaded: review and try again.';
  }
  if (res.reason === 'sin_permiso') return es ? 'Tu cuenta todavía no está vinculada. Pedile a tu entrenador que apruebe el vínculo.' : 'Your account is not linked yet. Ask your coach to approve the link.';
  if (res.reason === 'sin_capacidad') return es ? 'El servidor todavía no permite subir estos registros.' : 'The server does not allow uploading these records yet.';
  return es ? 'No se pudo subir. Tus registros siguen guardados en este teléfono.' : 'Could not upload. Your records are still saved on this phone.';
}

var PAL = {
  dark: { bg: '#16161f', text: '#f4f4f5', muted: '#a1a1aa', border: '#2e2e3a', btn: '#27272f', prim: '#2563eb', primText: '#ffffff', danger: '#fecaca', warnBg: '#1f1500', warnText: '#fcd34d' },
  light: { bg: '#ffffff', text: '#18181b', muted: '#52525b', border: '#d4d4d8', btn: '#e4e4e7', prim: '#1d4ed8', primText: '#ffffff', danger: '#991b1b', warnBg: '#fffbeb', warnText: '#78350f' },
};

export default function HistorialCuarentenaModal({ alumnoId, storage, rpc, addSesion, es = true, darkMode = true, nombreEjercicio, onCambio, onClose }) {
  var c = PAL[darkMode === false ? 'light' : 'dark'];
  var [version, setVersion] = useState(0);
  var [paso, setPaso] = useState('lista');            // lista | confirmar
  var [estado, setEstado] = useState(null);           // { epoch, reset_at } leido del servidor para la confirmacion
  var [acepta, setAcepta] = useState(false);
  var [ocupado, setOcupado] = useState(false);
  var [mensaje, setMensaje] = useState('');
  var [aDescartar, setADescartar] = useState(null);   // registro con confirmacion de descarte abierta
  var tituloRef = useRef(null);
  var q = leerCuarentena(storage, alumnoId);
  void version;
  var registros = q.series.concat(q.sesiones);

  useEffect(function () { if (tituloRef.current) tituloRef.current.focus(); }, [paso]);
  useEffect(function () {
    var onKey = function (e) { if (e.key === 'Escape' && !ocupado) onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); };
  }, [ocupado, onClose]);

  function cambio() { setVersion(function (v) { return v + 1; }); if (typeof onCambio === 'function') onCambio(); }

  async function iniciarSubida() {
    setOcupado(true); setMensaje('');
    var r = await prepararConfirmacionReingreso({ rpc: rpc, storage: storage, alumnoId: alumnoId });
    setOcupado(false);
    if (!r.ok) { setMensaje(textoResultadoReingreso({ ok: false, reason: r.reason }, es)); return; }
    setEstado(r); setAcepta(false); setPaso('confirmar');
  }

  async function confirmarSubida() {
    if (!acepta || !estado) return;
    setOcupado(true);
    var res = await ejecutarReingreso({ rpc: rpc, storage: storage, alumnoId: alumnoId, epochConfirmado: estado.epoch, addSesion: addSesion });
    setOcupado(false);
    setMensaje(textoResultadoReingreso(res, es));
    setPaso('lista'); setEstado(null); setAcepta(false);
    cambio();
  }

  var btn = { minHeight: 44, minWidth: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid ' + c.border, background: c.btn, color: c.text, font: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box', maxWidth: '100%', whiteSpace: 'normal' };
  var prim = Object.assign({}, btn, { background: c.prim, color: c.primText, border: '1px solid transparent' });
  // Deshabilitado: se nota a simple vista (no solo para lectores de pantalla).
  var off = function (base, disabled) { return disabled ? Object.assign({}, base, { opacity: 0.5, cursor: 'default' }) : base; };

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'env(safe-area-inset-top) 0 0' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="it-cuarentena-titulo" data-qa-quarantine-modal={paso}
        style={{ background: c.bg, color: c.text, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', boxSizing: 'border-box', fontSize: 15, lineHeight: 1.45 }}>
        <h2 id="it-cuarentena-titulo" ref={tituloRef} tabIndex={-1} style={{ fontSize: 18, margin: '0 0 6px', outline: 'none' }}>
          {paso === 'confirmar' ? (es ? 'Confirmar «Subir igual»' : 'Confirm «Upload anyway»') : (es ? 'Registros en revisión' : 'Records under review')}
        </h2>

        {paso === 'lista' ? (
          <>
            <p style={{ margin: '0 0 10px', color: c.muted }}>
              {es
                ? 'Tu entrenador reinició tu historial. Estos registros estaban guardados en este teléfono y no se subieron para no mezclarse con el historial nuevo. Siguen guardados acá hasta que decidas.'
                : 'Your coach reset your history. These records were saved on this phone and were not uploaded so they do not mix with the new history. They stay here until you decide.'}
            </p>
            {registros.length === 0 ? <p style={{ margin: '8px 0' }}>{es ? 'No hay registros en revisión.' : 'There are no records under review.'}</p> : (
              <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
                {registros.map(function (r) {
                  var abierto = aDescartar && aDescartar.id === r.id && aDescartar.tipo === r.tipo;
                  return (
                    <li key={r.tipo + ':' + r.id} style={{ borderTop: '1px solid ' + c.border, padding: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span style={{ flex: '1 1 12rem', minWidth: 0, overflowWrap: 'anywhere' }}>{textoRegistro(r, es, nombreEjercicio)}</span>
                      {abierto ? (
                        <>
                          <button type="button" style={Object.assign({}, btn, { color: c.danger })} disabled={ocupado}
                            onClick={function () { descartarDeCuarentena(storage, r.tipo, r.id); setADescartar(null); cambio(); }}>
                            {es ? 'Sí, descartar' : 'Yes, discard'}
                          </button>
                          <button type="button" style={btn} onClick={function () { setADescartar(null); }}>{es ? 'No' : 'No'}</button>
                        </>
                      ) : (
                        <button type="button" style={btn} disabled={ocupado} onClick={function () { setADescartar({ id: r.id, tipo: r.tipo }); }}>
                          {es ? 'Descartar' : 'Discard'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {mensaje ? <p role="status" style={{ background: c.warnBg, color: c.warnText, borderRadius: 10, padding: '8px 10px', fontWeight: 600 }}>{mensaje}</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" style={btn} disabled={ocupado} onClick={function () { onClose && onClose(); }}>{es ? 'Conservar y cerrar' : 'Keep and close'}</button>
              <button type="button" style={off(prim, ocupado || registros.length === 0)} disabled={ocupado || registros.length === 0} onClick={iniciarSubida}>
                {ocupado ? (es ? 'Consultando…' : 'Checking…') : (es ? 'Subir igual' : 'Upload anyway')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 10px' }}>
              {es
                ? 'Tu entrenador reinició tu historial (' + fechaHora(estado && estado.reset_at, es) + '). Vas a subir ' + registros.length + ' ' + (registros.length === 1 ? 'registro guardado' : 'registros guardados') + ' en este teléfono. Hacelo solo si son entrenamientos reales que querés conservar: tu entrenador verá que los subiste igual.'
                : 'Your coach reset your history (' + fechaHora(estado && estado.reset_at, es) + '). You are about to upload ' + registros.length + ' ' + (registros.length === 1 ? 'record' : 'records') + ' saved on this phone. Only do it if they are real workouts you want to keep: your coach will see you uploaded them anyway.'}
            </p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer', margin: '0 0 12px' }}>
              <input type="checkbox" checked={acepta} onChange={function (e) { setAcepta(e.target.checked); }} style={{ width: 22, height: 22 }} />
              <span>{es ? 'Son entrenamientos reales y quiero subirlos' : 'These are real workouts and I want to upload them'}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" style={btn} disabled={ocupado} onClick={function () { setPaso('lista'); setEstado(null); }}>{es ? 'Volver' : 'Back'}</button>
              <button type="button" style={off(prim, ocupado || !acepta)} disabled={ocupado || !acepta} onClick={confirmarSubida}>
                {ocupado ? (es ? 'Subiendo…' : 'Uploading…') : (es ? 'Confirmar y subir' : 'Confirm and upload')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
