import React from 'react';

export default function SettingsShell({
  embed,
  pal,
  ui,
  sections,
  active,
  setActive,
  ActiveTab,
  panelProps,
  onClose,
}) {
  return (
    <div style={embed ? {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      overflow: 'hidden',
      background: pal.bg,
      color: pal.text,
      fontFamily: "'DM Sans', sans-serif",
      borderRadius: 12,
      boxSizing: 'border-box',
    } : {
      position: 'fixed', inset: 0, zIndex: 220,
      display: 'flex', flexDirection: 'column',
      background: pal.bg, color: pal.text,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* HEADER - en embed anadimos aire horizontal; el padre sigue alineando la columna principal */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: embed ? '12px 16px 12px 20px' : '0 24px',
        minHeight: 52,
        height: embed ? undefined : 52,
        flexShrink: 0,
        borderBottom: `1px solid ${pal.border}`, background: pal.chrome,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: pal.muted }}>{ui.settingsHeader}</div>
          <div style={{ fontSize: 20, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, lineHeight: 1.1, color: pal.text }}>{ui.coachMode}</div>
        </div>
        <button type="button" onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${pal.border}`, color: pal.muted,
          borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
        }}>{ui.close}</button>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 200, flexShrink: 0,
          borderRight: `1px solid ${pal.border}`,
          background: pal.chrome,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          padding: embed ? '16px 8px 16px 12px' : '16px 10px',
        }}>
          {sections.map((s, i) => {
            const isActive = active === s.id;
            return (
              <React.Fragment key={s.id}>
                {s.danger && i > 0 && <div style={{ height: 1, background: pal.border, margin: '8px 0' }} />}
                <button
                  type="button"
                  onClick={() => setActive(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 10px', borderRadius: 8,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    background: isActive ? (s.danger ? 'rgba(239,68,68,.15)' : pal.navActiveBg) : 'transparent',
                    color: isActive ? (s.danger ? pal.red : pal.blueL) : (s.danger ? pal.navInactiveDangerText : pal.sub),
                    borderLeft: isActive ? `3px solid ${s.danger ? pal.red : pal.blueL}` : '3px solid transparent',
                    transition: 'all .15s',
                  }}
                >{s.label}</button>
              </React.Fragment>
            );
          })}
        </aside>

        {/* CONTENT */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: embed ? '24px 0 24px 20px' : '24px 28px',
          background: pal.bg,
          boxSizing: 'border-box',
        }}>
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${pal.border}` }}>
            <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: pal.text }}>
              {sections.find(s => s.id === active)?.label?.toUpperCase()}
            </div>
          </div>
          <ActiveTab key={active} {...(panelProps[active] || {})} />
        </main>
      </div>
    </div>
  );
}
