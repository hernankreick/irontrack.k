import React, { useState, useEffect } from 'react';

function useIsUnder768() {
  var [v, setV] = useState(function () {
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 767px)').matches
      : false;
  });
  useEffect(function () {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    var mq = window.matchMedia('(max-width: 767px)');
    var fn = function () { setV(mq.matches); };
    mq.addEventListener('change', fn);
    return function () { mq.removeEventListener('change', fn); };
  }, []);
  return v;
}

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
  var isUnder768 = useIsUnder768();

  var outerStyle = embed ? {
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
  };

  var headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: embed ? '12px 16px 12px 20px' : '0 24px',
    minHeight: 52,
    height: embed ? undefined : 52,
    flexShrink: 0,
    borderBottom: '1px solid ' + pal.border,
    background: pal.chrome,
  };

  return (
    <div style={outerStyle}>
      {/* HEADER — identical on both mobile and desktop */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: pal.muted }}>
            {ui.settingsHeader}
          </div>
          <div style={{ fontSize: 20, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, lineHeight: 1.1, color: pal.text }}>
            {ui.coachMode}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid ' + pal.border, color: pal.muted,
            borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {ui.close}
        </button>
      </div>

      {isUnder768 ? (
        /* ── MOBILE: horizontal tab bar + full-width content ── */
        <>
          {/* Scoped style: force 2-col inline grids inside tab content to single column */}
          <style>{'.it-stg-mob * { grid-template-columns: 1fr !important; }'}</style>

          {/* Horizontal scrollable tab bar */}
          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              borderBottom: '1px solid ' + pal.border,
              background: pal.chrome,
              flexShrink: 0,
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            {sections.map(function (s) {
              var isActive = active === s.id;
              var isDanger = !!s.danger;
              var activeColor = isDanger ? '#ef4444' : '#2563EB';
              var inactiveColor = isDanger ? 'rgba(239,68,68,0.65)' : pal.sub;
              return (
                <React.Fragment key={s.id}>
                  {isDanger && (
                    <div style={{ width: 1, background: pal.border, flexShrink: 0, margin: '8px 2px' }} />
                  )}
                  <button
                    type="button"
                    onClick={function () { setActive(s.id); }}
                    style={{
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: isActive ? '2px solid ' + activeColor : '2px solid transparent',
                      background: 'transparent',
                      color: isActive ? activeColor : inactiveColor,
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    {s.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Content: full-width scrollable column */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div
              className="it-stg-mob"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 16px 80px',
                background: pal.bg,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid ' + pal.border }}>
                <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: pal.text }}>
                  {(sections.find(function (s) { return s.id === active; }) || {}).label?.toUpperCase()}
                </div>
              </div>
              <ActiveTab key={active} {...(panelProps[active] || {})} />
            </div>

            {/* Gradient fade at bottom — suggests more content below; pointer-events off */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 64,
                background: 'linear-gradient(to top, ' + pal.bg + ' 0%, transparent 100%)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          </div>
        </>
      ) : (
        /* ── DESKTOP (≥768px): sidebar + content columns — unchanged ── */
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* SIDEBAR */}
          <aside style={{
            width: 200, flexShrink: 0,
            borderRight: '1px solid ' + pal.border,
            background: pal.chrome,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
            padding: embed ? '16px 8px 16px 12px' : '16px 10px',
          }}>
            {sections.map(function (s, i) {
              var isActive = active === s.id;
              return (
                <React.Fragment key={s.id}>
                  {s.danger && i > 0 && (
                    <div style={{ height: 1, background: pal.border, margin: '8px 0' }} />
                  )}
                  <button
                    type="button"
                    onClick={function () { setActive(s.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 10px', borderRadius: 8,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                      background: isActive ? (s.danger ? 'rgba(239,68,68,.15)' : pal.navActiveBg) : 'transparent',
                      color: isActive ? (s.danger ? pal.red : pal.blueL) : (s.danger ? pal.navInactiveDangerText : pal.sub),
                      borderLeft: isActive ? '3px solid ' + (s.danger ? pal.red : pal.blueL) : '3px solid transparent',
                      transition: 'all .15s',
                    }}
                  >
                    {s.label}
                  </button>
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
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid ' + pal.border }}>
              <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: pal.text }}>
                {(sections.find(function (s) { return s.id === active; }) || {}).label?.toUpperCase()}
              </div>
            </div>
            <ActiveTab key={active} {...(panelProps[active] || {})} />
          </main>
        </div>
      )}
    </div>
  );
}
