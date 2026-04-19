import React, { useEffect, useMemo, useState } from 'react';
import SectionPerfil from './SectionPerfil.jsx';
import SectionPreferencias from './SectionPreferencias.jsx';
import SectionNegocio from './SectionNegocio.jsx';
import SectionSuscripcion from './SectionSuscripcion.jsx';
import SectionNotificaciones from './SectionNotificaciones.jsx';
import SectionZonaRiesgo from './SectionZonaRiesgo.jsx';

const SECTIONS = [
  { id: 'perfil', label: 'Perfil', component: SectionPerfil, danger: false },
  { id: 'preferencias', label: 'Preferencias', component: SectionPreferencias, danger: false },
  { id: 'negocio', label: 'Negocio', component: SectionNegocio, danger: false },
  { id: 'suscripcion', label: 'Suscripción', component: SectionSuscripcion, danger: false },
  { id: 'notificaciones', label: 'Notificaciones', component: SectionNotificaciones, danger: false },
  { id: 'riesgo', label: 'Zona de riesgo', component: SectionZonaRiesgo, danger: true },
];

function sesionesEsteMes(sesionesGlobales) {
  if (!Array.isArray(sesionesGlobales)) return 0;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return sesionesGlobales.filter((s) => {
    if (!s || !s.created_at) return false;
    const d = new Date(s.created_at);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}

export default function SettingsPage({
  coach,
  onClose,
  toast2,
  setSessionData,
  syncStateWithLocalStorage,
  lang,
  setLang,
  darkMode,
  setDarkMode,
  es,
  alumnosCount,
  rutinasActivasCount,
  sesionesGlobales,
  sb,
  entrenadorId,
  initialSection = 'perfil',
}) {
  const [active, setActive] = useState(function () {
    return SECTIONS.some((s) => s.id === initialSection) ? initialSection : 'perfil';
  });

  useEffect(
    function () {
      var next = SECTIONS.some((s) => s.id === initialSection) ? initialSection : 'perfil';
      setActive(next);
    },
    [initialSection]
  );

  const sesionesMesCount = useMemo(() => sesionesEsteMes(sesionesGlobales), [sesionesGlobales]);

  const ActivePanel = SECTIONS.find((s) => s.id === active)?.component || SectionPerfil;

  const panelProps = (() => {
    switch (active) {
      case 'perfil':
        return { coach, setSessionData, toast2, sb, entrenadorId };
      case 'preferencias':
        return { lang, setLang, darkMode, setDarkMode, toast2 };
      case 'negocio':
        return { toast2, sb, entrenadorId, alumnosCount };
      case 'suscripcion':
        return { alumnosCount, rutinasActivasCount, sesionesMesCount };
      case 'notificaciones':
        return {};
      case 'riesgo':
        return { toast2, syncStateWithLocalStorage, onClose };
      default:
        return {};
    }
  })();

  const navItem = (s) => {
    const isActive = active === s.id;
    const base =
      'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200';
    if (s.danger) {
      return (
        <button
          key={s.id}
          type="button"
          onClick={() => setActive(s.id)}
          className={`${base} ${
            isActive
              ? 'bg-red-500/20 text-red-100 ring-1 ring-red-500/35'
              : 'text-red-300/90 hover:bg-red-500/10 hover:text-red-100'
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400 opacity-80 group-hover:opacity-100" />
          <span className="min-w-0 flex-1 truncate">{s.label}</span>
        </button>
      );
    }
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setActive(s.id)}
        className={`${base} ${
          isActive
            ? 'bg-white/[0.08] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]'
            : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-blue-400' : 'bg-white/20 group-hover:bg-white/40'}`}
        />
        <span className="min-w-0 flex-1 truncate">{s.label}</span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex min-h-0 flex-col bg-[#070a12] text-[13px] text-white"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        WebkitTextSizeAdjust: '100%',
      }}
    >
      <style>{`
        @keyframes itSet2Fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .it-set2-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .it-set2-tabs::-webkit-scrollbar { display: none; height: 0; }
      `}</style>

      <header className="shrink-0 border-b border-white/[0.07] bg-[#070a12]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between gap-4 px-4 sm:h-[64px] sm:px-6 lg:px-10 xl:px-12">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {es ? 'Configuración' : 'Settings'}
            </p>
            <h1
              className="truncate text-[1.15rem] font-semibold tracking-tight text-white sm:text-xl"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {es ? 'Modo entrenador' : 'Coach workspace'}
            </h1>
          </div>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-wide text-white/70 transition-colors hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white"
            onClick={onClose}
          >
            {es ? 'Cerrar' : 'Close'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-gradient-to-b from-[#0a101f] via-[#080c14] to-[#070a12]">
        <div className="mx-auto flex h-full min-h-0 max-w-[1200px] flex-col lg:flex-row">
          <aside className="hidden w-[248px] shrink-0 border-white/[0.06] lg:flex lg:flex-col lg:border-r xl:w-[260px]">
            <div className="sticky top-0 flex max-h-screen flex-col gap-2 px-4 py-8 xl:px-5">
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Navegación</p>
              <nav className="flex flex-col gap-1.5">
                {SECTIONS.map((s) => (
                  <React.Fragment key={s.id}>
                    {s.id === 'riesgo' ? <div className="my-3 border-t border-white/[0.06]" /> : null}
                    {navItem(s)}
                  </React.Fragment>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-7 pb-28 sm:px-6 sm:py-9 lg:px-10 lg:pb-12 lg:pt-10 xl:px-12">
            <div className="it-set2-tabs mb-8 lg:hidden">
              {SECTIONS.map((s) => {
                const isActive = active === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      s.danger
                        ? isActive
                          ? 'bg-red-500 text-white'
                          : 'bg-red-500/15 text-red-200'
                        : isActive
                          ? 'bg-white text-slate-900'
                          : 'bg-white/[0.06] text-white/70'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div
              key={active}
              className="min-w-0"
              style={{ animation: 'itSet2Fade 0.22s ease-out' }}
            >
              <ActivePanel {...panelProps} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
