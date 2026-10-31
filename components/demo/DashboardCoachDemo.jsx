import React from 'react';
import CoachDashboardMain from '../coach/CoachDashboardMain.jsx';
import StudentsSection from '../students/StudentsSection.jsx';
import CoachConfirmDialog from '../coach/CoachConfirmDialog.jsx';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import ToastBanner from '../ui/ToastBanner.jsx';
import { bajaActividadIds } from '../CoachDashboard.jsx';
import { crearNavegacionDashboard, vistaAlumnosConBaja } from '../coach/coachDashboardNav.js';
import { getCoachDialogModalConfig } from '../coach/coachDialogConfig.js';
import { useCoachUIState } from '../../hooks/useCoachUIState.js';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';
import { irontrackMsg } from '../../lib/irontrackMsg.js';
import { cleanActiveCoachAlumnos } from '../../lib/appHelpers.js';
import { mergeRutinasAsignadas, getRutinaAsignadaAlumno } from '../../lib/routineStore.js';
import { selectCoachStudentListState } from '../../lib/coachStudentListSelectors.js';
import { resolveDashboardMessageTarget } from '../../lib/chatMessages.js';
import { generarSugerenciasAlumno } from '../../lib/sugerenciasAlumno.js';
import { EX } from '../../lib/exerciseStaticData.js';
import { normalizeLibraryExercise } from '../../lib/exerciseResolve.js';
import {
  DEMO_DASH_ALUMNOS, DEMO_DASH_ENTRENADOR_ID, DEMO_DASH_RUTINA_LOCAL, createDemoDashSb, demoDashRutinas, demoDashSesiones,
} from './dashboardCoachDemoData.js';

const DEMO = "DEMO · ";
const HISTORIA_COMPLETA = { sesiones: true, progreso: true };

/**
 * Demostracion del Dashboard del entrenador -> Alumnos (D4) con los componentes REALES (CoachDashboardMain, StudentsSection,
 * CoachConfirmDialog) y los handlers REALES de navegacion (components/coach/coachDashboardNav.js, los mismos que usa App.jsx).
 * Solo existe en builds de Preview (vite.config.js). Datos ficticios en memoria: sin Supabase, sin red y sin la sesion de IronTrack.
 * Toda accion que en la app escribiria algo (asignar, chat, crear) se reemplaza por un aviso "DEMO".
 */
export default function DashboardCoachDemo() {
  const darkMode = true;
  const lang = "es";
  const es = true;
  const msg = React.useCallback(function (esStr, enStr, ptStr) { return irontrackMsg(lang, esStr, enStr, ptStr); }, []);
  const T = getAppThemeTokens(darkMode);
  const ui = useCoachUIState();
  const sb = React.useMemo(function () { return createDemoDashSb(); }, []);
  const allEx = React.useMemo(function () { return EX.map(function (e) { return normalizeLibraryExercise(e, { catalog: true }); }); }, []);

  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = React.useCallback(function (text) {
    setToast(DEMO + text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(function () { setToast(null); }, 3200);
  }, []);
  const toast2 = React.useCallback(function (text) { showToast(text + " (simulado)"); }, [showToast]);
  const avisoDemo = function (accion) { showToast(accion + ": no se guarda nada en la demostración"); };

  const [tab, setTab] = React.useState("plan");
  const [alumnos, setAlumnos] = React.useState(DEMO_DASH_ALUMNOS);
  const [alumnoActivo, setAlumnoActivo] = React.useState(null);
  const [alumnoProgreso, setAlumnoProgreso] = React.useState([]);
  const [alumnoSesiones, setAlumnoSesiones] = React.useState([]);
  const [rutinasSB, setRutinasSB] = React.useState([]);
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = React.useState(function () { return demoDashRutinas(); });
  const [sesionesGlobales] = React.useState(function () { return demoDashSesiones(); });
  const [loadingSB, setLoadingSB] = React.useState(false);
  const [coachDialog, setCoachDialog] = React.useState({ t: 'none' });
  const [coachDashIntent, setCoachDashIntent] = React.useState(null);
  const [notaDiaInput, setNotaDiaInput] = React.useState("");
  const [newAlumnoData, setNewAlumnoData] = React.useState({ nombre: "", email: "", pass: "" });
  const [newAlumnoErrors, setNewAlumnoErrors] = React.useState({});

  const alumnosIds = React.useMemo(function () {
    var ids = {};
    alumnos.forEach(function (a) { ids[String(a.id)] = true; });
    return ids;
  }, [alumnos]);
  // Misma composicion que App.jsx: rutinas unificadas -> categoria -> filtro «Baja actividad» (regla de D3).
  const rutinasUnificadas = React.useMemo(function () {
    return mergeRutinasAsignadas(rutinasSBEntrenador, rutinasSB, alumnosIds);
  }, [rutinasSBEntrenador, rutinasSB, alumnosIds]);
  const getRutinaAsignadaAlumnoDemo = React.useCallback(function (a) { return getRutinaAsignadaAlumno(rutinasUnificadas, a); }, [rutinasUnificadas]);
  const lista = React.useMemo(function () {
    return selectCoachStudentListState({
      alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinasUnificadas, sesionesGlobalesLimpias: sesionesGlobales, progresoGlobalLimpio: {},
      coachAlumnosSearch: ui.coachAlumnosSearch, coachAlumnosFilter: ui.coachAlumnosFilter, nowMs: Date.now(),
    });
  }, [alumnos, rutinasUnificadas, sesionesGlobales, ui.coachAlumnosSearch, ui.coachAlumnosFilter]);
  const bajaIds = React.useMemo(function () {
    return bajaActividadIds({ alumnos: alumnos, catFn: lista.coachAlumnoCategoria, rutinas: rutinasUnificadas, sesiones: sesionesGlobales });
  }, [alumnos, lista, rutinasUnificadas, sesionesGlobales]);
  const vista = vistaAlumnosConBaja({ counts: lista.coachAlumnosCounts, lista: lista.coachAlumnosListaFiltrada, filtro: ui.coachAlumnosFilter, bajaIds: bajaIds });

  // Handlers REALES del Dashboard (los mismos de App.jsx); la ficha se carga de la capa en memoria.
  const nav = crearNavegacionDashboard({
    setTab: setTab,
    setCoachAlumnosSearch: ui.setCoachAlumnosSearch,
    setCoachAlumnosFilter: ui.setCoachAlumnosFilter,
    setAlumnoActivo: setAlumnoActivo,
    setCoachDashIntent: setCoachDashIntent,
    getAlumnos: function () { return alumnos; },
    cargarFicha: async function (alum) {
      setLoadingSB(true);
      var r = await Promise.all([sb.getRutinas(alum.id), sb.getProgreso(alum.id), sb.getSesiones(alum.id)]);
      setRutinasSB(r[0] || []);
      setAlumnoProgreso(r[1] || []);
      setAlumnoSesiones(r[2] || []);
      setLoadingSB(false);
    },
  });
  const nombreDe = function (id) {
    var a = alumnos.find(function (x) { return String(x.id) === String(id); });
    return a ? a.nombre : "alumno";
  };

  const navBtn = function (key, label) {
    var on = tab === key;
    return (
      <button
        type="button"
        aria-pressed={on}
        data-demo-tab={key}
        onClick={function () { setTab(key); }}
        style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid " + (on ? "#2563eb" : T.coachAluBorderSoft), background: on ? "rgba(59,130,246,0.2)" : "transparent", color: on ? "#93c5fd" : T.textMuted, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.textMain, fontFamily: "Inter,sans-serif", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AppGlobalStyles darkMode={darkMode} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
      <div role="note" style={{ position: "sticky", top: 0, zIndex: 50, paddingTop: "env(safe-area-inset-top, 0px)", background: "#78350f", borderBottom: "1px solid #f59e0b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", minHeight: 44, boxSizing: "border-box" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#0f172a", background: "#f59e0b", borderRadius: 6, padding: "2px 8px" }}>DEMO</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#fde68a", lineHeight: 1.3 }}>Dashboard del entrenador · datos ficticios · sin conexión a IronTrack</span>
          <button type="button" onClick={function () { window.location.reload(); }} style={{ minHeight: 44, minWidth: 44, padding: "0 10px", background: "transparent", border: "1px solid #f59e0b", borderRadius: 10, color: "#fde68a", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Reiniciar</button>
        </div>
        {/* Sustituto de la barra / menu de la app (que viven en App.jsx): solo cambia de seccion, sin filtros. */}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 8px", background: T.bg }}>
          {navBtn("plan", "Dashboard")}
          {navBtn("alumnos", "Alumnos")}
        </div>
      </div>

      {tab === "plan" && (
        <CoachDashboardMain
          activeNav="dashboard"
          alumnos={alumnos}
          alumnosStatus="ready"
          sesionesGlobales={sesionesGlobales}
          mensajesEntrenadorPendientes={[]}
          progresoGlobal={{}}
          historiaCompleta={HISTORIA_COMPLETA}
          rutinasSBEntrenador={rutinasUnificadas}
          allEx={allEx}
          lang={lang}
          darkMode={darkMode}
          currentWeek={0}
          coachName="Entrenador Demo"
          onEnviarMensaje={function () {
            var target = resolveDashboardMessageTarget(lista.coachAlumnosCounts);
            if (!target.empty) nav.irAlumnosConFiltro(target.filter);
          }}
          onCrearRutina={function () { avisoDemo("Crear rutina"); }}
          onRevisarAlumnos={nav.verTodos}
          onVerInactivos={nav.verInactivos}
          onVerSinRutina={nav.verSinRutina}
          onVerBajaActividad={nav.verBajaActividad}
          onAsignarRutina={nav.asignarRutina}
          onRevisar={nav.revisar}
          onVerPerfil={nav.verPerfil}
          onNuevoAlumno={function () { avisoDemo("Nuevo alumno"); }}
          onNuevaRutina={function () { avisoDemo("Nueva rutina"); }}
          onNuevoEjercicio={function () { avisoDemo("Nuevo ejercicio"); }}
          onIrProgreso={function () { avisoDemo("Progreso"); }}
          onAbrirChatAlumno={function (id) { showToast("Chat con " + nombreDe(id) + " (simulado)"); }}
          globalSearchData={{ alumnos: [], rutinas: [], ejercicios: [], sesiones: [] }}
          onGlobalSearchNavigate={function () {}}
          getAlumnoCategoria={lista.coachAlumnoCategoria}
          supabase={null}
          entrenadorId={null}
        />
      )}

      {tab === "alumnos" && (
        <div className="app-inner" style={{ paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
          <StudentsSection
            allEx={allEx}
            alumnoActivo={alumnoActivo}
            alumnoProgreso={alumnoProgreso}
            alumnoSesiones={alumnoSesiones}
            alumnos={alumnos}
            bgCard={T.bgCard}
            bgSub={T.bgSub}
            border={T.border}
            cargarAlumnos={function () {}}
            alumnosStatus="ok"
            cleanActiveCoachAlumnos={cleanActiveCoachAlumnos}
            coachAluBorderSoft={T.coachAluBorderSoft}
            coachAluDropdown={T.coachAluDropdown}
            coachAluDropdownShadow={T.coachAluDropdownShadow}
            coachAluGhostBtn={T.coachAluGhostBtn}
            coachAluShell={T.coachAluShell}
            coachAluSubtle={T.coachAluSubtle}
            coachAluSurface={T.coachAluSurface}
            coachAluTrack={T.coachAluTrack}
            coachAlumnosCounts={vista.counts}
            coachAlumnosFilter={ui.coachAlumnosFilter}
            coachAlumnosListaFiltrada={vista.lista}
            coachAlumnosSearch={ui.coachAlumnosSearch}
            coachDashIntent={coachDashIntent}
            setCoachDashIntent={setCoachDashIntent}
            coachCardMenuId={ui.coachCardMenuId}
            coachDiaSecsOpen={ui.coachDiaSecsOpen}
            coachRoutineDiaIdx={ui.coachRoutineDiaIdx}
            coachRutinaMenuOpen={ui.coachRutinaMenuOpen}
            completedDays={[]}
            currentWeek={0}
            darkMode={darkMode}
            ENTRENADOR_ID={DEMO_DASH_ENTRENADOR_ID}
            es={es}
            EX={EX}
            generarSugerenciasAlumno={generarSugerenciasAlumno}
            getRutinaAsignadaAlumno={getRutinaAsignadaAlumnoDemo}
            loadingSB={loadingSB}
            mergeRutinasAsignadas={mergeRutinasAsignadas}
            msg={msg}
            newAlumnoData={newAlumnoData}
            newAlumnoErrors={newAlumnoErrors}
            newAlumnoForm={false}
            notaDiaInput={notaDiaInput}
            routineForAssign={DEMO_DASH_RUTINA_LOCAL}
            routines={[DEMO_DASH_RUTINA_LOCAL]}
            rutinasLoaded={true}
            sb={sb}
            setAddExModal={function () { avisoDemo("Agregar ejercicio"); }}
            setAddExMuscle={function () {}}
            setAddExPat={function () {}}
            setAddExSearch={function () {}}
            setAddExSelectedIds={function () {}}
            setAliasModal={function () { avisoDemo("Datos de pago"); }}
            setAlumnoActivo={setAlumnoActivo}
            setAlumnoProgreso={setAlumnoProgreso}
            setAlumnoSesiones={setAlumnoSesiones}
            setAlumnos={setAlumnos}
            setAssignRoutineId={function () {}}
            setCoachAlumnosFilter={ui.setCoachAlumnosFilter}
            setCoachAlumnosSearch={ui.setCoachAlumnosSearch}
            setCoachCardMenuId={ui.setCoachCardMenuId}
            setChatModal={function (c) { showToast("Chat con " + ((c && c.alumnoNombre) || "alumno") + " (simulado)"); }}
            setCoachDiaSecsOpen={ui.setCoachDiaSecsOpen}
            setCoachDialog={setCoachDialog}
            setCoachRoutineDiaIdx={ui.setCoachRoutineDiaIdx}
            setCoachRutinaMenuOpen={ui.setCoachRutinaMenuOpen}
            setEditEx={function () { avisoDemo("Editar ejercicio"); }}
            setLoadingSB={setLoadingSB}
            setNewAlumnoData={setNewAlumnoData}
            setNewAlumnoErrors={setNewAlumnoErrors}
            setNewAlumnoForm={function () { avisoDemo("Nuevo alumno"); }}
            setNotaDiaInput={setNotaDiaInput}
            setRegistrosSubTab={ui.setRegistrosSubTab}
            setRutinasSB={setRutinasSB}
            setRutinasSBEntrenador={setRutinasSBEntrenador}
            sesionesGlobales={sesionesGlobales}
            progresoGlobal={{}}
            showCoachDesktopShell={false}
            sugsOpen={ui.sugsOpen}
            setSugsOpen={ui.setSugsOpen}
            textMain={T.textMain}
            textMuted={T.textMuted}
            toast2={toast2}
          />
        </div>
      )}

      <CoachConfirmDialog
        dialog={coachDialog}
        config={getCoachDialogModalConfig(coachDialog, msg, es)}
        loading={false}
        cancelLabel={msg('Cancelar', 'Cancel', 'Cancelar')}
        onCancel={function () { setCoachDialog({ t: 'none' }); }}
        onConfirm={function () {
          setCoachDialog({ t: 'none' });
          ui.setCoachRutinaMenuOpen(false);
          avisoDemo("Asignar rutina");
        }}
      />
      <ToastBanner toast={toast} darkMode={darkMode} border={T.border} textMain={T.textMain} />
    </div>
  );
}
