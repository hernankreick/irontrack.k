import React from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';

export default function RoutineCardActionMenu({
  menuOpen,
  menuPopCoords,
  menuRef,
  menuDropdownRef,
  darkMode,
  border,
  textMain,
  textMuted,
  lang,
  M,
  Ic,
  MoreVertical,
  Pencil,
  ClipboardList,
  onToggleMenu,
  onEditRoutine,
  onEditName,
  onDuplicate,
  canRestart = false,
  onRequestRestart,
  onRequestDelete,
}) {
  const ghostBtn = () => ({
    background: 'transparent',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-control)',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    width: 44,
    height: 44,
    flexShrink: 0,
    transition: 'background .15s, border-color .15s, color .15s',
  });

  const menuItemStyle = {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    minHeight: 44,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="it-routine-btn hov"
          style={ghostBtn()}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={onToggleMenu}
          aria-label={M(lang, 'Más acciones', 'More actions', 'Mais ações')}
          title={M(lang, 'Más acciones', 'More actions', 'Mais ações')}
        >
          <MoreVertical size={20} aria-hidden="true" />
        </button>
      </div>
      {menuOpen && menuPopCoords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuDropdownRef}
            className="it-routine-menu-pop is-open it-routine-menu-pop--portal"
            style={{
              position: 'fixed',
              top: menuPopCoords.top,
              left: menuPopCoords.left,
              width: menuPopCoords.width,
              minWidth: menuPopCoords.width,
              background: 'var(--surface-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-control)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
              padding: 4,
              zIndex: 100,
            }}
          >
            <button
              type="button"
              className="it-routine-menu-item hov"
              style={menuItemStyle}
              onClick={onEditRoutine}
            >
              <ClipboardList size={14} color="currentColor" />
              {M(lang, 'Editar rutina', 'Edit routine', 'Editar rotina')}
            </button>
            <button
              type="button"
              className="it-routine-menu-item hov"
              style={menuItemStyle}
              onClick={onEditName}
            >
              <Pencil size={14} color="currentColor" />
              {M(lang, 'Editar nombre', 'Edit name', 'Editar nome')}
            </button>
            <button
              type="button"
              className="it-routine-menu-item hov"
              style={menuItemStyle}
              onClick={onDuplicate}
            >
              <Ic name="copy" size={14} color="currentColor" />
              {M(lang, 'Duplicar rutina', 'Duplicate routine', 'Duplicar rotina')}
            </button>
            {canRestart && (
              <button
                type="button"
                className="it-routine-menu-item hov"
                style={menuItemStyle}
                onClick={onRequestRestart}
              >
                <RotateCcw size={14} color="currentColor" />
                {M(lang, 'Reiniciar rutina', 'Restart routine', 'Reiniciar rotina')}
              </button>
            )}
            <button
              type="button"
              className="it-routine-menu-item it-routine-menu-item--danger hov"
              style={{ ...menuItemStyle, color: 'var(--danger)', fontWeight: 700 }}
              onClick={onRequestDelete}
            >
              <Ic name="trash-2" size={14} color="currentColor" />
              {M(lang, 'Eliminar rutina', 'Delete routine', 'Excluir rotina')}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
