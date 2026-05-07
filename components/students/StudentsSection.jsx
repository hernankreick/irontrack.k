import React from 'react';
import { Ic } from '../Ic.jsx';
import { resolveExerciseTitle } from '../../lib/exerciseResolve.js';
import { getRutinaAlumnoId, getRutinaBadgeConfig } from '../../lib/routineStore.js';

export default function StudentsSection(props) {
  const {
    allEx, alumnoActivo, alumnoProgreso, alumnos, bgCard, bgSub, border, cargarAlumnos, cleanActiveCoachAlumnos,
    coachAluBorderSoft, coachAluDropdown, coachAluDropdownShadow, coachAluGhostBtn, coachAluShell, coachAluSubtle, coachAluSurface,
    coachAlumnosCounts, coachAlumnosFilter, coachAlumnosListaFiltrada, coachAlumnosSearch, coachCardMenuId, coachDiaSecsOpen, coachRoutineDiaIdx, coachRutinaMenuOpen,
    completedDays, currentWeek, darkMode, ENTRENADOR_ID, es, EX, generarSugerenciasAlumno, getRutinaAsignadaAlumno, loadingSB, mergeRutinasAsignadas, msg,
    newAlumnoData, newAlumnoErrors, newAlumnoForm, notaDiaInput, routineForAssign, routines, sb, semanaCiclo, semCalLabel,
    setAddExModal, setAddExMuscle, setAddExPat, setAddExSearch, setAddExSelectedIds, setAliasModal, setAlumnoActivo, setAlumnoProgreso, setAlumnoSesiones, setAlumnos, setAssignRoutineId,
    setCoachAlumnosFilter, setCoachAlumnosSearch, setCoachCardMenuId, setChatModal, setCoachDiaSecsOpen, setCoachDialog, setCoachRoutineDiaIdx, setCoachRutinaMenuOpen, setEditEx,
    setLoadingSB, setNewAlumnoData, setNewAlumnoErrors, setNewAlumnoForm, setNotaDiaInput, setRegistrosSubTab, setRutinasSB, setRutinasSBEntrenador,
    showCoachDesktopShell, sugsOpen, setSugsOpen, textMain, textMuted, toast2
  } = props;

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
              const rutinaAsignada = getRutinaAsignadaAlumno(a);
              return (
              <div key={a.id} style={{position:"relative",background:coachAluSurface,borderRadius:12,padding:"14px 14px 12px",marginBottom:10,border:alumnoActivo?.id===a.id?"1px solid #2563eb":"1px solid "+coachAluBorderSoft,boxShadow:darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.08)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"#2563eb",color:"#fff",fontSize:20,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"inherit"}}>
                    {(a.nombre||a.email||"?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:17,fontWeight:800,color:textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{a.nombre}</span>
                      {(() => {
                        var cfg = getRutinaBadgeConfig({
                          rutina: rutinaAsignada,
                          rutinasLoaded: rutinasLoaded,
                          darkMode: darkMode,
                          msg: msg,
                        });
                        return <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,background:cfg.bg,color:cfg.color}}>{cfg.t}</span>;
                      })()}
                    </div>
                    <div style={{fontSize:13,color:textMuted,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.email}</div>
                    {(() => {
                      var rA = rutinaAsignada;
                      var nD = rA ? (rA.datos?.days || []).length : 0;
                      var done = rA ? completedDays.filter(function (k) { return k.startsWith(rA.id + "-") && k.endsWith("-w" + currentWeek); }).length : 0;
                      if (!nD) return null;
                      var pct = Math.min(100, Math.round((done / nD) * 100));
                      return (
                        <div style={{marginTop:10}}>
                          <div style={{fontSize:12,fontWeight:700,color:textMuted,marginBottom:4}}>{done}/{nD} {msg("días esta semana", "days this week")}</div>
                          <div style={{height:6,background:coachAluTrack,borderRadius:4,overflow:"hidden"}}>
                            <div style={{width: pct + "%", height: "100%", background: "#22c55e", borderRadius: 4, transition: "width .2s ease"}}/>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:"auto"}}>
                    <button
                      className="hov"
                      style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={async function () {
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
                    >{alumnoActivo?.id === a.id ? (msg("CERRAR", "CLOSE", "FECHAR")) : msg("VER", "VIEW", "VER")}</button>
                    <div style={{position:"relative"}}>
                      <button
                        type="button"
                        className="hov"
                        aria-label={msg("Más opciones", "More options")}
                        style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}}
                        onClick={function (e) { e.stopPropagation(); setCoachCardMenuId(coachCardMenuId === a.id ? null : a.id); }}
                      >
                        <Ic name="more-vertical" size={18} color="currentColor"/>
                      </button>
                      {coachCardMenuId === a.id && (
                        <div
                          style={{position:"absolute",right:0,top:"100%",marginTop:6,background:coachAluDropdown,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:6,zIndex:30,minWidth:176,boxShadow:coachAluDropdownShadow}}
                          onClick={function (e) { e.stopPropagation(); }}
                        >
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:textMain,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () {
                              setCoachCardMenuId(null);
                              setCoachDialog({ t: 'editAlum', a: a });
                            }}
                          >
                            <Ic name="edit-2" size={16} color={textMuted}/> {msg("Editar", "Edit")}
                          </button>
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:textMain,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () { setCoachCardMenuId(null); setChatModal({ alumnoId: a.id, alumnoNombre: a.nombre || a.email || "Alumno" }); }}
                          >
                            <Ic name="message-circle" size={16} color="#2563eb"/> {msg("Mensaje", "Message")}
                          </button>
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f59e0b",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () {
                              setCoachCardMenuId(null);
                              setCoachDialog({ t: 'clearProgress', a: a });
                            }}
                          >
                            <Ic name="refresh-cw" size={16} color="#f59e0b"/> {msg("Limpiar historial de progreso", "Clear progress history")}
                          </button>
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f87171",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () {
                              setCoachCardMenuId(null);
                              setCoachDialog({ t: 'deleteAlumno', a: a });
                            }}
                          >
                            <Ic name="trash-2" size={16} color="#f87171"/> {msg("Eliminar", "Delete")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {alumnoActivo?.id===a.id&&(
                  <div>
                    {(()=>{
                      const rutinaActiva = getRutinaAsignadaAlumno(a.id);
                      if(!rutinaActiva) return <div style={{background:coachAluSurface,borderRadius:12,padding:"16px",marginBottom:8,textAlign:"center",border:"1px solid "+coachAluBorderSoft}}><div style={{fontSize:13,color:textMuted}}>{msg("Sin rutina asignada", "No routine assigned")}</div></div>;
                      const dias=rutinaActiva.datos?.days||[];
                      const semanaCiclo = currentWeek + 1;
                      const rId = rutinaActiva.id;
                      const diasCompletados = completedDays.filter(function(k){return k.startsWith(rId+"-") && k.endsWith("-w"+currentWeek)}).length;
                      const hoyDate = new Date();
                      const inicioSemana = new Date(hoyDate);
                      inicioSemana.setDate(hoyDate.getDate() - ((hoyDate.getDay()+6)%7));
                      const finSemana = new Date(inicioSemana);
                      finSemana.setDate(inicioSemana.getDate() + 6);
                      const semCalLabel = inicioSemana.getDate() + "/" + (inicioSemana.getMonth()+1) + " — " + finSemana.getDate() + "/" + (finSemana.getMonth()+1);
                      const pctBar = dias.length ? Math.min(100, Math.round((diasCompletados / dias.length) * 100)) : 0;
                      const diSel = dias.length ? Math.min(coachRoutineDiaIdx, Math.max(0, dias.length - 1)) : 0;
                      const dSel = dias[diSel] || { warmup: [], exercises: [], label: "" };
                      const proxTxt = (function(){
                        var proxDia, proxSemana;
                        if(diasCompletados >= dias.length) { proxDia = 1; proxSemana = semanaCiclo < 4 ? semanaCiclo + 1 : 1; }
                        else { proxDia = diasCompletados + 1; proxSemana = semanaCiclo; }
                        var proxLabel = dias[proxDia-1] ? (dias[proxDia-1].label || ("Día " + proxDia)) : ("Día " + proxDia);
                        return proxLabel + " · " + (msg("Semana ", "Week ")) + proxSemana + (semanaCiclo >= 4 && diasCompletados >= dias.length ? (msg(" (nuevo ciclo)", " (new cycle)")) : "");
                      })();
                      return(
                        <div style={{marginBottom:8}}>
                          <div style={{background:coachAluSurface,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"16px",position:"relative",boxShadow:darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.06)"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:24,fontWeight:900,color:textMain,lineHeight:1.15}}>{rutinaActiva.nombre}</div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10,alignItems:"center"}}>
                                  <span style={{fontSize:14,color:textMuted,fontWeight:600}}>{dias.length} {msg("días", "days")}</span>
                                  <span style={{padding:"4px 10px",borderRadius:8,background:darkMode?"rgba(59,130,246,0.15)":"rgba(37,99,235,0.1)",border:"1px solid "+(darkMode?"rgba(59,130,246,0.35)":"rgba(37,99,235,0.35)"),color:"#2563eb",fontSize:12,fontWeight:800}}>{msg("Semana", "Week")} {semanaCiclo} {msg("de", "of")} 4</span>
                                  <span style={{fontSize:13,color:textMuted,fontWeight:600}}>{semCalLabel}</span>
                                </div>
                              </div>
                              <div style={{position:"relative",flexShrink:0}}>
                                <button type="button" className="hov" aria-label={msg("Opciones de rutina", "Routine options")} style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}} onClick={function(){setCoachRutinaMenuOpen(function(o){return !o;});}}>
                                  <Ic name="more-vertical" size={18} color={textMuted}/>
                                </button>
                                {coachRutinaMenuOpen && (
                                  <div style={{position:"absolute",right:0,top:"100%",marginTop:6,background:coachAluDropdown,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:6,zIndex:40,minWidth:200,boxShadow:coachAluDropdownShadow}} onClick={function(e){e.stopPropagation();}}>
                                    <button type="button" className="hov" style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#fbbf24",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){
                                      setCoachDialog({ t: 'resetWeek', semanaCiclo: semanaCiclo });
                                    }}>
                                      <Ic name="refresh-cw" size={15} color="#fbbf24"/> {msg("Reiniciar semana", "Reset week")}
                                    </button>
                                    <button type="button" className="hov" style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){
                                      setCoachDialog({ t: 'resetRoutine' });
                                    }}>
                                      <Ic name="refresh-cw" size={15} color="#f87171"/> {msg("Reiniciar rutina", "Reset routine")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{marginBottom:12}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                                <span style={{fontSize:14,fontWeight:700,color:textMain}}>{diasCompletados} {msg("de", "of")} {dias.length} {msg("días completados", "days completed")}</span>
                                <span style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>{pctBar}%</span>
                              </div>
                              <div style={{height:12,background:coachAluTrack,borderRadius:8,overflow:"hidden"}}>
                                <div style={{width:pctBar+"%",height:"100%",background:"linear-gradient(90deg,#22c55e,#16a34a)",borderRadius:8,transition:"width .25s ease"}}/>
                              </div>
                            </div>
                            <div style={{marginBottom:14,padding:"10px 12px",background:darkMode?"rgba(59,130,246,0.06)":"rgba(37,99,235,0.06)",border:"1px solid "+(darkMode?"rgba(59,130,246,0.2)":"rgba(37,99,235,0.2)"),borderRadius:10}}>
                              <span style={{fontSize:13,color:textMuted,fontWeight:600}}>{msg("Próxima sesión:", "Next session:")} </span>
                              <span style={{fontSize:13,color:textMain,fontWeight:700}}>{proxTxt}</span>
                            </div>
                            {dias.length > 0 && (
                              <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:14,paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
                                {dias.map(function(d, di){
                                  var dayDone = completedDays.includes(rId+"-"+di+"-w"+currentWeek);
                                  var active = di === diSel;
                                  return (
                                    <button
                                      key={(rutinaActiva?.id||"rut")+"-tab-"+di}
                                      type="button"
                                      className="hov"
                                      onClick={function(){ setCoachRoutineDiaIdx(di); }}
                                      style={{
                                        flexShrink:0,
                                        padding:"10px 14px",
                                        borderRadius:10,
                                        border:active?"2px solid #2563eb":"1px solid "+coachAluBorderSoft,
                                        background:active?(darkMode?"rgba(59,130,246,0.18)":"rgba(37,99,235,0.12)"):coachAluSubtle,
                                        color:active?textMain:textMuted,
                                        fontSize:13,
                                        fontWeight:800,
                                        cursor:"pointer",
                                        fontFamily:"inherit",
                                        display:"flex",
                                        alignItems:"center",
                                        gap:6,
                                      }}
                                    >
                                      {msg("Día ", "Day ")}{di+1}
                                      {dayDone ? <Ic name="check-sm" size={14} color="#22c55e"/> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {dias.length > 0 && (
                              <div style={{background:coachAluSubtle,borderRadius:12,border:"1px solid "+coachAluBorderSoft,padding:"12px"}}>
                                <div style={{fontSize:12,fontWeight:800,color:textMuted,marginBottom:10}}>{dSel.label || ((msg("Día ", "Day "))+(diSel+1))} · {((dSel.warmup||[]).length+(dSel.exercises||[]).length)} {msg("ej.", "ex.")}</div>
                                <div style={{marginBottom:12}}>
                                    <button type="button" className="hov" onClick={function(){ setCoachDiaSecsOpen(function(o){ return {...o, warmup:!o.warmup}; }); }} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                                      <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
                                      <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.warmup?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                                    </button>
                                    {coachDiaSecsOpen.warmup && (
                                      <div>
                                        {(dSel.warmup||[]).map((ex,ei)=>{
                                          const exInfo=allEx.find(e=>e.id===ex.id);
                                          const nombre=resolveExerciseTitle(exInfo||null,ex,es);
                                          return <div key={(rutinaActiva?.id||"rut")+"-d"+diSel+"-wu-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:ei<(dSel.warmup||[]).length-1?"1px solid "+coachAluBorderSoft:"none"}}>
                                            <div style={{flex:1,fontSize:14,fontWeight:600,color:textMain}}>{nombre}</div>
                                            <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                                            <button className="hov" onClick={()=>setEditEx({rId:rutinaActiva.id,dIdx:diSel,eIdx:ei,bloque:"warmup",ex:{...ex}})} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                                          </div>;
                                        })}
                                        <button className="hov" onClick={()=>{setAddExModal({rId:rutinaActiva.id,dIdx:diSel,bloque:"warmup"});setAddExSearch("");setAddExPat(null);setAddExMuscle(null);setAddExSelectedIds([]);}} style={{width:"100%",marginTop:6,padding:"8px",background:"transparent",border:"1px dashed rgba(245,158,11,0.45)",borderRadius:8,fontSize:12,fontWeight:700,color:"#f59e0b",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={14} color="#f59e0b"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                                      </div>
                                    )}
                                </div>
                                <button type="button" className="hov" onClick={function(){ setCoachDiaSecsOpen(function(o){ return {...o, main:!o.main}; }); }} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                                  <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
                                  <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.main?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                                </button>
                                {coachDiaSecsOpen.main && (
                                  <div>
                                    {(dSel.exercises||[]).map((ex,ei)=>{
                                      const exInfo=allEx.find(e=>e.id===ex.id);
                                      const nombre=resolveExerciseTitle(exInfo||null,ex,es);
                                      return <div key={(rutinaActiva?.id||"rut")+"-d"+diSel+"-ex-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:ei<(dSel.exercises||[]).length-1?"1px solid "+coachAluBorderSoft:"none"}}>
                                        <div style={{flex:1,fontSize:15,fontWeight:700,color:textMain}}>{nombre}</div>
                                        <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                                        <button className="hov" onClick={()=>setEditEx({rId:rutinaActiva.id,dIdx:diSel,eIdx:ei,bloque:"exercises",ex:{...ex}})} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                                      </div>;
                                    })}
                                    <button className="hov" onClick={()=>{setAddExModal({rId:rutinaActiva.id,dIdx:diSel,bloque:"exercises"});setAddExSearch("");setAddExPat(null);setAddExMuscle(null);setAddExSelectedIds([]);}} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",border:"1px dashed rgba(59,130,246,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#3b82f6",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={15} color="#3b82f6"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{display:"flex",gap:8,marginTop:14}}>
                              <button className="hov" style={{flex:2,padding:"10px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMain,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={function () {
                                var rut = {id:rutinaActiva.id,...(rutinaActiva.datos||{}),name:rutinaActiva.nombre,saved:true,alumno_id:a.id,alumno:a.nombre};
                                setCoachDialog({ t: 'goRoutines', rutinaActiva: rutinaActiva, a: a, rutina: rut });
                              }}><Ic name="edit-2" size={16} color={textMuted}/>{msg("Editar rutina", "Edit routine")}</button>
                              <button className="hov" style={{padding:"10px 16px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={function () {
                                setCoachDialog({ t: 'quitarRut', rutinaActiva: rutinaActiva, a: a });
                              }}><Ic name="trash-2" size={15}/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={function () {
                      const rutinaLocal = routineForAssign;
                      if (!rutinaLocal) {
                        toast2(msg('Creá una rutina en RUTINAS', 'Create a routine in ROUTINES', 'Crie uma rotina em ROTINAS'));
                        return;
                      }
                      const ex0 = getRutinaAsignadaAlumno(a.id);
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
                    }}>{getRutinaAsignadaAlumno(a.id)?(<><Ic name="refresh-cw" size={16}/>{msg("Cambiar rutina", "Change routine")}</>):(<><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</>)}</button>
                    {/* ── SUGERENCIAS ── */}
                    {(()=>{
                      const rutSB = getRutinaAsignadaAlumno(a.id);
                      const regsAlu = alumnoProgreso || [];
                      if(!rutSB || regsAlu.length < 2) return null;
                      const sugs = generarSugerenciasAlumno(regsAlu, rutSB.datos, EX);
                      if(sugs.length === 0) return null;
                      var open = !!sugsOpen[a.id];
                      const colores = {
                        subir: {icon:(<Ic name="trending-up" size={16} color="#22C55E"/>),bg:"#22C55E12",border:"#22C55E33",color:"#22C55E",btnBg:"#22C55E"},
                        bajar: {icon:(<Ic name="trending-up" size={16} color="#EF4444" style={{transform:"rotate(180deg)"}}/>),bg:"#EF444412",border:"#EF444433",color:"#EF4444",btnBg:"#EF4444"},
                        ajustar: {icon:(<Ic name="zap" size={16} color="#F59E0B"/>),bg:"#F59E0B12",border:"#F59E0B33",color:"#F59E0B",btnBg:"#F59E0B"},
                        cambiar: {icon:(<Ic name="refresh-cw" size={16} color="#2563EB"/>),bg:"#2563EB12",border:"#2563EB33",color:"#2563EB",btnBg:"#2563EB"},
                        mantener: {icon:(<Ic name="chevron-right" size={16} color={textMuted}/>),bg:bgSub,border:border,color:textMuted,btnBg:"#2563EB"}
                      };
                      return (
                        <div style={{marginTop:12,marginBottom:8}}>
                          <button
                            type="button"
                            className="hov"
                            onClick={function(){ setSugsOpen(function(prev){ return {...prev, [a.id]: !prev[a.id]}; }); }}
                            style={{
                              width:"100%",
                              background:bgSub,
                              border:"1px solid "+border,
                              borderRadius:12,
                              padding:"10px 12px",
                              cursor:"pointer",
                              display:"flex",
                              alignItems:"center",
                              justifyContent:"space-between",
                              gap:10
                            }}
                          >
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <Ic name="info" size={16} color="#F59E0B"/>
                              <div style={{fontSize:11,fontWeight:800,color:"#F59E0B",letterSpacing:2,textTransform:"uppercase"}}>{msg("SUGERENCIAS", "SUGGESTIONS")}</div>
                              <span style={{fontSize:12,fontWeight:800,color:textMuted,background:"#F59E0B12",border:"1px solid #F59E0B33",borderRadius:999,padding:"2px 8px"}}>{sugs.length}</span>
                            </div>
                            <Ic
                              name="chevron-right"
                              size={18}
                              color={textMuted}
                              style={{transition:"transform .18s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)"}}
                            />
                          </button>
                          {open && (
                            <div style={{marginTop:10,maxHeight:260,overflowY:"auto",paddingRight:4}}>
                              {sugs.map(function(sug,si){
                                var c = colores[sug.tipo] || colores.mantener;
                                var sugKey = a.id+"-sug-"+(sug.exId||"ex")+"-"+sug.dIdx+"-"+sug.eIdx+"-"+sug.tipo;
                                return (
                                  <div key={sugKey} id={sugKey} style={{background:c.bg,border:"1px solid "+c.border,borderRadius:12,padding:"12px",marginBottom:8}}>
                                    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                                      <div style={{flexShrink:0,marginTop:1}}>{c.icon}</div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:13,fontWeight:800,color:c.color,marginBottom:2}}>{sug.nombre}</div>
                                        <div style={{fontSize:14,fontWeight:700,color:textMain}}>{sug.accion}</div>
                                        <div style={{fontSize:12,color:textMuted,marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                                          <Ic name="chevron-right" size={12} color={textMuted}/>
                                          {sug.ajuste}
                                        </div>
                                        <div style={{display:"flex",gap:8,marginTop:8}}>
                                          <button className="hov" onClick={function(){
                                            var exConSug = {...sug.exData};
                                            if(sug.sugKg) exConSug.kg = sug.sugKg;
                                            if(sug.sugReps) exConSug.reps = sug.sugReps;
                                            if(sug.sugSets) exConSug.sets = sug.sugSets;
                                            if(sug.sugPause) exConSug.pause = sug.sugPause;
                                            setEditEx({rId:rutSB.id,dIdx:sug.dIdx,eIdx:sug.eIdx,bloque:sug.bloque,ex:exConSug});
                                          }} style={{padding:"5px 14px",background:c.btnBg,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{msg("APLICAR", "APPLY")}</button>
                                          <button className="hov" onClick={function(){
                                            var el=document.getElementById(sugKey);
                                            if(el){el.style.opacity="0";el.style.height="0";el.style.padding="0";el.style.margin="0";el.style.overflow="hidden";el.style.transition="all .3s ease";}
                                          }} style={{padding:"5px 14px",background:"transparent",color:textMuted,border:"1px solid "+border,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("IGNORAR", "IGNORE")}</button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
                        textTransform:"uppercase",marginBottom:8}}>
                        <Ic name="bookmark" size={14} color={textMuted}/> {msg("Nota del día", "Daily note")}
                      </div>
                      <textarea
                        style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
                          borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
                          resize:"none",lineHeight:1.5,outline:"none",minHeight:80}}
                        placeholder={msg("Escribí una nota, recordatorio o indicación para el alumno...", "Write a note, reminder or instruction for this athlete...")}
                        value={notaDiaInput}
                        onChange={e=>setNotaDiaInput(e.target.value)}
                      />
                      <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
                        background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
                        fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={async()=>{
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
                        }}>
                        {msg("Enviar nota", "Send note")}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )})}
          </div>
  );
}
