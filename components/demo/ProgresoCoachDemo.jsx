import React from 'react';
import ProgresoView from '../ProgresoView.jsx';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import { IronTrackI18nProvider } from '../../contexts/IronTrackI18nContext.jsx';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';
import { alumnosPaleta } from '../students/alumnosPaleta.js';
import { buildProgresoDemoData } from './progresoCoachDemoData.js';

/**
 * Demostración de Progreso del entrenador con el componente REAL (ProgresoView y sus tarjetas, hojas y gráficos) y datos
 * ficticios en memoria (progresoCoachDemoData.js). Solo existe en builds de Preview (vite.config.js). No usa Supabase, la red,
 * localStorage ni la sesión de IronTrack: ProgresoView solo lee los datos que recibe y no escribe nada.
 * El modo oscuro/claro es estado de React (no se guarda).
 */
export default function ProgresoCoachDemo() {
  const [darkMode, setDarkMode] = React.useState(true);
  // ?incompleto=1 en la URL simula un historial que no se cargó completo (solo lectura de la URL; no se guarda nada).
  const incompleto = React.useMemo(function () {
    try { return new URLSearchParams(window.location.search).get('incompleto') === '1'; } catch (e) { return false; }
  }, []);
  // ?vacio=1: alumnos con rutina pero sin sesiones ni progreso (estado «sin datos»). Reutiliza los datos ficticios, solo los vacía.
  const vacio = React.useMemo(function () {
    try { return new URLSearchParams(window.location.search).get('vacio') === '1'; } catch (e) { return false; }
  }, []);
  const data = React.useMemo(function () {
    const d = buildProgresoDemoData({ incompleto: incompleto });
    return vacio ? Object.assign({}, d, { sesionesGlobales: [], progresoGlobal: {} }) : d;
  }, [incompleto, vacio]);
  const T = getAppThemeTokens(darkMode);
  const bannerText = darkMode ? '#fde68a' : '#78350f';

  return (
    <IronTrackI18nProvider lang="es">
      <div style={{ minHeight: '100dvh', background: alumnosPaleta(darkMode).coachAluShell, color: T.textMain, paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <AppGlobalStyles darkMode={darkMode} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
        {/* data-coach-topbar: la barra compacta de Progreso se ubica debajo de este aviso, como debajo de la barra superior de la app. */}
        <div
          role="note"
          data-coach-topbar="1"
          data-qa="demo-banner"
          style={{ position: 'sticky', top: 0, zIndex: 60, paddingTop: 'env(safe-area-inset-top, 0px)', background: darkMode ? '#78350f' : '#fef3c7', borderBottom: '1px solid #f59e0b' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 16px', minHeight: 56, boxSizing: 'border-box' }}>
            <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: '#0f172a', background: '#f59e0b', borderRadius: 6, padding: '2px 8px' }}>DEMO</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: bannerText, lineHeight: 1.3 }}>
              Progreso del entrenador · datos ficticios · no se guarda nada{incompleto ? ' · historial incompleto simulado' : ''}{vacio ? ' · sin sesiones simulado' : ''}
            </span>
            <button
              type="button"
              aria-pressed={!darkMode}
              data-qa="demo-tema"
              onClick={function () { setDarkMode(!darkMode); }}
              style={{ flex: 'none', minHeight: 44, minWidth: 44, padding: '0 12px', background: 'transparent', border: '1px solid #f59e0b', borderRadius: 10, color: bannerText, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {darkMode ? 'Modo claro' : 'Modo oscuro'}
            </button>
          </div>
        </div>
        <ProgresoView
          alumnos={data.alumnos}
          sesionesGlobales={data.sesionesGlobales}
          progresoGlobal={data.progresoGlobal}
          rutinasSBEntrenador={data.rutinasSBEntrenador}
          allEx={data.allEx}
          historiaCompleta={data.historiaCompleta}
          darkMode={darkMode}
        />
      </div>
    </IronTrackI18nProvider>
  );
}
