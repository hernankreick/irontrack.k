import React, { useMemo, useState } from 'react';
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
}) {
  const [active, setActive] = useState('perfil');

  const sesionesMesCount = useMemo(() => sesionesEsteMes(sesionesGlobales), [sesionesGlobales]);

  const ActivePanel = SECTIONS.find((s) => s.id === active)?.component || SectionPerfil;

  const desktopNavBtn = (s) => {
    const isActive = active === s.id;
    const base =
      'flex min-h-[36px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors';
    if (s.danger) {
      return (
        <button
          key={s.id}
          type="button"
          onClick={() => setActive(s.id)}
          className={`${base} ${
            isActive ? 'bg-red-500/15 text-red-300' : 'text-red-400 hover:bg-red-500/10'
          }`}
        >
          {s.label}
        </button>
      );
    }
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setActive(s.id)}
        className={`${base} ${
          isActive ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:bg-white/5 hover:text-white'
        }`}
      >
        {s.label}
      </button>
    );
  };

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

  return (
    <div
      className="fixed inset-0 z-[220] flex min-h-0 flex-col bg-[#0a0f1a]"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        WebkitTextSizeAdjust: '100%',
      }}
    >
      <style>{`
        @keyframes itSettingsFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .it-settings-nav-mobile {
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .it-settings-nav-mobile::-webkit-scrollbar {
          display: none;
          height: 0;
        }
      `}</style>
      <header className="sticky top-0 z-50 shrink-0 border-b border-white/10 bg-[#0a0f1a]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold uppercase tracking-widest text-white/50">
              {es ? 'Configuración' : 'Settings'}
            </div>
            <h1
              className="truncate text-xl font-black tracking-tight text-white md:text-2xl"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {es ? 'MODO ENTRENADOR' : 'COACH'}
            </h1>
          </div>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-bold uppercase tracking-wide text-white/70 transition-colors hover:bg-white/10"
            onClick={onClose}
          >
            {es ? 'Cerrar' : 'Close'}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:pb-10 lg:pt-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-start sm:gap-8 md:gap-10">
          <aside className="hidden shrink-0 sm:block sm:w-[190px]">
            <nav className="sticky top-[70px] space-y-1">
              {SECTIONS.map((s) => (
                <React.Fragment key={s.id}>
                  {s.id === 'riesgo' ? <div className="my-4 border-t border-white/10" /> : null}
                  {desktopNavBtn(s)}
                </React.Fragment>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 w-full flex-1 lg:max-w-4xl xl:max-w-5xl">
            <div className="it-settings-nav-mobile mb-6 -mx-4 px-4 sm:hidden">
              <div className="flex w-max min-w-full gap-2 pb-2">
                {SECTIONS.map((s) => {
                  const isActive = active === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActive(s.id)}
                      className={`flex min-h-[36px] shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        s.danger
                          ? isActive
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          : isActive
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/15'
                      }`}
                    >
                      <span className="whitespace-nowrap">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              key={active}
              className="space-y-6"
              style={{ animation: 'itSettingsFade 0.2s ease-out' }}
            >
              <ActivePanel {...panelProps} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
