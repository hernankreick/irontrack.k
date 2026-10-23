import React, { useState, useEffect, useRef } from 'react';
import useDialogA11y from '../modals/useDialogA11y.js';

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

// Estilos locales de Configuracion (solo clases it-set-* / it-stg-root, colores de la paleta):
// espaciado constante de titulos, placeholder de inputs y slider de capacidad.
function settingsLocalCss(pal) {
  var thumb = 'width:22px;height:22px;border-radius:50%;background:' + pal.blue + ';border:3px solid ' + pal.card + ';box-shadow:0 0 0 1px ' + pal.blue + ';';
  var track = 'height:6px;border-radius:3px;background:' + pal.borderStrong + ';';
  return '.it-stg-root .it-set-title{margin-top:26px!important;margin-bottom:10px!important}' +
    '.it-stg-root .it-set-title:first-child{margin-top:4px!important}' +
    '.it-set-input::placeholder{color:' + pal.muted + ';opacity:1}' +
    '.it-set-range{-webkit-appearance:none;appearance:none;background:transparent;height:24px;cursor:pointer;accent-color:' + pal.blue + '}' +
    '.it-set-range::-webkit-slider-runnable-track{' + track + '}' +
    '.it-set-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;margin-top:-8px;' + thumb + '}' +
    '.it-set-range::-moz-range-track{' + track + '}' +
    '.it-set-range::-moz-range-progress{height:6px;border-radius:3px;background:' + pal.blue + '}' +
    '.it-set-range::-moz-range-thumb{box-sizing:border-box;' + thumb + '}';
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
  // Pestañas moviles con scroll horizontal: degradado a la derecha mientras quedan pestañas ocultas.
  var tabsRef = useRef(null);
  var [tabsMore, setTabsMore] = useState(false);
  function measureTabs() {
    var el = tabsRef.current;
    if (!el) return;
    setTabsMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  }
  useEffect(function () {
    var el = tabsRef.current;
    // La pestaña activa no debe quedar tapada por el borde ni por el degradado: se desplaza lo justo para mostrarla.
    var b = el && el.querySelector('[data-tab-active="1"]');
    if (b && b.offsetLeft + b.offsetWidth > el.scrollLeft + el.clientWidth - 48) {
      el.scrollLeft = b.offsetLeft + b.offsetWidth - el.clientWidth + 48;
    }
    measureTabs();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('resize', measureTabs);
    return function () { window.removeEventListener('resize', measureTabs); };
  }, [isUnder768, active]);
  // Como pantalla completa (no embebida) es un dialogo modal: foco, Tab atrapado, Escape (= boton cerrar) y retorno de foco.
  var dialogRef = useRef(null);
  useDialogA11y({ open: !embed, containerRef: dialogRef, onEscape: !embed && typeof onClose === 'function' ? onClose : undefined });

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
    borderRadius: 0,
    boxSizing: 'border-box',
    // Fondo continuo: el relleno del contenedor padre lo pinta AppMainScroll con pal.bg (coach + settings/perfil); aqui no hay sombras de relleno.
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
    <div
      ref={dialogRef}
      className="it-stg-root"
      style={outerStyle}
      {...(embed ? {} : { role: 'dialog', 'aria-modal': 'true', 'aria-label': String(ui.settingsHeader || '') + ' ' + String(ui.coachMode || '') })}
    >
      <style>{settingsLocalCss(pal)}</style>
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
        <button className="coach-tap"
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid ' + pal.borderStrong, color: pal.sub,
            borderRadius: pal.rCtrl, padding: '5px 14px', fontSize: 12, fontWeight: 600,
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
          <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            ref={tabsRef}
            onScroll={measureTabs}
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
              var activeColor = isDanger ? pal.red : pal.blueText;
              var inactiveColor = isDanger ? pal.red : pal.sub;
              return (
                <React.Fragment key={s.id}>
                  {isDanger && (
                    <div style={{ width: 1, background: pal.border, flexShrink: 0, margin: '8px 2px' }} />
                  )}
                  <button className="coach-tap"
                    type="button"
                    data-tab-active={isActive ? '1' : undefined}
                    onClick={function () { setActive(s.id); }}
                    style={{
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: isActive ? '3px solid ' + (isDanger ? pal.red : pal.blue) : '3px solid transparent',
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
          {tabsMore ? (
            <div
              aria-hidden="true"
              data-testid="settings-tabs-fade"
              style={{
                position: 'absolute', top: 0, right: 0, bottom: 1, width: 40,
                background: 'linear-gradient(to left, ' + pal.chrome + ' 15%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          ) : null}
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
                  <button className="coach-tap"
                    type="button"
                    onClick={function () { setActive(s.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 10px', borderRadius: pal.rCtrl,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, fontWeight: isActive ? 700 : 500, fontFamily: 'inherit',
                      background: isActive ? (s.danger ? pal.dangerBg : pal.navActiveBg) : 'transparent',
                      color: isActive ? (s.danger ? pal.red : pal.blueText) : (s.danger ? pal.navInactiveDangerText : pal.sub),
                      borderLeft: isActive ? '3px solid ' + (s.danger ? pal.red : pal.blue) : '3px solid transparent',
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
            padding: embed ? '24px 20px 24px 20px' : '24px 28px',
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
