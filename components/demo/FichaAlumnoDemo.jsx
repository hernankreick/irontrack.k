import React from 'react';
import StudentsSection from '../students/StudentsSection.jsx';
import CoachConfirmDialog from '../coach/CoachConfirmDialog.jsx';
import EditExerciseModalHost from '../routines/EditExerciseModalHost.jsx';
import AddExerciseModal from '../modals/AddExerciseModal.jsx';
import AppGlobalStyles from '../layout/AppGlobalStyles.jsx';
import ToastBanner from '../ui/ToastBanner.jsx';
import { getCoachDialogModalConfig } from '../coach/coachDialogConfig.js';
import { useCoachUIState } from '../../hooks/useCoachUIState.js';
import { getAppThemeTokens } from '../../lib/appThemeTokens.js';
import { irontrackMsg } from '../../lib/irontrackMsg.js';
import { cleanActiveCoachAlumnos } from '../../lib/appHelpers.js';
import { mergeRutinasAsignadas, getRutinaAsignadaAlumno } from '../../lib/routineStore.js';
import { selectCoachStudentListState } from '../../lib/coachStudentListSelectors.js';
import { generarSugerenciasAlumno } from '../../lib/sugerenciasAlumno.js';
import { EX, PATS } from '../../lib/exerciseStaticData.js';
import { normalizeLibraryExercise } from '../../lib/exerciseResolve.js';
import { DEMO_ALUMNO, DEMO_ENTRENADOR_ID, createDemoSb } from './fichaAlumnoDemoData.js';

const DEMO = "DEMO · ";

/**
 * Demostracion de la ficha del alumno (Alumnos) con los componentes REALES de la app y datos ficticios en memoria.
 * Solo existe en builds de Preview (vite.config.js). No usa Supabase, red, localStorage ni la sesion de IronTrack:
 * toda accion que en la app escribiria algo se reemplaza por un aviso "DEMO".
 */
export default function FichaAlumnoDemo() {
  const darkMode = true;
  const lang = "es";
  const es = true;
  const msg = React.useCallback(function (esStr, enStr, ptStr) { return irontrackMsg(lang, esStr, enStr, ptStr); }, []);
  const T = getAppThemeTokens(darkMode);
  const ui = useCoachUIState();
  const sb = React.useMemo(createDemoSb, []);
  const allEx = React.useMemo(function () { return EX.map(function (e) { return normalizeLibraryExercise(e, { catalog: true }); }); }, []);

  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = React.useCallback(function (text) {
    setToast(DEMO + text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(function () { setToast(null); }, 3200);
  }, []);
  // Avisos de los componentes reales (p. ej. "Sesión validada ✓"): se marcan como simulados.
  const toast2 = React.useCallback(function (text) { showToast(text + " (simulado)"); }, [showToast]);
  const avisoDemo = function (accion) { showToast(accion + ": no se guarda nada en la demostración"); };

  const [alumnos, setAlumnos] = React.useState([DEMO_ALUMNO]);
  const [alumnoActivo, setAlumnoActivo] = React.useState(null);
  const [alumnoProgreso, setAlumnoProgreso] = React.useState([]);
  const [alumnoSesiones, setAlumnoSesiones] = React.useState([]);
  const [rutinasSB, setRutinasSB] = React.useState([]);
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = React.useState([]);
  const [sesionesGlobales, setSesionesGlobales] = React.useState([]);
  const [loadingSB, setLoadingSB] = React.useState(false);
  const [coachDialog, setCoachDialog] = React.useState({ t: 'none' });
  const [notaDiaInput, setNotaDiaInput] = React.useState("");
  const [newAlumnoForm, setNewAlumnoForm] = React.useState(false);
  const [newAlumnoData, setNewAlumnoData] = React.useState({ nombre: "", email: "", pass: "" });
  const [newAlumnoErrors, setNewAlumnoErrors] = React.useState({});
  const [editEx, setEditEx] = React.useState(null);
  const [addExModal, setAddExModal] = React.useState(null);
  const [addExSearch, setAddExSearch] = React.useState("");
  const [addExPat, setAddExPat] = React.useState(null);
  const [addExMuscle, setAddExMuscle] = React.useState(null);
  const [addExSelectedIds, setAddExSelectedIds] = React.useState([]);

  // Carga inicial como la de la app (rutinas del entrenador y ultimas sesiones), desde la capa simulada.
  React.useEffect(function () {
    sb.getRutinas(DEMO_ALUMNO.id).then(setRutinasSBEntrenador);
    sb.getSesiones(DEMO_ALUMNO.id).then(setSesionesGlobales);
  }, [sb]);

  const rutinasUnificadas = React.useMemo(function () {
    return mergeRutinasAsignadas(rutinasSBEntrenador, rutinasSB, { [DEMO_ALUMNO.id]: true });
  }, [rutinasSBEntrenador, rutinasSB]);
  const getRutinaAsignadaAlumnoDemo = React.useCallback(function (a) { return getRutinaAsignadaAlumno(rutinasUnificadas, a); }, [rutinasUnificadas]);
  const lista = selectCoachStudentListState({
    alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinasUnificadas, sesionesGlobalesLimpias: sesionesGlobales, progresoGlobalLimpio: {},
    coachAlumnosSearch: ui.coachAlumnosSearch, coachAlumnosFilter: ui.coachAlumnosFilter, nowMs: Date.now(),
  });

  const dialogNames = { resetWeek: "Reiniciar semana", resetRoutine: "Reiniciar rutina", quitarRut: "Quitar rutina", goRoutines: "Abrir en Rutinas",
    assignRut: "Cambiar rutina", editAlum: "Editar alumno", clearProgress: "Limpiar historial", deleteAlumno: "Eliminar alumno" };

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.textMain, fontFamily: "Inter,sans-serif", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AppGlobalStyles darkMode={darkMode} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
      <div role="note" style={{ position: "sticky", top: 0, zIndex: 50, paddingTop: "env(safe-area-inset-top, 0px)", background: "#78350f", borderBottom: "1px solid #f59e0b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", minHeight: 44, boxSizing: "border-box" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#0f172a", background: "#f59e0b", borderRadius: 6, padding: "2px 8px" }}>DEMO</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#fde68a", lineHeight: 1.3 }}>Datos ficticios · no se guarda nada · sin conexión a IronTrack</span>
          <button type="button" onClick={function () { window.location.reload(); }} style={{ minHeight: 44, minWidth: 44, padding: "0 10px", background: "transparent", border: "1px solid #f59e0b", borderRadius: 10, color: "#fde68a", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Reiniciar</button>
        </div>
      </div>
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
          coachAlumnosCounts={lista.coachAlumnosCounts}
          coachAlumnosFilter={ui.coachAlumnosFilter}
          coachAlumnosListaFiltrada={lista.coachAlumnosListaFiltrada}
          coachAlumnosSearch={ui.coachAlumnosSearch}
          coachCardMenuId={ui.coachCardMenuId}
          coachDiaSecsOpen={ui.coachDiaSecsOpen}
          coachRoutineDiaIdx={ui.coachRoutineDiaIdx}
          coachRutinaMenuOpen={ui.coachRutinaMenuOpen}
          completedDays={[]}
          currentWeek={0}
          darkMode={darkMode}
          ENTRENADOR_ID={DEMO_ENTRENADOR_ID}
          es={es}
          EX={EX}
          generarSugerenciasAlumno={generarSugerenciasAlumno}
          getRutinaAsignadaAlumno={getRutinaAsignadaAlumnoDemo}
          loadingSB={loadingSB}
          mergeRutinasAsignadas={mergeRutinasAsignadas}
          msg={msg}
          newAlumnoData={newAlumnoData}
          newAlumnoErrors={newAlumnoErrors}
          newAlumnoForm={newAlumnoForm}
          notaDiaInput={notaDiaInput}
          routineForAssign={null}
          routines={[]}
          rutinasLoaded={true}
          sb={sb}
          setAddExModal={setAddExModal}
          setAddExMuscle={setAddExMuscle}
          setAddExPat={setAddExPat}
          setAddExSearch={setAddExSearch}
          setAddExSelectedIds={setAddExSelectedIds}
          setAliasModal={function () { avisoDemo("Datos de pago"); }}
          setAlumnoActivo={setAlumnoActivo}
          setAlumnoProgreso={setAlumnoProgreso}
          setAlumnoSesiones={setAlumnoSesiones}
          setAlumnos={setAlumnos}
          setAssignRoutineId={function () {}}
          setCoachAlumnosFilter={ui.setCoachAlumnosFilter}
          setCoachAlumnosSearch={ui.setCoachAlumnosSearch}
          setCoachCardMenuId={ui.setCoachCardMenuId}
          setChatModal={function () { avisoDemo("Chat"); }}
          setCoachDiaSecsOpen={ui.setCoachDiaSecsOpen}
          setCoachDialog={setCoachDialog}
          setCoachRoutineDiaIdx={ui.setCoachRoutineDiaIdx}
          setCoachRutinaMenuOpen={ui.setCoachRutinaMenuOpen}
          setEditEx={setEditEx}
          setLoadingSB={setLoadingSB}
          setNewAlumnoData={setNewAlumnoData}
          setNewAlumnoErrors={setNewAlumnoErrors}
          setNewAlumnoForm={setNewAlumnoForm}
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
          var name = dialogNames[coachDialog.t] || "Acción";
          setCoachDialog({ t: 'none' });
          ui.setCoachRutinaMenuOpen(false);
          avisoDemo(name);
        }}
      />
      <EditExerciseModalHost
        editEx={editEx} darkMode={darkMode} btn={T.btn} inp={T.inp} allEx={allEx} es={es} PATS={PATS} msg={msg}
        onSave={function () { setEditEx(null); avisoDemo("Editar ejercicio"); }}
        onClose={function () { setEditEx(null); }}
      />
      <AddExerciseModal
        addExModal={addExModal} addExSearch={addExSearch} setAddExSearch={setAddExSearch} addExPat={addExPat} setAddExPat={setAddExPat}
        addExMuscle={addExMuscle} setAddExMuscle={setAddExMuscle} addExSelectedIds={addExSelectedIds} setAddExSelectedIds={setAddExSelectedIds}
        allEx={allEx} coachDesktopNavHidden={true} darkMode={darkMode} es={es} lang={lang} msg={msg} btn={T.btn} inp={T.inp}
        bgCard={T.bgCard} border={T.border} textMuted={T.textMuted}
        onClose={function () { setAddExModal(null); setAddExSelectedIds([]); }}
        onConfirm={function () { setAddExModal(null); setAddExSelectedIds([]); avisoDemo("Añadir ejercicio"); }}
      />
      <ToastBanner toast={toast} darkMode={darkMode} border={T.border} textMain={T.textMain} />
    </div>
  );
}
