import React from 'react';
import StudentProgressSection from '../student-progress/StudentProgressSection.jsx';
import LibraryAlumno from './LibraryAlumno.jsx';

// NOTA: por decision de producto el alumno usa SOLO su Plan; este componente se conserva pero NO se monta en App.jsx.
// Acceso desde el Plan del alumno al historial de sesiones y a los ejercicios (antes eran las pestanas "Progreso" y "Ejercicios",
// que ya no estan en la navegacion). Reutiliza las MISMAS vistas, sin duplicar logica ni datos: se abren en una pantalla
// superpuesta con boton de cierre y respetando el area segura de iPhone.

function ChevronRight({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export default function StudentHistoryAccess({
  es,
  darkMode,
  textMain,
  textMuted,
  bgCard,
  border,
  progressProps,
  libraryProps,
  initialView = null,
}) {
  const [view, setView] = React.useState(initialView); // null | 'history' | 'library'
  const closeRef = React.useRef(null);
  const openerRef = React.useRef(null);
  const dialogRef = React.useRef(null);

  const close = React.useCallback(() => {
    setView(null);
    const el = openerRef.current;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0);
  }, []);

  React.useEffect(() => {
    if (!view) return undefined;
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.defaultPrevented) return; // otra capa (p. ej. el reproductor de video) ya lo manejo
      const root = dialogRef.current;
      const active = document.activeElement;
      const inside = !!root && !!active && root.contains(active);
      if (e.key === 'Escape') {
        // Si el foco esta en otra capa abierta encima (video), Escape es de esa capa.
        if (inside || !active || active === document.body) close();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      // Navegacion de teclado contenida: el Tab da la vuelta dentro de la pantalla y no sale al fondo.
      const items = [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter((n) => n.offsetParent !== null || n === active);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (!inside) { if (active && active !== document.body) return; e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [view, close]);

  const bgScreen = darkMode ? '#0B1220' : '#F1F5F9';
  const rows = [
    { key: 'history', title: es ? 'Historial de entrenamientos' : 'Workout history', sub: es ? 'Tus sesiones anteriores, semana por semana' : 'Your previous sessions, week by week' },
    { key: 'library', title: es ? 'Ejercicios y videos' : 'Exercises and videos', sub: es ? 'Los ejercicios de tu rutina' : 'The exercises in your routine' },
  ];
  const title = view === 'library' ? rows[1].title : rows[0].title;

  return (
    <>
      <div
        style={{
          marginTop: 16, background: bgCard, border: '1px solid ' + border, borderRadius: 16, overflow: 'hidden',
        }}
      >
        {rows.map((r, i) => (
          <button
            key={r.key}
            type="button"
            onClick={(e) => { openerRef.current = e.currentTarget; setView(r.key); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 64, padding: '14px 18px',
              background: 'transparent', border: 'none', borderTop: i === 0 ? 'none' : '1px solid ' + border,
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: textMain }}>{r.title}</span>
              <span style={{ display: 'block', fontSize: 13, marginTop: 2, color: textMuted }}>{r.sub}</span>
            </span>
            <ChevronRight color={textMuted} />
          </button>
        ))}
      </div>

      {view && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: bgScreen, display: 'flex', flexDirection: 'column',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid ' + border, flexShrink: 0,
            }}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label={es ? 'Volver al Plan' : 'Back to Plan'}
              style={{
                minWidth: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0,
                padding: '0 10px 0 6px', background: 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', color: textMain,
                fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 6 9 12 15 18" />
              </svg>
              <span aria-hidden="true">Plan</span>
            </button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textMain, minWidth: 0 }}>{title}</h2>
          </div>
          <div
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
              // El historial ya trae su propio margen lateral y espacio inferior; los ejercicios reciben 20px y el area segura.
              padding: view === 'history' ? '0 0 env(safe-area-inset-bottom, 0px)' : '16px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="mx-auto w-full max-w-[32rem]">
              {view === 'history' && (
                <StudentProgressSection {...progressProps} esEntrenador={false} initialSubView="sessions" hideBack onRegistrarPrimerEntrenamiento={close} />
              )}
              {view === 'library' && <LibraryAlumno {...libraryProps} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
