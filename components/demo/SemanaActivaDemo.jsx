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
  DEMO_SA_ALUMNOS, DEMO_SA_CLAVES, DEMO_SA_ENTRENADOR_ID, DEMO_SA_ESPERADO, DEMO_SA_FILAS, DEMO_SA_RUTINAS_LOCALES,
  createDemoSaSb, demoSaAlumnoId, demoSaRutinas, demoSaSesiones,
} from './semanaActivaDemoData.js';

const DEMO = "DEMO · ";

/**
 * Demostracion del subtitulo de «Semana N de 4» (PR #196) con el componente REAL: CoachStudentsMain -> StudentsSection -> ficha del alumno
 * -> StudentProgressSummary, el mismo que usa la app (el subtitulo sale de semanaSubtitulo.js, usado por StudentsSection). Solo existe en
 * builds de Preview (vite.config.js). Datos ficticios en memoria: sin Supabase, sin red, sin inicio de sesion ni almacenamiento.
 * Controles: alumno (Catalina / Alumno B / Alumno C) y tema oscuro / claro. Lo unico que cambia entre alumnos son sus sesiones y su
 * semana_activa; la demo nunca avanza ni modifica una semana (la capa sb solo lee).
 *
 * Props (para enlaces directos y pruebas): initialAlumno = clave de DEMO_SA_CLAVES; initialDark = true | false.
 */
export default function SemanaActivaDemo(props) {
  const p = props || {};
  const claveInicial = DEMO_SA_CLAVES.indexOf(p.initialAlumno) >= 0 ? p.initialAlumno : DEMO_SA_CLAVES[0];
  const [darkMode, setDarkMode] = React.useState(p.initialDark !== false);
  const lang = "es";
  const es = true;
  const msg = React.useCallback(function (esStr, enStr, ptStr) { return irontrackMsg(lang, esStr, enStr, ptStr); }, []);
  const T = getAppThemeTokens(darkMode);
  const pal = alumnosPaleta(darkMode);
  const ui = useCoachUIState();
  const sb = React.useMemo(function () { return createDemoSaSb(); }, []);
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

  const [alumnos, setAlumnos] = React.useState(DEMO_SA_ALUMNOS);
  // La ficha de la clave inicial arranca abierta: rutinas y sesiones ya estan en memoria (rutinasSBEntrenador / sesionesGlobales), igual que
  // en la app despues de cargar la lista, asi que el subtitulo se calcula en el primer render.
  const [alumnoActivo, setAlumnoActivo] = React.useState(function () {
    return DEMO_SA_ALUMNOS.find(function (a) { return a.id === demoSaAlumnoId(claveInicial); }) || null;
  });
  const [alumnoProgreso, setAlumnoProgreso] = React.useState([]);
  const [alumnoSesiones, setAlumnoSesiones] = React.useState([]);
  const [rutinasSB, setRutinasSB] = React.useState([]);
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = React.useState(function () { return demoSaRutinas(); });
  const [sesionesGlobales] = React.useState(function () { return demoSaSesiones(); });
  const [loadingSB, setLoadingSB] = React.useState(false);
  const [coachDashIntent, setCoachDashIntent] = React.useState(null);
  const [coachDialog, setCoachDialog] = React.useState({ t: 'none' });
  const [notaDiaInput, setNotaDiaInput] = React.useState("");
  const [newAlumnoData, setNewAlumnoData] = React.useState({ nombre: "", email: "", pass: "" });
  const [newAlumnoErrors, setNewAlumnoErrors] = React.useState({});
  const [assignRoutineId, setAssignRoutineId] = React.useState(DEMO_SA_RUTINAS_LOCALES[0].id);
  const routineForAssign = DEMO_SA_RUTINAS_LOCALES.find(function (r) { return r.id === assignRoutineId; }) || DEMO_SA_RUTINAS_LOCALES[0];

  const claveActiva = alumnoActivo ? DEMO_SA_CLAVES.find(function (c) { return demoSaAlumnoId(c) === alumnoActivo.id; }) || null : null;

  // La ficha se abre debajo de la lista de tarjetas: al elegir un alumno (o abrir un enlace directo) se baja hasta «Semana N de 4» para que
  // el subtitulo quede a la vista, justo debajo de la barra fija. Solo mueve el scroll de la pagina; no cambia datos ni estado.
  const barRef = React.useRef(null);
  React.useEffect(function () {
    if (!claveActiva || typeof document === "undefined") return undefined;
    var intentos = 0;
    var t = null;
    var bajar = function () {
      var el = document.querySelector("[data-demo-semana-activa] .it-ficha-stats");
      if (!el) { if (++intentos < 8) t = setTimeout(bajar, 60); return; }
      var alto = barRef.current ? barRef.current.offsetHeight : 0;
      el.style.scrollMarginTop = (alto + 12) + "px";
      el.scrollIntoView({ block: "start", behavior: "auto" });
    };
    t = setTimeout(bajar, 30);
    return function () { if (t) clearTimeout(t); };
  }, [claveActiva]);

  // Enlace directo reproducible (?alumno=catalina&tema=claro): solo cambia la URL visible, no recarga ni guarda nada.
  const sincronizarUrl = function (clave, oscuro) {
    try {
      if (typeof window === "undefined" || !window.history || !window.history.replaceState) return;
      var q = new URLSearchParams(window.location.search);
      if (clave) q.set("alumno", clave); else q.delete("alumno");
      q.set("tema", oscuro ? "oscuro" : "claro");
      window.history.replaceState(null, "", window.location.pathname + "?" + q.toString());
    } catch (e) { /* sin historial disponible: la demo sigue funcionando */ }
  };
  const elegirAlumno = function (clave) {
    var a = DEMO_SA_ALUMNOS.find(function (x) { return x.id === demoSaAlumnoId(clave); });
    if (!a) return;
    ui.setCoachCardMenuId(null);
    setAlumnoActivo(a);
    setAlumnoProgreso([]);
    setAlumnoSesiones([]);
    setRutinasSB([]);
    setLoadingSB(false);
    sincronizarUrl(clave, darkMode);
  };
  const elegirTema = function (oscuro) {
    setDarkMode(oscuro);
    sincronizarUrl(claveActiva, oscuro);
  };

  const alumnosIds = React.useMemo(function () {
    var ids = {};
    alumnos.forEach(function (a) { ids[String(a.id)] = true; });
    return ids;
  }, [alumnos]);
  // Misma composicion que App.jsx: rutinas unificadas -> categoria -> filtro «Baja actividad».
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
  const esperado = claveActiva ? DEMO_SA_ESPERADO[claveActiva] : null;

  return (
    <div data-demo-semana-activa style={{ minHeight: "100dvh", background: pal.coachAluShell, color: T.textMain, fontFamily: "Inter,sans-serif", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <AppGlobalStyles darkMode={darkMode} bgSub={T.bgSub} textMain={T.textMain} border={T.border} />
      <div ref={barRef} role="note" style={{ position: "sticky", top: 0, zIndex: 50, paddingTop: "env(safe-area-inset-top, 0px)", background: "#78350f", borderBottom: "1px solid #f59e0b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", minHeight: 44, boxSizing: "border-box" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#0f172a", background: "#f59e0b", borderRadius: 6, padding: "2px 8px" }}>DEMO</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#fde68a", lineHeight: 1.2 }}>PR #196 · datos ficticios</span>
          <button type="button" data-demo-theme="dark" aria-pressed={darkMode} onClick={function () { elegirTema(true); }} style={barBtn(darkMode)}>Oscuro</button>
          <button type="button" data-demo-theme="light" aria-pressed={!darkMode} onClick={function () { elegirTema(false); }} style={barBtn(!darkMode)}>Claro</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 6px" }}>
          {DEMO_SA_FILAS.map(function (f) {
            var on = claveActiva === f[0];
            return <button key={f[0]} type="button" data-demo-alumno={f[0]} aria-pressed={on} onClick={function () { elegirAlumno(f[0]); }} style={barBtn(on)}>{f[1]}</button>;
          })}
        </div>
        <div data-demo-esperado={esperado || ""} style={{ padding: "0 16px 8px", fontSize: 13, color: "#fde68a", lineHeight: 1.35 }}>
          {esperado ? "Debajo de «Semana N de 4» tiene que decir: «" + esperado + "»" : "Elegí un alumno para ver su ficha"}
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
          ENTRENADOR_ID={DEMO_SA_ENTRENADOR_ID}
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
          routines={DEMO_SA_RUTINAS_LOCALES}
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
