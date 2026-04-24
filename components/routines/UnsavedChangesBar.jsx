import React from 'react';
import { Save } from 'lucide-react';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';
import './routines-ui.css';
import { coachType as T, coachSpace as S } from '../coachUiScale.js';

export function UnsavedChangesBar({
  visible,
  lang,
  border,
  onSave,
  onDiscard,
  saveBarBox,
  desktopCoachStableLayout,
}) {
  return (
    <div
      className={'it-routines-unsaved ' + (visible ? 'is-visible' : '')}
      style={{
        position: 'fixed',
        bottom: 0,
        ...(saveBarBox.width != null && saveBarBox.width > 0
          ? { left: saveBarBox.left, width: saveBarBox.width }
          : { left: 0, right: 0 }),
        boxSizing: 'border-box',
        padding: `${S.gridGapTight}px ${S.gridGapTight}px`,
        paddingBottom: `calc(${S.gridGapTight}px + env(safe-area-inset-bottom, 0px))`,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid ${border}`,
        zIndex: 35,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          display: 'flex',
          flexDirection: desktopCoachStableLayout ? 'row' : 'column',
          alignItems: desktopCoachStableLayout ? 'center' : 'stretch',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...T.control, fontWeight: 800, color: '#f1f5f9', marginBottom: 2 }}>
            {M(lang, 'Tenés cambios sin guardar', 'You have unsaved changes', 'Há alterações não salvas')}
          </div>
          <div style={{ ...T.meta, color: '#94a3b8', lineHeight: 1.35 }}>
            {M(
              lang,
              'Asignaciones o ediciones pendientes.',
              'Pending assignments or edits.',
              'Atribuições ou edições pendentes.'
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexShrink: 0,
            width: desktopCoachStableLayout ? 'auto' : '100%',
          }}
        >
          <button
            type="button"
            className="it-routine-btn hov"
            onClick={onDiscard}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              ...T.control,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'transparent',
              color: '#cbd5e1',
              flex: desktopCoachStableLayout ? '0 0 auto' : 1,
            }}
          >
            {M(lang, 'Descartar', 'Discard', 'Descartar')}
          </button>
          <button
            type="button"
            className="it-routine-btn hov"
            onClick={onSave}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              ...T.control,
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: 'none',
              background: '#22c55e',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flex: desktopCoachStableLayout ? '0 0 auto' : 1,
              boxShadow: '0 0 18px rgba(34,197,94,0.25)',
            }}
          >
            <Save size={16} />
            {M(lang, 'Guardar cambios', 'Save changes', 'Salvar alterações')}
          </button>
        </div>
      </div>
    </div>
  );
}
