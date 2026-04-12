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

  return (
    <div className="flex flex-col space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-6 xl:gap-8">
        <SectionCard title="Idioma" subtitle="Seleccioná el idioma de la interfaz.">
          <div className="space-y-4">
            <h3 className="mb-6 block text-lg font-semibold text-white">Idioma de la interfaz</h3>
            <div className="flex flex-wrap gap-3">
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
                  className={`flex h-11 min-h-[44px] min-w-[100px] flex-1 flex-col items-center justify-center gap-3 rounded-lg border px-5 py-3 text-center text-sm font-medium transition-all sm:flex-initial ${
                    selected
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white/90">
                    {c.abbr}
                  </span>
                  <span className="font-semibold text-white">{c.label}</span>
                </button>
              );
            })}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Tema" subtitle="Apariencia clara u oscura.">
          <div className="space-y-4">
            <h3 className="mb-6 block text-lg font-semibold text-white">Apariencia</h3>
            <div className="flex flex-wrap gap-3">
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
                  className={`flex h-11 min-h-[44px] min-w-[100px] flex-1 items-center justify-center gap-3 rounded-lg border px-5 py-3 text-sm font-medium transition-all sm:flex-initial ${
                    selected
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center text-white/90">{c.icon}</span>
                  <span className="font-semibold">{c.label}</span>
                </button>
              );
            })}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Zona horaria" subtitle="Referencia para recordatorios y vistas de calendario.">
        <div className="space-y-4">
          <h3 className="mb-6 block text-lg font-semibold text-white">Referencia horaria</h3>
          <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80" htmlFor="it-settings-tz">
            Zona horaria
          </label>
          <select
            id="it-settings-tz"
            className="h-11 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-4 text-[15px] text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            style={{
              fontFamily: 'inherit',
            }}
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
      </SectionCard>

      <StickyActionBar>
        <Btn className="w-full" onClick={onSave}>
          GUARDAR PREFERENCIAS
        </Btn>
      </StickyActionBar>

      <div className="mt-8 hidden sm:flex">
        <Btn onClick={onSave}>GUARDAR PREFERENCIAS</Btn>
      </div>
    </div>
  );
}
