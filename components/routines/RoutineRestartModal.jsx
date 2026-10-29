import React, { useEffect, useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import BaseModal from '../modals/BaseModal.jsx';
import { CICLO_CARGAS } from '../../lib/rutinaCiclo.js';

/**
 * Confirmacion obligatoria de "Reiniciar rutina" (conserva el historial; abre un ciclo nuevo).
 * onConfirm(cargas) recibe CICLO_CARGAS.MANTENER | CICLO_CARGAS.CERO.
 */
export default function RoutineRestartModal({ open, alumnoName, loading, errorText, warningText, onCancel, onConfirm, M, lang }) {
  const [cargas, setCargas] = useState(CICLO_CARGAS.MANTENER);
  const titleId = useId();
  const descId = useId();

  useEffect(
    function () {
      if (open) setCargas(CICLO_CARGAS.MANTENER);
    },
    [open]
  );

  var name = String(alumnoName || '').trim() || M(lang, 'este alumno', 'this athlete', 'este aluno');
  var options = [
    {
      value: CICLO_CARGAS.MANTENER,
      label: M(lang, 'Reiniciar manteniendo cargas', 'Restart keeping loads', 'Reiniciar mantendo cargas'),
      hint: M(lang, 'Los pesos sugeridos parten de los últimos usados.', 'Suggested weights start from the last ones used.', 'Os pesos sugeridos partem dos últimos usados.'),
    },
    {
      value: CICLO_CARGAS.CERO,
      label: M(lang, 'Reiniciar desde cero', 'Restart from scratch', 'Reiniciar do zero'),
      hint: M(lang, 'Sin pesos precargados.', 'No preloaded weights.', 'Sem pesos pré-carregados.'),
    },
  ];

  return (
    <BaseModal
      open={open}
      onClose={function () {
        if (!loading) onCancel();
      }}
      maxWidth={440}
      closeOnOutside={!loading}
      zIndex={10000}
      overlayStyle={{ padding: 16, background: 'rgba(2, 6, 23, 0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      contentProps={{ role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': descId }}
      contentStyle={{
        width: 'min(440px, calc(100vw - 32px))',
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.28)',
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(0,0,0,.45)',
        padding: '24px 20px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div
          aria-hidden
          style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
        >
          <RotateCcw size={22} color="#60a5fa" strokeWidth={2} />
        </div>
        <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.25, wordBreak: 'break-word' }}>
          {M(lang, '¿Reiniciar rutina de ' + name + '?', 'Restart ' + name + "'s routine?", 'Reiniciar a rotina de ' + name + '?')}
        </h2>
        <p id={descId} style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 500, color: 'rgba(226, 232, 240, 0.82)', lineHeight: 1.5 }}>
          {M(
            lang,
            'Vuelve a Semana 1, Día 1. No se borra nada: las sesiones, series y récords ya registrados quedan en el historial.',
            'Goes back to Week 1, Day 1. Nothing is deleted: sessions, sets and records already logged stay in the history.',
            'Volta para a Semana 1, Dia 1. Nada é apagado: sessões, séries e recordes já registrados ficam no histórico.'
          )}
        </p>
      </div>

      <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
        {options.map(function (o) {
          var selected = cargas === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={loading}
              onClick={function () {
                setCargas(o.value);
              }}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                minHeight: 44,
                borderRadius: 12,
                border: '1px solid ' + (selected ? '#3b82f6' : 'rgba(148, 163, 184, 0.28)'),
                background: selected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: '#f1f5f9',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>{o.label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(148, 163, 184, 0.95)' }}>{o.hint}</span>
            </button>
          );
        })}
      </div>

      {warningText ? (
        <div role="note" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.10)', fontSize: 13, fontWeight: 600, color: '#fbbf24', lineHeight: 1.45, textAlign: 'left' }}>
          {warningText}
        </div>
      ) : null}

      {errorText ? (
        <div role="alert" style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#fca5a5', textAlign: 'center' }}>
          {errorText}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.28)', background: 'transparent', color: '#e2e8f0', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}
        >
          {M(lang, 'Cancelar', 'Cancel', 'Cancelar')}
        </button>
        <button
          type="button"
          disabled={loading}
          aria-busy={loading}
          onClick={function () {
            onConfirm(cargas);
          }}
          style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          {loading ? M(lang, 'Reiniciando…', 'Restarting…', 'Reiniciando…') : M(lang, 'Reiniciar', 'Restart', 'Reiniciar')}
        </button>
      </div>
    </BaseModal>
  );
}
