import React from 'react';
import ProgresoView from '../ProgresoView.jsx';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import { IronTrackI18nProvider } from '../../contexts/IronTrackI18nContext.jsx';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';
import { alumnosPaleta } from '../students/alumnosPaleta.js';
import { buildProgresoDemoData, compararVolumenDemo } from './progresoCoachDemoData.js';

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
  // ?volumen=comparar (D7.3, solo demo): agrega un alumno con el caso de referencia y la tarjeta «Comparación de volumen».
  const volumen = React.useMemo(function () {
    try { return new URLSearchParams(window.location.search).get('volumen') === 'comparar'; } catch (e) { return false; }
  }, []);
  const data = React.useMemo(function () {
    const d = buildProgresoDemoData({ incompleto: incompleto, volumen: volumen });
    return vacio ? Object.assign({}, d, { sesionesGlobales: [], progresoGlobal: {} }) : d;
  }, [incompleto, vacio, volumen]);
  const comparacion = React.useMemo(function () {
    return volumen ? { hoy: compararVolumenDemo(data, 0), previa: compararVolumenDemo(data, 7) } : null;
  }, [volumen, data]);
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
        {comparacion ? <VolumenComparacionCard comparacion={comparacion} T={T} darkMode={darkMode} /> : null}
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

const NOMBRES_ANTES = [
  ['A', 'Progreso del entrenador'],
  ['B', 'Tarjeta «Volumen de entrenamiento» (alumno)'],
  ['C', '«t esta semana» (alumno)'],
  ['D', 'Resumen de la sesión'],
];
const kgTxt = function (n) { return Math.round(n * 100) / 100 + ' kg'; };

/** Tarjeta solo demo: cifras «Antes» (réplicas locales de las definiciones viejas) y «Ahora» (función real) del mismo día. */
function VolumenComparacionCard({ comparacion, T, darkMode }) {
  const hoy = comparacion.hoy;
  const previa = comparacion.previa;
  const ok = darkMode ? '#86efac' : '#166534';
  const mal = darkMode ? '#fca5a5' : '#991b1b';
  const fila = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0', borderTop: '1px solid ' + T.border, fontSize: 14, lineHeight: 1.35 };
  const sub = { margin: '0 0 4px', fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: darkMode ? '#cbd5e1' : '#475569' };
  return (
    <section data-qa="volumen-comparar" aria-label="DEMO · Comparación de volumen" style={{ margin: '12px 12px 0', padding: 16, boxSizing: 'border-box', maxWidth: 'calc(100% - 24px)', background: T.bgCard, border: '1px solid ' + T.border, borderRadius: 16, color: T.textMain, overflowWrap: 'anywhere' }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800 }}>DEMO · Comparación de volumen</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: darkMode ? '#cbd5e1' : '#475569' }}>Valentina Carga · hoy ({hoy.fecha})</p>

      <h3 style={sub}>Antes</h3>
      <div data-qa="volumen-antes" style={{ marginBottom: 12 }}>
        {NOMBRES_ANTES.map(function (par) {
          return (
            <div key={par[0]} style={fila} data-qa={'volumen-antes-' + par[0]}>
              <span style={{ minWidth: 0 }}>{par[0]} · {par[1]}</span>
              <strong style={{ flex: 'none', color: hoy.antes[par[0]] === hoy.ahora ? T.textMain : mal }}>{kgTxt(hoy.antes[par[0]])}</strong>
            </div>
          );
        })}
      </div>

      <h3 style={sub}>Ahora</h3>
      <p data-qa="volumen-ahora" style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: ok }}>Ahora: {kgTxt(hoy.ahora)} en todas las pantallas</p>

      <h3 style={sub}>Por ejercicio</h3>
      <ul data-qa="volumen-ejercicios" style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
        {hoy.ejercicios.map(function (e) {
          return (
            <li key={e.id} style={fila}>
              <span style={{ minWidth: 0 }}>{e.nombre}<br /><span style={{ fontSize: 13, color: e.incluido ? ok : mal }}>{e.incluido ? 'Incluido' : 'Excluido · ' + e.motivo}</span></span>
              <strong style={{ flex: 'none' }}>{e.incluido ? kgTxt(e.kg) : '—'}</strong>
            </li>
          );
        })}
      </ul>

      <p data-qa="volumen-previa" style={{ margin: 0, fontSize: 13, color: darkMode ? '#cbd5e1' : '#475569' }}>
        Hace 7 días ({previa.fecha}): ahora {kgTxt(previa.ahora)} · antes A {kgTxt(previa.antes.A)}, B {kgTxt(previa.antes.B)}, C {kgTxt(previa.antes.C)}, D {kgTxt(previa.antes.D)}.
      </p>
    </section>
  );
}
