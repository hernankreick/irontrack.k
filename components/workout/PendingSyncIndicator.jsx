// D76-08 — Indicador de series pendientes de sincronizar (solo presentacion; el estado lo calcula lib/pendingSyncController.js).
// Nunca dice "Sincronizado": cuando no hay nada pendiente y hay conexion no se muestra.
import React from 'react';

function plural(n, uno, varios) {
  return n === 1 ? uno : varios;
}

/**
 * Texto y accion del indicador a partir del estado del controlador. Puro (se prueba en node).
 * Devuelve { visible, tone: 'warn'|'error'|'info', text, actionLabel (o null), busy }.
 */
export function describePendingSync(state, es) {
  var s = state || {};
  var n = Math.max(0, Number(s.pending) || 0);
  var inFlight = Math.max(0, Number(s.inFlight) || 0);
  var status = s.status || 'idle';
  var hidden = { visible: false, tone: 'info', text: '', actionLabel: null, busy: false };
  if (!s.alumnoId) return hidden;
  if (status === 'offline') {
    var off = n > 0
      ? (es
        ? 'Sin conexión · ' + n + ' ' + plural(n, 'serie guardada', 'series guardadas') + ' en este dispositivo, todavía sin sincronizar'
        : 'Offline · ' + n + ' ' + plural(n, 'set saved', 'sets saved') + ' on this device, not synced yet')
      : (es ? 'Sin conexión · las series se guardan en este dispositivo' : 'Offline · sets are saved on this device');
    return { visible: true, tone: 'warn', text: off, actionLabel: null, busy: false };
  }
  if (n === 0) return hidden;
  if (status === 'syncing') {
    // Lo unico pendiente es el envio normal de la serie recien registrada (logSet): no se muestra para no mover la pantalla en cada serie.
    if (inFlight >= n) return hidden;
    return { visible: true, tone: 'info', text: (es ? 'Sincronizando… · ' : 'Syncing… · ') + n + ' ' + (es ? plural(n, 'serie', 'series') : plural(n, 'set', 'sets')), actionLabel: null, busy: true };
  }
  if (status === 'error') {
    return {
      visible: true,
      tone: 'error',
      text: es
        ? n + ' ' + plural(n, 'serie pendiente', 'series pendientes') + ' · No se pudieron sincronizar'
        : n + ' ' + plural(n, 'set pending', 'sets pending') + ' · Could not sync',
      actionLabel: es ? 'Reintentar' : 'Retry',
      busy: false,
    };
  }
  return {
    visible: true,
    tone: 'warn',
    text: es
      ? n + ' ' + plural(n, 'serie pendiente', 'series pendientes') + ' de sincronizar'
      : n + ' ' + plural(n, 'set', 'sets') + ' waiting to sync',
    actionLabel: es ? 'Sincronizar ahora' : 'Sync now',
    busy: false,
  };
}

/**
 * D7.6: aviso de series pendientes con datos invalidos (no se envian, quedan en el dispositivo, sin reintento). Puro (se prueba en node).
 * nombreEjercicio(exId) opcional para mostrar el nombre. Devuelve { visible, text, items: [texto por serie, max 3], extra }.
 */
export function describeInvalidPending(state, es, nombreEjercicio) {
  var s = state || {};
  var lista = Array.isArray(s.invalidItems) ? s.invalidItems : [];
  var n = Math.max(lista.length, Number(s.invalid) || 0);
  if (!s.alumnoId || n === 0) return { visible: false, text: '', items: [], extra: 0 };
  var text = es
    ? n + ' ' + plural(n, 'serie con peso o repeticiones no válidos no se envió', 'series con peso o repeticiones no válidos no se enviaron') +
      '. ' + plural(n, 'Queda guardada', 'Quedan guardadas') + ' en este dispositivo; avisale a tu entrenador.'
    : n + ' ' + plural(n, 'set with an invalid weight or reps was not sent', 'sets with an invalid weight or reps were not sent') +
      '. ' + plural(n, 'It stays', 'They stay') + ' saved on this device; let your coach know.';
  var items = lista.slice(0, 3).map(function (it) {
    var nombre = '';
    try { nombre = typeof nombreEjercicio === 'function' ? (nombreEjercicio(it.exId) || '') : ''; } catch (e) { nombre = ''; }
    return (nombre || it.exId || (es ? 'Ejercicio' : 'Exercise')) + ' · ' + String(it.kg) + ' kg × ' + String(it.reps) + (it.date ? ' · ' + it.date : '');
  });
  return { visible: true, text: text, items: items, extra: Math.max(0, n - items.length) };
}

// Colores con contraste AA (texto >= 4.5:1 sobre su fondo) en claro y oscuro.
var PALETTE = {
  dark: {
    warn: { bg: '#1f1500', border: '#F59E0B66', text: '#FCD34D', btnBg: '#FCD34D', btnText: '#1f1500', dot: '#F59E0B' },
    error: { bg: '#2a0f12', border: '#F8717166', text: '#FECACA', btnBg: '#FECACA', btnText: '#450A0A', dot: '#F87171' },
    info: { bg: '#0c1a2e', border: '#60A5FA66', text: '#BFDBFE', btnBg: '#BFDBFE', btnText: '#0c1a2e', dot: '#60A5FA' },
  },
  light: {
    warn: { bg: '#FFFBEB', border: '#D97706', text: '#78350F', btnBg: '#78350F', btnText: '#FFFFFF', dot: '#B45309' },
    error: { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B', btnBg: '#991B1B', btnText: '#FFFFFF', dot: '#DC2626' },
    info: { bg: '#EFF6FF', border: '#2563EB', text: '#1E3A8A', btnBg: '#1E3A8A', btnText: '#FFFFFF', dot: '#2563EB' },
  },
};

var CSS = '.it-psync-btn:focus-visible{outline:3px solid #60A5FA;outline-offset:2px}.it-psync-btn:disabled{opacity:.6;cursor:default}';

export default function PendingSyncIndicator({ state, onRetry, es = true, darkMode = true, variant = 'inline', nombreEjercicio }) {
  var d = describePendingSync(state, es);
  var inv = describeInvalidPending(state, es, nombreEjercicio);
  if (!d.visible && !inv.visible) return null;
  var banner = variant === 'banner';
  var aviso = inv.visible ? <InvalidPendingNotice inv={inv} es={es} darkMode={darkMode} banner={banner} /> : null;
  if (!d.visible) return aviso;
  var c = PALETTE[darkMode === false ? 'light' : 'dark'][d.tone];
  return (
    <>
    <div
      role="status"
      aria-live="polite"
      data-qa-pending-sync={state && state.status}
      style={{
        background: c.bg,
        border: banner ? 'none' : '1px solid ' + c.border,
        borderBottom: '1px solid ' + c.border,
        borderRadius: banner ? 0 : 12,
        padding: banner ? '6px 16px' : '8px 12px',
        margin: banner ? 0 : '0 0 10px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        color: c.text,
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.35,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <style>{CSS}</style>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      <span style={{ flex: '1 1 12rem', minWidth: 0, overflowWrap: 'anywhere' }}>{d.text}</span>
      {d.actionLabel ? (
        <button
          type="button"
          className="it-psync-btn"
          onClick={function () { if (typeof onRetry === 'function') onRetry(); }}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0 14px',
            borderRadius: 10,
            border: 'none',
            background: c.btnBg,
            color: c.btnText,
            font: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            maxWidth: '100%',
            whiteSpace: 'normal',
          }}
        >
          {d.actionLabel}
        </button>
      ) : null}
    </div>
    {aviso}
    </>
  );
}

// D7.6: series que no se enviaran por datos invalidos. Sin boton de reintento (reintentar no las corrige); se listan para identificarlas.
function InvalidPendingNotice({ inv, es, darkMode, banner }) {
  var c = PALETTE[darkMode === false ? 'light' : 'dark'].error;
  return (
    <div
      role="status"
      aria-live="polite"
      data-qa-pending-invalid={inv.items.length + inv.extra}
      style={{
        background: c.bg,
        border: banner ? 'none' : '1px solid ' + c.border,
        borderBottom: '1px solid ' + c.border,
        borderRadius: banner ? 0 : 12,
        padding: banner ? '6px 16px' : '8px 12px',
        margin: banner ? 0 : '0 0 10px',
        color: c.text,
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.35,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowWrap: 'anywhere',
      }}
    >
      <div>{inv.text}</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontWeight: 500 }}>
        {inv.items.map(function (t, i) { return <li key={i}>{t}</li>; })}
        {inv.extra > 0 ? <li>{(es ? 'y ' : 'and ') + inv.extra + (es ? ' más' : ' more')}</li> : null}
      </ul>
    </div>
  );
}
