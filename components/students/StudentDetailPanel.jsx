import React from 'react';
import { Ic } from '../Ic.jsx';

export default function StudentDetailPanel({
  alumno,
  rutinaActiva,
  routineForAssign,
  dias = [],
  rId,
  weeklyProgress,
  semanaCiclo,
  semanaIdx,
  diasCompletados,
  semCalLabel,
  pctBar,
  diSel,
  dSel,
  proxTxt,
  warmupItems = [],
  exerciseItems = [],
  sugs = [],
  rutSB,
  suggestionsOpen,
  completedDays = [],
  coachRutinaMenuOpen,
  coachDiaSecsOpen = {},
  notaDiaInput,
  darkMode,
  es,
  msg,
  textMain,
  textMuted,
  bgSub,
  border,
  coachAluSurface,
  coachAluBorderSoft,
  coachAluTrack,
  coachAluSubtle,
  coachAluDropdown,
  coachAluDropdownShadow,
  coachAluGhostBtn,
  onToggleRoutineMenu,
  onResetWeek,
  onResetRoutine,
  onSelectDay,
  onToggleWarmup,
  onToggleMain,
  onEditWarmupExercise,
  onAddWarmupExercise,
  onEditMainExercise,
  onAddMainExercise,
  onEditRoutine,
  onRemoveRoutine,
  onAssignRoutine,
  onToggleSuggestions,
  onApplySuggestion,
  onIgnoreSuggestion,
  onNotaChange,
  onEnviarNota,
}) {
  if(!rutinaActiva) {
    return (
      <div>
        <div style={{background:coachAluSurface,borderRadius:12,padding:"16px",marginBottom:8,textAlign:"center",border:"1px solid "+coachAluBorderSoft}}>
          <div style={{fontSize:13,color:textMuted}}>{msg("Sin rutina asignada", "No routine assigned")}</div>
        </div>
        <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={onAssignRoutine}><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</button>
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
            onChange={onNotaChange}
          />
          <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
            background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
            fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={onEnviarNota}>
            {msg("Enviar nota", "Send note")}
          </button>
        </div>
      </div>
    );
  }

  const colores = {
    subir: {icon:(<Ic name="trending-up" size={16} color="#22C55E"/>),bg:"#22C55E12",border:"#22C55E33",color:"#22C55E",btnBg:"#22C55E"},
    bajar: {icon:(<Ic name="trending-up" size={16} color="#EF4444" style={{transform:"rotate(180deg)"}}/>),bg:"#EF444412",border:"#EF444433",color:"#EF4444",btnBg:"#EF4444"},
    ajustar: {icon:(<Ic name="zap" size={16} color="#F59E0B"/>),bg:"#F59E0B12",border:"#F59E0B33",color:"#F59E0B",btnBg:"#F59E0B"},
    cambiar: {icon:(<Ic name="refresh-cw" size={16} color="#2563EB"/>),bg:"#2563EB12",border:"#2563EB33",color:"#2563EB",btnBg:"#2563EB"},
    mantener: {icon:(<Ic name="chevron-right" size={16} color={textMuted}/>),bg:bgSub,border:border,color:textMuted,btnBg:"#2563EB"}
  };

  return (
    <div>
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
              <button type="button" className="hov" aria-label={msg("Opciones de rutina", "Routine options")} style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}} onClick={onToggleRoutineMenu}>
                <Ic name="more-vertical" size={18} color={textMuted}/>
              </button>
              {coachRutinaMenuOpen && (
                <div style={{position:"absolute",right:0,top:"100%",marginTop:6,background:coachAluDropdown,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:6,zIndex:40,minWidth:200,boxShadow:coachAluDropdownShadow}} onClick={function(e){e.stopPropagation();}}>
                  <button type="button" className="hov" style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#fbbf24",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={onResetWeek}>
                    <Ic name="refresh-cw" size={15} color="#fbbf24"/> {msg("Reiniciar semana", "Reset week")}
                  </button>
                  <button type="button" className="hov" style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={onResetRoutine}>
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
                var dayDone = weeklyProgress.completedDayIndexes.indexOf(di) !== -1 || (!weeklyProgress.sesiones.length && completedDays.includes(rId+"-"+di+"-w"+semanaIdx));
                var active = di === diSel;
                return (
                  <button
                    key={(rutinaActiva?.id||"rut")+"-tab-"+di}
                    type="button"
                    className="hov"
                    onClick={function(){ onSelectDay(di); }}
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
                  <button type="button" className="hov" onClick={onToggleWarmup} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
                    <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.warmup?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                  </button>
                  {coachDiaSecsOpen.warmup && (
                    <div>
                      {warmupItems.map(function(item){
                        var ex = item.ex;
                        return <div key={item.key} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:!item.isLast?"1px solid "+coachAluBorderSoft:"none"}}>
                          <div style={{flex:1,fontSize:14,fontWeight:600,color:textMain}}>{item.nombre}</div>
                          <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                          <button className="hov" onClick={function(){onEditWarmupExercise(item);}} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                        </div>;
                      })}
                      <button className="hov" onClick={onAddWarmupExercise} style={{width:"100%",marginTop:6,padding:"8px",background:"transparent",border:"1px dashed rgba(245,158,11,0.45)",borderRadius:8,fontSize:12,fontWeight:700,color:"#f59e0b",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={14} color="#f59e0b"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                    </div>
                  )}
              </div>
              <button type="button" className="hov" onClick={onToggleMain} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
                <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.main?"rotate(90deg)":"none",transition:"transform .2s"}}/>
              </button>
              {coachDiaSecsOpen.main && (
                <div>
                  {exerciseItems.map(function(item){
                    var ex = item.ex;
                    return <div key={item.key} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:!item.isLast?"1px solid "+coachAluBorderSoft:"none"}}>
                      <div style={{flex:1,fontSize:15,fontWeight:700,color:textMain}}>{item.nombre}</div>
                      <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                      <button className="hov" onClick={function(){onEditMainExercise(item);}} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                    </div>;
                  })}
                  <button className="hov" onClick={onAddMainExercise} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",border:"1px dashed rgba(59,130,246,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#3b82f6",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={15} color="#3b82f6"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                </div>
              )}
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button className="hov" style={{flex:2,padding:"10px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMain,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={onEditRoutine}><Ic name="edit-2" size={16} color={textMuted}/>{msg("Editar rutina", "Edit routine")}</button>
            <button className="hov" style={{padding:"10px 16px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={onRemoveRoutine}><Ic name="trash-2" size={15}/></button>
          </div>
        </div>
      </div>
      <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={onAssignRoutine}>{rutinaActiva?(<><Ic name="refresh-cw" size={16}/>{msg("Cambiar rutina", "Change routine")}</>):(<><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</>)}</button>
      {rutSB && sugs.length > 0 && (
        <div style={{marginTop:12,marginBottom:8}}>
          <button
            type="button"
            className="hov"
            onClick={onToggleSuggestions}
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
              style={{transition:"transform .18s ease", transform: suggestionsOpen ? "rotate(90deg)" : "rotate(0deg)"}}
            />
          </button>
          {suggestionsOpen && (
            <div style={{marginTop:10,maxHeight:260,overflowY:"auto",paddingRight:4}}>
              {sugs.map(function(sug,si){
                var c = colores[sug.tipo] || colores.mantener;
                var sugKey = alumno.id+"-sug-"+(sug.exId||"ex")+"-"+sug.dIdx+"-"+sug.eIdx+"-"+sug.tipo;
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
                          <button className="hov" onClick={function(){onApplySuggestion(sug);}} style={{padding:"5px 14px",background:c.btnBg,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{msg("APLICAR", "APPLY")}</button>
                          <button className="hov" onClick={function(){onIgnoreSuggestion(sugKey);}} style={{padding:"5px 14px",background:"transparent",color:textMuted,border:"1px solid "+border,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("IGNORAR", "IGNORE")}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
          onChange={onNotaChange}
        />
        <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
          background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
          fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onEnviarNota}>
          {msg("Enviar nota", "Send note")}
        </button>
      </div>
    </div>
  );
}
