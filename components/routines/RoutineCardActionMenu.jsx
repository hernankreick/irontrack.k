import React from 'react';
import { createPortal } from 'react-dom';

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
  onRequestDelete,
}) {
  const ghostBtn = () => ({
    background: 'transparent',
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '7px 9px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: textMuted,
    minWidth: 36,
    minHeight: 36,
    transition: 'background .15s, border-color .15s, color .15s',
  });

  const menuItemStyle = {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: textMain,
    fontSize: 13,
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
          title={M(lang, 'Más acciones', 'More actions', 'Mais ações')}
        >
          <MoreVertical size={18} color={textMuted} />
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
              background: darkMode ? '#0f172a' : '#fff',
              border: `1px solid ${border}`,
              borderRadius: 10,
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
              <ClipboardList size={14} color={textMuted} />
              {M(lang, 'Editar rutina', 'Edit routine', 'Editar rotina')}
            </button>
            <button
              type="button"
              className="it-routine-menu-item hov"
              style={menuItemStyle}
              onClick={onEditName}
            >
              <Pencil size={14} color={textMuted} />
              {M(lang, 'Editar nombre', 'Edit name', 'Editar nome')}
            </button>
            <button
              type="button"
              className="it-routine-menu-item hov"
              style={menuItemStyle}
              onClick={onDuplicate}
            >
              <Ic name="copy" size={14} color={textMuted} />
              {M(lang, 'Duplicar rutina', 'Duplicate routine', 'Duplicar rotina')}
            </button>
            <button
              type="button"
              className="it-routine-menu-item it-routine-menu-item--danger hov"
              style={{ ...menuItemStyle, color: '#f87171', fontWeight: 700 }}
              onClick={onRequestDelete}
            >
              <Ic name="trash-2" size={14} color="#f87171" />
              {M(lang, 'Eliminar rutina', 'Delete routine', 'Excluir rotina')}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
