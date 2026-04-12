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

  const navBtn = (s) => (
    <button
      key={s.id}
      type="button"
      onClick={() => setActive(s.id)}
      className="flex min-h-[44px] w-full shrink-0 items-center rounded-xl px-3 text-left text-sm font-bold uppercase tracking-wide transition-colors lg:w-auto"
      style={{
        color: active === s.id ? '#fff' : '#94a3b8',
        background: active === s.id ? 'rgba(37,99,235,0.2)' : 'transparent',
        border: active === s.id ? '1px solid rgba(37,99,235,0.45)' : '1px solid transparent',
      }}
    >
      <span style={{ color: s.danger ? '#f87171' : undefined }}>{s.label}</span>
    </button>
  );

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
    <div className="fixed inset-0 z-[220] flex flex-col" style={{ background: '#0a0f1a', fontFamily: "'DM Sans', sans-serif" }}>
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0a0f1a' }}
      >
        <div className="min-w-0">
          <div className="truncate text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
            {es ? 'Configuración' : 'Settings'}
          </div>
          <h1 className="truncate text-xl font-black tracking-tight text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {es ? 'MODO ENTRENADOR' : 'COACH'}
          </h1>
        </div>
        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border text-sm font-bold uppercase tracking-wide"
          style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#94a3b8', background: 'rgba(255,255,255,0.04)' }}
          onClick={onClose}
        >
          {es ? 'Cerrar' : 'Close'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className="hidden shrink-0 border-r lg:flex lg:w-56 lg:flex-col lg:gap-1 lg:p-3"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0a0f1a' }}
        >
          {SECTIONS.map((s) => navBtn(s))}
        </aside>

        <nav
          className="flex gap-2 overflow-x-auto border-b px-3 py-2 lg:hidden"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0a0f1a' }}
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className="shrink-0 rounded-full border px-3 py-2 text-xs font-bold uppercase whitespace-nowrap"
              style={{
                color: active === s.id ? '#fff' : '#94a3b8',
                background: active === s.id ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)',
                borderColor: active === s.id ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.1)',
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-3 sm:px-5 md:px-6 lg:px-8 lg:pb-24 lg:pt-4">
          <div className="mx-auto w-full max-w-4xl space-y-8 lg:space-y-10">
            <ActivePanel {...panelProps} />
          </div>
        </main>
      </div>
    </div>
  );
}
