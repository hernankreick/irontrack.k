import React from 'react';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import CumplimientoCicloCard from '../students/CumplimientoCicloCard.jsx';
import { modeloCumplimientoCiclo } from '../students/cumplimientoCiclo.js';
import { alumnosPaleta } from '../students/alumnosPaleta.js';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';
import { ALUMNOS_DEMO, RUTINAS_DEMO, SESIONES_ROSTER, CARGAS_DEMO } from './cumplimientoCicloDemoData.js';

/**
 * Demostracion de la tarjeta «Cumplimiento del ciclo» (demo/ficha-alumno.html?vista=cumplimiento). Usa el mismo modelo y la misma
 * tarjeta que la ficha real (components/students/cumplimientoCiclo.js + CumplimientoCicloCard.jsx) con datos ficticios en memoria.
 * Sin login, sin Supabase, sin red y sin almacenamiento. Permite cambiar de alumno, de tema y el estado de la carga del historial.
 */
export default function CumplimientoCicloDemo() {
  const [tema, setTema] = React.useState("oscuro");
  const [alumnoId, setAlumnoId] = React.useState(ALUMNOS_DEMO[0].id);
  const [carga, setCarga] = React.useState("completa");
  const darkMode = tema === "oscuro";
  const T = getAppThemeTokens(darkMode);
  const pal = alumnosPaleta(darkMode);
  const alumno = ALUMNOS_DEMO.find(function (a) { return a.id === alumnoId; }) || ALUMNOS_DEMO[0];
  const modelo = modeloCumplimientoCiclo({
    alumnoId: alumno.id,
    rutina: RUTINAS_DEMO[alumno.id],
    sesiones: SESIONES_ROSTER,
    historiaCompleta: CARGAS_DEMO[carga].valor,
  });
  const msg = function (esText) { return esText; };
  const chip = function (activo) {
    return {
      minHeight: 44, minWidth: 44, padding: "0 12px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
      border: "1px solid " + (activo ? (darkMode ? "#3B82F6" : "#2563EB") : pal.coachAluBorderSoft),
      background: activo ? (darkMode ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.08)") : pal.coachAluSurface,
      color: activo ? (darkMode ? "#93c5fd" : "#1d4ed8") : T.textMain,
    };
  };
  const grupo = function (titulo, opciones, valor, onChange) {
    return (
      <fieldset style={{ border: "none", margin: "0 0 12px", padding: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 700, color: T.textMuted, marginBottom: 6, padding: 0 }}>{titulo}</legend>
        <div role="radiogroup" aria-label={titulo} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {opciones.map(function (op) {
            const activo = op.valor === valor;
            return (
              <button key={op.valor} type="button" role="radio" aria-checked={activo} onClick={function () { onChange(op.valor); }} style={chip(activo)}>
                {activo ? "● " : ""}{op.etiqueta}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  };

  return (
    <div style={{ minHeight: "100dvh", background: pal.coachAluShell, color: T.textMain, fontFamily: "Inter,sans-serif", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AppGlobalStyles darkMode={darkMode} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
      <div role="note" style={{ position: "sticky", top: 0, zIndex: 50, paddingTop: "env(safe-area-inset-top, 0px)", background: "#78350f", borderBottom: "1px solid #f59e0b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", minHeight: 44, boxSizing: "border-box" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#0f172a", background: "#f59e0b", borderRadius: 6, padding: "2px 8px" }}>DEMO</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#fde68a", lineHeight: 1.3 }}>Datos ficticios · sin login · sin conexión a IronTrack</span>
        </div>
      </div>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 0", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>Cumplimiento del ciclo · demo</h1>
        {grupo("Alumno", ALUMNOS_DEMO.map(function (a) { return { valor: a.id, etiqueta: a.nombre }; }), alumnoId, setAlumnoId)}
        {grupo("Carga del historial", Object.keys(CARGAS_DEMO).map(function (k) { return { valor: k, etiqueta: CARGAS_DEMO[k].etiqueta }; }), carga, setCarga)}
        {grupo("Tema", [{ valor: "oscuro", etiqueta: "Oscuro" }, { valor: "claro", etiqueta: "Claro" }], tema, setTema)}
        <p data-qa="escenario" style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.4, margin: "0 0 12px" }}>{alumno.escenario}</p>
        <div key={alumno.id + "|" + carga}>
          <CumplimientoCicloCard
            modelo={modelo}
            darkMode={darkMode}
            msg={msg}
            textMain={T.textMain}
            textMuted={T.textMuted}
            coachAluSurface={pal.coachAluSurface}
            coachAluBorderSoft={pal.coachAluBorderSoft}
            coachAluSubtle={pal.coachAluSubtle}
          />
        </div>
      </main>
    </div>
  );
}
