import React from 'react';
import { Ic } from '../Ic.jsx';
import StudentRoutinePreview from './StudentRoutinePreview.jsx';

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
      <StudentRoutinePreview
        alumno={alumno}
        rutinaAsignada={rutinaActiva}
        dias={dias}
        rId={rId}
        progresoSemanal={weeklyProgress}
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
        completedDays={completedDays}
        coachRutinaMenuOpen={coachRutinaMenuOpen}
        coachDiaSecsOpen={coachDiaSecsOpen}
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
        onToggleRoutineMenu={onToggleRoutineMenu}
        onResetWeek={onResetWeek}
        onResetRoutine={onResetRoutine}
        onSelectDay={onSelectDay}
        onToggleWarmup={onToggleWarmup}
        onToggleMain={onToggleMain}
        onEditWarmupExercise={onEditWarmupExercise}
        onAddWarmupExercise={onAddWarmupExercise}
        onEditMainExercise={onEditMainExercise}
        onAddMainExercise={onAddMainExercise}
        onEditRoutine={onEditRoutine}
        onRemoveRoutine={onRemoveRoutine}
      />
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
