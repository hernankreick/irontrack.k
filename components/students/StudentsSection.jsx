import React from 'react';
import { Ic } from '../Ic.jsx';
import { resolveExerciseTitle } from '../../lib/exerciseResolve.js';
import { getRutinaAlumnoId } from '../../lib/routineStore.js';
import { getStudentWeeklyProgress } from '../../lib/studentWeeklyProgress.js';
import StudentCard from './StudentCard.jsx';
import StudentDetailPanel from './StudentDetailPanel.jsx';

export default function StudentsSection(props) {
  const {
    allEx = [], alumnoActivo, alumnoProgreso = [], alumnoSesiones = [], alumnos = [], bgCard, bgSub, border, cargarAlumnos, cleanActiveCoachAlumnos,
    coachAluBorderSoft, coachAluDropdown, coachAluDropdownShadow, coachAluGhostBtn, coachAluShell, coachAluSubtle, coachAluSurface, coachAluTrack,
    coachAlumnosCounts = { todos: 0, activos: 0, inactivos: 0, sin_rutina: 0 }, coachAlumnosFilter, coachAlumnosListaFiltrada = [], coachAlumnosSearch, coachCardMenuId, coachDiaSecsOpen = {}, coachRoutineDiaIdx, coachRutinaMenuOpen,
    completedDays = [], currentWeek, darkMode, ENTRENADOR_ID, es, EX = [], generarSugerenciasAlumno, getRutinaAsignadaAlumno, loadingSB, mergeRutinasAsignadas, msg,
    newAlumnoData = { nombre: "", email: "", pass: "" }, newAlumnoErrors = {}, newAlumnoForm, notaDiaInput, routineForAssign, routines = [], rutinasLoaded, sb,
    setAddExModal, setAddExMuscle, setAddExPat, setAddExSearch, setAddExSelectedIds, setAliasModal, setAlumnoActivo, setAlumnoProgreso, setAlumnoSesiones, setAlumnos, setAssignRoutineId,
    setCoachAlumnosFilter, setCoachAlumnosSearch, setCoachCardMenuId, setChatModal, setCoachDiaSecsOpen, setCoachDialog, setCoachRoutineDiaIdx, setCoachRutinaMenuOpen, setEditEx,
    setLoadingSB, setNewAlumnoData, setNewAlumnoErrors, setNewAlumnoForm, setNotaDiaInput, setRegistrosSubTab, setRutinasSB, setRutinasSBEntrenador,
    sesionesGlobales = [], progresoGlobal = {}, showCoachDesktopShell, sugsOpen = {}, setSugsOpen, textMain, textMuted, toast2
  } = props;
  const t = typeof msg === "function" ? msg : function (esText, enText) { return es ? esText : enText; };
  const assignedRoutineFor = typeof getRutinaAsignadaAlumno === "function"
    ? getRutinaAsignadaAlumno
    : function () { return null; };
  const sesionesForAlumno = React.useCallback(function (a) {
    var aid = String(a && a.id != null ? a.id : a);
    var byGlobal = (sesionesGlobales || []).filter(function (s) {
      return String(s && s.alumno_id) === aid;
    });
    var bySelected = alumnoActivo && String(alumnoActivo.id) === aid ? (alumnoSesiones || []) : [];
    var seen = {};
    return bySelected.concat(byGlobal).filter(function (s, idx) {
      var key = s && s.id != null ? "id:" + String(s.id) : "row:" + idx + ":" + String(s && (s.fecha || s.created_at || ""));
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }, [sesionesGlobales, alumnoSesiones, alumnoActivo]);

  return (

          <div className="min-w-0 max-w-full" style={{background:coachAluShell,marginLeft:showCoachDesktopShell?0:-4,marginRight:showCoachDesktopShell?0:-4,padding:"8px 0 20px",borderRadius:12}}>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={{fontSize:22,fontWeight:800,letterSpacing:1,color:textMain,minWidth:0,flex:"1 1 12rem"}}><Ic name="users" size={18} color={textMain}/> {msg("MIS ALUMNOS", "MY ATHLETES")}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
                <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={()=>setAliasModal(true)} aria-label={msg("Datos de pago", "Payment info")}><Ic name="share" size={16}/></button>
                <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={cargarAlumnos} aria-label={msg("Actualizar", "Refresh")}><Ic name="refresh-cw" size={16}/></button>
                <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setNewAlumnoForm(true)}>+ {msg("Nuevo", "New")}</button>
              </div>
            </div>

            {routines.length>0&&(
              <div style={{marginBottom:12,padding:"12px 14px",background:bgSub,borderRadius:12,border:"1px solid "+border}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:0.8,color:"#2563EB",marginBottom:8}}>{msg("RUTINA QUE SE ASIGNA AL TOCAR «ASIGNAR»", "ROUTINE USED WHEN YOU TAP «ASSIGN»")}</div>
                {routines.length===1 ? (
                  <div style={{fontSize:16,fontWeight:700,color:textMain}}>{routines[0].name}</div>
                ) : (
                  <select
                    style={{width:"100%",background:bgCard,color:textMain,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
                    value={routineForAssign?.id||""}
                    onChange={function(e){setAssignRoutineId(e.target.value);}}>
                    {routines.map(function(r){
                      return <option key={r.id} value={r.id}>{r.name||"—"} · {(r.days||[]).length} {msg("días", "days")}</option>;
                    })}
                  </select>
                )}
                <div style={{fontSize:12,color:textMuted,marginTop:6}}>{msg("Creá o editá rutinas en RUTINAS. Con varias listas, elegí cuál mandar acá.", "Create or edit routines under ROUTINES. If you have several, pick which one to send.")}</div>
              </div>
            )}

            <div style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,background:coachAluSurface,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"10px 12px",boxShadow:darkMode ? "none" : "0 1px 2px rgba(15,23,42,0.06)"}}>
                <Ic name="search" size={18} color={textMuted}/>
                <input
                  type="search"
                  value={coachAlumnosSearch}
                  onChange={function (e) { setCoachAlumnosSearch(e.target.value); }}
                  placeholder={msg("Buscar alumno...", "Search athlete...")}
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:textMain,fontSize:15,fontFamily:"inherit",minWidth:0}}
                />
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                {[
                  { k: "todos", es: "Todos", en: "All", n: coachAlumnosCounts.todos },
                  { k: "activos", es: "Activos", en: "Active", n: coachAlumnosCounts.activos },
                  { k: "inactivos", es: "Inactivos", en: "Inactive", n: coachAlumnosCounts.inactivos },
                  { k: "sin_rutina", es: "Sin rutina", en: "No routine", n: coachAlumnosCounts.sin_rutina },
                ].map(function (chip) {
                  var sel = coachAlumnosFilter === chip.k;
                  return (
                    <button
                      key={chip.k}
                      type="button"
                      className="hov"
                      onClick={function () { setCoachAlumnosFilter(chip.k); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: sel ? "1px solid #2563eb" : "1px solid "+coachAluBorderSoft,
                        background: sel ? (darkMode ? "rgba(59,130,246,0.2)" : "rgba(37,99,235,0.1)") : coachAluSurface,
                        color: sel ? "#2563eb" : textMuted,
                      }}
                    >
                      {es ? chip.es : chip.en} ({chip.n})
                    </button>
                  );
                })}
              </div>
            </div>

            {newAlumnoForm&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}}>
                <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxWidth:480,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
                  <div style={{fontSize:15,fontWeight:800,letterSpacing:1,marginBottom:16,color:textMain}}>{msg("NUEVO ALUMNO", "NEW ATHLETE")}</div>
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
                  <div style={{marginBottom:16}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>{msg("CONTRASEÑA", "PASSWORD")}</span>
                    <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15}} value={newAlumnoData.pass} onChange={e=>setNewAlumnoData(p=>({...p,pass:e.target.value}))} placeholder="Contraseña" type="password"/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}}>{msg("Cancelar", "Cancel")}</button>
                    <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flex:1}} onClick={async()=>{
                      const errNom = !newAlumnoData.nombre.trim();
                      const errEm = !/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email);
                      if(errNom||errEm){setNewAlumnoErrors({nombre:errNom,email:errEm});return;}
                      setLoadingSB(true);
                      const res = await sb.createAlumno({nombre:newAlumnoData.nombre.trim(),email:newAlumnoData.email.trim(),password:newAlumnoData.pass.trim()||"irontrack2024",entrenador_id:ENTRENADOR_ID});
                      if(res&&res[0]){setAlumnos(prev=>cleanActiveCoachAlumnos([...prev,res[0]],ENTRENADOR_ID));toast2(msg("Alumno creado ✓", "Athlete created ✓"));setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}
                      else{toast2("Error al crear alumno");}
                      setLoadingSB(false);
                    }}>GUARDAR</button>
                  </div>
                </div>
              </div>
            )}

            {loadingSB&&(
              <div>
                {[1,2,3].map(i=>(
                  <div key={"alumno-list-skel-"+i} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{flex:1}}>
                        <div className="sk" style={{height:16,width:"55%",marginBottom:8}}/>
                        <div className="sk" style={{height:12,width:"35%"}}/>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                        <div className="sk" style={{width:52,height:32,borderRadius:8}}/>
                        <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {alumnos.length===0&&!loadingSB&&(
              <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
                <div style={{fontSize:36,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Ic name="users" size={34} color={textMuted}/>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:textMain}}>{msg("Sin alumnos aún", "No athletes yet")}</div>
              </div>
            )}
            {alumnos.length>0 && coachAlumnosListaFiltrada.length===0 && !loadingSB && (
              <div style={{textAlign:"center",padding:"24px 12px",color:textMuted,fontSize:15,fontWeight:600}}>
                {msg("No hay alumnos que coincidan con la búsqueda o el filtro.", "No athletes match your search or filter.")}
              </div>
            )}

            {coachAlumnosListaFiltrada.map(a=>{
              const rutinaAsignada = assignedRoutineFor(a);
              const progresoSemanal = getStudentWeeklyProgress({
                alumno: a,
                rutina: rutinaAsignada,
                sesiones: sesionesForAlumno(a),
                progreso: progresoGlobal,
                completedDays: completedDays,
                currentWeek: currentWeek,
              });
              const isAlumnoActive = alumnoActivo?.id===a.id;
              const rutinaActiva = isAlumnoActive ? assignedRoutineFor(a.id) : null;
              const dias = rutinaActiva ? (rutinaActiva.datos?.days||[]) : [];
              const rId = rutinaActiva ? rutinaActiva.id : null;
              const weeklyProgress = rutinaActiva ? getStudentWeeklyProgress({
                alumno: a,
                rutina: rutinaActiva,
                sesiones: sesionesForAlumno(a),
                progreso: progresoGlobal,
                completedDays: completedDays,
                currentWeek: currentWeek,
              }) : null;
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
              const proxTxt = weeklyProgress ? (function(){
                var proxDia, proxSemana;
                if(diasCompletados >= dias.length) { proxDia = 1; proxSemana = semanaCiclo < 4 ? semanaCiclo + 1 : 1; }
                else { proxDia = diasCompletados + 1; proxSemana = semanaCiclo; }
                var proxLabel = dias[proxDia-1] ? (dias[proxDia-1].label || ("Día " + proxDia)) : ("Día " + proxDia);
                return proxLabel + " · " + (msg("Semana ", "Week ")) + proxSemana + (semanaCiclo >= 4 && diasCompletados >= dias.length ? (msg(" (nuevo ciclo)", " (new cycle)")) : "");
              })() : "";
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
              const regsAlu = alumnoProgreso || [];
              const sugs = rutSB && regsAlu.length >= 2 ? generarSugerenciasAlumno(regsAlu, rutSB.datos, EX) : [];
              const suggestionsOpen = !!sugsOpen[a.id];
              return (
              <StudentCard
                key={a.id}
                alumno={a}
                rutinaAsignada={rutinaAsignada}
                progresoSemanal={progresoSemanal}
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
                  if (alumnoActivo?.id === a.id) { setAlumnoActivo(null); return; }
                  setAlumnoActivo(a); setRegistrosSubTab(0); setLoadingSB(true);
                  const ruts = await sb.getRutinas(a.id); setRutinasSB(ruts || []);
                  setRutinasSBEntrenador(function (prev) {
                    var fresh = Array.isArray(ruts) ? ruts : [];
                    return mergeRutinasAsignadas(
                      fresh,
                      (prev || []).filter(function (r) {
                        var alumnoRutinaId = getRutinaAlumnoId(r);
                        return alumnoRutinaId == null || String(alumnoRutinaId) !== String(a.id);
                      })
                    );
                  });
                  const prog = await sb.getProgreso(a.id); setAlumnoProgreso(prog || []);
                  const ses = await sb.getSesiones(a.id); setAlumnoSesiones(ses || []);
                  setLoadingSB(false);
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
                onAsignarRutina={function () {}}
              >
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
                    warmupItems={warmupItems}
                    exerciseItems={exerciseItems}
                    sugs={sugs}
                    rutSB={rutSB}
                    suggestionsOpen={suggestionsOpen}
                    completedDays={completedDays}
                    coachRutinaMenuOpen={coachRutinaMenuOpen}
                    coachDiaSecsOpen={coachDiaSecsOpen}
                    notaDiaInput={notaDiaInput}
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
                    onResetWeek={function(){ setCoachDialog({ t: 'resetWeek', semanaCiclo: semanaCiclo }); }}
                    onResetRoutine={function(){ setCoachDialog({ t: 'resetRoutine', a: a, rutinaActiva: rutinaActiva }); }}
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
                    onAssignRoutine={function () {
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
                    }}
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
                    onNotaChange={function(e){ setNotaDiaInput(e.target.value); }}
                    onEnviarNota={async function(){
                      if(!notaDiaInput.trim()) return;
                      try{
                        await sb.setNota({
                          alumno_id:a.id,
                          entrenador_id:ENTRENADOR_ID,
                          contenido:notaDiaInput.trim(),
                          texto:notaDiaInput.trim(),
                          fecha:new Date().toLocaleDateString("es-AR")
                        });
                        toast2(msg("Nota enviada ✓", "Note sent ✓"));
                        setNotaDiaInput("");
                      }catch(e){toast2("Error al enviar nota");}
                    }}
                  />
                )}
              </StudentCard>
            )})}
          </div>
  );
}
