import React from 'react';
import DashboardD5Propuesta from './DashboardD5Propuesta.jsx';
import { modeloDashboardD5 } from './modeloDashboardD5.js';
import { escenarioD5, ESCENARIOS_D5, D5_ENTRENADOR_ID, D5_RUTINA_LOCAL, createD5Sb } from './dashboardD5DemoData.js';
import CoachDashboardMain from '../../coach/CoachDashboardMain.jsx';
import StudentsSection from '../../students/StudentsSection.jsx';
import CoachConfirmDialog from '../../coach/CoachConfirmDialog.jsx';
import ProgresoView from '../../ProgresoView.jsx';
import AppGlobalStyles from '../../layout/AppGlobalStyles.jsx';
import ToastBanner from '../../ui/ToastBanner.jsx';
import { bajaActividadIds } from '../../CoachDashboard.jsx';
import { crearNavegacionDashboard, vistaAlumnosConBaja } from '../../coach/coachDashboardNav.js';
import { getCoachDialogModalConfig } from '../../coach/coachDialogConfig.js';
import { useCoachUIState } from '../../../hooks/useCoachUIState.js';
import { getAppThemeTokens } from '../../../lib/appThemeTokens.js';
import { irontrackMsg } from '../../../lib/irontrackMsg.js';
import { cleanActiveCoachAlumnos } from '../../../lib/appHelpers.js';
import { mergeRutinasAsignadas, getRutinaAsignadaAlumno } from '../../../lib/routineStore.js';
import { selectCoachStudentListState } from '../../../lib/coachStudentListSelectors.js';
import { generarSugerenciasAlumno } from '../../../lib/sugerenciasAlumno.js';
import { EX } from '../../../lib/exerciseStaticData.js';
import { normalizeLibraryExercise } from '../../../lib/exerciseResolve.js';

const DEMO = "DEMO · ";

/**
 * Demostracion de DISENO D5 (demo/dashboard-d5.html, solo Preview). Muestra la PROPUESTA de Dashboard (DashboardD5Propuesta) y, para
 * comparar, el Dashboard ACTUAL real (CoachDashboardMain) con los mismos datos ficticios. La navegacion a Alumnos usa los handlers reales
 * de D4 (coachDashboardNav.js) y la pantalla real de Alumnos (StudentsSection); Progreso es la pantalla real (ProgresoView).
 * Sin Supabase, sin red y sin la sesion de IronTrack. Nada se guarda: crear / asignar / chat solo muestran un aviso DEMO.
 */
export default function DashboardD5Demo() {
  const [escId, setEscId] = React.useState("atencion");
  const [dark, setDark] = React.useState(true);
  const [vista, setVista] = React.useState("propuesta");
  const [opciones, setOpciones] = React.useState(false);
  return (
    <DemoEscenario
      key={escId}
      escId={escId} setEscId={setEscId} dark={dark} setDark={setDark} vista={vista} setVista={setVista} opciones={opciones} setOpciones={setOpciones}
    />
  );
}

function DemoEscenario({ escId, setEscId, dark, setDark, vista, setVista, opciones, setOpciones }) {
  const lang = "es";
  const es = true;
  const msg = React.useCallback(function (a, b, c) { return irontrackMsg(lang, a, b, c); }, []);
  const T = getAppThemeTokens(dark);
  const ui = useCoachUIState();
  const esc = React.useMemo(function () { return escenarioD5(escId); }, [escId]);
  const sb = React.useMemo(function () { return createD5Sb(esc); }, [esc]);
  const allEx = React.useMemo(function () { return EX.map(function (e) { return normalizeLibraryExercise(e, { catalog: true }); }); }, []);

  const [toast, setToast] = React.useState(null);
  const timer = React.useRef(null);
  const showToast = React.useCallback(function (t) {
    setToast(DEMO + t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(function () { setToast(null); }, 3000);
  }, []);
  const avisoDemo = function (a) { showToast(a + ": no se guarda nada en la demostración"); };

  const [tab, setTab] = React.useState("plan");
  const [alumnos, setAlumnos] = React.useState(esc.alumnos);
  const [alumnoActivo, setAlumnoActivo] = React.useState(null);
  const [alumnoProgreso, setAlumnoProgreso] = React.useState([]);
  const [alumnoSesiones, setAlumnoSesiones] = React.useState([]);
  const [rutinasSB, setRutinasSB] = React.useState([]);
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = React.useState(esc.rutinas);
  const [loadingSB, setLoadingSB] = React.useState(false);
  const [coachDialog, setCoachDialog] = React.useState({ t: 'none' });
  const [coachDashIntent, setCoachDashIntent] = React.useState(null);
  const [notaDiaInput, setNotaDiaInput] = React.useState("");
  const [newAlumnoData, setNewAlumnoData] = React.useState({ nombre: "", email: "", pass: "" });
  const [newAlumnoErrors, setNewAlumnoErrors] = React.useState({});

  const ids = React.useMemo(function () { var o = {}; alumnos.forEach(function (a) { o[String(a.id)] = true; }); return o; }, [alumnos]);
  const rutinasUnificadas = React.useMemo(function () { return mergeRutinasAsignadas(rutinasSBEntrenador, rutinasSB, ids); }, [rutinasSBEntrenador, rutinasSB, ids]);
  const lista = React.useMemo(function () {
    return selectCoachStudentListState({
      alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinasUnificadas, sesionesGlobalesLimpias: esc.sesiones, progresoGlobalLimpio: {},
      coachAlumnosSearch: ui.coachAlumnosSearch, coachAlumnosFilter: ui.coachAlumnosFilter, nowMs: Date.now(),
    });
  }, [alumnos, rutinasUnificadas, esc, ui.coachAlumnosSearch, ui.coachAlumnosFilter]);
  const bajaIds = React.useMemo(function () {
    return bajaActividadIds({ alumnos: alumnos, catFn: lista.coachAlumnoCategoria, rutinas: rutinasUnificadas, sesiones: esc.sesiones });
  }, [alumnos, lista, rutinasUnificadas, esc]);
  const vistaAlu = vistaAlumnosConBaja({ counts: lista.coachAlumnosCounts, lista: lista.coachAlumnosListaFiltrada, filtro: ui.coachAlumnosFilter, bajaIds: bajaIds });
  const modelo = React.useMemo(function () {
    return modeloDashboardD5({ alumnos: alumnos, rutinas: rutinasUnificadas, sesiones: esc.sesiones, historiaCompleta: esc.historiaCompleta, alumnosStatus: esc.alumnosStatus });
  }, [alumnos, rutinasUnificadas, esc]);

  // Handlers REALES de D4 (los mismos de App.jsx).
  const nav = crearNavegacionDashboard({
    setTab: setTab, setCoachAlumnosSearch: ui.setCoachAlumnosSearch, setCoachAlumnosFilter: ui.setCoachAlumnosFilter,
    setAlumnoActivo: setAlumnoActivo, setCoachDashIntent: setCoachDashIntent,
    getAlumnos: function () { return alumnos; },
    cargarFicha: async function (alum) {
      setLoadingSB(true);
      var r = await Promise.all([sb.getRutinas(alum.id), sb.getProgreso(alum.id), sb.getSesiones(alum.id)]);
      setRutinasSB(r[0] || []); setAlumnoProgreso(r[1] || []); setAlumnoSesiones(r[2] || []);
      setLoadingSB(false);
    },
  });
  React.useEffect(function () { if (typeof window !== "undefined") window.scrollTo(0, 0); }, [tab]);

  const chip = function (on, label, onClick, qa) {
    return (
      <button type="button" aria-pressed={on} data-qa={qa} onClick={onClick} style={{ minHeight: 44, padding: "0 12px", borderRadius: 10, border: "1px solid " + (on ? "#f59e0b" : "rgba(245,158,11,0.35)"), background: on ? "#f59e0b" : "transparent", color: on ? "#0f172a" : "#fde68a", fontSize: 13, fontWeight: 750, fontFamily: "inherit", cursor: "pointer" }}>{label}</button>
    );
  };
  const enDash = tab === "plan";

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.textMain, fontFamily: "Inter,sans-serif", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
      <AppGlobalStyles darkMode={dark} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
      <div role="note" data-qa="d5-barra-demo" style={{ position: "sticky", top: 0, zIndex: 60, paddingTop: "env(safe-area-inset-top, 0px)", background: "#78350f", borderBottom: "1px solid #f59e0b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", minHeight: 48, boxSizing: "border-box" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", background: "#f59e0b", borderRadius: 6, padding: "2px 7px" }}>DEMO D5</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#fde68a", lineHeight: 1.25 }}>
            {vista === "propuesta" ? "Propuesta" : "Actual"} · {(ESCENARIOS_D5.find(function (x) { return x[0] === escId; }) || [])[1]} · datos ficticios
          </span>
          {!enDash ? chip(false, "← Dashboard", function () { setTab("plan"); }, "d5-volver") : null}
          {chip(opciones, "Opciones", function () { setOpciones(!opciones); }, "d5-opciones")}
        </div>
        {opciones ? (
          <div data-qa="d5-panel-opciones" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 12px 10px" }}>
            {chip(vista === "propuesta", "Propuesta D5", function () { setVista("propuesta"); setTab("plan"); }, "d5-vista-propuesta")}
            {chip(vista === "actual", "Dashboard actual", function () { setVista("actual"); setTab("plan"); }, "d5-vista-actual")}
            {chip(dark, "Oscuro", function () { setDark(true); }, "d5-tema-oscuro")}
            {chip(!dark, "Claro", function () { setDark(false); }, "d5-tema-claro")}
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#fde68a", fontSize: 13, fontWeight: 650 }}>
              Escenario
              <select data-qa="d5-escenario" value={escId} onChange={function (e) { setEscId(e.target.value); }} style={{ minHeight: 44, fontSize: 16, borderRadius: 10, padding: "0 8px", background: "#451a03", color: "#fde68a", border: "1px solid #f59e0b", fontFamily: "inherit" }}>
                {ESCENARIOS_D5.map(function (x) { return <option key={x[0]} value={x[0]}>{x[1]}</option>; })}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {enDash && vista === "propuesta" && (
        <DashboardD5Propuesta
          modelo={modelo}
          darkMode={dark}
          coachName="Hernán"
          onBuscar={nav.verTodos}
          onVerSinRutina={nav.verSinRutina}
          onVerInactivos={nav.verInactivos}
          onVerBaja={nav.verBajaActividad}
          onVerTodos={nav.verTodos}
          onVerPerfil={nav.verPerfil}
          onNuevoAlumno={function () { avisoDemo("Nuevo alumno"); }}
          onCrearRutina={function () { avisoDemo("Crear rutina"); }}
          onProgreso={function () { setTab("progress"); }}
        />
      )}

      {enDash && vista === "actual" && (
        <CoachDashboardMain
          activeNav="dashboard" alumnos={alumnos} alumnosStatus={esc.alumnosStatus} sesionesGlobales={esc.sesiones} mensajesEntrenadorPendientes={[]}
          progresoGlobal={{}} historiaCompleta={esc.historiaCompleta} rutinasSBEntrenador={rutinasUnificadas} allEx={allEx} lang={lang} darkMode={dark}
          currentWeek={0} coachName="Hernán"
          onEnviarMensaje={nav.verInactivos} onCrearRutina={function () { avisoDemo("Crear rutina"); }} onRevisarAlumnos={nav.verTodos}
          onVerInactivos={nav.verInactivos} onVerSinRutina={nav.verSinRutina} onVerBajaActividad={nav.verBajaActividad} onAsignarRutina={nav.asignarRutina}
          onRevisar={nav.revisar} onVerPerfil={nav.verPerfil}
          onNuevoAlumno={function () { avisoDemo("Nuevo alumno"); }} onNuevaRutina={function () { avisoDemo("Nueva rutina"); }}
          onNuevoEjercicio={function () { avisoDemo("Nuevo ejercicio"); }} onIrProgreso={function () { setTab("progress"); }}
          onAbrirChatAlumno={function () { avisoDemo("Chat"); }}
          globalSearchData={{ alumnos: [], rutinas: [], ejercicios: [], sesiones: [] }} onGlobalSearchNavigate={function () {}}
          getAlumnoCategoria={lista.coachAlumnoCategoria} supabase={null} entrenadorId={null}
        />
      )}

      {tab === "progress" && (
        <ProgresoView alumnos={alumnos} sesionesGlobales={esc.sesiones} progresoGlobal={{}} historiaCompleta={esc.historiaCompleta}
          rutinasSBEntrenador={rutinasUnificadas} allEx={allEx} darkMode={dark} />
      )}

      {tab === "alumnos" && (
        <div className="app-inner" style={{ paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
          <StudentsSection
            allEx={allEx} alumnoActivo={alumnoActivo} alumnoProgreso={alumnoProgreso} alumnoSesiones={alumnoSesiones} alumnos={alumnos}
            bgCard={T.bgCard} bgSub={T.bgSub} border={T.border} cargarAlumnos={function () {}} alumnosStatus="ok" cleanActiveCoachAlumnos={cleanActiveCoachAlumnos}
            coachAluBorderSoft={T.coachAluBorderSoft} coachAluDropdown={T.coachAluDropdown} coachAluDropdownShadow={T.coachAluDropdownShadow}
            coachAluGhostBtn={T.coachAluGhostBtn} coachAluShell={T.coachAluShell} coachAluSubtle={T.coachAluSubtle} coachAluSurface={T.coachAluSurface} coachAluTrack={T.coachAluTrack}
            coachAlumnosCounts={vistaAlu.counts} coachAlumnosFilter={ui.coachAlumnosFilter} coachAlumnosListaFiltrada={vistaAlu.lista} coachAlumnosSearch={ui.coachAlumnosSearch}
            coachDashIntent={coachDashIntent} setCoachDashIntent={setCoachDashIntent}
            coachCardMenuId={ui.coachCardMenuId} coachDiaSecsOpen={ui.coachDiaSecsOpen} coachRoutineDiaIdx={ui.coachRoutineDiaIdx} coachRutinaMenuOpen={ui.coachRutinaMenuOpen}
            completedDays={[]} currentWeek={0} darkMode={dark} ENTRENADOR_ID={D5_ENTRENADOR_ID} es={es} EX={EX}
            generarSugerenciasAlumno={generarSugerenciasAlumno} getRutinaAsignadaAlumno={function (a) { return getRutinaAsignadaAlumno(rutinasUnificadas, a); }}
            loadingSB={loadingSB} mergeRutinasAsignadas={mergeRutinasAsignadas} msg={msg}
            newAlumnoData={newAlumnoData} newAlumnoErrors={newAlumnoErrors} newAlumnoForm={false} notaDiaInput={notaDiaInput}
            routineForAssign={D5_RUTINA_LOCAL} routines={[D5_RUTINA_LOCAL]} rutinasLoaded={true} sb={sb}
            setAddExModal={function () { avisoDemo("Agregar ejercicio"); }} setAddExMuscle={function () {}} setAddExPat={function () {}} setAddExSearch={function () {}} setAddExSelectedIds={function () {}}
            setAliasModal={function () { avisoDemo("Datos de pago"); }} setAlumnoActivo={setAlumnoActivo} setAlumnoProgreso={setAlumnoProgreso} setAlumnoSesiones={setAlumnoSesiones}
            setAlumnos={setAlumnos} setAssignRoutineId={function () {}} setCoachAlumnosFilter={ui.setCoachAlumnosFilter} setCoachAlumnosSearch={ui.setCoachAlumnosSearch}
            setCoachCardMenuId={ui.setCoachCardMenuId} setChatModal={function () { avisoDemo("Chat"); }} setCoachDiaSecsOpen={ui.setCoachDiaSecsOpen}
            setCoachDialog={setCoachDialog} setCoachRoutineDiaIdx={ui.setCoachRoutineDiaIdx} setCoachRutinaMenuOpen={ui.setCoachRutinaMenuOpen}
            setEditEx={function () { avisoDemo("Editar ejercicio"); }} setLoadingSB={setLoadingSB} setNewAlumnoData={setNewAlumnoData} setNewAlumnoErrors={setNewAlumnoErrors}
            setNewAlumnoForm={function () { avisoDemo("Nuevo alumno"); }} setNotaDiaInput={setNotaDiaInput} setRegistrosSubTab={ui.setRegistrosSubTab}
            setRutinasSB={setRutinasSB} setRutinasSBEntrenador={setRutinasSBEntrenador} sesionesGlobales={esc.sesiones} progresoGlobal={{}}
            showCoachDesktopShell={false} sugsOpen={ui.sugsOpen} setSugsOpen={ui.setSugsOpen} textMain={T.textMain} textMuted={T.textMuted}
            toast2={function (t) { showToast(t + " (simulado)"); }}
          />
        </div>
      )}

      <CoachConfirmDialog
        dialog={coachDialog} config={getCoachDialogModalConfig(coachDialog, msg, es)} loading={false} cancelLabel="Cancelar"
        onCancel={function () { setCoachDialog({ t: 'none' }); }}
        onConfirm={function () { setCoachDialog({ t: 'none' }); avisoDemo("Asignar rutina"); }}
      />
      <ToastBanner toast={toast} darkMode={dark} border={T.border} textMain={T.textMain} />
    </div>
  );
}
