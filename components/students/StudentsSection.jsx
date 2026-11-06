import { loadAlumnoFicha, nuevaCargaFicha, filasDelAlumno } from "../../lib/studentFicha.js";
import React from 'react';
import { Ic } from '../Ic.jsx';
import { resolveExerciseTitle } from '../../lib/exerciseResolve.js';
import { getActiveStudentRoutinePosition } from '../../lib/studentWeeklyProgress.js';
import { CICLO_CARGAS, readCicloBase, readCicloCargas, rowCiclo } from '../../lib/rutinaCiclo.js';
import StudentCard from './StudentCard.jsx';
import StudentDetailPanel from './StudentDetailPanel.jsx';
import StudentOrphanSession from './StudentOrphanSession.jsx';
import ManualSessionValidationModal from './ManualSessionValidationModal.jsx';
import StudentsSectionStates from './StudentsSectionStates.jsx';
import useDialogA11y from '../modals/useDialogA11y.js';
import { crearEnviosNota, notaVisible, debeDescartarBorrador, decidirResultadoNota } from './notaDelDia.js';

export default function StudentsSection(props) {
  const {
    allEx = [], alumnoActivo, alumnoProgreso = [], alumnoSesiones = [], alumnos = [], bgCard, bgSub, border, cargarAlumnos, alumnosStatus, cleanActiveCoachAlumnos,
    coachAluBorderSoft, coachAluDropdown, coachAluDropdownShadow, coachAluGhostBtn, coachAluShell, coachAluSubtle, coachAluSurface, coachAluTrack,
    coachAlumnosCounts = { todos: 0, activos: 0, inactivos: 0, sin_rutina: 0 }, coachAlumnosFilter, coachAlumnosListaFiltrada = [], coachAlumnosSearch, coachDashIntent = null, setCoachDashIntent, coachCardMenuId, coachDiaSecsOpen = {}, coachRoutineDiaIdx, coachRutinaMenuOpen,
    completedDays = [], currentWeek, darkMode, ENTRENADOR_ID, es, EX = [], fichaError = null, setFichaError, generarSugerenciasAlumno, getRutinaAsignadaAlumno, loadingSB, mergeRutinasAsignadas, msg,
    newAlumnoData = { nombre: "", email: "", pass: "" }, newAlumnoErrors = {}, newAlumnoForm, notaDiaInput, routineForAssign, routines = [], rutinasLoaded, sb,
    setAddExModal, setAddExMuscle, setAddExPat, setAddExSearch, setAddExSelectedIds, setAliasModal, setAlumnoActivo, setAlumnoProgreso, setAlumnoSesiones, setAlumnos, setAssignRoutineId,
    setCoachAlumnosFilter, setCoachAlumnosSearch, setCoachCardMenuId, setChatModal, setCoachDiaSecsOpen, setCoachDialog, setCoachRoutineDiaIdx, setCoachRutinaMenuOpen, setEditEx,
    setLoadingSB, setNewAlumnoData, setNewAlumnoErrors, setNewAlumnoForm, setNotaDiaInput, setRegistrosSubTab, setRutinasSB, setRutinasSBEntrenador,
    sesionesGlobales = [], setSesionesGlobales, progresoGlobal = {}, showCoachDesktopShell, sugsOpen = {}, setSugsOpen, textMain, textMuted, toast2
  } = props;
  const t = typeof msg === "function" ? msg : function (esText, enText) { return es ? esText : enText; };
  const assignedRoutineFor = typeof getRutinaAsignadaAlumno === "function"
    ? getRutinaAsignadaAlumno
    : function () { return null; };
  const studentsStateProps = {
    loadingSB,
    alumnosLength: alumnos.length,
    alumnosStatus,
    filteredLength: coachAlumnosListaFiltrada.length,
    bgCard,
    border,
    textMuted,
    textMain,
    msg,
    Ic,
  };
  // Alta de alumno: foco/Tab/Escape/retorno de foco. El fondo NO cierra (se perdia lo tipeado); Escape solo cierra si el formulario esta vacio.
  const newAlumnoDialogRef = React.useRef(null);
  const [creatingAlumno, setCreatingAlumno] = React.useState(false);
  const closeNewAlumnoForm = function () { setNewAlumnoForm(false); setNewAlumnoData({nombre:"",email:"",pass:""}); setNewAlumnoErrors({nombre:false,email:false}); };
  const newAlumnoPristine = !((newAlumnoData.nombre || "").trim() || (newAlumnoData.email || "").trim());
  useDialogA11y({ open: !!newAlumnoForm, containerRef: newAlumnoDialogRef, onEscape: newAlumnoPristine && !creatingAlumno ? closeNewAlumnoForm : undefined });
  const [manualValidate, setManualValidate] = React.useState(null);
  // «Nota del día»: el borrador (notaDiaInput, estado de App) pertenece al alumno para el que se escribió (notaDueno). Solo se muestra
  // y se envía en SU ficha; al abrir la ficha de otro alumno se descarta (contraer/expandir la misma ficha lo conserva). El envío tiene
  // candado síncrono por alumno, y su resultado tardío nunca toca la ficha de otro alumno. Reglas y contrato de sb.setNota: notaDelDia.js.
  const [notaDueno, setNotaDueno] = React.useState(null);
  const [notaEnviando, setNotaEnviando] = React.useState({});
  const [notaError, setNotaError] = React.useState(null);
  const enviosNotaRef = React.useRef(null);
  if (!enviosNotaRef.current) enviosNotaRef.current = crearEnviosNota();
  const notaVistaRef = React.useRef({ abierto: null, dueno: null });
  const alumnoActivoIdStr = alumnoActivo && alumnoActivo.id != null ? String(alumnoActivo.id) : null;
  notaVistaRef.current = { abierto: alumnoActivoIdStr, dueno: notaDueno };
  React.useEffect(function () {
    // Al montar, no hay dueño conocido: un texto que haya quedado en App no se muestra ni se envía a nadie.
    if (typeof setNotaDiaInput === "function") setNotaDiaInput("");
  }, []);
  React.useEffect(function () {
    if (debeDescartarBorrador(notaVistaRef.current.dueno, alumnoActivoIdStr)) {
      notaVistaRef.current = { abierto: alumnoActivoIdStr, dueno: null };
      setNotaDueno(null);
      if (typeof setNotaDiaInput === "function") setNotaDiaInput("");
    }
    if (alumnoActivoIdStr != null) setNotaError(function (prev) { return prev && prev.alumnoId !== alumnoActivoIdStr ? null : prev; });
  }, [alumnoActivoIdStr]);
  const cambiarNota = function (a, texto) {
    const id = String(a.id);
    notaVistaRef.current = { abierto: notaVistaRef.current.abierto, dueno: id };
    setNotaDueno(id);
    setNotaDiaInput(texto);
    setNotaError(function (prev) { return prev && prev.alumnoId === id ? null : prev; });
  };
  const enviarNota = function (a) {
    const id = String(a.id);
    const quien = a.nombre || a.email || "";
    return enviosNotaRef.current.enviar({
      alumnoId: id,
      texto: notaVisible(notaDiaInput, notaDueno, id),
      ejecutar: function (texto) {
        return sb.setNota({
          alumno_id: a.id,
          entrenador_id: ENTRENADOR_ID,
          contenido: texto,
          texto: texto,
          fecha: new Date().toLocaleDateString("es-AR"),
        });
      },
      onInicio: function () {
        setNotaError(function (prev) { return prev && prev.alumnoId === id ? null : prev; });
        setNotaEnviando(function (prev) { return Object.assign({}, prev, { [id]: true }); });
      },
      onResultado: function (_id, r) {
        setNotaEnviando(function (prev) { const n = Object.assign({}, prev); delete n[id]; return n; });
        if (!r.ok) console.error("[nota del día]", r.motivo, r.error || "");
        const d = decidirResultadoNota({ alumnoId: id, resultado: r, vista: notaVistaRef.current, quien: quien, msg: msg });
        if (d.limpiarBorrador) {
          notaVistaRef.current = { abierto: notaVistaRef.current.abierto, dueno: null };
          setNotaDueno(null);
          setNotaDiaInput("");
        }
        if (d.error) setNotaError(d.error);
        toast2(d.aviso);
      },
    });
  };
  // D7.3: carga de la ficha del alumno `a` (VER y Reintentar). Vacia lo anterior, solo la carga vigente escribe y apaga «cargando»,
  // y si falla la red queda el estado de error de ESE alumno (nunca datos de otro).
  const cargarFichaDe = async function (a) {
    setLoadingSB(true);
    if (typeof setFichaError === "function") setFichaError(null);
    const vigente = nuevaCargaFicha(a.id);
    let res = null;
    try {
      res = await loadAlumnoFicha({
        esVigente: vigente,
        alumno: a,
        sb: sb,
        mergeRutinasAsignadas: mergeRutinasAsignadas,
        setRutinasSB: setRutinasSB,
        setRutinasSBEntrenador: setRutinasSBEntrenador,
        setAlumnoProgreso: setAlumnoProgreso,
        setAlumnoSesiones: setAlumnoSesiones,
      });
    } catch (e) {
      res = { error: e };
    } finally {
      if (vigente()) {
        if (res && res.error) {
          console.error("[VER alumno]", res.error);
          if (typeof setFichaError === "function") setFichaError(String(a.id));
        }
        setLoadingSB(false);
      }
    }
  };
  const sesionesForAlumno = React.useCallback(function (a) {
    var aid = String(a && a.id != null ? a.id : a);
    var byGlobal = (sesionesGlobales || []).filter(function (s) {
      return String(s && s.alumno_id) === aid;
    });
    // D7.3: solo filas de ESTE alumno (una respuesta de otro alumno nunca se muestra como suya)
    var bySelected = alumnoActivo && String(alumnoActivo.id) === aid ? filasDelAlumno(alumnoSesiones, aid) : [];
    var seen = {};
    return bySelected.concat(byGlobal).filter(function (s, idx) {
      var key = s && s.id != null ? "id:" + String(s.id) : "row:" + idx + ":" + String(s && (s.fecha || s.created_at || ""));
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }, [sesionesGlobales, alumnoSesiones, alumnoActivo]);

  // Flujo EXISTENTE de asignacion de la ficha (boton «Asignar / Cambiar rutina»); D4 lo reutiliza para el pedido del Dashboard.
  function abrirAsignacionRutina(a) {
    const rutinaLocal = routineForAssign;
    if (!rutinaLocal) {
      toast2(msg('Creá una rutina en RUTINAS', 'Create a routine in ROUTINES', 'Crie uma rotina em ROTINAS'));
      return;
    }
    const ex0 = assignedRoutineFor(a.id);
    const rutinaParaAsignar = rutinaLocal.datos
      ? rutinaLocal
      : {
          nombre: rutinaLocal.nombre || rutinaLocal.name || 'Rutina',
          datos: {
            days: rutinaLocal.days || [],
            note: rutinaLocal.note || '',
          },
        };
    const rutinaNombre = rutinaParaAsignar.nombre || 'Rutina';
    var assignMsg0 = ex0
      ? es
        ? 'Ya tiene: ' + ex0.nombre + '\n¿Reemplazar por: ' + rutinaNombre + '?'
        : 'Has: ' + ex0.nombre + '\nReplace with: ' + rutinaNombre + '?'
      : es
        ? '¿Asignar rutina: ' + rutinaNombre + ' a ' + a.nombre + '?'
        : 'Assign routine: ' + rutinaNombre + ' to ' + a.nombre + '?';
    setCoachDialog({ t: 'assignRut', a: a, ex: ex0 || null, rutinaLocal: rutinaParaAsignar, assignMsg: assignMsg0 });
  }

  // D4: pedido del Dashboard al abrir un alumno: llevar su ficha a la vista y, con «Asignar rutina», abrir el mismo dialogo de asignacion
  // (solo si sigue sin rutina). Se consume una sola vez, cuando la ficha de ESE alumno ya termino de cargar.
  React.useEffect(function () {
    if (!coachDashIntent || !alumnoActivo || loadingSB) return;
    if (String(alumnoActivo.id) !== String(coachDashIntent.alumnoId)) return;
    var accion = coachDashIntent.accion;
    if (typeof setCoachDashIntent === "function") setCoachDashIntent(null);
    if (typeof document !== "undefined") {
      var el = document.querySelector('[data-alumno-id="' + String(alumnoActivo.id).replace(/"/g, "") + '"]');
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    if (accion === "asignar" && !assignedRoutineFor(alumnoActivo.id)) abrirAsignacionRutina(alumnoActivo);
  }, [coachDashIntent, alumnoActivo, loadingSB]);

  return (

          <div className="alu-pad min-w-0 max-w-full" style={{background:coachAluShell,boxSizing:"border-box"}}>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:16}}>
              <h1 style={{margin:0,fontSize:22,fontWeight:750,letterSpacing:0,color:textMain,minWidth:0,flex:"1 1 10rem",display:"flex",alignItems:"center",gap:8}}><Ic name="users" size={20} color={textMain}/> {msg("Mis alumnos", "My athletes")}</h1>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
                <button className="hov coach-tap" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:10,minWidth:44,minHeight:44,padding:"8px 10px",fontSize:13,cursor:"pointer"}} onClick={()=>setAliasModal(true)} aria-label={msg("Datos de pago", "Payment info")}><Ic name="share" size={16}/></button>
                <button className="hov coach-tap" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:10,minWidth:44,minHeight:44,padding:"8px 10px",fontSize:13,cursor:"pointer"}} onClick={cargarAlumnos} aria-label={msg("Actualizar", "Refresh")}><Ic name="refresh-cw" size={16}/></button>
                <button className="hov coach-tap" style={{background:darkMode?"#3B82F6":"#2563EB",color:darkMode?"#06101F":"#fff",border:"none",borderRadius:10,minHeight:44,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setNewAlumnoForm(true)}>+ {msg("Nuevo", "New")}</button>
              </div>
            </div>

            {routines.length>0&&(
              <div title={msg("Creá o editá rutinas en RUTINAS. Con varias listas, elegí cuál mandar acá.", "Create or edit routines under ROUTINES. If you have several, pick which one to send.")} style={{position:"relative",display:"flex",alignItems:"center",flexWrap:"wrap",gap:"6px 12px",marginBottom:16,padding:"6px 12px",minHeight:56,boxSizing:"border-box",background:coachAluSurface,borderRadius:12,border:"1px solid "+coachAluBorderSoft}}>
                <span id="alu-rutina-label" style={{fontSize:13,fontWeight:600,color:textMuted,flexShrink:0}}>{msg("Rutina a asignar", "Routine to assign")}</span>
                {routines.length===1 ? (
                  <span aria-describedby="alu-rutina-ayuda" style={{flex:"1 1 8rem",minWidth:0,fontSize:15,fontWeight:700,color:textMain,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{routines[0].name}</span>
                ) : (
                  <select
                    aria-labelledby="alu-rutina-label"
                    aria-describedby="alu-rutina-ayuda"
                    style={{flex:"1 1 10rem",minWidth:0,minHeight:44,background:coachAluSubtle,color:textMain,border:"1px solid "+coachAluBorderSoft,borderRadius:10,padding:"8px 12px",fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
                    value={routineForAssign?.id||""}
                    onChange={function(e){setAssignRoutineId(e.target.value);}}>
                    {routines.map(function(r){
                      return <option key={r.id} value={r.id}>{r.name||"—"} · {(r.days||[]).length} {msg("días", "days")}</option>;
                    })}
                  </select>
                )}
                <span id="alu-rutina-ayuda" style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap"}}>{msg("Creá o editá rutinas en RUTINAS. Con varias listas, elegí cuál mandar acá.", "Create or edit routines under ROUTINES. If you have several, pick which one to send.")}</span>
              </div>
            )}

            <div style={{marginBottom:16}}>
              <div className="coach-field-tap coach-stu-search" style={{display:"flex",alignItems:"center",gap:10,background:coachAluSurface,border:"1px solid "+coachAluBorderSoft,borderRadius:12,minHeight:48,padding:"0 14px",boxShadow:darkMode ? "none" : "0 1px 2px rgba(15,23,42,0.06)"}}>
                <Ic name="search" size={18} color={textMuted}/>
                <input
                  type="search"
                  className="coach-stu-search-input"
                  aria-label={msg("Buscar alumno", "Search athlete")}
                  value={coachAlumnosSearch}
                  onChange={function (e) { setCoachAlumnosSearch(e.target.value); }}
                  placeholder={msg("Buscar alumno...", "Search athlete...")}
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:textMain,fontSize:16,fontFamily:"inherit",minWidth:0,minHeight:44}}
                />
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                {[
                  { k: "todos", es: "Todos", en: "All", n: coachAlumnosCounts.todos },
                  { k: "activos", es: "Activos", en: "Active", n: coachAlumnosCounts.activos },
                  { k: "inactivos", es: "Inactivos", en: "Inactive", n: coachAlumnosCounts.inactivos },
                  { k: "sin_rutina", es: "Sin rutina", en: "No routine", n: coachAlumnosCounts.sin_rutina },
                  // D4: mismo criterio que «Baja actividad» del Dashboard (D3); el contador lo calcula App.jsx con esa regla.
                  { k: "baja", es: "Baja actividad", en: "Low activity", n: coachAlumnosCounts.baja || 0 },
                ].map(function (chip) {
                  var sel = coachAlumnosFilter === chip.k;
                  return (
                    <button
                      key={chip.k}
                      type="button"
                      className="hov coach-tap"
                      aria-pressed={sel}
                      onClick={function () { setCoachAlumnosFilter(chip.k); }}
                      style={{
                        minHeight: 44,
                        padding: "0 14px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: sel ? "1px solid "+(darkMode ? "#3B82F6" : "#2563EB") : "1px solid "+coachAluBorderSoft,
                        background: sel ? (darkMode ? "rgba(59,130,246,0.2)" : "rgba(37,99,235,0.1)") : coachAluSurface,
                        color: sel ? (darkMode ? "#93C5FD" : "#1D4ED8") : textMuted,
                      }}
                    >
                      {es ? chip.es : chip.en} ({chip.n})
                    </button>
                  );
                })}
              </div>
            </div>

            {newAlumnoForm&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                <div ref={newAlumnoDialogRef} role="dialog" aria-modal="true" aria-labelledby="new-alumno-title" style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxWidth:480,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
                  <div id="new-alumno-title" style={{fontSize:15,fontWeight:800,letterSpacing:1,marginBottom:16,color:textMain}}>{msg("NUEVO ALUMNO", "NEW ATHLETE")}</div>
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>{msg("NOMBRE", "NAME")}</span>
                    <input
                      style={{background:bgSub,color:textMain,
                        border:"1px solid "+(newAlumnoErrors.nombre?"#EF4444":newAlumnoData.nombre.trim().length>1?"#22C55E":border),
                        borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15,
                        transition:"border-color .2s ease",outline:"none"}}
                      value={newAlumnoData.nombre}
                      onChange={e=>{setNewAlumnoData(p=>({...p,nombre:e.target.value}));if(e.target.value.trim().length>1)setNewAlumnoErrors(p=>({...p,nombre:false}));}}
                      onBlur={e=>{if(!e.target.value.trim())setNewAlumnoErrors(p=>({...p,nombre:true}));}}
                      placeholder={msg("Nombre completo", "Full name")}/>
                    {newAlumnoErrors.nombre&&<div style={{fontSize:11,color:"#EF4444",marginTop:4,fontWeight:700}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {msg("El nombre es obligatorio", "Name is required")}</div>}
                  </div>
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>EMAIL</span>
                    <input
                      style={{background:bgSub,color:textMain,
                        border:"1px solid "+(newAlumnoErrors.email?"#EF4444":/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email)?"#22C55E":border),
                        borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15,
                        transition:"border-color .2s ease",outline:"none"}}
                      value={newAlumnoData.email} type="email"
                      onChange={e=>{setNewAlumnoData(p=>({...p,email:e.target.value}));if(/^[^@]+@[^@]+\.[^@]+$/.test(e.target.value))setNewAlumnoErrors(p=>({...p,email:false}));}}
                      onBlur={e=>{if(!/^[^@]+@[^@]+\.[^@]+$/.test(e.target.value))setNewAlumnoErrors(p=>({...p,email:true}));}}
                      placeholder="email@ejemplo.com"/>
                    {newAlumnoErrors.email&&<div style={{fontSize:11,color:"#EF4444",marginTop:4,fontWeight:700}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {msg("Email inválido (ej: nombre@mail.com)", "Invalid email (e.g. name@mail.com)")}</div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button type="button" className="hov" style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={closeNewAlumnoForm}>{msg("Cancelar", "Cancel")}</button>
                    <button type="button" className="hov" disabled={creatingAlumno} aria-busy={creatingAlumno} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:creatingAlumno?"default":"pointer",opacity:creatingAlumno?0.6:1,fontFamily:"inherit",flex:1}} onClick={async()=>{
                      if(creatingAlumno) return;
                      const errNom = !newAlumnoData.nombre.trim();
                      const errEm = !/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email);
                      if(errNom||errEm){setNewAlumnoErrors({nombre:errNom,email:errEm});return;}
                      setCreatingAlumno(true);
                      try{
                      setLoadingSB(true);
                      const {data:createdRows,error:createErr} = await sb.createAlumno({nombre:newAlumnoData.nombre.trim(),email:newAlumnoData.email.trim(),entrenador_id:ENTRENADOR_ID});
                      if(createdRows&&createdRows[0]){setAlumnos(prev=>cleanActiveCoachAlumnos([...prev,createdRows[0]],ENTRENADOR_ID));toast2(msg("Alumno creado ✓", "Athlete created ✓"));setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}
                      else{const errMsg=createErr?.message||createErr?.details||"";toast2("Error al crear alumno"+(errMsg?" — "+errMsg:""));}
                      setLoadingSB(false);
                      }finally{setCreatingAlumno(false);}
                    }}>GUARDAR</button>
                  </div>
                </div>
              </div>
            )}

            {loadingSB&&(
              <StudentsSectionStates {...studentsStateProps} />
            )}
            {alumnosStatus==='error'&&alumnos.length>0&&!loadingSB&&coachAlumnosListaFiltrada.length>0&&(
              <StudentsSectionStates {...studentsStateProps} />
            )}
            {alumnos.length===0&&!loadingSB&&(
              <StudentsSectionStates {...studentsStateProps} />
            )}
            {alumnos.length>0 && coachAlumnosListaFiltrada.length===0 && !loadingSB && (
              <StudentsSectionStates {...studentsStateProps} />
            )}

            {coachAlumnosListaFiltrada.map(a=>{
              const rutinaAsignada = assignedRoutineFor(a);
              const progresoSemanal = getActiveStudentRoutinePosition({
                alumno: a,
                rutina: rutinaAsignada,
                sesiones: sesionesForAlumno(a),
                progreso: progresoGlobal,
                currentWeek: currentWeek,
              }).weeklyProgress;
              const isAlumnoActive = alumnoActivo?.id===a.id;
              const rutinaActiva = isAlumnoActive ? assignedRoutineFor(a.id) : null;
              const dias = rutinaActiva ? (rutinaActiva.datos?.days||[]) : [];
              const rId = rutinaActiva ? rutinaActiva.id : null;
              const weeklyPosition = rutinaActiva ? getActiveStudentRoutinePosition({
                alumno: a,
                rutina: rutinaActiva,
                sesiones: sesionesForAlumno(a),
                progreso: progresoGlobal,
                currentWeek: currentWeek,
              }) : null;
              const weeklyProgress = weeklyPosition ? weeklyPosition.weeklyProgress : null;
              const semanaCiclo = weeklyProgress ? weeklyProgress.weekNumber : 1;
              const semanaIdx = weeklyProgress ? weeklyProgress.weekIndex : 0;
              const diasCompletados = weeklyProgress ? weeklyProgress.completedDays : 0;
              const hoyDate = new Date();
              const inicioSemana = new Date(hoyDate);
              inicioSemana.setDate(hoyDate.getDate() - ((hoyDate.getDay()+6)%7));
              const finSemana = new Date(inicioSemana);
              finSemana.setDate(inicioSemana.getDate() + 6);
              const semCalLabel = inicioSemana.getDate() + "/" + (inicioSemana.getMonth()+1) + " — " + finSemana.getDate() + "/" + (finSemana.getMonth()+1);
              const pctBar = weeklyProgress ? weeklyProgress.pct : 0;
              const diSel = dias.length ? Math.min(coachRoutineDiaIdx, Math.max(0, dias.length - 1)) : 0;
              const dSel = dias[diSel] || { warmup: [], exercises: [], label: "" };
              const proxInfo = weeklyProgress ? (function(){
                var proxDia, proxSemana;
                if(diasCompletados >= dias.length) { proxDia = 1; proxSemana = semanaCiclo < 4 ? semanaCiclo + 1 : 1; }
                else { proxDia = diasCompletados + 1; proxSemana = semanaCiclo; }
                var proxLabel = dias[proxDia-1] ? (dias[proxDia-1].label || ("Día " + proxDia)) : ("Día " + proxDia);
                return { dia: proxDia, label: proxLabel, txt: proxLabel + " · " + (msg("Semana ", "Week ")) + proxSemana + (semanaCiclo >= 4 && diasCompletados >= dias.length ? (msg(" (nuevo ciclo)", " (new cycle)")) : "") };
              })() : null;
              const proxTxt = proxInfo ? proxInfo.txt : "";
              // Resumen del encabezado de la ficha: mismos datos que la tarjeta de rutina (no recalcula nada).
              const fichaSummary = weeklyProgress ? {
                semanaTxt: msg("Semana ", "Week ") + semanaCiclo + msg("\u00a0de\u00a04", "\u00a0of\u00a04"),
                diasTxt: diasCompletados + msg("\u00a0de\u00a0", "\u00a0of\u00a0") + dias.length + msg(" días", " days"),
                proxTxt: proxInfo.label,
              } : null;
              const warmupItems = (dSel.warmup||[]).map(function(ex,ei){
                const exInfo=allEx.find(e=>e.id===ex.id);
                return {
                  ex: ex,
                  index: ei,
                  nombre: resolveExerciseTitle(exInfo||null,ex,es),
                  key: (rutinaActiva?.id||"rut")+"-d"+diSel+"-wu-"+(ex.id||"ex")+"-"+ei,
                  isLast: ei >= (dSel.warmup||[]).length-1,
                };
              });
              const exerciseItems = (dSel.exercises||[]).map(function(ex,ei){
                const exInfo=allEx.find(e=>e.id===ex.id);
                return {
                  ex: ex,
                  index: ei,
                  nombre: resolveExerciseTitle(exInfo||null,ex,es),
                  key: (rutinaActiva?.id||"rut")+"-d"+diSel+"-ex-"+(ex.id||"ex")+"-"+ei,
                  isLast: ei >= (dSel.exercises||[]).length-1,
                };
              });
              const rutSB = isAlumnoActive ? assignedRoutineFor(a.id) : null;
              // "Reiniciar desde cero": las sugerencias de carga solo parten de los registros del bloque vigente (un reinicio de semana las mantiene).
              const progresoAlu = isAlumnoActive ? filasDelAlumno(alumnoProgreso, a.id) : [];
              const regsAlu = rutSB && readCicloCargas(rutSB.datos) === CICLO_CARGAS.CERO && readCicloBase(rutSB.datos) > 1
                ? progresoAlu.filter(function (reg) { return rowCiclo(reg) >= readCicloBase(rutSB.datos); })
                : progresoAlu;
              const sugs = rutSB && regsAlu.length >= 2 ? generarSugerenciasAlumno(regsAlu, rutSB.datos, EX) : [];
              const suggestionsOpen = !!sugsOpen[a.id];
              return (
              <StudentCard
                key={a.id}
                alumno={a}
                rutinaAsignada={rutinaAsignada}
                progresoSemanal={progresoSemanal}
                summary={fichaSummary}
                rutinasLoaded={rutinasLoaded}
                isActive={alumnoActivo?.id===a.id}
                isMenuOpen={coachCardMenuId === a.id}
                darkMode={darkMode}
                msg={msg}
                textMain={textMain}
                textMuted={textMuted}
                coachAluSurface={coachAluSurface}
                coachAluBorderSoft={coachAluBorderSoft}
                coachAluTrack={coachAluTrack}
                coachAluSubtle={coachAluSubtle}
                coachAluDropdown={coachAluDropdown}
                coachAluDropdownShadow={coachAluDropdownShadow}
                onVer={async function () {
                  setCoachCardMenuId(null);
                  // D7.3: cerrar la ficha invalida la carga y las operaciones en curso (sus respuestas tardias no tocan la ficha)
                  if (alumnoActivo?.id === a.id) { nuevaCargaFicha(null); setAlumnoActivo(null); setLoadingSB(false); if (typeof setFichaError === "function") setFichaError(null); return; }
                  setAlumnoActivo(a); setRegistrosSubTab(0);
                  await cargarFichaDe(a);
                }}
                onToggleMenu={function (e) { e.stopPropagation(); setCoachCardMenuId(coachCardMenuId === a.id ? null : a.id); }}
                onEdit={function () {
                  setCoachCardMenuId(null);
                  setCoachDialog({ t: 'editAlum', a: a });
                }}
                onChat={function () {
                  setCoachCardMenuId(null);
                  setChatModal({ alumnoId: a.id, alumnoNombre: a.nombre || a.email || "Alumno" });
                }}
                onClearProgress={function () {
                  setCoachCardMenuId(null);
                  setCoachDialog({ t: 'clearProgress', a: a });
                }}
                onDelete={function () {
                  setCoachCardMenuId(null);
                  setCoachDialog({ t: 'deleteAlumno', a: a });
                }}
                onMarkPaid={async function () {
                  setCoachCardMenuId(null);
                  try {
                    const now = new Date().toISOString();
                    const updated = await sb.updateAlumno(a.id, { ultimo_pago_confirmado: now });
                    if (!updated) { toast2(msg("Error al registrar el pago", "Error registering payment")); return; }
                    setAlumnos(function (prev) { return prev.map(function (al) { return al.id === a.id ? {...al, ultimo_pago_confirmado: now} : al; }); });
                    toast2(msg("Pago registrado ✓", "Payment registered ✓"));
                  } catch (e) {
                    toast2(msg("Error al registrar el pago", "Error registering payment"));
                  }
                }}
                onAsignarRutina={function () {}}
              >
                {isAlumnoActive&&fichaError===String(a.id)&&!loadingSB&&(
                  <div role="alert" data-qa="ficha-error" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",margin:"8px 0",padding:"10px 12px",borderRadius:12,border:"1px solid "+coachAluBorderSoft,background:coachAluSubtle,color:textMain,fontSize:13}}>
                    <span>{t("No se pudo cargar la ficha de ", "Could not load the profile of ")}{a.nombre || a.email}{t(". Revisá la conexión.", ". Check your connection.")}</span>
                    <button type="button" className="coach-tap" onClick={function () { cargarFichaDe(a); }} style={{minHeight:44,minWidth:44,padding:"8px 14px",borderRadius:10,border:"1px solid "+coachAluBorderSoft,background:coachAluSurface,color:textMain,fontWeight:700,fontSize:13,cursor:"pointer"}}>{t("Reintentar", "Retry")}</button>
                  </div>
                )}
                {isAlumnoActive&&rutinaActiva&&!loadingSB&&fichaError!==String(a.id)&&(
                  <StudentOrphanSession
                    alumno={a}
                    rutina={rutinaActiva}
                    progreso={progresoAlu}
                    sesiones={sesionesForAlumno(a)}
                    allEx={allEx}
                    sb={sb}
                    setAlumnoSesiones={setAlumnoSesiones}
                    setSesionesGlobales={setSesionesGlobales}
                    setRutinasSB={setRutinasSB}
                    setRutinasSBEntrenador={setRutinasSBEntrenador}
                    toast2={toast2}
                    es={es}
                    msg={msg}
                    textMain={textMain}
                    textMuted={textMuted}
                    coachAluSurface={coachAluSurface}
                    coachAluBorderSoft={coachAluBorderSoft}
                  />
                )}
                {isAlumnoActive&&(
                  <StudentDetailPanel
                    alumno={a}
                    rutinaActiva={rutinaActiva}
                    routineForAssign={routineForAssign}
                    dias={dias}
                    rId={rId}
                    weeklyProgress={weeklyProgress}
                    semanaCiclo={semanaCiclo}
                    semanaIdx={semanaIdx}
                    diasCompletados={diasCompletados}
                    semCalLabel={semCalLabel}
                    pctBar={pctBar}
                    diSel={diSel}
                    dSel={dSel}
                    proxTxt={proxTxt}
                    proxDiaIdx={proxInfo ? proxInfo.dia - 1 : null}
                    warmupItems={warmupItems}
                    exerciseItems={exerciseItems}
                    sugs={sugs}
                    rutSB={rutSB}
                    suggestionsOpen={suggestionsOpen}
                    completedDays={completedDays}
                    coachRutinaMenuOpen={coachRutinaMenuOpen}
                    coachDiaSecsOpen={coachDiaSecsOpen}
                    notaDiaInput={notaVisible(notaDiaInput, notaDueno, a.id)}
                    darkMode={darkMode}
                    es={es}
                    msg={msg}
                    textMain={textMain}
                    textMuted={textMuted}
                    bgSub={bgSub}
                    border={border}
                    coachAluSurface={coachAluSurface}
                    coachAluBorderSoft={coachAluBorderSoft}
                    coachAluTrack={coachAluTrack}
                    coachAluSubtle={coachAluSubtle}
                    coachAluDropdown={coachAluDropdown}
                    coachAluDropdownShadow={coachAluDropdownShadow}
                    coachAluGhostBtn={coachAluGhostBtn}
                    onToggleRoutineMenu={function(){setCoachRutinaMenuOpen(function(o){return !o;});}}
                    onResetWeek={function(){ setCoachDialog({ t: 'resetWeek', a: a, rutinaActiva: rutinaActiva, semanaCiclo: semanaCiclo }); }}
                    onResetRoutine={function(){ setCoachDialog({ t: 'resetRoutine', a: a, rutinaActiva: rutinaActiva }); }}
                    onValidateSession={function(){ setCoachRutinaMenuOpen(false); setManualValidate({ alumno: a, rutina: rutinaActiva, semana: semanaCiclo }); }}
                    onSelectDay={function(di){ setCoachRoutineDiaIdx(di); }}
                    onToggleWarmup={function(){ setCoachDiaSecsOpen(function(o){ return {...o, warmup:!o.warmup}; }); }}
                    onToggleMain={function(){ setCoachDiaSecsOpen(function(o){ return {...o, main:!o.main}; }); }}
                    onEditWarmupExercise={function(item){ setEditEx({rId:rutinaActiva.id,dIdx:diSel,eIdx:item.index,bloque:"warmup",ex:{...item.ex}}); }}
                    onAddWarmupExercise={function(){setAddExModal({rId:rutinaActiva.id,dIdx:diSel,bloque:"warmup"});setAddExSearch("");setAddExPat(null);setAddExMuscle(null);setAddExSelectedIds([]);}}
                    onEditMainExercise={function(item){ setEditEx({rId:rutinaActiva.id,dIdx:diSel,eIdx:item.index,bloque:"exercises",ex:{...item.ex}}); }}
                    onAddMainExercise={function(){setAddExModal({rId:rutinaActiva.id,dIdx:diSel,bloque:"exercises"});setAddExSearch("");setAddExPat(null);setAddExMuscle(null);setAddExSelectedIds([]);}}
                    onEditRoutine={function () {
                      var rut = {id:rutinaActiva.id,...(rutinaActiva.datos||{}),name:rutinaActiva.nombre,saved:true,alumno_id:a.id,alumno:a.nombre};
                      setCoachDialog({ t: 'goRoutines', rutinaActiva: rutinaActiva, a: a, rutina: rut });
                    }}
                    onRemoveRoutine={function () { setCoachDialog({ t: 'quitarRut', rutinaActiva: rutinaActiva, a: a }); }}
                    onAssignRoutine={function () { abrirAsignacionRutina(a); }}
                    onToggleSuggestions={function(){ setSugsOpen(function(prev){ return {...prev, [a.id]: !prev[a.id]}; }); }}
                    onApplySuggestion={function(sug){
                      var exConSug = {...sug.exData};
                      if(sug.sugKg) exConSug.kg = sug.sugKg;
                      if(sug.sugReps) exConSug.reps = sug.sugReps;
                      if(sug.sugSets) exConSug.sets = sug.sugSets;
                      if(sug.sugPause) exConSug.pause = sug.sugPause;
                      setEditEx({rId:rutSB.id,dIdx:sug.dIdx,eIdx:sug.eIdx,bloque:sug.bloque,ex:exConSug});
                    }}
                    onIgnoreSuggestion={function(sugKey){
                      var el=document.getElementById(sugKey);
                      if(el){el.style.opacity="0";el.style.height="0";el.style.padding="0";el.style.margin="0";el.style.overflow="hidden";el.style.transition="all .3s ease";}
                    }}
                    onNotaChange={function(e){ cambiarNota(a, e.target.value); }}
                    onEnviarNota={function(){ enviarNota(a); }}
                    notaEnviando={!!notaEnviando[String(a.id)]}
                    notaError={notaError && notaError.alumnoId === String(a.id) ? notaError.texto : null}
                  />
                )}
              </StudentCard>
            )})}
            <ManualSessionValidationModal
              open={!!manualValidate}
              onClose={function(){ setManualValidate(null); }}
              alumno={manualValidate ? manualValidate.alumno : null}
              rutina={manualValidate ? manualValidate.rutina : null}
              semana={manualValidate ? manualValidate.semana : null}
              sb={sb}
              setAlumnoSesiones={setAlumnoSesiones}
              setSesionesGlobales={setSesionesGlobales}
              setRutinasSB={setRutinasSB}
              setRutinasSBEntrenador={setRutinasSBEntrenador}
              toast2={toast2}
              msg={msg}
              textMain={textMain}
              textMuted={textMuted}
              coachAluSurface={coachAluSurface}
              coachAluBorderSoft={coachAluBorderSoft}
            />
          </div>
  );
}
