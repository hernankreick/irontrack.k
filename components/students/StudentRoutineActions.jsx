import React from 'react';
import { Ic } from '../Ic.jsx';

export default function StudentRoutineActions({
  variant,
  hasRoutine,
  isMenuOpen,
  msg,
  textMain,
  textMuted,
  coachAluBorderSoft,
  coachAluSubtle,
  coachAluDropdown,
  coachAluDropdownShadow,
  coachAluGhostBtn,
  onToggleMenu,
  onResetWeek,
  onResetRoutine,
  onEditRoutine,
  onRemoveRoutine,
  onAssignRoutine,
}) {
  if (variant === "menu") {
    return (
      <div style={{position:"relative",flexShrink:0}}>
        <button type="button" className="hov" aria-label={msg("Opciones de rutina", "Routine options")} style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}} onClick={onToggleMenu}>
          <Ic name="more-vertical" size={18} color={textMuted}/>
        </button>
        {isMenuOpen && (
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
    );
  }

  if (variant === "editRemove") {
    return (
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button className="hov" style={{flex:2,padding:"10px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMain,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={onEditRoutine}><Ic name="edit-2" size={16} color={textMuted}/>{msg("Editar rutina", "Edit routine")}</button>
        <button className="hov" style={{padding:"10px 16px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={onRemoveRoutine}><Ic name="trash-2" size={15}/></button>
      </div>
    );
  }

  if (variant === "assign") {
    return (
      <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={onAssignRoutine}>{hasRoutine?(<><Ic name="refresh-cw" size={16}/>{msg("Cambiar rutina", "Change routine")}</>):(<><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</>)}</button>
    );
  }

  return null;
}
