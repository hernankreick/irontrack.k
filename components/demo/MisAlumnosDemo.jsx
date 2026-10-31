import React from 'react';
import CoachStudentsMain from '../coach/CoachStudentsMain.jsx';
import CoachConfirmDialog from '../coach/CoachConfirmDialog.jsx';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import ToastBanner from '../ui/ToastBanner.jsx';
import { bajaActividadIds } from '../CoachDashboard.jsx';
import { vistaAlumnosConBaja } from '../coach/coachDashboardNav.js';
import { getCoachDialogModalConfig } from '../coach/coachDialogConfig.js';
import { useCoachUIState } from '../../hooks/useCoachUIState.js';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';
import { irontrackMsg } from '../../lib/irontrackMsg.js';
import { cleanActiveCoachAlumnos } from '../../lib/appHelpers.js';
import { mergeRutinasAsignadas, getRutinaAsignadaAlumno } from '../../lib/routineStore.js';
import { selectCoachStudentListState } from '../../lib/coachStudentListSelectors.js';
import { generarSugerenciasAlumno } from '../../lib/sugerenciasAlumno.js';
import { EX } from '../../lib/exerciseStaticData.js';
import { normalizeLibraryExercise } from '../../lib/exerciseResolve.js';
import { alumnosPaleta } from '../students/alumnosPaleta.js';
import {
  DEMO_MA_ALUMNOS, DEMO_MA_ENTRENADOR_ID, DEMO_MA_RUTINAS_LOCALES, createDemoMaSb, demoMaRutinas, demoMaSesiones,
} from './misAlumnosDemoData.js';

const DEMO = "DEMO · ";

/**
 * Demostracion de «Mis alumnos» del entrenador con el componente REAL (CoachStudentsMain -> StudentsSection), para que se apliquen las
 * sobrescrituras de paleta. Solo existe en builds de Preview (vite.config.js). Datos ficticios en memoria: sin Supabase, sin red y sin
 * la sesion de IronTrack. Toda accion que en la app escribiria algo (asignar, crear, pago) se reemplaza por un aviso "DEMO".
 * Controles: tema oscuro / claro, escenario «Muchos alumnos» / «Lista vacia» y Reiniciar.
 */
export default function MisAlumnosDemo() {
  const [darkMode, setDarkMode] = React.useState(true);
  const [escenario, setEscenario] = React.useState("muchos");
  const lang = "es";
  const es = true;
  const msg = React.useCallback(function (esStr, enStr, ptStr) { return irontrackMsg(lang, esStr, enStr, ptStr); }, []);
  const T = getAppThemeTokens(darkMode);
  const pal = alumnosPaleta(darkMode);
  const ui = useCoachUIState();
  const sb = React.useMemo(function () { return createDemoMaSb(); }, []);
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

  const [alumnos, setAlumnos] = React.useState(DEMO_MA_ALUMNOS);
  const [alumnoActivo, setAlumnoActivo] = React.useState(null);
  const [alumnoProgreso, setAlumnoProgreso] = React.useState([]);
  const [alumnoSesiones, setAlumnoSesiones] = React.useState([]);
  const [rutinasSB, setRutinasSB] = React.useState([]);
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = React.useState(function () { return demoMaRutinas(); });
  const [sesionesGlobales, setSesionesGlobales] = React.useState(function () { return demoMaSesiones(); });
  const [loadingSB, setLoadingSB] = React.useState(false);
  const [coachDashIntent, setCoachDashIntent] = React.useState(null);
  const [coachDialog, setCoachDialog] = React.useState({ t: 'none' });
  const [notaDiaInput, setNotaDiaInput] = React.useState("");
  const [newAlumnoData, setNewAlumnoData] = React.useState({ nombre: "", email: "", pass: "" });
  const [newAlumnoErrors, setNewAlumnoErrors] = React.useState({});
  const [assignRoutineId, setAssignRoutineId] = React.useState(DEMO_MA_RUTINAS_LOCALES[0].id);
  const routineForAssign = DEMO_MA_RUTINAS_LOCALES.find(function (r) { return r.id === assignRoutineId; }) || DEMO_MA_RUTINAS_LOCALES[0];

  const cambiarEscenario = function (nuevo) {
    var vacia = nuevo === "vacia";
    setEscenario(nuevo);
    setAlumnos(vacia ? [] : DEMO_MA_ALUMNOS);
    setRutinasSBEntrenador(vacia ? [] : demoMaRutinas());
    setSesionesGlobales(vacia ? [] : demoMaSesiones());
    setAlumnoActivo(null);
    setAlumnoProgreso([]);
    setAlumnoSesiones([]);
    setRutinasSB([]);
    ui.setCoachAlumnosFilter("todos");
    ui.setCoachAlumnosSearch("");
  };

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

  const barBtn = function (activo, extra) {
    return Object.assign({ minHeight: 44, minWidth: 44, padding: "0 12px", background: activo ? "rgba(245,158,11,0.22)" : "transparent", border: "1px solid #f59e0b", borderRadius: 10, color: "#fde68a", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }, extra || {});
  };

  return (
    <div style={{ minHeight: "100dvh", background: pal.coachAluShell, color: T.textMain, fontFamily: "Inter,sans-serif", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AppGlobalStyles darkMode={darkMode} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
      <div role="note" style={{ position: "sticky", top: 0, zIndex: 50, paddingTop: "env(safe-area-inset-top, 0px)", background: "#78350f", borderBottom: "1px solid #f59e0b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", minHeight: 44, boxSizing: "border-box" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#0f172a", background: "#f59e0b", borderRadius: 6, padding: "2px 8px" }}>DEMO</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#fde68a", lineHeight: 1.3 }}>Mis alumnos · datos ficticios · sin conexión a IronTrack</span>
          <button type="button" data-demo-reset onClick={function () { window.location.reload(); }} style={barBtn(false)}>Reiniciar</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 8px" }}>
          <button type="button" data-demo-theme="dark" aria-pressed={darkMode} onClick={function () { setDarkMode(true); }} style={barBtn(darkMode)}>Oscuro</button>
          <button type="button" data-demo-theme="light" aria-pressed={!darkMode} onClick={function () { setDarkMode(false); }} style={barBtn(!darkMode)}>Claro</button>
          <button type="button" data-demo-scenario="muchos" aria-pressed={escenario === "muchos"} onClick={function () { cambiarEscenario("muchos"); }} style={barBtn(escenario === "muchos")}>Muchos alumnos</button>
          <button type="button" data-demo-scenario="vacia" aria-pressed={escenario === "vacia"} onClick={function () { cambiarEscenario("vacia"); }} style={barBtn(escenario === "vacia")}>Lista vacía</button>
        </div>
      </div>

      {/* Mismo contenedor que CoachSectionRenderer para la pestana Alumnos (la barra superior de la app no existe aqui). */}
      <div className="alu-page" style={{ paddingTop: 20, boxSizing: "border-box", background: pal.coachAluShell }}>
              <CoachStudentsMain
                allEx={allEx}
                alumnoActivo={alumnoActivo}
                alumnoProgreso={alumnoProgreso}
                alumnoSesiones={alumnoSesiones}
                alumnos={alumnos}
                bgCard={T.bgCard}
                bgSub={T.bgSub}
                border={T.border}
                cargarAlumnos={function () { avisoDemo("Actualizar"); }}
                alumnosStatus="ok"
                cleanActiveCoachAlumnos={cleanActiveCoachAlumnos}
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
                ENTRENADOR_ID={DEMO_MA_ENTRENADOR_ID}
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
                routineForAssign={routineForAssign}
                routines={DEMO_MA_RUTINAS_LOCALES}
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
                setAssignRoutineId={setAssignRoutineId}
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
