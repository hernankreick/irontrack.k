import React, { useEffect, useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Btn from './ui/Btn.jsx';
import StickyActionBar from './ui/StickyActionBar.jsx';

const TZ_OPTIONS = [
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { id: 'America/Santiago', label: 'Santiago (CLT)' },
  { id: 'America/Lima', label: 'Lima (PET)' },
  { id: 'America/Bogota', label: 'Bogotá (COT)' },
  { id: 'America/Mexico_City', label: 'Ciudad de México (CST)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { id: 'Europe/Madrid', label: 'Madrid (CET)' },
  { id: 'America/New_York', label: 'Nueva York (ET)' },
];

function readPrefs() {
  try {
    const raw = localStorage.getItem('it_prefs');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writePrefs(p) {
  try {
    localStorage.setItem('it_prefs', JSON.stringify(p));
  } catch (e) {}
  applyToDocument(p);
}

export function applyItPrefsToDocument(p) {
  if (!p || typeof p !== 'object') return;
  const root = document.documentElement;
  if (p.lang) root.setAttribute('data-it-lang', p.lang);
  if (p.theme) root.setAttribute('data-it-theme', p.theme);
  if (p.tz) root.setAttribute('data-it-tz', p.tz);
}

function applyToDocument(p) {
  applyItPrefsToDocument(p);
}

export default function SectionPreferencias({ lang, setLang, darkMode, setDarkMode, toast2 }) {
  const [locale, setLocale] = useState('es');
  const [theme, setTheme] = useState('night');
  const [tz, setTz] = useState('America/Argentina/Buenos_Aires');

  useEffect(() => {
    const p = readPrefs();
    if (p) {
      if (p.lang === 'es' || p.lang === 'en' || p.lang === 'pt') setLocale(p.lang);
      if (p.theme === 'night' || p.theme === 'day' || p.theme === 'system') setTheme(p.theme);
      if (p.tz) setTz(p.tz);
    } else {
      setLocale(lang === 'en' ? 'en' : lang === 'pt' ? 'pt' : 'es');
      setTheme(darkMode ? 'night' : 'day');
    }
  }, []);

  const persist = (next) => {
    writePrefs(next);
    if (next.lang === 'es' || next.lang === 'en') {
      setLang(next.lang);
      try {
        localStorage.setItem('it_lang', next.lang);
      } catch (e) {}
    } else if (next.lang === 'pt') {
      setLang('es');
      try {
        localStorage.setItem('it_lang', 'es');
      } catch (e) {}
      toast2('Idioma PT guardado; la app usa ES/EN en textos por ahora.');
    }
    if (next.theme === 'night') {
      setDarkMode(true);
      try {
        localStorage.setItem('it_dark', 'true');
      } catch (e) {}
    } else if (next.theme === 'day') {
      setDarkMode(false);
      try {
        localStorage.setItem('it_dark', 'false');
      } catch (e) {}
    } else if (next.theme === 'system') {
      const d = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(d);
      try {
        localStorage.setItem('it_dark', d ? 'true' : 'false');
      } catch (e) {}
    }
  };

  const onSave = () => {
    const p = { lang: locale, theme, tz };
    persist(p);
    toast2('Preferencias guardadas ✓');
  };

  const langCards = [
    { id: 'es', abbr: 'ES', label: 'Español' },
    { id: 'en', abbr: 'EN', label: 'English' },
    { id: 'pt', abbr: 'PT', label: 'Português' },
  ];

  const themeCards = [
    {
      id: 'night',
      label: 'Noche',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      id: 'day',
      label: 'Día',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      id: 'system',
      label: 'Sistema',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  const rowShell = 'rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-5 sm:px-6 sm:py-6';

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-4 lg:pb-0">
      <SectionCard title="Apariencia" subtitle="Idioma de la interfaz y modo visual.">
        <div className={`${rowShell}`}>
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center lg:gap-8">
            <div className="lg:col-span-4">
              <p className="text-sm font-semibold text-white">Idioma</p>
              <p className="mt-1 text-sm text-white/45">Afecta textos de la app donde aplique.</p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2 lg:col-span-8 lg:justify-end">
              {langCards.map((c) => {
                const selected = locale === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setLocale(c.id);
                      const p = { ...readPrefs(), lang: c.id, theme, tz };
                      if (!readPrefs()) Object.assign(p, { theme, tz });
                      persist({ lang: c.id, theme, tz });
                    }}
                    className={`inline-flex min-h-[44px] min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all sm:flex-none ${
                      selected
                        ? 'border-blue-500/70 bg-blue-500/15 text-blue-100'
                        : 'border-white/[0.08] bg-transparent text-white/70 hover:border-white/[0.14] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-xs font-bold text-white/80">{c.abbr}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`${rowShell}`}>
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center lg:gap-8">
            <div className="lg:col-span-4">
              <p className="text-sm font-semibold text-white">Tema</p>
              <p className="mt-1 text-sm text-white/45">Claro, oscuro o siguiendo al sistema.</p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2 lg:col-span-8 lg:justify-end">
              {themeCards.map((c) => {
                const selected = theme === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setTheme(c.id);
                      persist({ lang: locale, theme: c.id, tz });
                    }}
                    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-5 ${
                      selected
                        ? 'border-blue-500/70 bg-blue-500/15 text-blue-100'
                        : 'border-white/[0.08] bg-transparent text-white/70 hover:border-white/[0.14] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-white/80">{c.icon}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Comportamiento" subtitle="Preferencias que impactan cómo se interpreta el tiempo en la app.">
        <div className={rowShell}>
          <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12 lg:items-end lg:gap-8">
            <div className="lg:col-span-4">
              <label className="text-sm font-semibold text-white" htmlFor="it-settings-tz">
                Zona horaria
              </label>
              <p className="mt-1 text-sm text-white/45">Referencia para calendarios y recordatorios.</p>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <select
                id="it-settings-tz"
                className="h-12 w-full min-w-0 rounded-xl border border-white/[0.09] bg-[#070b14] px-4 text-[15px] text-white outline-none transition-colors focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20"
                style={{ fontFamily: 'inherit' }}
                value={tz}
                onChange={(e) => {
                  const v = e.target.value;
                  setTz(v);
                  writePrefs({ lang: locale, theme, tz: v });
                }}
              >
                {TZ_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      <StickyActionBar>
        <Btn className="h-12 w-full text-[12px]" onClick={onSave}>
          GUARDAR PREFERENCIAS
        </Btn>
      </StickyActionBar>

      <div className="hidden border-t border-white/[0.08] pt-8 lg:flex lg:justify-end">
        <Btn className="h-12 px-8 text-[12px]" onClick={onSave}>
          GUARDAR PREFERENCIAS
        </Btn>
      </div>
    </div>
  );
}
