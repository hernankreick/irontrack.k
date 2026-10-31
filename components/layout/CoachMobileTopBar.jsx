import React from 'react';

// Barra superior del ENTRENADOR en pantallas < 768 px. Antes no habia ningun control visible para abrir el menu (la barra superior y la
// inferior se ocultan en movil y el drawer solo se abria con un gesto desde el borde). Esta barra es parte del flujo (sticky), absorbe el
// area segura superior de iPhone y deja el boton de menu SIEMPRE visible; el gesto de borde sigue funcionando.
export default function CoachMobileTopBar({ tab, darkMode, msg, menuOpen, onOpenMenu }) {
  const labels = {
    plan: msg('Dashboard', 'Dashboard'),
    progress: msg('Progreso', 'Progress'),
    calendar: msg('Calendario', 'Calendar'),
    mensajes: msg('Mensajes', 'Messages'),
    routines: msg('Rutinas', 'Routines'),
    biblioteca: msg('Ejercicios', 'Exercises'),
    library: msg('Ejercicios', 'Exercises'),
    alumnos: msg('Alumnos', 'Athletes'),
    settings: msg('Configuración', 'Settings'),
    perfil: msg('Mi perfil', 'My profile'),
  };
  const title = labels[tab] || '';
  const fg = darkMode ? '#F1F5F9' : '#0F1923';
  const icon = darkMode ? '#CBD5E1' : '#475569';
  return (
    <header
      data-coach-topbar="1"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 'calc(56px + env(safe-area-inset-top, 0px))',
        padding: 'env(safe-area-inset-top, 0px) 12px 0 8px',
        boxSizing: 'border-box',
        background: darkMode ? 'rgba(15,25,35,0.96)' : 'rgba(255,255,255,0.96)',
        borderBottom: '1px solid ' + (darkMode ? '#1E2D40' : '#E2E8F0'),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={msg('Abrir menú', 'Open menu')}
        aria-haspopup="dialog"
        aria-expanded={menuOpen ? 'true' : 'false'}
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={icon} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="3" y1="7" x2="21" y2="7" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="17" x2="21" y2="17" />
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, color: fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      <div aria-hidden="true" style={{ fontSize: 13, fontWeight: 900, letterSpacing: '-.3px', flexShrink: 0 }}>
        <span style={{ color: '#2563EB' }}>IRON</span>
        <span style={{ color: fg }}>TRACK</span>
      </div>
    </header>
  );
}
